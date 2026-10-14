import 'server-only';
import { createReadStream, createWriteStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { AbortMultipartUploadCommand, CompleteMultipartUploadCommand, CreateMultipartUploadCommand, DeleteObjectCommand, DeleteObjectsCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client, UploadPartCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from './env';

let client: S3Client | null = null;

export type R2BucketKind = 'assets' | 'media';

export function r2BucketName(kind: R2BucketKind) {
  return kind === 'assets' ? env.R2_ASSETS_BUCKET : env.R2_MEDIA_BUCKET;
}

export function r2BucketForAssetKind(kind: string): R2BucketKind {
  return ['poster', 'backdrop', 'avatar', 'other'].includes(kind) ? 'assets' : 'media';
}

export function r2BucketKindFromName(bucketName: unknown): R2BucketKind {
  if (bucketName === env.R2_ASSETS_BUCKET) return 'assets';
  if (bucketName === env.R2_MEDIA_BUCKET) return 'media';
  throw Object.assign(new Error('The asset references an unexpected storage bucket.'), { status: 409, code: 'INVALID_STORAGE_BUCKET' });
}

export function r2Configured(kind?: R2BucketKind) {
  const credentials = Boolean(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY);
  return credentials && (!kind || Boolean(r2BucketName(kind)));
}

export function getR2Client() {
  if (!r2Configured()) throw Object.assign(new Error('Object storage is not configured'), { status: 503, code: 'STORAGE_UNAVAILABLE' });
  client ??= new S3Client({
    region: 'auto',
    endpoint: env.R2_ENDPOINT ?? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID!, secretAccessKey: env.R2_SECRET_ACCESS_KEY! },
  });
  return client;
}

export async function signedDownloadUrl(key: string, fileName: string, expiresIn = 90, bucket: R2BucketKind = 'media') {
  const command = new GetObjectCommand({ Bucket: r2BucketName(bucket), Key: key, ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}` });
  return getSignedUrl(getR2Client(), command, { expiresIn });
}

export async function signedStreamUrl(key: string, contentType?: string, expiresIn = 600, bucket: R2BucketKind = 'media') {
  const command = new GetObjectCommand({ Bucket: r2BucketName(bucket), Key: key, ResponseContentType: contentType, ResponseContentDisposition: 'inline' });
  return getSignedUrl(getR2Client(), command, { expiresIn });
}

export async function signedUploadUrl(key: string, contentType: string, metadata: Record<string, string>, expiresIn = 600, bucket: R2BucketKind = 'media') {
  const command = new PutObjectCommand({ Bucket: r2BucketName(bucket), Key: key, ContentType: contentType, Metadata: metadata });
  return getSignedUrl(getR2Client(), command, { expiresIn });
}

export async function createMultipartObject(key: string, contentType: string, metadata: Record<string, string>, bucket: R2BucketKind = 'media') {
  const response = await getR2Client().send(new CreateMultipartUploadCommand({ Bucket: r2BucketName(bucket), Key: key, ContentType: contentType, Metadata: metadata }));
  if (!response.UploadId) throw Object.assign(new Error('R2 did not create a multipart upload.'), { status: 502, code: 'MULTIPART_START_FAILED' });
  return response.UploadId;
}

export async function signedMultipartPartUrl(key: string, uploadId: string, partNumber: number, expiresIn = 900, bucket: R2BucketKind = 'media') {
  const command = new UploadPartCommand({ Bucket: r2BucketName(bucket), Key: key, UploadId: uploadId, PartNumber: partNumber });
  return getSignedUrl(getR2Client(), command, { expiresIn });
}

export async function completeMultipartObject(key: string, uploadId: string, parts: { ETag: string; PartNumber: number }[], bucket: R2BucketKind = 'media') {
  return getR2Client().send(new CompleteMultipartUploadCommand({ Bucket: r2BucketName(bucket), Key: key, UploadId: uploadId, MultipartUpload: { Parts: parts } }));
}

export async function abortMultipartObject(key: string, uploadId: string, bucket: R2BucketKind = 'media') {
  await getR2Client().send(new AbortMultipartUploadCommand({ Bucket: r2BucketName(bucket), Key: key, UploadId: uploadId }));
}

export async function inspectObject(key: string, bucket: R2BucketKind = 'media') {
  return getR2Client().send(new HeadObjectCommand({ Bucket: r2BucketName(bucket), Key: key }));
}

export async function writeObjectBytes(key: string, bytes: Uint8Array, contentType: string, bucket: R2BucketKind, metadata?: Record<string, string>) {
  return getR2Client().send(new PutObjectCommand({ Bucket: r2BucketName(bucket), Key: key, Body: bytes, ContentType: contentType, Metadata: metadata }));
}

export async function uploadObjectFile(key: string, filePath: string, contentType: string, bucket: R2BucketKind = 'media') {
  const info = await stat(filePath);
  await getR2Client().send(new PutObjectCommand({ Bucket: r2BucketName(bucket), Key: key, Body: createReadStream(filePath), ContentLength: info.size, ContentType: contentType }));
  return info.size;
}

export async function downloadObjectFile(key: string, filePath: string, bucket: R2BucketKind = 'media') {
  const response = await getR2Client().send(new GetObjectCommand({ Bucket: r2BucketName(bucket), Key: key }));
  if (!response.Body) throw Object.assign(new Error('Stored object could not be read.'), { status: 422, code: 'OBJECT_UNREADABLE' });
  await pipeline(response.Body as NodeJS.ReadableStream, createWriteStream(filePath));
}

export async function readObjectStream(key: string, bucket: R2BucketKind = 'media') {
  const response = await getR2Client().send(new GetObjectCommand({ Bucket: r2BucketName(bucket), Key: key }));
  if (!response.Body) throw Object.assign(new Error('Stored object could not be read.'), { status: 404, code: 'OBJECT_NOT_FOUND' });
  return {
    body: response.Body.transformToWebStream(),
    contentLength: response.ContentLength,
    contentType: response.ContentType,
    etag: response.ETag,
  };
}

export async function readObjectBytes(key: string, bucket: R2BucketKind = 'media') {
  const response = await getR2Client().send(new GetObjectCommand({ Bucket: r2BucketName(bucket), Key: key }));
  if (!response.Body) throw Object.assign(new Error('Stored object could not be read.'), { status: 422, code: 'OBJECT_UNREADABLE' });
  return response.Body.transformToByteArray();
}

export async function deleteObject(key: string, bucket: R2BucketKind = 'media') {
  await getR2Client().send(new DeleteObjectCommand({ Bucket: r2BucketName(bucket), Key: key }));
}

export async function listObjectKeys(bucket: R2BucketKind, limit = 10_000) {
  const keys: string[] = [];
  let continuationToken: string | undefined;
  do {
    const page = await getR2Client().send(new ListObjectsV2Command({ Bucket: r2BucketName(bucket), ContinuationToken: continuationToken, MaxKeys: Math.min(1_000, limit - keys.length) }));
    for (const object of page.Contents ?? []) if (object.Key) keys.push(object.Key);
    continuationToken = page.IsTruncated && keys.length < limit ? page.NextContinuationToken : undefined;
  } while (continuationToken);
  return { bucket: r2BucketName(bucket), keys, capped: keys.length >= limit };
}

export async function listObjectKeysByPrefix(prefix: string, bucket: R2BucketKind = 'media', limit = 10_000) {
  const keys: string[] = [];
  let continuationToken: string | undefined;
  do {
    const page = await getR2Client().send(new ListObjectsV2Command({
      Bucket: r2BucketName(bucket), Prefix: prefix, ContinuationToken: continuationToken, MaxKeys: Math.min(1_000, limit - keys.length),
    }));
    for (const object of page.Contents ?? []) if (object.Key) keys.push(object.Key);
    continuationToken = page.IsTruncated && keys.length < limit ? page.NextContinuationToken : undefined;
  } while (continuationToken);
  return { keys, capped: keys.length >= limit };
}

export async function deleteObjectPrefix(prefix: string, bucket: R2BucketKind = 'media') {
  const listed = await listObjectKeysByPrefix(prefix, bucket, 50_000);
  if (listed.capped) throw Object.assign(new Error('Stream package is too large for one deletion operation.'), { status: 409, code: 'DELETE_LIMIT_REACHED' });
  for (let offset = 0; offset < listed.keys.length; offset += 1_000) {
    const keys = listed.keys.slice(offset, offset + 1_000);
    if (keys.length) await getR2Client().send(new DeleteObjectsCommand({ Bucket: r2BucketName(bucket), Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true } }));
  }
  return listed.keys.length;
}

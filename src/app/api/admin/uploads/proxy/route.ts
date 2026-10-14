import { resolvePublicAssetUrl } from '@/lib/assets';
import { assertMutationRequest, requirePermission } from '@/lib/auth';
import { connectDb } from '@/lib/db';
import { apiError } from '@/lib/http';
import { deleteObject, r2BucketForAssetKind, r2BucketName, writeObjectBytes } from '@/lib/r2';
import { buildStorageObjectKey, sanitizeStorageFileName } from '@/lib/storage-key';
import { presignUploadSchema, uploadLimitFor, validateSubtitleArchive } from '@/lib/validation/upload';
import { AuditLog, MediaAsset } from '@/models';

async function readRequestBytes(request: Request, maximumBytes: number) {
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw Object.assign(new Error('The uploaded file is larger than allowed.'), { status: 413, code: 'UPLOAD_TOO_LARGE' });
  }
  if (!request.body) throw Object.assign(new Error('The upload body is empty.'), { status: 400, code: 'EMPTY_UPLOAD' });

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel();
      throw Object.assign(new Error('The uploaded file is larger than allowed.'), { status: 413, code: 'UPLOAD_TOO_LARGE' });
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const input = presignUploadSchema.parse({
      kind: url.searchParams.get('kind'),
      purpose: url.searchParams.get('purpose') || undefined,
      fileName: url.searchParams.get('fileName'),
      contentType: url.searchParams.get('contentType'),
      size: Number(url.searchParams.get('size')),
      checksum: url.searchParams.get('checksum') || undefined,
      linkedModel: url.searchParams.get('linkedModel') || undefined,
      linkedId: url.searchParams.get('linkedId') || undefined,
    });
    if (input.kind === 'media') {
      throw Object.assign(new Error('Video files must use the resumable media uploader.'), { status: 400, code: 'PROXY_MEDIA_UNSUPPORTED' });
    }

    const session = await requirePermission(input.kind === 'subtitle' ? 'subtitles.create' : 'media.upload');
    await assertMutationRequest(request, session);

    const requestType = String(request.headers.get('content-type') || '').split(';', 1)[0].trim().toLocaleLowerCase();
    if (requestType !== input.contentType.toLocaleLowerCase()) {
      throw Object.assign(new Error('The uploaded file type did not match the request.'), { status: 422, code: 'UPLOAD_MISMATCH' });
    }

    const bytes = await readRequestBytes(request, Math.min(input.size, uploadLimitFor(input.kind)));
    if (bytes.byteLength !== input.size) {
      throw Object.assign(new Error('The uploaded file size did not match the request.'), { status: 422, code: 'UPLOAD_MISMATCH' });
    }

    let archiveMetadata: Record<string, number> | undefined;
    if (input.kind === 'subtitle' && input.fileName.toLocaleLowerCase().endsWith('.zip')) {
      archiveMetadata = await validateSubtitleArchive(bytes);
    }

    const safeInput = { ...input, fileName: sanitizeStorageFileName(input.fileName) };
    const bucketKind = r2BucketForAssetKind(safeInput.kind);
    const objectKey = buildStorageObjectKey(safeInput);
    const isPublic = ['poster', 'backdrop', 'avatar', 'other'].includes(safeInput.kind);
    const publicUrl = isPublic ? resolvePublicAssetUrl(objectKey) : undefined;
    if (isPublic && !publicUrl) {
      throw Object.assign(new Error('PUBLIC_ASSET_DOMAIN is required to publish uploaded artwork.'), { status: 503, code: 'PUBLIC_ASSET_DOMAIN_REQUIRED' });
    }

    await connectDb();
    const asset = await MediaAsset.create({
      objectKey,
      bucket: r2BucketName(bucketKind),
      kind: safeInput.kind,
      fileName: safeInput.fileName,
      mimeType: safeInput.contentType,
      size: safeInput.size,
      checksum: safeInput.checksum,
      status: 'pending',
      linkedModel: safeInput.linkedModel,
      linkedId: safeInput.linkedId,
      uploadedBy: session.user.id,
      metadata: { requestedAt: new Date(), bucketKind, purpose: safeInput.purpose, uploadMode: 'server_proxy' },
    });

    let objectWritten = false;
    try {
      const stored = await writeObjectBytes(objectKey, bytes, safeInput.contentType, bucketKind, {
        assetid: String(asset._id),
        uploader: session.user.id,
        purpose: safeInput.purpose,
      });
      objectWritten = true;
      asset.status = 'active';
      asset.metadata = {
        ...(asset.metadata as Record<string, unknown> | undefined),
        etag: stored.ETag,
        verifiedAt: new Date(),
        ...archiveMetadata,
      };
      await asset.save();
      await AuditLog.create({
        actor: session.user.id,
        action: 'media.server_upload',
        entity: 'MediaAsset',
        entityId: String(asset._id),
        metadata: { kind: asset.kind, objectKey: asset.objectKey, bucket: asset.bucket, size: asset.size },
      });
      return Response.json({
        asset: {
          id: String(asset._id),
          objectKey: asset.objectKey,
          bucket: asset.bucket,
          kind: asset.kind,
          fileName: asset.fileName,
          size: asset.size,
          status: asset.status,
          publicUrl,
        },
      }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      if (objectWritten) await deleteObject(objectKey, bucketKind).catch(() => undefined);
      await MediaAsset.deleteOne({ _id: asset._id }).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    return apiError(error);
  }
}

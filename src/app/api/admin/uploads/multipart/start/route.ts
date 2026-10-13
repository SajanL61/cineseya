import { assertMutationRequest, requirePermission } from '@/lib/auth';
import { connectDb } from '@/lib/db';
import { apiError } from '@/lib/http';
import { createMultipartObject, r2BucketName } from '@/lib/r2';
import { presignUploadSchema } from '@/lib/validation/upload';
import { AuditLog, MediaAsset } from '@/models';
import { buildStorageObjectKey, sanitizeStorageFileName } from '@/lib/storage-key';

export async function POST(request: Request) {
  try {
    const session = await requirePermission('media.upload');
    await assertMutationRequest(request, session);
    const input = presignUploadSchema.parse(await request.json());
    if (input.kind !== 'media') throw Object.assign(new Error('Multipart upload is available only for authorized media.'), { status: 400, code: 'INVALID_UPLOAD_KIND' });
    await connectDb();
    const safeInput = { ...input, fileName: sanitizeStorageFileName(input.fileName) };
    const objectKey = buildStorageObjectKey(safeInput);
    const asset = await MediaAsset.create({
      objectKey, bucket: r2BucketName('media'), kind: 'media', fileName: safeInput.fileName,
      mimeType: safeInput.contentType, size: safeInput.size, checksum: safeInput.checksum, status: 'pending',
      linkedModel: safeInput.linkedModel, linkedId: safeInput.linkedId, uploadedBy: session.user.id,
      metadata: { requestedAt: new Date(), multipart: true, bucketKind: 'media', purpose: safeInput.purpose },
    });
    try {
      const uploadId = await createMultipartObject(objectKey, safeInput.contentType, { assetid: String(asset._id), uploader: session.user.id, purpose: safeInput.purpose }, 'media');
      asset.metadata = { ...(asset.metadata as Record<string, unknown>), uploadId };
      await asset.save();
      await AuditLog.create({ actor: session.user.id, action: 'media.multipart.start', entity: 'MediaAsset', entityId: String(asset._id), metadata: { objectKey, size: safeInput.size, bucket: asset.bucket } });
      return Response.json({ assetId: String(asset._id), objectKey, uploadId, partSize: 100 * 1024 * 1024 });
    } catch (error) {
      await MediaAsset.deleteOne({ _id: asset._id }).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    return apiError(error);
  }
}

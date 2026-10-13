import { assertMutationRequest, requirePermission } from '@/lib/auth';
import { connectDb } from '@/lib/db';
import { apiError } from '@/lib/http';
import { r2BucketForAssetKind, r2BucketName, signedUploadUrl } from '@/lib/r2';
import { presignUploadSchema } from '@/lib/validation/upload';
import { AuditLog, MediaAsset } from '@/models';
import { buildStorageObjectKey, sanitizeStorageFileName } from '@/lib/storage-key';

export async function POST(request: Request) {
  try {
    const input = presignUploadSchema.parse(await request.json());
    const session = await requirePermission(input.kind === 'subtitle' ? 'subtitles.create' : 'media.upload');
    await assertMutationRequest(request, session);
    await connectDb();
    const safeInput = { ...input, fileName: sanitizeStorageFileName(input.fileName) };
    const bucketKind = r2BucketForAssetKind(safeInput.kind);
    const objectKey = buildStorageObjectKey(safeInput);
    const asset = await MediaAsset.create({
      objectKey, bucket: r2BucketName(bucketKind), kind: safeInput.kind, fileName: safeInput.fileName,
      mimeType: safeInput.contentType, size: safeInput.size, checksum: safeInput.checksum, status: 'pending',
      linkedModel: safeInput.linkedModel, linkedId: safeInput.linkedId, uploadedBy: session.user.id,
      metadata: { requestedAt: new Date(), bucketKind, purpose: safeInput.purpose },
    });
    try {
      const metadata = { assetid: String(asset._id), uploader: session.user.id, purpose: safeInput.purpose };
      const uploadUrl = await signedUploadUrl(objectKey, safeInput.contentType, metadata, 600, bucketKind);
      await AuditLog.create({ actor: session.user.id, action: 'media.presign', entity: 'MediaAsset', entityId: String(asset._id), metadata: { kind: safeInput.kind, fileName: safeInput.fileName, size: safeInput.size, bucket: asset.bucket } });
      return Response.json({ assetId: String(asset._id), objectKey, uploadUrl, method: 'PUT', headers: { 'Content-Type': safeInput.contentType }, expiresIn: 600 });
    } catch (error) {
      await MediaAsset.deleteOne({ _id: asset._id }).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    return apiError(error);
  }
}

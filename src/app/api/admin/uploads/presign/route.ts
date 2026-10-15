import { assertMutationRequest, requirePermission } from '@/lib/auth';
import { connectDb } from '@/lib/db';
import { apiError } from '@/lib/http';
import { r2BucketForAssetKind, r2BucketName, signedUploadUrl } from '@/lib/r2';
import { presignUploadSchema } from '@/lib/validation/upload';
import { AuditLog, MediaAsset, Subtitle, TranslatorProfile } from '@/models';
import { buildStorageObjectKey, sanitizeStorageFileName } from '@/lib/storage-key';

export async function POST(request: Request) {
  try {
    const input = presignUploadSchema.parse(await request.json());
    const replacement = Boolean(input.replacementFor);
    const session = await requirePermission(replacement ? 'subtitles.update' : input.kind === 'subtitle' ? 'subtitles.create' : 'media.upload');
    await assertMutationRequest(request, session);
    await connectDb();
    if (input.replacementFor) {
      const subtitle = await Subtitle.findById(input.replacementFor).select('status translator').lean();
      if (!subtitle) throw Object.assign(new Error('The subtitle being edited was not found.'), { status: 404, code: 'NOT_FOUND' });
      if (subtitle.status === 'published' && !session.user.permissions.includes('subtitles.verify')) throw Object.assign(new Error('Verification permission is required to edit a published subtitle.'), { status: 403, code: 'FORBIDDEN' });
      if (session.user.role === 'translator') {
        const profile = await TranslatorProfile.findOne({ user: session.user.id }).select('_id').lean();
        if (!profile || String(profile._id) !== String(subtitle.translator)) throw Object.assign(new Error('You may replace files only for your own subtitle records.'), { status: 403, code: 'FORBIDDEN' });
      }
    }
    const safeInput = { ...input, fileName: sanitizeStorageFileName(input.fileName) };
    const bucketKind = r2BucketForAssetKind(safeInput.kind);
    const objectKey = buildStorageObjectKey(safeInput);
    const asset = await MediaAsset.create({
      objectKey, bucket: r2BucketName(bucketKind), kind: safeInput.kind, fileName: safeInput.fileName,
      mimeType: safeInput.contentType, size: safeInput.size, checksum: safeInput.checksum, status: 'pending',
      linkedModel: replacement ? undefined : safeInput.linkedModel, linkedId: replacement ? undefined : safeInput.linkedId, uploadedBy: session.user.id,
      metadata: { requestedAt: new Date(), bucketKind, purpose: safeInput.purpose, replacementFor: safeInput.replacementFor },
    });
    try {
      const metadata = { assetid: String(asset._id), uploader: session.user.id, purpose: safeInput.purpose };
      const uploadUrl = await signedUploadUrl(objectKey, safeInput.contentType, metadata, 600, bucketKind);
      await AuditLog.create({ actor: session.user.id, action: replacement ? 'subtitle.replacement_presign' : 'media.presign', entity: 'MediaAsset', entityId: String(asset._id), metadata: { kind: safeInput.kind, fileName: safeInput.fileName, size: safeInput.size, bucket: asset.bucket, replacementFor: safeInput.replacementFor } });
      return Response.json({ assetId: String(asset._id), objectKey, uploadUrl, method: 'PUT', headers: { 'Content-Type': safeInput.contentType }, expiresIn: 600 });
    } catch (error) {
      await MediaAsset.deleteOne({ _id: asset._id }).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    return apiError(error);
  }
}

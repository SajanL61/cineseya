import { isValidObjectId } from 'mongoose';
import { assertMutationRequest, requirePermission } from '@/lib/auth';
import { connectDb } from '@/lib/db';
import { apiError } from '@/lib/http';
import { downloadMirrorInputSchema } from '@/lib/validation/media';
import { assertPublicMirrorTarget } from '@/services/mirror-health';
import { AuditLog, DownloadMirror, MediaVersion } from '@/models';

export async function POST(request: Request, { params }: RouteContext<'/api/admin/media-versions/[id]/mirrors'>) {
  try {
    const session = await requirePermission('media.update');
    await assertMutationRequest(request, session);
    const { id } = await params;
    if (!isValidObjectId(id)) throw Object.assign(new Error('Media version was not found.'), { status: 404, code: 'NOT_FOUND' });
    const input = downloadMirrorInputSchema.parse(await request.json());
    await assertPublicMirrorTarget(input.url);
    await connectDb();
    if (!await MediaVersion.exists({ _id: id })) throw Object.assign(new Error('Media version was not found.'), { status: 404, code: 'NOT_FOUND' });
    const mirror = await DownloadMirror.create({ ...input, mediaVersion: id, healthStatus: 'unknown', createdBy: session.user.id, updatedBy: session.user.id });
    await AuditLog.create({ actor: session.user.id, action: 'mirror.add', entity: 'DownloadMirror', entityId: String(mirror._id), metadata: { mediaVersionId: id, providerName: input.providerName, providerType: input.providerType } });
    return Response.json({ id: String(mirror._id) }, { status: 201 });
  } catch (error) { return apiError(error); }
}

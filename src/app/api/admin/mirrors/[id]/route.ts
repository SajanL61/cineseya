import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { assertMutationRequest, requirePermission } from '@/lib/auth';
import { connectDb } from '@/lib/db';
import { apiError } from '@/lib/http';
import { downloadMirrorInputSchema } from '@/lib/validation/media';
import { assertPublicMirrorTarget } from '@/services/mirror-health';
import { AuditLog, DownloadMirror } from '@/models';

const patchSchema = downloadMirrorInputSchema.partial().extend({ active: z.boolean().optional() });

export async function PATCH(request: Request, { params }: RouteContext<'/api/admin/mirrors/[id]'>) {
  try {
    const session = await requirePermission('media.update'); await assertMutationRequest(request, session);
    const { id } = await params; if (!isValidObjectId(id)) throw Object.assign(new Error('Mirror was not found.'), { status: 404, code: 'NOT_FOUND' });
    const input = patchSchema.parse(await request.json()); if (input.url) await assertPublicMirrorTarget(input.url);
    await connectDb(); const mirror = await DownloadMirror.findByIdAndUpdate(id, { $set: { ...input, updatedBy: session.user.id } }, { new: true });
    if (!mirror) throw Object.assign(new Error('Mirror was not found.'), { status: 404, code: 'NOT_FOUND' });
    const action = input.active === true ? 'mirror.enable' : input.active === false ? 'mirror.disable' : 'mirror.update';
    await AuditLog.create({ actor: session.user.id, action, entity: 'DownloadMirror', entityId: id, metadata: { fields: Object.keys(input) } });
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request, { params }: RouteContext<'/api/admin/mirrors/[id]'>) {
  try {
    const session = await requirePermission('media.update'); await assertMutationRequest(request, session);
    const { id } = await params; if (!isValidObjectId(id)) throw Object.assign(new Error('Mirror was not found.'), { status: 404, code: 'NOT_FOUND' });
    await connectDb(); const mirror = await DownloadMirror.findById(id);
    if (!mirror) throw Object.assign(new Error('Mirror was not found.'), { status: 404, code: 'NOT_FOUND' });
    await DownloadMirror.deleteOne({ _id: id });
    await AuditLog.create({ actor: session.user.id, action: 'mirror.delete', entity: 'DownloadMirror', entityId: id, metadata: { mediaVersionId: String(mirror.mediaVersion), providerType: String(mirror.providerType) } });
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}

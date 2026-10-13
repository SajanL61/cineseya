import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { assertMutationRequest, requirePermission } from '@/lib/auth';
import { connectDb } from '@/lib/db';
import { apiError } from '@/lib/http';
import { AuditLog, Subtitle } from '@/models';
import { publishSubtitleNotifications } from '@/services/notifications';

const schema=z.object({status:z.enum(['draft','published','disabled']).optional(),verified:z.boolean().optional(),releaseMatches:z.array(z.string().trim().min(1)).max(30).optional(),version:z.number().int().min(1).max(100).optional()});
export async function PATCH(request: Request, { params }: RouteContext<'/api/admin/subtitles/[id]'>) {
  try {
    const session = await requirePermission('subtitles.update');
    await assertMutationRequest(request, session);
    const { id } = await params;
    if (!isValidObjectId(id)) throw Object.assign(new Error('Subtitle was not found.'), { status: 404, code: 'NOT_FOUND' });
    const input = schema.parse(await request.json());
    if ((input.verified || input.status === 'published') && !session.user.permissions.includes('subtitles.verify')) throw Object.assign(new Error('Verification permission is required to publish subtitles.'), { status: 403, code: 'FORBIDDEN' });
    await connectDb();
    const subtitle = await Subtitle.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true });
    if (!subtitle) throw Object.assign(new Error('Subtitle was not found.'), { status: 404, code: 'NOT_FOUND' });
    const delivery = subtitle.status === 'published' ? await publishSubtitleNotifications(id) : undefined;
    await AuditLog.create({ actor: session.user.id, action: 'subtitle.update', entity: 'Subtitle', entityId: id, metadata: { ...input, notificationRecipients: delivery?.recipients, notificationsCreated: delivery?.notifications } });
    return Response.json({ id, status: subtitle.status, verified: subtitle.verified, notificationsCreated: delivery?.notifications ?? 0 });
  } catch (error) { return apiError(error); }
}

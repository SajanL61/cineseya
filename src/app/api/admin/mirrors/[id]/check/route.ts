import { isValidObjectId } from 'mongoose';
import { assertMutationRequest, requirePermission } from '@/lib/auth';
import { connectDb } from '@/lib/db';
import { apiError } from '@/lib/http';
import { checkMirrorHealth } from '@/services/mirror-health';
import { AuditLog, DownloadMirror } from '@/models';

export async function POST(request: Request, { params }: RouteContext<'/api/admin/mirrors/[id]/check'>) {
  try {
    const session = await requirePermission('media.update'); await assertMutationRequest(request, session);
    const { id } = await params; if (!isValidObjectId(id)) throw Object.assign(new Error('Mirror was not found.'), { status: 404, code: 'NOT_FOUND' });
    await connectDb(); const mirror = await DownloadMirror.findById(id).select('+url');
    if (!mirror) throw Object.assign(new Error('Mirror was not found.'), { status: 404, code: 'NOT_FOUND' });
    const result = await checkMirrorHealth(mirror as unknown as { url: unknown; active?: unknown });
    const checkedAt = new Date(); mirror.healthStatus = result.healthStatus; mirror.latencyMs = result.latencyMs; mirror.lastCheckedAt = checkedAt; mirror.updatedBy = session.user.id;
    if (result.healthStatus === 'online' || result.healthStatus === 'slow') { mirror.lastSuccessfulAt = checkedAt; mirror.failureCount = 0; } else mirror.failureCount = Number(mirror.failureCount || 0) + 1;
    await mirror.save();
    await AuditLog.create({ actor: session.user.id, action: 'mirror.check', entity: 'DownloadMirror', entityId: id, metadata: { healthStatus: mirror.healthStatus, latencyMs: result.latencyMs } });
    return Response.json({ healthStatus: mirror.healthStatus, latencyMs: result.latencyMs, lastCheckedAt: checkedAt.toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}

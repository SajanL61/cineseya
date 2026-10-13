import { isValidObjectId } from 'mongoose';
import { assertMutationRequest, requirePermission } from '@/lib/auth';
import { connectDb } from '@/lib/db';
import { apiError } from '@/lib/http';
import { deleteObjectPrefix } from '@/lib/r2';
import { AuditLog, MediaStream } from '@/models';

export async function DELETE(request: Request, { params }: RouteContext<'/api/admin/streams/[id]'>) {
  try {
    const session = await requirePermission('media.delete');
    await assertMutationRequest(request, session);
    const { id } = await params;
    if (!isValidObjectId(id)) throw Object.assign(new Error('Stream was not found.'), { status: 404, code: 'NOT_FOUND' });
    await connectDb();
    const stream = await MediaStream.findById(id);
    if (!stream || stream.status === 'deleted') throw Object.assign(new Error('Stream was not found.'), { status: 404, code: 'NOT_FOUND' });
    stream.status = 'deleting'; stream.active = false; await stream.save();
    try {
      const removed = await deleteObjectPrefix(`${String(stream.prefix).replace(/\/$/, '')}/`, 'media');
      stream.status = 'deleted'; stream.manifestKey = undefined; stream.renditions = []; stream.totalBytes = 0; stream.segmentCount = 0; await stream.save();
      await AuditLog.create({ actor: session.user.id, action: 'stream.delete', entity: 'MediaStream', entityId: id, metadata: { removedObjects: removed } });
      return Response.json({ ok: true, removedObjects: removed });
    } catch (error) {
      stream.status = 'failed'; await stream.save(); throw error;
    }
  } catch (error) { return apiError(error); }
}

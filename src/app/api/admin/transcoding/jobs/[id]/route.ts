import { assertMutationRequest, requirePermission } from '@/lib/auth';
import { apiError } from '@/lib/http';
import { transcodeJobActionSchema } from '@/lib/validation/streaming';
import { requestTranscodeJobAction } from '@/services/transcoding';

export async function PATCH(request: Request, { params }: RouteContext<'/api/admin/transcoding/jobs/[id]'>) {
  try {
    const session = await requirePermission('media.update');
    await assertMutationRequest(request, session);
    const { id } = await params;
    const { action } = transcodeJobActionSchema.parse(await request.json());
    await requestTranscodeJobAction(id, action, session.user.id);
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}

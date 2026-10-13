import { assertMutationRequest, requirePermission } from '@/lib/auth';
import { apiError } from '@/lib/http';
import { createTranscodeJobSchema } from '@/lib/validation/streaming';
import { createTranscodeJob } from '@/services/transcoding';

export async function POST(request: Request) {
  try {
    const session = await requirePermission('media.update');
    await assertMutationRequest(request, session);
    const input = createTranscodeJobSchema.parse(await request.json());
    const result = await createTranscodeJob(input, session.user.id);
    return Response.json(result, { status: result.existing ? 200 : 201 });
  } catch (error) { return apiError(error); }
}

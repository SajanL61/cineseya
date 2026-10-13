import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { assertMutationRequest, currentSession } from '@/lib/auth';
import { apiError } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getSubtitleInterest, removeSubtitleInterest, requestSubtitle, subscribeForSubtitle } from '@/services/subtitle-interest';

const contentTypeSchema = z.enum(['movie', 'episode']);
const mutationSchema = z.object({ action: z.enum(['subscribe', 'request']) });

function validId(contentId: string) {
  if (!isValidObjectId(contentId)) throw Object.assign(new Error('Content was not found.'), { status: 404, code: 'NOT_FOUND' });
}

export async function GET(request: Request, { params }: RouteContext<'/api/subtitle-interest/[contentType]/[contentId]'>) {
  try {
    await enforceRateLimit(request, 'subtitle-interest-read', 90, 60_000);
    const { contentType: rawType, contentId } = await params;
    const contentType = contentTypeSchema.parse(rawType);
    validId(contentId);
    const session = await currentSession();
    const state = await getSubtitleInterest(contentType, contentId, session?.user.id);
    return Response.json(state, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request, { params }: RouteContext<'/api/subtitle-interest/[contentType]/[contentId]'>) {
  try {
    await enforceRateLimit(request, 'subtitle-interest-write', 20, 60 * 60_000);
    const session = await currentSession();
    if (!session) throw Object.assign(new Error('Sign in to request or follow a subtitle.'), { status: 401, code: 'AUTH_REQUIRED' });
    await assertMutationRequest(request, session);
    const { contentType: rawType, contentId } = await params;
    const contentType = contentTypeSchema.parse(rawType);
    validId(contentId);
    const { action } = mutationSchema.parse(await request.json());
    const state = action === 'subscribe' ? await subscribeForSubtitle(session.user.id, contentType, contentId) : await requestSubtitle(session.user.id, contentType, contentId);
    return Response.json(state, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request, { params }: RouteContext<'/api/subtitle-interest/[contentType]/[contentId]'>) {
  try {
    await enforceRateLimit(request, 'subtitle-interest-write', 20, 60 * 60_000);
    const session = await currentSession();
    if (!session) throw Object.assign(new Error('Authentication is required.'), { status: 401, code: 'AUTH_REQUIRED' });
    await assertMutationRequest(request, session);
    const { contentType: rawType, contentId } = await params;
    const contentType = contentTypeSchema.parse(rawType);
    validId(contentId);
    const { action } = mutationSchema.parse(await request.json());
    const state = await removeSubtitleInterest(session.user.id, contentType, contentId, action);
    return Response.json(state, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error); }
}

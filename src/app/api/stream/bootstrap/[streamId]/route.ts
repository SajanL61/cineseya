import { isValidObjectId } from 'mongoose';
import { currentUser } from '@/lib/auth';
import { connectDb } from '@/lib/db';
import { env } from '@/lib/env';
import { apiError } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';
import { assertMediaDistributionAllowed } from '@/lib/rights';
import { randomToken } from '@/lib/security';
import { assertSameOrigin } from '@/lib/request-security';
import { Episode, MediaStream, Movie } from '@/models';
import { createStreamSession, streamClientKeyFromToken } from '@/services/stream-sessions';
import type { RightsStatus } from '@/types/content';

const CLIENT_COOKIE = 'cineseya_stream_client';

function cookieValue(request: Request) {
  return (request.headers.get('cookie') || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${CLIENT_COOKIE}=`))?.split('=').slice(1).join('=');
}

export async function POST(request: Request, { params }: RouteContext<'/api/stream/bootstrap/[streamId]'>) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit(request, 'stream-session', 20, 10 * 60_000);
    const { streamId } = await params;
    if (!isValidObjectId(streamId)) throw Object.assign(new Error('This stream is unavailable.'), { status: 404, code: 'STREAM_UNAVAILABLE' });
    await connectDb();
    const stream = await MediaStream.findOne({ _id: streamId, status: 'ready', active: true, manifestKey: { $exists: true }, 'renditions.0': { $exists: true } }).lean();
    if (!stream) throw Object.assign(new Error('This stream is unavailable.'), { status: 404, code: 'STREAM_UNAVAILABLE' });
    const content = stream.contentType === 'movie' ? await Movie.findOne({ _id: stream.contentId, publicationStatus: 'published' }).lean() : await Episode.findOne({ _id: stream.contentId, publicationStatus: 'published' }).lean();
    if (!content) throw Object.assign(new Error('This title is unavailable.'), { status: 404, code: 'NOT_FOUND' });
    assertMediaDistributionAllowed(content.rightsStatus as RightsStatus, true);
    assertMediaDistributionAllowed(stream.rightsStatus as RightsStatus, Boolean(stream.active));
    const existingToken = cookieValue(request);
    const validExistingToken = existingToken && existingToken.length >= 32 && existingToken.length <= 200 ? existingToken : undefined;
    const clientToken = validExistingToken || randomToken(32);
    const user = await currentUser();
    const session = await createStreamSession(stream._id, streamClientKeyFromToken(clientToken), user?.id);
    const headers = new Headers({ 'Cache-Control': 'private, no-store' });
    if (!validExistingToken) headers.append('Set-Cookie', `${CLIENT_COOKIE}=${clientToken}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000${env.NODE_ENV === 'production' ? '; Secure' : ''}`);
    return Response.json({ streamUrl: `/api/stream/${session.token}/master.m3u8`, expiresAt: session.expiresAt.toISOString() }, { headers });
  } catch (error) { return apiError(error); }
}

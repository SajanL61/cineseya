import { isValidObjectId } from 'mongoose';
import { connectDb } from '@/lib/db';
import { apiError } from '@/lib/http';
import { readObjectBytes } from '@/lib/r2';
import { subtitleTextToVtt } from '@/lib/subtitle-text';
import { MediaStream, Subtitle } from '@/models';
import { resolveStreamSession } from '@/services/stream-sessions';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: RouteContext<'/api/stream-caption/[token]/[subtitleId]'>) {
  try {
    const { token, subtitleId } = await params;
    if (!isValidObjectId(subtitleId)) throw Object.assign(new Error('Subtitle was not found.'), { status: 404, code: 'NOT_FOUND' });
    const session = await resolveStreamSession(token, request.headers);
    if (!session) throw Object.assign(new Error('The streaming session is missing or expired.'), { status: 403, code: 'STREAM_SESSION_EXPIRED' });
    await connectDb();
    const stream = await MediaStream.findOne({ _id: session.mediaStream, status: 'ready', active: true }).select('contentId contentType').lean();
    if (!stream) throw Object.assign(new Error('This stream is unavailable.'), { status: 404, code: 'STREAM_UNAVAILABLE' });
    const owner = stream.contentType === 'movie' ? { movie: stream.contentId } : { episode: stream.contentId };
    const subtitle = await Subtitle.findOne({ _id: subtitleId, ...owner, status: 'published', format: { $in: ['srt', 'vtt'] } }).lean();
    if (!subtitle) throw Object.assign(new Error('Subtitle was not found.'), { status: 404, code: 'NOT_FOUND' });
    const bytes = await readObjectBytes(String(subtitle.fileKey), 'media');
    const vtt = subtitleTextToVtt(new TextDecoder().decode(bytes), String(subtitle.format));
    return new Response(vtt, { headers: { 'Content-Type': 'text/vtt; charset=utf-8', 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) { return apiError(error); }
}

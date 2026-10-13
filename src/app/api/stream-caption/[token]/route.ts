import { connectDb } from '@/lib/db';
import { apiError } from '@/lib/http';
import { MediaStream, Subtitle } from '@/models';
import { resolveStreamSession } from '@/services/stream-sessions';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: RouteContext<'/api/stream-caption/[token]'>) {
  try {
    const { token } = await params;
    const session = await resolveStreamSession(token, request.headers);
    if (!session) throw Object.assign(new Error('The streaming session is missing or expired.'), { status: 403, code: 'STREAM_SESSION_EXPIRED' });
    await connectDb();
    const stream = await MediaStream.findOne({ _id: session.mediaStream, status: 'ready', active: true }).select('contentId contentType').lean();
    if (!stream) throw Object.assign(new Error('This stream is unavailable.'), { status: 404, code: 'STREAM_UNAVAILABLE' });
    const owner = stream.contentType === 'movie' ? { movie: stream.contentId } : { episode: stream.contentId };
    const rows = await Subtitle.find({ ...owner, status: 'published', format: { $in: ['srt', 'vtt'] } }).select('language languageCode').sort({ languageCode: 1 }).lean();
    return Response.json({ subtitles: rows.map((row) => ({ id: String(row._id), label: String(row.language), language: String(row.languageCode), src: `/api/stream-caption/${token}/${String(row._id)}` })) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error); }
}

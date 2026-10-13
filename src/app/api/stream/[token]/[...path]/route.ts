import { connectDb } from '@/lib/db';
import { apiError } from '@/lib/http';
import { readObjectBytes, readObjectStream } from '@/lib/r2';
import { hlsContentType, safeHlsRelativePath } from '@/lib/transcoding';
import { MediaStream, Subtitle } from '@/models';
import { resolveStreamSession } from '@/services/stream-sessions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: RouteContext<'/api/stream/[token]/[...path]'>) {
  try {
    const { token, path } = await params;
    const session = await resolveStreamSession(token, request.headers);
    if (!session) throw Object.assign(new Error('The streaming session is missing or expired.'), { status: 403, code: 'STREAM_SESSION_EXPIRED' });
    const relative = safeHlsRelativePath(path);
    await connectDb();
    const stream = await MediaStream.findOne({ _id: session.mediaStream, status: 'ready', active: true }).select('prefix contentId contentType').lean();
    if (!stream) throw Object.assign(new Error('This stream is unavailable.'), { status: 404, code: 'STREAM_UNAVAILABLE' });
    const objectKey = `${String(stream.prefix).replace(/\/$/, '')}/${relative}`;
    if (relative === 'master.m3u8') {
      const owner = stream.contentType === 'movie' ? { movie: stream.contentId } : { episode: stream.contentId };
      const [bytes, subtitles] = await Promise.all([
        readObjectBytes(objectKey, 'media'),
        Subtitle.find({ ...owner, status: 'published', format: { $in: ['srt', 'vtt'] } }).select('language languageCode').sort({ languageCode: 1 }).lean(),
      ]);
      let manifest = new TextDecoder().decode(bytes);
      if (subtitles.length) {
        const clean = (value: unknown) => String(value || '').replace(/["\r\n,]/g, ' ').trim().slice(0, 80);
        const tracks = subtitles.map((subtitle) => `#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",NAME="${clean(subtitle.language)}",LANGUAGE="${clean(subtitle.languageCode)}",AUTOSELECT=YES,DEFAULT=NO,URI="/api/stream-caption/${token}/${String(subtitle._id)}"`).join('\n');
        manifest = manifest.replace('#EXT-X-INDEPENDENT-SEGMENTS', `#EXT-X-INDEPENDENT-SEGMENTS\n${tracks}`).replace(/^#EXT-X-STREAM-INF:(.+)$/gm, '#EXT-X-STREAM-INF:$1,SUBTITLES="subs"');
      }
      return new Response(manifest, { headers: { 'Content-Type': 'application/vnd.apple.mpegurl', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' } });
    }
    const object = await readObjectStream(objectKey, 'media');
    const responseHeaders = new Headers({
      'Content-Type': object.contentType || hlsContentType(relative),
      'Cache-Control': relative.endsWith('.m3u8') ? 'private, no-store' : 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
    });
    if (object.contentLength !== undefined) responseHeaders.set('Content-Length', String(object.contentLength));
    if (object.etag) responseHeaders.set('ETag', object.etag);
    return new Response(object.body, { headers: responseHeaders });
  } catch (error) { return apiError(error); }
}

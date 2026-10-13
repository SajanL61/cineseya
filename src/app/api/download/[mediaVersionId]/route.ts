import { createDownloadToken } from '@/lib/download-token';
import { apiError } from '@/lib/http';
import { enforceRateLimit, requestClientKey } from '@/lib/rate-limit';
import { authorizeReadyDownload } from '@/services/download-verification';
import { DownloadEvent } from '@/models';
import { recordAnalyticsEvent } from '@/services/analytics';
import { z } from 'zod';

function deviceCategory(userAgent: string) {
  if (/ipad|tablet/i.test(userAgent)) return 'tablet';
  if (/mobile|android|iphone/i.test(userAgent)) return 'mobile';
  if (userAgent) return 'desktop';
  return 'unknown';
}

const inputSchema = z.object({ readyToken: z.string().trim().min(20).max(200) });

export async function POST(request: Request, { params }: RouteContext<'/api/download/[mediaVersionId]'>) {
  try {
    await enforceRateLimit(request, 'media-download-token', 12, 10 * 60_000);
    const { mediaVersionId } = await params;
    const { readyToken } = inputSchema.parse(await request.json());
    const { version, content, asset } = await authorizeReadyDownload(request, readyToken, mediaVersionId);
    const expiresAt = Math.floor(Date.now() / 1_000) + 90;
    const fileName = String(version.fileName || `cineseya-${String(version.quality)}.${String(version.container || 'mp4').toLocaleLowerCase()}`);
    const token = createDownloadToken({ mediaVersionId, objectKey: String(asset.objectKey), bucket: String(asset.bucket), fileName, contentType: String(asset.mimeType || 'application/octet-stream'), exp: expiresAt });
    const downloadUrl = `/api/download/file/${token}`;
    await Promise.all([
      DownloadEvent.create({ kind: 'media', targetId: version._id, contentId: version.contentId, mediaVersion: version._id, movie: version.contentType === 'movie' ? content._id : undefined, providerType: 'direct', status: 'started', ipHash: requestClientKey(request), countryCode: request.headers.get('cf-ipcountry')?.slice(0, 2), userAgentFamily: request.headers.get('user-agent')?.slice(0, 180), deviceCategory: deviceCategory(request.headers.get('user-agent') || '') }),
      recordAnalyticsEvent(request, { eventType: 'direct_download_started', contentType: String(version.contentType), contentId: String(version.contentId), mediaVersion: version._id, providerType: 'direct', quality: String(version.quality) }),
    ]);
    return Response.json({ downloadUrl, expiresAt: new Date(expiresAt * 1_000).toISOString(), resumeSupported: true }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error); }
}

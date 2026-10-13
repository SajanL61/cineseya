import { isValidObjectId } from 'mongoose';
import { connectDb } from '@/lib/db';
import { apiError } from '@/lib/http';
import { enforceRateLimit, requestClientKey } from '@/lib/rate-limit';
import { assertMediaDistributionAllowed } from '@/lib/rights';
import { DownloadEvent, DownloadMirror, Episode, MediaVersion, Movie } from '@/models';
import type { RightsStatus } from '@/types/content';
import { authorizeReadyDownload } from '@/services/download-verification';
import { assertPublicMirrorTarget } from '@/services/mirror-health';
import { recordAnalyticsEvent, type AnalyticsEventType } from '@/services/analytics';

export async function GET(request: Request, { params }: RouteContext<'/api/download/mirror/[mirrorId]'>) {
  try {
    await enforceRateLimit(request, 'media-download-mirror', 20, 10 * 60_000);
    const { mirrorId } = await params;
    const readyToken = new URL(request.url).searchParams.get('verification') || '';
    if (!isValidObjectId(mirrorId)) throw Object.assign(new Error('Mirror was not found.'), { status: 404, code: 'NOT_FOUND' });
    await connectDb();
    const mirror = await DownloadMirror.findOne({ _id: mirrorId, active: true }).select('+url').lean();
    if (!mirror) throw Object.assign(new Error('This mirror is unavailable.'), { status: 404, code: 'MIRROR_UNAVAILABLE' });
    const version = await MediaVersion.findOne({ _id: mirror.mediaVersion, active: true, deletionStatus: { $ne: 'deleted' } }).lean();
    if (!version) throw Object.assign(new Error('This media version is unavailable.'), { status: 404, code: 'NOT_FOUND' });
    const content = version.contentType === 'movie' ? await Movie.findOne({ _id: version.contentId, publicationStatus: 'published' }).lean() : await Episode.findOne({ _id: version.contentId, publicationStatus: 'published' }).lean();
    if (!content) throw Object.assign(new Error('This title is unavailable.'), { status: 404, code: 'NOT_FOUND' });
    assertMediaDistributionAllowed(content.rightsStatus as RightsStatus, true);
    assertMediaDistributionAllowed(version.rightsStatus as RightsStatus, Boolean(version.active));
    await authorizeReadyDownload(request, readyToken, String(version._id), mirrorId);
    const safeUrl = await assertPublicMirrorTarget(String(mirror.url));
    const eventType: AnalyticsEventType = mirror.providerType === 'dotflix' ? 'dotflix_click' : mirror.providerType === 'telegram' ? 'telegram_mirror_click' : 'mirror_click';
    await Promise.all([
      DownloadEvent.create({ kind: 'media', targetId: version._id, contentId: version.contentId, mediaVersion: version._id, movie: version.contentType === 'movie' ? content._id : undefined, providerType: mirror.providerType, status: 'redirected', ipHash: requestClientKey(request) }),
      recordAnalyticsEvent(request, { eventType, contentType: String(version.contentType), contentId: String(version.contentId), mediaVersion: version._id, mirror: mirror._id, providerType: String(mirror.providerType), quality: String(version.quality) }),
    ]);
    const response = Response.redirect(safeUrl, 302); response.headers.set('Cache-Control', 'private, no-store'); return response;
  } catch (error) { return apiError(error); }
}

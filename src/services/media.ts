import 'server-only';
import { isValidObjectId } from 'mongoose';
import { connectDb } from '@/lib/db';
import { resolvePublicAssetUrl } from '@/lib/assets';
import { assertMediaDistributionAllowed } from '@/lib/rights';
import { signedStreamUrl } from '@/lib/r2';
import { Episode, MediaAsset, MediaStream, MediaVersion, Movie, Series } from '@/models';
import type { RightsStatus } from '@/types/content';

export async function getReadyStreamForContent(contentId: string, contentType: 'movie' | 'episode') {
  if (!isValidObjectId(contentId)) return null;
  await connectDb();
  const stream = await MediaStream.findOne({ contentId, contentType, status: 'ready', active: true, rightsStatus: { $in: ['owned', 'licensed', 'public_domain'] }, manifestKey: { $exists: true }, 'renditions.0': { $exists: true } }).sort({ verifiedAt: -1 }).select('_id renditions').lean();
  return stream ? { id: String(stream._id), qualities: (stream.renditions as Array<{ name?: string }> | undefined)?.map((item) => String(item.name)) ?? [] } : null;
}

export async function getPlayableMedia(mediaId: string) {
  if (!isValidObjectId(mediaId)) return null;
  await connectDb();
  const stream = await MediaStream.findOne({ _id: mediaId, status: 'ready', active: true, manifestKey: { $exists: true }, 'renditions.0': { $exists: true } }).lean();
  if (stream) {
    const content = stream.contentType === 'movie'
      ? await Movie.findOne({ _id: stream.contentId, publicationStatus: 'published' }).lean()
      : await Episode.findOne({ _id: stream.contentId, publicationStatus: 'published' }).lean();
    if (!content) return null;
    assertMediaDistributionAllowed(content.rightsStatus as RightsStatus, true);
    assertMediaDistributionAllowed(stream.rightsStatus as RightsStatus, Boolean(stream.active));
    let seriesSlug: string | undefined;
    if (stream.contentType === 'episode' && content.series) seriesSlug = String((await Series.findById(content.series).select('slug').lean())?.slug || '');
    const renditions = (stream.renditions as Array<{ name?: string; bandwidth?: number }> | undefined) ?? [];
    return {
      id: String(stream._id), contentId: String(content._id), contentType: stream.contentType as 'movie' | 'episode', title: String(content.title),
      slug: String(content.slug), seriesSlug, posterUrl: resolvePublicAssetUrl(content.posterUrl || content.thumbnailUrl, '/media/fallback-backdrop.svg')!,
      quality: 'Auto', releaseType: 'Adaptive HLS', streamUrl: `/api/stream/bootstrap/${String(stream._id)}`, mimeType: 'application/vnd.apple.mpegurl',
      renditions: renditions.map((item) => ({ name: String(item.name), bandwidth: Number(item.bandwidth || 0) })),
      subtitles: [],
    };
  }
  const version = await MediaVersion.findOne({ _id: mediaId, active: true, deletionStatus: { $ne: 'deleted' } }).lean();
  if (!version) return null;
  const content = version.contentType === 'movie'
    ? await Movie.findOne({ _id: version.contentId, publicationStatus: 'published' }).lean()
    : await Episode.findOne({ _id: version.contentId, publicationStatus: 'published' }).lean();
  if (!content) return null;
  assertMediaDistributionAllowed(content.rightsStatus as RightsStatus, true);
  assertMediaDistributionAllowed(version.rightsStatus as RightsStatus, Boolean(version.active));
  const asset = await MediaAsset.findOne({ objectKey: version.r2ObjectKey, bucket: version.storageBucket, status: 'active' }).lean();
  if (!asset) return null;
  let seriesSlug: string | undefined;
  if (version.contentType === 'episode' && content.series) seriesSlug = String((await Series.findById(content.series).select('slug').lean())?.slug || '');
  const streamKey = String(version.streamingManifestKey || version.r2ObjectKey);
  const adaptive = Boolean(version.streamingManifestKey);
  return {
    id: String(version._id), contentId: String(content._id), contentType: version.contentType as 'movie' | 'episode', title: String(content.title),
    slug: String(content.slug), seriesSlug, posterUrl: resolvePublicAssetUrl(content.posterUrl || content.thumbnailUrl, '/media/fallback-backdrop.svg')!,
    quality: String(version.resolution || version.quality || 'HD'), releaseType: String(version.releaseType || 'Authorized release'),
    streamUrl: await signedStreamUrl(streamKey, adaptive ? 'application/vnd.apple.mpegurl' : String(asset.mimeType || 'video/mp4'), 600, 'media'),
    mimeType: adaptive ? 'application/vnd.apple.mpegurl' : String(asset.mimeType || 'video/mp4'),
    renditions: [], subtitles: [],
  };
}

async function playableIdForEpisode(episodeId: string) {
  const stream = await MediaStream.findOne({ contentId: episodeId, contentType: 'episode', status: 'ready', active: true, rightsStatus: { $in: ['owned', 'licensed', 'public_domain'] }, manifestKey: { $exists: true } }).select('_id').sort({ verifiedAt: -1 }).lean();
  if (stream) return String(stream._id);
  const version = await MediaVersion.findOne({ contentId: episodeId, contentType: 'episode', active: true, rightsStatus: { $in: ['owned', 'licensed', 'public_domain'] }, deletionStatus: { $ne: 'deleted' } }).select('_id').sort({ createdAt: -1 }).lean();
  return version ? String(version._id) : undefined;
}

export async function getEpisodeNavigation(episodeId: string) {
  if (!isValidObjectId(episodeId)) return null;
  await connectDb();
  const current = await Episode.findOne({ _id: episodeId, publicationStatus: 'published' }).select('series seasonNumber episodeNumber').lean();
  if (!current) return null;
  const [series, episodes] = await Promise.all([
    Series.findOne({ _id: current.series, publicationStatus: 'published' }).select('title slug').lean(),
    Episode.find({ series: current.series, publicationStatus: 'published' }).select('title seasonNumber episodeNumber rightsStatus').sort({ seasonNumber: 1, episodeNumber: 1 }).lean(),
  ]);
  if (!series) return null;
  const index = episodes.findIndex((item) => String(item._id) === episodeId);
  const adjacent = async (episode: (typeof episodes)[number] | undefined) => {
    if (!episode) return undefined;
    const playableId = ['owned', 'licensed', 'public_domain'].includes(String(episode.rightsStatus)) ? await playableIdForEpisode(String(episode._id)) : undefined;
    const detailHref = `/tv/${series.slug}/season-${episode.seasonNumber}/episode-${episode.episodeNumber}`;
    return { id: String(episode._id), label: `S${episode.seasonNumber} E${episode.episodeNumber} · ${episode.title}`, href: playableId ? `/watch/${playableId}` : detailHref, watchHref: playableId ? `/watch/${playableId}` : undefined, detailHref };
  };
  const [previous, next] = await Promise.all([adjacent(index > 0 ? episodes[index - 1] : undefined), adjacent(index >= 0 ? episodes[index + 1] : undefined)]);
  return { seriesTitle: String(series.title), seriesHref: `/tv/${series.slug}`, previous, next };
}

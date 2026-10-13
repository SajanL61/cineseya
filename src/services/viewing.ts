import 'server-only';
import { connectDb } from '@/lib/db';
import { resolvePublicAssetUrl } from '@/lib/assets';
import { useDemoData } from '@/lib/env';
import { Episode, MediaStream, MediaVersion, Movie, Series, ViewingProgress } from '@/models';

const mediaRights = ['owned', 'licensed', 'public_domain'];

export type ContinueWatchingItem = {
  contentType: 'movie' | 'episode'; contentId: string; title: string; subtitle?: string; posterUrl: string;
  watchHref: string; contentHref: string; seconds: number; duration: number; progressPercent: number; timeRemaining: number;
};

export async function getContinueWatching(userId: string): Promise<ContinueWatchingItem[]> {
  if (useDemoData) return [];
  await connectDb();
  const progressRows = await ViewingProgress.find({ user: userId, completed: false, seconds: { $gt: 5 }, duration: { $gt: 0 } }).sort({ lastViewedAt: -1 }).limit(24).lean();
  if (!progressRows.length) return [];
  const movieIds = progressRows.filter((row) => row.contentType === 'movie').map((row) => row.contentId);
  const episodeIds = progressRows.filter((row) => row.contentType === 'episode').map((row) => row.contentId);
  const contentIds = progressRows.map((row) => row.contentId);
  const [movies, episodes, streams, versions] = await Promise.all([
    Movie.find({ _id: { $in: movieIds }, publicationStatus: 'published' }).select('title slug posterUrl rightsStatus').lean(),
    Episode.find({ _id: { $in: episodeIds }, publicationStatus: 'published' }).select('title series seasonNumber episodeNumber thumbnailUrl rightsStatus').lean(),
    MediaStream.find({ contentId: { $in: contentIds }, status: 'ready', active: true, rightsStatus: { $in: mediaRights } }).select('contentId contentType').sort({ verifiedAt: -1 }).lean(),
    MediaVersion.find({ contentId: { $in: contentIds }, active: true, rightsStatus: { $in: mediaRights } }).select('contentId contentType').sort({ createdAt: -1 }).lean(),
  ]);
  const seriesIds = [...new Set(episodes.map((episode) => String(episode.series)))];
  const seriesRows = await Series.find({ _id: { $in: seriesIds }, publicationStatus: 'published' }).select('title slug posterUrl').lean();
  const seriesById = new Map(seriesRows.map((series) => [String(series._id), series]));
  const playable = new Map<string, string>();
  for (const item of [...streams, ...versions]) {
    const key = `${item.contentType}:${item.contentId}`;
    if (!playable.has(key)) playable.set(key, String(item._id));
  }
  const movieById = new Map(movies.map((movie) => [String(movie._id), movie]));
  const episodeById = new Map(episodes.map((episode) => [String(episode._id), episode]));
  const items: ContinueWatchingItem[] = [];
  for (const row of progressRows) {
    const contentType = row.contentType as 'movie' | 'episode';
    const contentId = String(row.contentId);
    const playableId = playable.get(`${contentType}:${contentId}`);
    const seconds = Number(row.seconds || 0); const duration = Number(row.duration || 0);
    if (!playableId || !duration || seconds / duration >= .92) continue;
    if (contentType === 'movie') {
      const movie = movieById.get(contentId);
      if (!movie) continue;
      items.push({ contentType, contentId, title: String(movie.title), posterUrl: resolvePublicAssetUrl(movie.posterUrl, '/media/fallback-poster.svg')!, watchHref: `/watch/${playableId}`, contentHref: `/movies/${movie.slug}`, seconds, duration, progressPercent: Math.min(99, Math.round(seconds / duration * 100)), timeRemaining: Math.max(0, duration - seconds) });
      continue;
    }
    const episode = episodeById.get(contentId); const series = episode ? seriesById.get(String(episode.series)) : undefined;
    if (!episode || !series) continue;
    items.push({ contentType, contentId, title: String(series.title), subtitle: `S${episode.seasonNumber} E${episode.episodeNumber} · ${episode.title}`, posterUrl: resolvePublicAssetUrl(episode.thumbnailUrl ?? series.posterUrl, '/media/fallback-backdrop.svg')!, watchHref: `/watch/${playableId}`, contentHref: `/tv/${series.slug}/season-${episode.seasonNumber}/episode-${episode.episodeNumber}`, seconds, duration, progressPercent: Math.min(99, Math.round(seconds / duration * 100)), timeRemaining: Math.max(0, duration - seconds) });
  }
  return items.slice(0, 12);
}

import 'server-only';
import { Types } from 'mongoose';
import { connectDb } from '@/lib/db';
import { useDemoData } from '@/lib/env';
import { Episode, Movie, Series, Subtitle, SubtitleRequest, SubtitleSubscription } from '@/models';

export type SubtitleContentType = 'movie' | 'episode';
export const SINHALA_LANGUAGE_CODE = 'si';

function fieldFor(contentType: SubtitleContentType) {
  return contentType === 'movie' ? 'movie' : 'episode';
}

async function contentDetails(contentType: SubtitleContentType, contentId: string) {
  if (contentType === 'movie') {
    const movie = await Movie.findOne({ _id: contentId, publicationStatus: 'published' }).select('title slug releaseDate').lean();
    return movie ? { title: String(movie.title), href: `/movies/${movie.slug}`, releaseDate: movie.releaseDate ? new Date(movie.releaseDate as Date) : undefined } : null;
  }
  const episode = await Episode.findOne({ _id: contentId, publicationStatus: 'published' }).select('title series seasonNumber episodeNumber releaseDate').lean();
  if (!episode) return null;
  const series = await Series.findById(episode.series).select('title slug publicationStatus').lean();
  if (!series || series.publicationStatus !== 'published') return null;
  return {
    title: `${series.title} — S${episode.seasonNumber} E${episode.episodeNumber}: ${episode.title}`,
    href: `/tv/${series.slug}/season-${episode.seasonNumber}/episode-${episode.episodeNumber}`,
    releaseDate: episode.releaseDate ? new Date(episode.releaseDate as Date) : undefined,
  };
}

export async function getSubtitleInterest(contentType: SubtitleContentType, contentId: string, userId?: string) {
  if (useDemoData) return { hasPublished: false, requestCount: 0, subscribed: false, requested: false };
  await connectDb();
  const languageCode = SINHALA_LANGUAGE_CODE;
  const subtitleFilter = { [fieldFor(contentType)]: contentId, languageCode, status: 'published' };
  const userFilter = userId ? { user: userId, contentType, contentId, languageCode } : null;
  const [hasPublished, requestCount, subscription, request] = await Promise.all([
    Subtitle.exists(subtitleFilter),
    SubtitleRequest.countDocuments({ contentType, contentId, languageCode, status: 'open' }),
    userFilter ? SubtitleSubscription.exists(userFilter) : null,
    userFilter ? SubtitleRequest.findOne(userFilter).select('status').lean() : null,
  ]);
  return { hasPublished: Boolean(hasPublished), requestCount, subscribed: Boolean(subscription), requested: request?.status === 'open' };
}

export async function subscribeForSubtitle(userId: string, contentType: SubtitleContentType, contentId: string) {
  await connectDb();
  if (!await contentDetails(contentType, contentId)) throw Object.assign(new Error('Content was not found.'), { status: 404, code: 'NOT_FOUND' });
  if (await Subtitle.exists({ [fieldFor(contentType)]: contentId, languageCode: SINHALA_LANGUAGE_CODE, status: 'published' })) {
    throw Object.assign(new Error('A Sinhala subtitle is already available.'), { status: 409, code: 'SUBTITLE_AVAILABLE' });
  }
  await SubtitleSubscription.updateOne(
    { user: userId, contentType, contentId, languageCode: SINHALA_LANGUAGE_CODE },
    { $setOnInsert: { user: userId, contentType, contentId, languageCode: SINHALA_LANGUAGE_CODE } },
    { upsert: true },
  );
  return getSubtitleInterest(contentType, contentId, userId);
}

export async function requestSubtitle(userId: string, contentType: SubtitleContentType, contentId: string) {
  await connectDb();
  if (!await contentDetails(contentType, contentId)) throw Object.assign(new Error('Content was not found.'), { status: 404, code: 'NOT_FOUND' });
  if (await Subtitle.exists({ [fieldFor(contentType)]: contentId, languageCode: SINHALA_LANGUAGE_CODE, status: 'published' })) {
    throw Object.assign(new Error('A Sinhala subtitle is already available.'), { status: 409, code: 'SUBTITLE_AVAILABLE' });
  }
  const filter = { user: userId, contentType, contentId, languageCode: SINHALA_LANGUAGE_CODE };
  await Promise.all([
    SubtitleRequest.updateOne(filter, { $set: { status: 'open' }, $unset: { fulfilledAt: 1, fulfilledBySubtitle: 1 }, $setOnInsert: filter }, { upsert: true }),
    SubtitleSubscription.updateOne(filter, { $setOnInsert: filter }, { upsert: true }),
  ]);
  return getSubtitleInterest(contentType, contentId, userId);
}

export async function removeSubtitleInterest(userId: string, contentType: SubtitleContentType, contentId: string, action: 'subscribe' | 'request') {
  await connectDb();
  const filter = { user: userId, contentType, contentId, languageCode: SINHALA_LANGUAGE_CODE };
  if (action === 'subscribe') await SubtitleSubscription.deleteOne(filter);
  else await SubtitleRequest.updateOne(filter, { $set: { status: 'withdrawn' }, $unset: { fulfilledAt: 1, fulfilledBySubtitle: 1 } });
  return getSubtitleInterest(contentType, contentId, userId);
}

export async function getAdminSubtitleRequests(sort: 'requested' | 'newest' | 'upcoming' = 'requested') {
  await connectDb();
  const grouped = await SubtitleRequest.aggregate<{ _id: { contentType: SubtitleContentType; contentId: Types.ObjectId }; requestCount: number; newestAt: Date }>([
    { $match: { status: 'open', languageCode: SINHALA_LANGUAGE_CODE } },
    { $group: { _id: { contentType: '$contentType', contentId: '$contentId' }, requestCount: { $sum: 1 }, newestAt: { $max: '$createdAt' } } },
    { $sort: sort === 'newest' ? { newestAt: -1 } : { requestCount: -1, newestAt: -1 } },
    { $limit: 200 },
  ]);
  const movieIds = grouped.filter((item) => item._id.contentType === 'movie').map((item) => item._id.contentId);
  const episodeIds = grouped.filter((item) => item._id.contentType === 'episode').map((item) => item._id.contentId);
  const [movies, episodes] = await Promise.all([
    Movie.find({ _id: { $in: movieIds } }).select('title slug releaseDate').lean(),
    Episode.find({ _id: { $in: episodeIds } }).select('title series seasonNumber episodeNumber releaseDate').lean(),
  ]);
  const seriesIds = [...new Set(episodes.map((item) => String(item.series)))];
  const series = await Series.find({ _id: { $in: seriesIds } }).select('title slug').lean();
  const seriesById = new Map(series.map((item) => [String(item._id), item]));
  const details = new Map<string, { title: string; href: string; releaseDate?: Date }>();
  for (const movie of movies) details.set(String(movie._id), { title: String(movie.title), href: `/movies/${movie.slug}`, releaseDate: movie.releaseDate ? new Date(movie.releaseDate as Date) : undefined });
  for (const episode of episodes) {
    const parent = seriesById.get(String(episode.series));
    details.set(String(episode._id), { title: `${parent?.title ?? 'TV Series'} — S${episode.seasonNumber} E${episode.episodeNumber}: ${episode.title}`, href: parent ? `/tv/${parent.slug}/season-${episode.seasonNumber}/episode-${episode.episodeNumber}` : '/tv', releaseDate: episode.releaseDate ? new Date(episode.releaseDate as Date) : undefined });
  }
  const rows = grouped.map((item) => ({ contentType: item._id.contentType, contentId: String(item._id.contentId), requestCount: item.requestCount, newestAt: item.newestAt.toISOString(), ...details.get(String(item._id.contentId)) })).filter((item) => item.title);
  if (sort === 'upcoming') rows.sort((left, right) => {
    const leftTime = left.releaseDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const rightTime = right.releaseDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return leftTime - rightTime || right.requestCount - left.requestCount;
  });
  return rows.map((item) => ({ ...item, releaseDate: item.releaseDate?.toISOString() }));
}

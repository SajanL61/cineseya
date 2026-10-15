import 'server-only';
import type { Model } from 'mongoose';
import { connectDb } from '@/lib/db';
import { env } from '@/lib/env';
import {
  AnalyticsEvent, AuditLog, Comment, ContactMessage, DownloadEvent, DownloadMirror, Episode, Genre, HomepageSection, Language, MediaAsset, MediaStream, MediaVersion, Movie, Report,
  SearchEvent, Series, SiteSetting, Subtitle, SubtitleRequest, TakedownRequest, TranslatorProfile, User,
} from '@/models';

type ResourceKey = 'movies' | 'series' | 'subtitles' | 'translators' | 'users' | 'comments' | 'reports' | 'homepage' | 'taxonomies' | 'media' | 'takedowns' | 'settings' | 'audit' | 'messages';
type ResourceDefinition = { model: Model<Record<string, unknown>>; searchField: string; select: string; titleField: string; secondaryField?: string };

const resources: Record<ResourceKey, ResourceDefinition> = {
  movies: { model: Movie, searchField: 'title', select: 'title slug year publicationStatus rightsStatus updatedAt', titleField: 'title', secondaryField: 'slug' },
  series: { model: Series, searchField: 'title', select: 'title slug year publicationStatus rightsStatus updatedAt', titleField: 'title', secondaryField: 'slug' },
  subtitles: { model: Subtitle, searchField: 'fileName', select: 'fileName language format status verified downloadCount movie episode updatedAt', titleField: 'fileName', secondaryField: 'language' },
  translators: { model: TranslatorProfile, searchField: 'displayName', select: 'displayName slug verified totalSubtitles totalDownloads updatedAt', titleField: 'displayName', secondaryField: 'slug' },
  users: { model: User, searchField: 'email', select: 'name displayName email role active lastLoginAt updatedAt', titleField: 'displayName', secondaryField: 'email' },
  comments: { model: Comment, searchField: 'body', select: 'body targetType status likeCount createdAt updatedAt', titleField: 'body', secondaryField: 'targetType' },
  reports: { model: Report, searchField: 'reason', select: 'reason targetType status details createdAt updatedAt', titleField: 'reason', secondaryField: 'targetType' },
  homepage: { model: HomepageSection, searchField: 'title', select: 'title key type enabled displayOrder updatedAt', titleField: 'title', secondaryField: 'key' },
  taxonomies: { model: Genre, searchField: 'name', select: 'name slug visible displayOrder updatedAt', titleField: 'name', secondaryField: 'slug' },
  media: { model: MediaAsset, searchField: 'fileName', select: 'fileName objectKey kind status size updatedAt', titleField: 'fileName', secondaryField: 'objectKey' },
  takedowns: { model: TakedownRequest, searchField: 'contentUrl', select: 'requester email contentUrl reason status createdAt updatedAt', titleField: 'contentUrl', secondaryField: 'requester' },
  settings: { model: SiteSetting, searchField: 'key', select: 'key value updatedAt', titleField: 'key' },
  audit: { model: AuditLog, searchField: 'action', select: 'action entity entityId createdAt metadata', titleField: 'action', secondaryField: 'entity' },
  messages: { model: ContactMessage, searchField: 'email', select: 'requester email message status createdAt updatedAt', titleField: 'requester', secondaryField: 'email' },
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function getAdminCollection(resource: ResourceKey, query = '', page = 1) {
  await connectDb();
  const definition = resources[resource];
  const filter: Record<string, unknown> = {
    ...(resource === 'subtitles' ? { status: { $ne: 'disabled' } } : {}),
    ...(resource === 'movies' ? { publicationStatus: { $ne: 'archived' } } : {}),
    ...(query ? { [definition.searchField]: { $regex: escapeRegex(query.slice(0, 80)), $options: 'i' } } : {}),
  };
  const [rawItems, total] = await Promise.all([
    definition.model.find(filter).select(definition.select).sort({ updatedAt: -1, createdAt: -1 }).skip((page - 1) * 30).limit(30).lean(),
    definition.model.countDocuments(filter),
  ]);
  const items = rawItems.map((item) => item as unknown as Record<string, unknown>);
  if (resource === 'taxonomies') {
    const languages = await Language.find(filter).select(definition.select).sort({ displayOrder: 1, name: 1 }).limit(30).lean();
    items.push(...languages.map((item) => ({ ...(item as unknown as Record<string, unknown>), taxonomyType: 'Language' })));
  }
  if (resource === 'subtitles') {
    const movieIds = items.map((item) => item.movie).filter(Boolean);
    const episodeIds = items.map((item) => item.episode).filter(Boolean);
    const [movies, episodes] = await Promise.all([
      movieIds.length ? Movie.find({ _id: { $in: movieIds } }).select('title').lean() : [],
      episodeIds.length ? Episode.find({ _id: { $in: episodeIds } }).select('title').lean() : [],
    ]);
    const movieTitles = new Map(movies.map((movie) => [String(movie._id), String(movie.title)]));
    const episodeTitles = new Map(episodes.map((episode) => [String(episode._id), String(episode.title)]));
    for (const item of items) {
      const movieId = item.movie ? String(item.movie) : '';
      const episodeId = item.episode ? String(item.episode) : '';
      item.contentTitle = movieTitles.get(movieId) ?? episodeTitles.get(episodeId) ?? 'Unknown linked content';
      item.contentType = movieId ? 'movie' : 'episode';
    }
  }
  return { items: items.map((item) => JSON.parse(JSON.stringify(item)) as Record<string, unknown>), total, titleField: definition.titleField, secondaryField: definition.secondaryField };
}

export async function getAdminAnalytics() {
  await connectDb();
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [downloads, searches, topDownloads, topSearches, eventCounts, topMovies, topSubtitles, topQualities, topMirrors, averageWatch] = await Promise.all([
    AnalyticsEvent.countDocuments({ eventType: { $in: ['direct_download_started', 'mirror_click', 'dotflix_click', 'telegram_mirror_click', 'subtitle_download'] }, createdAt: { $gte: since } }), SearchEvent.countDocuments({ createdAt: { $gte: since } }),
    DownloadEvent.aggregate<{ _id: { kind: string; targetId: unknown }; count: number }>([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: { kind: '$kind', targetId: '$targetId' }, count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 8 }]),
    SearchEvent.aggregate<{ _id: string; count: number }>([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: '$normalizedQuery', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 8 }]),
    AnalyticsEvent.aggregate<{ _id: string; count: number }>([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: '$eventType', count: { $sum: 1 } } }]),
    AnalyticsEvent.aggregate<{ _id: string; count: number }>([{ $match: { createdAt: { $gte: since }, contentType: 'movie', eventType: { $in: ['direct_download_started', 'mirror_click', 'dotflix_click', 'telegram_mirror_click'] } } }, { $group: { _id: '$contentId', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 8 }]),
    AnalyticsEvent.aggregate<{ _id: string; count: number }>([{ $match: { createdAt: { $gte: since }, eventType: 'subtitle_download' } }, { $group: { _id: '$contentId', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 8 }]),
    AnalyticsEvent.aggregate<{ _id: string; count: number }>([{ $match: { createdAt: { $gte: since }, quality: { $exists: true } } }, { $group: { _id: '$quality', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 8 }]),
    AnalyticsEvent.aggregate<{ _id: string; count: number }>([{ $match: { createdAt: { $gte: since }, providerType: { $exists: true } } }, { $group: { _id: '$providerType', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 8 }]),
    AnalyticsEvent.aggregate<{ averageSeconds: number }>([{ $match: { createdAt: { $gte: since }, eventType: 'watch_completed', durationSeconds: { $gt: 0 } } }, { $group: { _id: null, averageSeconds: { $avg: '$durationSeconds' } } }]).then((result) => result[0]?.averageSeconds ?? 0),
  ]);
  const counts = Object.fromEntries(eventCounts.map((item) => [item._id, item.count])) as Record<string, number>;
  const starts = counts.watch_started || 0; const buffers = counts.buffer_event || 0;
  const streamHealth = [
    { _id: 'Watch starts', count: starts },
    { _id: 'Data Saver enabled', count: counts.data_saver_enabled || 0 },
    { _id: 'Average completed session (minutes)', count: Number((averageWatch / 60).toFixed(1)) },
    { _id: 'Buffer events per start', count: starts ? Number((buffers / starts).toFixed(2)) : 0 },
  ];
  return { downloads, searches, topDownloads, topSearches, counts, topMovies, topSubtitles, topQualities: [...topQualities, ...streamHealth], topMirrors, streamHealth };
}

export async function getAdminOverview() {
  await connectDb();
  const [movies, series, subtitles, users, openReports, openTakedowns, openSubtitleRequests, downloads, recentAudit] = await Promise.all([
    Movie.countDocuments(), Series.countDocuments(), Subtitle.countDocuments(), User.countDocuments(), Report.countDocuments({ status: { $in: ['new', 'reviewing'] } }),
    TakedownRequest.countDocuments({ status: { $in: ['new', 'reviewing'] } }), SubtitleRequest.countDocuments({ status: 'open' }), DownloadEvent.countDocuments(), AuditLog.find().select('action entity entityId createdAt').sort({ createdAt: -1 }).limit(8).lean(),
  ]);
  return { movies, series, subtitles, users, openReports, openTakedowns, openSubtitleRequests, downloads, recentAudit: recentAudit.map((item) => JSON.parse(JSON.stringify(item)) as Record<string, unknown>) };
}

export async function getStorageStats() {
  await connectDb();
  const now = Date.now(); const active = { status: { $nin: ['disabled'] } };
  const [rows, bucketRows, growthRows, largest, recent, streamUsage] = await Promise.all([
    MediaAsset.aggregate<{ _id: string; bytes: number; count: number }>([{ $match: active }, { $project: { size: 1, category: { $cond: [{ $eq: ['$kind', 'media'] }, { $cond: [{ $eq: ['$metadata.purpose', 'stream_master'] }, 'masters', 'downloads'] }, '$kind'] } } }, { $group: { _id: '$category', bytes: { $sum: { $ifNull: ['$size', 0] } }, count: { $sum: 1 } } }, { $sort: { bytes: -1 } }]),
    MediaAsset.aggregate<{ _id: string; bytes: number; count: number }>([{ $match: active }, { $group: { _id: '$bucket', bytes: { $sum: { $ifNull: ['$size', 0] } }, count: { $sum: 1 } } }, { $sort: { bytes: -1 } }]),
    Promise.all([86_400_000, 7 * 86_400_000, 30 * 86_400_000].map((window) => MediaAsset.aggregate<{ bytes: number; count: number }>([{ $match: { ...active, createdAt: { $gte: new Date(now - window) } } }, { $group: { _id: null, bytes: { $sum: { $ifNull: ['$size', 0] } }, count: { $sum: 1 } } }]).then((result) => result[0] ?? { bytes: 0, count: 0 }))),
    MediaAsset.find(active).select('fileName kind bucket size status createdAt').sort({ size: -1 }).limit(8).lean(),
    MediaAsset.find(active).select('fileName kind bucket size status createdAt uploadedBy').sort({ createdAt: -1 }).limit(8).lean(),
    MediaStream.aggregate<{ bytes: number; count: number }>([{ $match: { status: { $ne: 'deleted' } } }, { $group: { _id: null, bytes: { $sum: { $ifNull: ['$totalBytes', 0] } }, count: { $sum: 1 } } }]).then((result) => result[0] ?? { bytes: 0, count: 0 }),
  ]);
  const categorizedRows = [...rows, { _id: 'streaming', bytes: streamUsage.bytes, count: streamUsage.count }].filter((row) => row.count > 0);
  const mediaBucket = bucketRows.find((row) => row._id === env.R2_MEDIA_BUCKET);
  if (mediaBucket) { mediaBucket.bytes += streamUsage.bytes; mediaBucket.count += streamUsage.count; }
  else if (streamUsage.count) bucketRows.push({ _id: env.R2_MEDIA_BUCKET, bytes: streamUsage.bytes, count: streamUsage.count });
  return { rows: categorizedRows, bucketRows, growth: { today: growthRows[0], week: growthRows[1], month: growthRows[2] }, largest: largest.map((item) => JSON.parse(JSON.stringify(item)) as Record<string, unknown>), recent: recent.map((item) => JSON.parse(JSON.stringify(item)) as Record<string, unknown>), totalBytes: categorizedRows.reduce((sum, row) => sum + row.bytes, 0), totalFiles: categorizedRows.reduce((sum, row) => sum + row.count, 0) };
}

export async function getAdminMediaVersions(contentId: string) {
  await connectDb();
  const versions = await MediaVersion.find({ contentId, contentType: 'movie' }).select('-r2ObjectKey -streamingManifestKey').sort({ createdAt: -1 }).lean();
  const mirrors = versions.length ? await DownloadMirror.find({ mediaVersion: { $in: versions.map((version) => version._id) } }).select('-url').sort({ priority: 1 }).lean() : [];
  return versions.map((version) => ({
    ...JSON.parse(JSON.stringify(version)) as Record<string, unknown>,
    mirrors: mirrors.filter((mirror) => String(mirror.mediaVersion) === String(version._id)).map((mirror) => JSON.parse(JSON.stringify(mirror)) as Record<string, unknown>),
  }));
}

export type { ResourceKey };

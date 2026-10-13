import 'server-only';
import { isValidObjectId } from 'mongoose';
import { connectDb } from '@/lib/db';
import { resolvePublicAssetUrl } from '@/lib/assets';
import { r2Configured } from '@/lib/r2';
import { assertMediaDistributionAllowed, mayDistributeFullMedia } from '@/lib/rights';
import { useDemoData } from '@/lib/env';
import { demoMovies } from '@/data/demo';
import { DownloadMirror, Episode, MediaAsset, MediaVersion, Movie, Series } from '@/models';
import type { RightsStatus } from '@/types/content';
import type { DownloadMirrorDto, MediaVersionDto } from '@/types/media';

type LeanRecord = Record<string, unknown>;

function mirrorDto(row: LeanRecord): DownloadMirrorDto {
  const storedHealth = String(row.active === false ? 'disabled' : row.healthStatus ?? 'unknown');
  const healthStatus = storedHealth === 'unavailable' ? 'offline' : storedHealth as DownloadMirrorDto['healthStatus'];
  return {
    id: String(row._id), providerName: String(row.providerName), providerType: row.providerType as DownloadMirrorDto['providerType'],
    label: row.label ? String(row.label) : undefined,
    priority: Number(row.priority ?? 100), supportsResume: Boolean(row.supportsResume), supportsRange: Boolean(row.supportsRange), requiresLogin: Boolean(row.requiresLogin),
    healthStatus,
    latencyMs: row.latencyMs === undefined ? undefined : Number(row.latencyMs),
    lastCheckedAt: row.lastCheckedAt ? new Date(row.lastCheckedAt as Date).toISOString() : undefined,
    redirectPath: `/download/${String(row.mediaVersion)}?server=${String(row._id)}`,
  };
}

function versionDto(row: LeanRecord, directAvailable: boolean, mirrors: DownloadMirrorDto[]): MediaVersionDto {
  return {
    id: String(row._id), _id: String(row._id), contentType: row.contentType as 'movie' | 'episode', quality: String(row.quality), resolution: String(row.resolution),
    releaseType: String(row.releaseType), videoCodec: row.videoCodec ? String(row.videoCodec) : undefined, audioCodec: row.audioCodec ? String(row.audioCodec) : undefined,
    container: row.container ? String(row.container) : undefined, audioLanguages: (row.audioLanguages as string[] | undefined) ?? [],
    embeddedSubtitleLanguages: (row.embeddedSubtitleLanguages as string[] | undefined) ?? [], fileName: String(row.fileName ?? 'CineSeya.lk media'),
    fileSize: Number(row.fileSize ?? 0), rightsStatus: row.rightsStatus as RightsStatus, directAvailable, mirrors,
  };
}

function demoVersions(contentId: string, contentType: 'movie' | 'episode'): MediaVersionDto[] {
  const movie = contentType === 'movie' ? demoMovies.find((item) => item.id === contentId) : undefined;
  if (!movie || !mayDistributeFullMedia(movie.rightsStatus)) return [];
  return [
    { id: `77${contentId.slice(2, 24)}`, _id: `77${contentId.slice(2, 24)}`, contentType, quality: '1080p', resolution: '1920×1080', releaseType: movie.releaseType ?? 'WEBRip', videoCodec: 'H264', audioCodec: 'AAC 5.1', container: 'MP4', audioLanguages: movie.languages, embeddedSubtitleLanguages: movie.subtitleLanguages, fileName: `${movie.slug}-1080p.mp4`, fileSize: 1_800_000_000, rightsStatus: movie.rightsStatus, directAvailable: false, mirrors: [] },
    { id: `78${contentId.slice(2, 24)}`, _id: `78${contentId.slice(2, 24)}`, contentType, quality: '720p', resolution: '1280×720', releaseType: movie.releaseType ?? 'WEBRip', videoCodec: 'H264', audioCodec: 'AAC', container: 'MP4', audioLanguages: movie.languages, embeddedSubtitleLanguages: movie.subtitleLanguages, fileName: `${movie.slug}-720p.mp4`, fileSize: 900_000_000, rightsStatus: movie.rightsStatus, directAvailable: false, mirrors: [] },
  ];
}

export async function getPublicMediaVersions(contentId: string, contentType: 'movie' | 'episode'): Promise<MediaVersionDto[]> {
  if (useDemoData) return demoVersions(contentId, contentType);
  await connectDb();
  const versions = await MediaVersion.find({ contentId, contentType, active: true, deletionStatus: { $ne: 'deleted' }, rightsStatus: { $in: ['owned', 'licensed', 'public_domain'] } })
    .select('contentType quality resolution releaseType videoCodec audioCodec container audioLanguages embeddedSubtitleLanguages fileName fileSize rightsStatus r2ObjectKey storageBucket').sort({ fileSize: -1 }).lean();
  if (!versions.length) return [];
  const [assets, mirrors] = await Promise.all([
    MediaAsset.find({ objectKey: { $in: versions.map((version) => version.r2ObjectKey) }, status: 'active' }).select('objectKey bucket').lean(),
    DownloadMirror.find({ mediaVersion: { $in: versions.map((version) => version._id) }, active: true }).select('-url').sort({ priority: 1 }).lean(),
  ]);
  const assetKeys = new Set(assets.map((asset) => `${String(asset.bucket)}:${String(asset.objectKey)}`));
  return versions.map((version) => versionDto(version as LeanRecord, r2Configured('media') && assetKeys.has(`${String(version.storageBucket)}:${String(version.r2ObjectKey)}`), mirrors.filter((mirror) => String(mirror.mediaVersion) === String(version._id)).map((mirror) => mirrorDto(mirror as LeanRecord))));
}

export async function resolveAuthorizedMediaVersion(mediaVersionId: string) {
  if (!isValidObjectId(mediaVersionId) || useDemoData) throw Object.assign(new Error('This media version is unavailable.'), { status: 404, code: 'NOT_FOUND' });
  await connectDb();
  const version = await MediaVersion.findOne({ _id: mediaVersionId, active: true, deletionStatus: { $ne: 'deleted' } }).lean();
  if (!version) throw Object.assign(new Error('This media version is unavailable.'), { status: 404, code: 'NOT_FOUND' });
  const content = version.contentType === 'movie'
    ? await Movie.findOne({ _id: version.contentId, publicationStatus: 'published' }).lean()
    : await Episode.findOne({ _id: version.contentId, publicationStatus: 'published' }).lean();
  if (!content) throw Object.assign(new Error('This title is unavailable.'), { status: 404, code: 'NOT_FOUND' });
  assertMediaDistributionAllowed(content.rightsStatus as RightsStatus, true);
  assertMediaDistributionAllowed(version.rightsStatus as RightsStatus, Boolean(version.active));
  const asset = await MediaAsset.findOne({ objectKey: version.r2ObjectKey, bucket: version.storageBucket, status: 'active' }).lean();
  if (!asset) throw Object.assign(new Error('Direct download is temporarily unavailable. Try an active mirror.'), { status: 503, code: 'DIRECT_DOWNLOAD_UNAVAILABLE' });
  return { version, content, asset };
}

export async function getDownloadPageData(mediaVersionId: string) {
  if (useDemoData) {
    for (const movie of demoMovies) {
      const version = demoVersions(movie.id, 'movie').find((item) => item.id === mediaVersionId);
      if (version) return { version, title: movie.title, posterUrl: movie.posterUrl, backHref: `/movies/${movie.slug}` };
    }
    return null;
  }
  try {
    const { version, content, asset } = await resolveAuthorizedMediaVersion(mediaVersionId);
    let backHref = `/movies/${String(content.slug)}`;
    if (version.contentType === 'episode' && content.series) {
      const series = await Series.findById(content.series).select('slug').lean();
      backHref = `/tv/${String(series?.slug ?? '')}`;
    }
    const mirrors = await DownloadMirror.find({ mediaVersion: version._id, active: true }).select('-url').sort({ priority: 1 }).lean();
    const directAvailable = r2Configured('media') && String(version.storageBucket) === String(asset.bucket);
    return {
      version: versionDto(version as LeanRecord, directAvailable, mirrors.map((mirror) => mirrorDto(mirror as LeanRecord))),
      title: String(content.title),
      year: Number(content.year ?? (content.releaseDate ? new Date(content.releaseDate as Date).getUTCFullYear() : 0)),
      posterUrl: resolvePublicAssetUrl(content.posterUrl ?? content.thumbnailUrl, '/media/fallback-poster.svg')!,
      backHref,
    };
  } catch { return null; }
}

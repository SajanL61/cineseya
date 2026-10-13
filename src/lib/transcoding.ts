import type { RenditionName, SourceProbe, StreamingRendition } from '@/types/streaming';

export type TranscodeProfile = {
  name: RenditionName;
  width: number;
  height: number;
  videoBitrate: number;
  audioBitrate: number;
};

export const DEFAULT_TRANSCODE_PROFILES: readonly TranscodeProfile[] = [
  { name: '360p', width: 640, height: 360, videoBitrate: 600_000, audioBitrate: 96_000 },
  { name: '480p', width: 854, height: 480, videoBitrate: 900_000, audioBitrate: 96_000 },
  { name: '720p', width: 1280, height: 720, videoBitrate: 2_000_000, audioBitrate: 128_000 },
  { name: '1080p', width: 1920, height: 1080, videoBitrate: 4_000_000, audioBitrate: 128_000 },
];

export function evenWidthForHeight(sourceWidth: number, sourceHeight: number, targetHeight: number) {
  const scaled = Math.round((sourceWidth / sourceHeight) * targetHeight);
  return Math.max(2, scaled % 2 === 0 ? scaled : scaled - 1);
}

export function selectTranscodeProfiles(
  source: Pick<SourceProbe, 'width' | 'height' | 'bitrate'>,
  requested?: readonly string[],
  profiles: readonly TranscodeProfile[] = DEFAULT_TRANSCODE_PROFILES,
) {
  const requestedSet = requested?.length ? new Set(requested) : null;
  const selected = profiles.filter((profile) => profile.height <= source.height && (!requestedSet || requestedSet.has(profile.name)));
  if (selected.length) return selected.map((profile) => ({ ...profile, width: evenWidthForHeight(source.width, source.height, profile.height) }));

  const height = Math.max(144, Math.floor(source.height / 2) * 2);
  const sourceRate = source.bitrate && source.bitrate > 0 ? Math.max(250_000, Math.min(source.bitrate, 600_000)) : 450_000;
  return [{
    name: `${height}p` as RenditionName,
    width: evenWidthForHeight(source.width, source.height, height),
    height,
    videoBitrate: sourceRate,
    audioBitrate: 64_000,
  }];
}

export function estimatedMegabytesPerHour(totalBitrate: number) {
  return Math.round((Math.max(0, totalBitrate) * 3_600) / 8 / 1_000_000);
}

export function parseFrameRate(value: unknown) {
  if (typeof value !== 'string' || !value) return 0;
  const [numerator, denominator = '1'] = value.split('/');
  const result = Number(numerator) / Number(denominator);
  return Number.isFinite(result) && result > 0 ? result : 0;
}

type ProbeStream = {
  index?: number;
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  r_frame_rate?: string;
  display_aspect_ratio?: string;
  bit_rate?: string;
  tags?: { language?: string; title?: string };
};

export function parseFfprobe(payload: unknown): SourceProbe {
  const value = payload as { streams?: ProbeStream[]; format?: { duration?: string; bit_rate?: string } };
  const streams = Array.isArray(value?.streams) ? value.streams : [];
  const video = streams.find((stream) => stream.codec_type === 'video');
  if (!video || !video.width || !video.height) throw new Error('No supported video stream was found.');
  const duration = Number(value.format?.duration);
  if (!Number.isFinite(duration) || duration <= 0 || duration > 12 * 60 * 60) throw new Error('The source duration is invalid or unsupported.');
  if (video.width < 160 || video.height < 120 || video.width > 8_192 || video.height > 8_192 || streams.length > 100) throw new Error('The source dimensions or stream count are unsupported.');
  const frameRate = parseFrameRate(video.avg_frame_rate) || parseFrameRate(video.r_frame_rate) || 24;
  const mapStreams = (kind: 'audio' | 'subtitle') => streams.filter((stream) => stream.codec_type === kind).map((stream) => ({
    index: Number(stream.index ?? 0), codec: String(stream.codec_name || 'unknown'), language: stream.tags?.language, title: stream.tags?.title,
  }));
  return {
    width: video.width,
    height: video.height,
    duration,
    frameRate,
    videoCodec: String(video.codec_name || 'unknown'),
    audioCodec: streams.find((stream) => stream.codec_type === 'audio')?.codec_name,
    bitrate: Number(video.bit_rate || value.format?.bit_rate) || undefined,
    aspectRatio: video.display_aspect_ratio,
    audioStreams: mapStreams('audio'),
    subtitleStreams: mapStreams('subtitle'),
  };
}

export function buildMasterPlaylist(renditions: readonly StreamingRendition[]) {
  if (!renditions.length) throw new Error('At least one rendition is required.');
  const rows = ['#EXTM3U', '#EXT-X-VERSION:3', '#EXT-X-INDEPENDENT-SEGMENTS'];
  for (const rendition of [...renditions].sort((left, right) => left.height - right.height)) {
    rows.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${rendition.bandwidth},AVERAGE-BANDWIDTH=${rendition.averageBandwidth},RESOLUTION=${rendition.width}x${rendition.height},CODECS="${rendition.codecs}"`,
      `${rendition.name}/index.m3u8`,
    );
  }
  return `${rows.join('\n')}\n`;
}

export function safeHlsRelativePath(parts: readonly string[]) {
  if (!parts.length) throw new Error('A stream object path is required.');
  const decoded = parts.map((part) => decodeURIComponent(part));
  if (decoded.some((part) => !part || part === '.' || part === '..' || part.includes('/') || part.includes('\\') || /[\u0000-\u001f\u007f]/.test(part))) {
    throw new Error('The stream object path is invalid.');
  }
  const path = decoded.join('/');
  if (!/^[a-zA-Z0-9._/-]+$/.test(path) || !/\.(m3u8|ts|m4s|mp4)$/i.test(path)) throw new Error('The stream object type is not allowed.');
  return path;
}

export function hlsContentType(path: string) {
  if (path.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl';
  if (path.endsWith('.ts')) return 'video/mp2t';
  if (path.endsWith('.m4s')) return 'video/iso.segment';
  return 'video/mp4';
}

export function buildTranscodeDedupeKey(masterAssetId: string, profileVersion: string, reprocessNonce?: string) {
  const base = `${masterAssetId}:${profileVersion}`;
  return reprocessNonce ? `${base}:${reprocessNonce}` : base;
}

export function buildAtomicClaim(workerId: string, now: Date, maxAttempts: number) {
  return {
    filter: { status: 'queued', attempts: { $lt: maxAttempts }, cancellationRequestedAt: { $exists: false } },
    update: { $set: { status: 'processing', workerId, lockedAt: now, startedAt: now, currentStage: 'downloading_master', progressPercent: 1 }, $inc: { attempts: 1 }, $unset: { failedAt: 1, errorCode: 1, safeErrorMessage: 1 } },
    options: { sort: { createdAt: 1 as const }, new: true },
  };
}

export function transcodeFailureState(attempts: number, maxAttempts: number, cancellationRequested: boolean) {
  if (cancellationRequested) return 'cancelled' as const;
  return attempts < maxAttempts ? 'queued' as const : 'failed' as const;
}

export function transcodeCanCancel(status: string) {
  return ['queued', 'processing', 'uploading'].includes(status);
}

import type { RightsStatus } from './content';

export const MEDIA_QUALITIES = ['480p', '720p', '1080p', '1440p', '2160p'] as const;
export const MEDIA_RELEASE_TYPES = ['WEB-DL', 'WEBRip', 'BluRay', 'HDRip', 'DVDRip', 'Other'] as const;
export const VIDEO_CODECS = ['H264', 'H265', 'AV1'] as const;
export const MEDIA_CONTAINERS = ['MP4', 'MKV', 'WEBM'] as const;
export const MIRROR_PROVIDER_TYPES = ['dotflix', 'telegram', 'backup', 'external', 'cloud_drive', 'custom'] as const;

export type DownloadMirrorDto = {
  id: string;
  providerName: string;
  providerType: (typeof MIRROR_PROVIDER_TYPES)[number];
  label?: string;
  priority: number;
  supportsResume: boolean;
  supportsRange: boolean;
  requiresLogin: boolean;
  /** `unavailable` is retained while legacy MongoDB rows are normalized to `offline`. */
  healthStatus: 'unknown' | 'online' | 'slow' | 'offline' | 'disabled' | 'unavailable';
  latencyMs?: number;
  lastCheckedAt?: string;
  redirectPath: string;
};

export type MediaVersionDto = {
  id: string;
  /** Preserves the independent download record when `id` is a streaming playback target. */
  downloadId?: string;
  /** Compatibility alias for older server-rendered episode views. */
  _id: string;
  contentType: 'movie' | 'episode';
  quality: string;
  resolution: string;
  releaseType: string;
  videoCodec?: string;
  audioCodec?: string;
  container?: string;
  audioLanguages: string[];
  embeddedSubtitleLanguages: string[];
  fileName: string;
  fileSize: number;
  rightsStatus: RightsStatus;
  directAvailable: boolean;
  mirrors: DownloadMirrorDto[];
};

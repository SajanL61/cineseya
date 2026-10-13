export const TRANSCODE_JOB_STATUSES = ['queued', 'processing', 'uploading', 'completed', 'failed', 'cancelled'] as const;
export type TranscodeJobStatus = (typeof TRANSCODE_JOB_STATUSES)[number];

export type RenditionName = '360p' | '480p' | '720p' | '1080p' | `${number}p`;

export type SourceProbe = {
  width: number;
  height: number;
  duration: number;
  frameRate: number;
  videoCodec: string;
  audioCodec?: string;
  bitrate?: number;
  aspectRatio?: string;
  audioStreams: Array<{ index: number; codec: string; language?: string; title?: string }>;
  subtitleStreams: Array<{ index: number; codec: string; language?: string; title?: string }>;
};

export type StreamingRendition = {
  name: RenditionName;
  width: number;
  height: number;
  videoBitrate: number;
  audioBitrate: number;
  bandwidth: number;
  averageBandwidth: number;
  codecs: string;
  playlistKey: string;
  segmentCount: number;
  bytes: number;
};

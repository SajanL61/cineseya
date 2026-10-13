import { describe, expect, it } from 'vitest';
import {
  buildAtomicClaim, buildMasterPlaylist, buildTranscodeDedupeKey, estimatedMegabytesPerHour, parseFfprobe,
  safeHlsRelativePath, selectTranscodeProfiles, transcodeCanCancel, transcodeFailureState,
} from '../src/lib/transcoding';
import { subtitleTextToVtt } from '../src/lib/subtitle-text';
import { buildStorageObjectKey } from '../src/lib/storage-key';

describe('professional HLS transcoding', () => {
  it('selects only renditions at or below the probed source resolution', () => {
    expect(selectTranscodeProfiles({ width: 1920, height: 1080 }).map((item) => item.name)).toEqual(['360p', '480p', '720p', '1080p']);
    expect(selectTranscodeProfiles({ width: 1280, height: 720 }).map((item) => item.name)).toEqual(['360p', '480p', '720p']);
    expect(selectTranscodeProfiles({ width: 854, height: 480 }, ['360p', '1080p']).map((item) => item.name)).toEqual(['360p']);
    expect(selectTranscodeProfiles({ width: 640, height: 360 }).map((item) => item.name)).toEqual(['360p']);
  });

  it('uses actual ffprobe data and rejects corrupt or unreasonable sources', () => {
    const source = parseFfprobe({ format: { duration: '60.25', bit_rate: '4200000' }, streams: [
      { index: 0, codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080, avg_frame_rate: '24000/1001', display_aspect_ratio: '16:9' },
      { index: 1, codec_type: 'audio', codec_name: 'aac', tags: { language: 'eng' } },
      { index: 2, codec_type: 'subtitle', codec_name: 'subrip', tags: { language: 'sin' } },
    ] });
    expect(source).toMatchObject({ width: 1920, height: 1080, duration: 60.25, videoCodec: 'h264', audioCodec: 'aac' });
    expect(source.frameRate).toBeCloseTo(23.976, 2);
    expect(source.subtitleStreams[0]?.language).toBe('sin');
    expect(() => parseFfprobe({ format: { duration: '60' }, streams: [{ codec_type: 'audio', codec_name: 'aac' }] })).toThrow('No supported video');
    expect(() => parseFfprobe({ format: { duration: '0' }, streams: [{ codec_type: 'video', width: 1920, height: 1080 }] })).toThrow('duration');
  });

  it('writes accurate HLS metadata and derives data estimates from configured bitrates', () => {
    const playlist = buildMasterPlaylist([{ name: '480p', width: 854, height: 480, videoBitrate: 900_000, audioBitrate: 96_000, bandwidth: 1_059_000, averageBandwidth: 996_000, codecs: 'avc1.4d401f,mp4a.40.2', playlistKey: 'unused', segmentCount: 10, bytes: 1_000 }]);
    expect(playlist).toContain('BANDWIDTH=1059000');
    expect(playlist).toContain('AVERAGE-BANDWIDTH=996000');
    expect(playlist).toContain('RESOLUTION=854x480');
    expect(playlist).toContain('480p/index.m3u8');
    expect(estimatedMegabytesPerHour(996_000)).toBe(448);
  });

  it('uses a deterministic duplicate key and an atomic queued-to-processing claim', () => {
    expect(buildTranscodeDedupeKey('asset-1', '1')).toBe(buildTranscodeDedupeKey('asset-1', '1'));
    expect(buildTranscodeDedupeKey('asset-1', '1', 'manual')).not.toBe(buildTranscodeDedupeKey('asset-1', '1'));
    const now = new Date('2026-01-01T00:00:00Z');
    const claim = buildAtomicClaim('worker-1', now, 2);
    expect(claim.filter).toMatchObject({ status: 'queued', attempts: { $lt: 2 } });
    expect(claim.update).toMatchObject({ $set: { status: 'processing', workerId: 'worker-1', lockedAt: now }, $inc: { attempts: 1 } });
    expect(claim.options.new).toBe(true);
  });

  it('bounds retries, supports cancellation, and rejects traversal in segment keys', () => {
    expect(transcodeFailureState(1, 2, false)).toBe('queued');
    expect(transcodeFailureState(2, 2, false)).toBe('failed');
    expect(transcodeFailureState(1, 2, true)).toBe('cancelled');
    expect(transcodeCanCancel('processing')).toBe(true);
    expect(transcodeCanCancel('completed')).toBe(false);
    expect(safeHlsRelativePath(['720p', 'segment00001.ts'])).toBe('720p/segment00001.ts');
    expect(() => safeHlsRelativePath(['..', 'master.m3u8'])).toThrow();
    expect(() => safeHlsRelativePath(['source.mp4.exe'])).toThrow();
  });

  it('keeps streaming masters, HLS, direct downloads, and original subtitles logically separate', () => {
    const common = { kind: 'media' as const, fileName: 'movie.mkv', linkedModel: 'Movie', linkedId: '66a000000000000000000001' };
    expect(buildStorageObjectKey({ ...common, purpose: 'stream_master' })).toMatch(/^masters\/movies\//);
    expect(buildStorageObjectKey({ ...common, purpose: 'download' })).toMatch(/^downloads\/movies\//);
    expect(subtitleTextToVtt('1\r\n00:00:00,000 --> 00:00:01,500\r\nආයුබෝවන්', 'srt')).toContain('00:00:00.000 --> 00:00:01.500');
  });
});

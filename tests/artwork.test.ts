import { describe, expect, it } from 'vitest';
import { artworkAssessment, focalPointPosition, normalizeFocalPoint } from '@/lib/artwork';
import { inspectImageBytes } from '@/lib/image-metadata';

function png(width: number, height: number) {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}

function jpeg(width: number, height: number) {
  const bytes = new Uint8Array(21);
  bytes.set([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08]);
  bytes[7] = height >> 8; bytes[8] = height & 0xff;
  bytes[9] = width >> 8; bytes[10] = width & 0xff;
  return bytes;
}

describe('artwork focal points', () => {
  it('defaults missing points to the center and clamps invalid percentages', () => {
    expect(normalizeFocalPoint(undefined)).toEqual({ x: 50, y: 50 });
    expect(normalizeFocalPoint({ x: -20, y: 140 })).toEqual({ x: 0, y: 100 });
    expect(focalPointPosition({ x: 24, y: 71 })).toBe('24% 71%');
  });

  it('warns about low-resolution and off-ratio artwork', () => {
    const warnings = artworkAssessment('poster', { width: 1920, height: 1080 });
    expect(warnings.some((item) => item.tone === 'warning' && item.message.includes('cropped'))).toBe(true);
  });
});

describe('server artwork inspection', () => {
  it('reads original PNG and JPEG dimensions', () => {
    expect(inspectImageBytes(png(1000, 1500), 'image/png')).toMatchObject({ width: 1000, height: 1500, aspectRatio: 2 / 3, mimeType: 'image/png' });
    expect(inspectImageBytes(jpeg(1920, 1080), 'image/jpeg')).toMatchObject({ width: 1920, height: 1080, aspectRatio: 16 / 9, mimeType: 'image/jpeg' });
  });

  it('rejects a declared MIME type that does not match the bytes', () => {
    expect(() => inspectImageBytes(png(600, 900), 'image/jpeg')).toThrow('do not match');
  });

  it('rejects unsupported or corrupt image bytes', () => {
    expect(() => inspectImageBytes(new Uint8Array([1, 2, 3]), 'image/png')).toThrow('not a valid supported image');
  });
});

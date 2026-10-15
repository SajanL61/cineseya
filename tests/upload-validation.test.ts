import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { multipartCompleteSchema, presignUploadSchema, validateSubtitleArchive } from '../src/lib/validation/upload';
import { sanitizeStorageFileName } from '../src/lib/storage-key';

describe('upload validation', () => {
  it('requires both an approved subtitle MIME type and extension', () => {
    expect(presignUploadSchema.safeParse({ kind: 'subtitle', fileName: 'release.srt', contentType: 'application/x-subrip', size: 1200 }).success).toBe(true);
    expect(presignUploadSchema.safeParse({ kind: 'subtitle', fileName: 'payload.exe', contentType: 'application/octet-stream', size: 1200 }).success).toBe(false);
    expect(presignUploadSchema.safeParse({ kind: 'poster', fileName: 'poster.svg', contentType: 'image/svg+xml', size: 1200 }).success).toBe(false);
  });

  it('rejects oversized uploads before issuing an R2 signature', () => {
    expect(presignUploadSchema.safeParse({ kind: 'subtitle', fileName: 'release.zip', contentType: 'application/zip', size: 5_000_001 }).success).toBe(false);
  });

  it('allows replacement tickets only for subtitle uploads', () => {
    const replacementFor = '67abc123def4567890abc123';
    expect(presignUploadSchema.safeParse({ kind: 'subtitle', fileName: 'release.srt', contentType: 'application/x-subrip', size: 1200, replacementFor }).success).toBe(true);
    expect(presignUploadSchema.safeParse({ kind: 'poster', fileName: 'poster.png', contentType: 'image/png', size: 1200, replacementFor }).success).toBe(false);
  });

  it('rejects paths and control characters while sanitizing safe display names', () => {
    expect(presignUploadSchema.safeParse({ kind: 'poster', fileName: '../poster.png', contentType: 'image/png', size: 1200 }).success).toBe(false);
    expect(presignUploadSchema.safeParse({ kind: 'poster', fileName: 'C:\\temp\\poster.png', contentType: 'image/png', size: 1200 }).success).toBe(false);
    expect(presignUploadSchema.safeParse({ kind: 'poster', fileName: 'poster\u0000.png', contentType: 'image/png', size: 1200 }).success).toBe(false);
    expect(sanitizeStorageFileName('My poster (2026).png')).toBe('My-poster-2026-.png');
  });

  it('requires unique multipart parts ordered from one', () => {
    expect(multipartCompleteSchema.safeParse({ uploadId: 'upload-1', parts: [{ ETag: 'etag-1', PartNumber: 1 }, { ETag: 'etag-2', PartNumber: 2 }] }).success).toBe(true);
    expect(multipartCompleteSchema.safeParse({ uploadId: 'upload-1', parts: [{ ETag: 'etag-2', PartNumber: 2 }, { ETag: 'etag-1', PartNumber: 1 }] }).success).toBe(false);
    expect(multipartCompleteSchema.safeParse({ uploadId: 'upload-1', parts: [{ ETag: 'etag-1', PartNumber: 1 }, { ETag: 'etag-2', PartNumber: 1 }] }).success).toBe(false);
  });

  it('accepts subtitle-only ZIP contents and rejects executable entries', async () => {
    const valid = new JSZip();
    valid.file('release/movie.si.srt', '1\n00:00:00,000 --> 00:00:01,000\nHello');
    await expect(validateSubtitleArchive(await valid.generateAsync({ type: 'uint8array' }))).resolves.toMatchObject({ fileCount: 1 });

    const invalid = new JSZip();
    invalid.file('install.exe', new Uint8Array([77, 90]));
    await expect(validateSubtitleArchive(await invalid.generateAsync({ type: 'uint8array' }))).rejects.toThrow('only .srt, .ass, or .vtt');
  });
});

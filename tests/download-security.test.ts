import { describe, expect, it } from 'vitest';
import { assertSafeMirrorUrl } from '../src/lib/validation/media';
import { buildStorageObjectKey, sanitizeStorageFileName } from '../src/lib/storage-key';
import { assertVerificationOrder, verificationExpired } from '../src/lib/download-verification-state';
import { buildShareTargets } from '../src/lib/share';

describe('download and storage security', () => {
  it('removes traversal and control characters from object filenames', () => {
    expect(sanitizeStorageFileName('../dangerous\u0000movie.mp4')).toBe('dangerousmovie.mp4');
    const key = buildStorageObjectKey({ kind: 'media', fileName: '../../movie file.mkv', linkedModel: 'Movie', linkedId: '66a000000000000000000001' });
    expect(key).toMatch(/^downloads\/movies\/66a000000000000000000001\/[a-f0-9-]+\/movie-file\.mkv$/);
    expect(key).not.toContain('..');
  });

  it('accepts public HTTPS mirrors and rejects local/private targets', () => {
    expect(assertSafeMirrorUrl('https://downloads.example.com/file')).toBeInstanceOf(URL);
    expect(() => assertSafeMirrorUrl('http://downloads.example.com/file')).toThrow();
    expect(() => assertSafeMirrorUrl('https://127.0.0.1/file')).toThrow();
    expect(() => assertSafeMirrorUrl('https://192.168.1.8/file')).toThrow();
    expect(() => assertSafeMirrorUrl('https://[::1]/file')).toThrow();
    expect(() => assertSafeMirrorUrl('https://169.254.169.254/latest/meta-data')).toThrow();
    expect(() => assertSafeMirrorUrl('https://user:pass@example.com/file')).toThrow();
  });

  it('prevents verification order bypass and rejects expired sessions', () => {
    const validUntil = new Date(Date.now() + 60_000);
    expect(() => assertVerificationOrder({ expiresAt: validUntil }, 'security')).toThrow('in order');
    expect(() => assertVerificationOrder({ expiresAt: validUntil, step1CompletedAt: new Date() }, 'generate')).toThrow('in order');
    expect(() => assertVerificationOrder({ expiresAt: validUntil, step1CompletedAt: new Date(), step2CompletedAt: new Date() }, 'generate')).not.toThrow();
    expect(verificationExpired(new Date(Date.now() - 1))).toBe(true);
    expect(() => assertVerificationOrder({ expiresAt: new Date(Date.now() - 1), step1CompletedAt: new Date() }, 'security')).toThrow('expired');
  });

  it('builds provider share links from only the canonical public page', () => {
    const canonical = 'https://cineseya.lk/movies/example';
    const targets = buildShareTargets('Example', canonical);
    expect(decodeURIComponent(targets.whatsapp)).toContain(canonical);
    expect(decodeURIComponent(targets.facebook)).toContain(canonical);
    expect(decodeURIComponent(targets.telegram)).toContain(canonical);
    expect(Object.values(targets).join(' ')).not.toContain('/api/download/');
  });
});

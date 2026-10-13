import { describe, expect, it, vi } from 'vitest';
import worker from '../cloudflare/download-worker/src/index.js';
import { createDownloadToken, verifyDownloadToken } from '../src/lib/download-token';
import { env } from '../src/lib/env';

const secret = env.DOWNLOAD_SIGNING_SECRET;
const payload = (exp: number) => ({ mediaVersionId: '66a000000000000000000001', objectKey: 'media/movies/example.mp4', bucket: 'cineseya-media', fileName: 'example.mp4', contentType: 'video/mp4', exp });

describe('short-lived download tokens and Worker ranges', () => {
  it('rejects expired and tampered download tokens', () => {
    const expired = createDownloadToken(payload(Math.floor(Date.now() / 1_000) - 1));
    expect(() => verifyDownloadToken(expired)).toThrow('expired');
    const valid = createDownloadToken(payload(Math.floor(Date.now() / 1_000) + 60));
    expect(verifyDownloadToken(valid).objectKey).toBe(payload(0).objectKey);
    expect(() => verifyDownloadToken(`${valid.slice(0, -1)}x`)).toThrow('invalid');
  });

  it('serves verified byte ranges with a 206 response', async () => {
    const token = createDownloadToken(payload(Math.floor(Date.now() / 1_000) + 60));
    const get = vi.fn(async () => ({
      body: new Uint8Array([2, 3, 4, 5]), size: 10, range: { offset: 2, length: 4 }, httpEtag: '"etag"',
      writeHttpMetadata(headers: Headers) { headers.set('Content-Type', 'video/mp4'); },
    }));
    const response = await worker.fetch(new Request(`https://dl.cineseya.lk/v1/files/${token}`, { headers: { Range: 'bytes=2-5' } }), { DOWNLOAD_SIGNING_SECRET: secret, MEDIA_BUCKET_NAME: 'cineseya-media', MEDIA_BUCKET: { get } });
    expect(response.status).toBe(206);
    expect(response.headers.get('Accept-Ranges')).toBe('bytes');
    expect(response.headers.get('Content-Range')).toBe('bytes 2-5/10');
    expect(get).toHaveBeenCalledOnce();
  });
});

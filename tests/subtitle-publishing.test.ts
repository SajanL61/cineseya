import { describe, expect, it } from 'vitest';
import { subtitlePublishConfirmation, subtitlePublishRequest } from '../src/lib/client/subtitle-publishing';

describe('subtitle publishing request', () => {
  it('targets only the selected subtitle record and preserves verification state', () => {
    const request = subtitlePublishRequest('67abc123def4567890abc123', 'csrf-token');

    expect(request.url).toBe('/api/admin/subtitles/67abc123def4567890abc123');
    expect(request.init.method).toBe('PATCH');
    expect(request.init.headers).toEqual({ 'Content-Type': 'application/json', 'x-csrf-token': 'csrf-token' });
    expect(JSON.parse(String(request.init.body))).toEqual({ status: 'published' });
    expect(JSON.parse(String(request.init.body))).not.toHaveProperty('verified');
  });

  it('includes the subtitle and linked content details in the confirmation', () => {
    const message = subtitlePublishConfirmation({ fileName: 'release.si.srt', language: 'Sinhala', contentTitle: 'The Youth', contentType: 'movie' });

    expect(message).toContain('release.si.srt');
    expect(message).toContain('Sinhala');
    expect(message).toContain('Movie: The Youth');
  });
});

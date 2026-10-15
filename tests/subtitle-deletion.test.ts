import { describe, expect, it } from 'vitest';
import { subtitleDeleteConfirmation, subtitleDeleteRequest } from '../src/lib/client/subtitle-deletion';

describe('subtitle deletion request', () => {
  it('targets only the selected subtitle with CSRF protection', () => {
    const request = subtitleDeleteRequest('67abc123def4567890abc123', 'csrf-token');

    expect(request.url).toBe('/api/admin/subtitles/67abc123def4567890abc123');
    expect(request.init.method).toBe('DELETE');
    expect(request.init.headers).toEqual({ 'x-csrf-token': 'csrf-token' });
  });

  it('identifies the file and linked content before deletion', () => {
    const message = subtitleDeleteConfirmation({ fileName: 'release.si.srt', language: 'Sinhala', contentTitle: 'The Youth', contentType: 'movie' });

    expect(message).toContain('release.si.srt');
    expect(message).toContain('Sinhala');
    expect(message).toContain('Movie: The Youth');
    expect(message).toContain('uploaded file will be kept');
  });
});

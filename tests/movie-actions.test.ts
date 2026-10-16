import { describe, expect, it } from 'vitest';
import { movieArchiveConfirmation, movieArchiveRequest, moviePublishConfirmation, moviePublishRequest } from '../src/lib/client/movie-actions';
import { adminCreditListSchema, moviePublicationPatchSchema } from '../src/lib/validation/movie';

describe('movie table actions', () => {
  it('publishes only the selected movie with a narrow status patch', () => {
    const request = moviePublishRequest('67abc123def4567890abc123', 'csrf-token');

    expect(request.url).toBe('/api/admin/movies/67abc123def4567890abc123');
    expect(request.init.method).toBe('PATCH');
    expect(request.init.headers).toEqual({ 'Content-Type': 'application/json', 'x-csrf-token': 'csrf-token' });
    expect(JSON.parse(request.init.body)).toEqual({ publicationStatus: 'published' });
    expect(moviePublicationPatchSchema.parse(JSON.parse(request.init.body))).toEqual({ publicationStatus: 'published' });
  });

  it('rejects extra fields in the table publication patch', () => {
    expect(() => moviePublicationPatchSchema.parse({ publicationStatus: 'published', title: 'Changed' })).toThrow();
  });

  it('archives only the selected movie with CSRF protection', () => {
    const request = movieArchiveRequest('67abc123def4567890abc123', 'csrf-token');

    expect(request.url).toBe('/api/admin/movies/67abc123def4567890abc123');
    expect(request.init.method).toBe('DELETE');
    expect(request.init.headers).toEqual({ 'x-csrf-token': 'csrf-token' });
  });

  it('identifies the movie before either action', () => {
    expect(moviePublishConfirmation('The Youth')).toContain('Movie: The Youth');
    expect(movieArchiveConfirmation('The Youth')).toContain('Movie: The Youth');
    expect(movieArchiveConfirmation('The Youth')).toContain('linked media will be preserved');
  });

  it('removes duplicate cast or crew people during API validation', () => {
    expect(adminCreditListSchema.parse([
      { name: 'Zachary Levi', slug: 'zachary-levi', character: 'Tucker' },
      { name: 'Zachary Levi', slug: 'zachary-levi-copy', character: 'Tucker' },
      { name: 'Liam Neeson', slug: 'liam-neeson', character: 'Larry' },
    ])).toEqual([
      { name: 'Zachary Levi', slug: 'zachary-levi', character: 'Tucker' },
      { name: 'Liam Neeson', slug: 'liam-neeson', character: 'Larry' },
    ]);
  });
});

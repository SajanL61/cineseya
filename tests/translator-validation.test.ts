import { describe, expect, it } from 'vitest';
import { translatorProfileInputSchema } from '@/lib/validation/translator';

describe('translator profile validation', () => {
  it('normalizes supported profile values', () => {
    const profile = translatorProfileInputSchema.parse({
      displayName: '  Kasun Jayawardena  ',
      slug: 'Kasun-Jayawardena',
      bio: '  Sinhala subtitle translator.  ',
      avatarUrl: '  avatars/kasun/profile.webp  ',
      userId: '507f1f77bcf86cd799439011',
      verified: true,
    });

    expect(profile).toEqual({
      displayName: 'Kasun Jayawardena',
      slug: 'kasun-jayawardena',
      bio: 'Sinhala subtitle translator.',
      avatarUrl: 'avatars/kasun/profile.webp',
      userId: '507f1f77bcf86cd799439011',
      verified: true,
    });
  });

  it('supplies safe defaults for optional profile fields', () => {
    expect(translatorProfileInputSchema.parse({ displayName: 'Nethmi Perera', slug: 'nethmi-perera' })).toMatchObject({
      bio: '',
      avatarUrl: '',
      userId: null,
      verified: false,
    });
  });

  it.each([
    { field: 'slug', value: 'bad slug' },
    { field: 'slug', value: '-bad-slug' },
    { field: 'userId', value: 'not-an-object-id' },
    { field: 'bio', value: 'a'.repeat(2_001) },
    { field: 'avatarUrl', value: 'a'.repeat(2_001) },
  ])('rejects an invalid $field', ({ field, value }) => {
    const result = translatorProfileInputSchema.safeParse({
      displayName: 'Valid Translator',
      slug: 'valid-translator',
      [field]: value,
    });

    expect(result.success).toBe(false);
  });
});

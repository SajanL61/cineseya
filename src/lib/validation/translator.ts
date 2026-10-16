import { z } from 'zod';

const objectId = /^[a-f\d]{24}$/i;
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const translatorProfileInputSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  slug: z.string().trim().toLowerCase().min(2).max(120).regex(slug, 'Use lowercase letters, numbers, and single hyphens only.'),
  bio: z.string().trim().max(2_000).default(''),
  avatarUrl: z.string().trim().max(2_000).default(''),
  userId: z.union([z.string().trim().regex(objectId, 'Select a valid user account.'), z.null()]).default(null),
  verified: z.boolean().default(false),
});

export type TranslatorProfileInput = z.infer<typeof translatorProfileInputSchema>;

import { z } from 'zod';
import { RIGHTS_STATUSES } from '@/types/content';

const optionalUrl = z.union([z.literal(''), z.url()]).optional();
const credit = z.object({ name: z.string().trim().min(1).max(160), slug: z.string().trim().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), role: z.string().trim().max(120).optional(), character: z.string().trim().max(160).optional() });
export const adminMovieSchema = z.object({
  title: z.string().trim().min(1).max(240), originalTitle: z.string().trim().max(240).optional(), sinhalaTitle: z.string().trim().max(240).optional(),
  alternativeTitles: z.array(z.string().trim().min(1).max(240)).max(30).default([]), searchAliases: z.array(z.string().trim().min(1).max(240)).max(30).default([]),
  slug: z.string().trim().min(2).max(240).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), overview: z.string().trim().min(20).max(8_000),
  year: z.coerce.number().int().min(1888).max(2200), releaseDate: z.coerce.date(), runtime: z.coerce.number().int().min(0).max(1_500), ageRating: z.string().trim().max(32),
  genres: z.array(z.string().trim().min(1)).max(24), languages: z.array(z.string().trim().min(1)).max(24), countries: z.array(z.string().trim().min(1)).max(24),
  releaseType: z.string().trim().max(32).optional(), videoQuality: z.string().trim().max(16).optional(),
  cast: z.array(credit).max(100).default([]), crew: z.array(credit).max(100).default([]),
  posterUrl: z.string().trim().min(1).max(2_000), backdropUrl: z.string().trim().min(1).max(2_000), trailerUrl: optionalUrl,
  imdbId: z.string().trim().max(32).optional(), tmdbId: z.string().trim().max(32).optional(), imdbRating: z.coerce.number().min(0).max(10).optional(), tmdbRating: z.coerce.number().min(0).max(10).optional(),
  rightsStatus: z.enum(RIGHTS_STATUSES), publicationStatus: z.enum(['draft','scheduled','published','archived']), releaseStatus: z.string().trim().max(80).default('Released'),
  featured: z.boolean().default(false), trending: z.boolean().default(false), editorPick: z.boolean().default(false), scheduledAt: z.coerce.date().optional(),
  seo: z.object({ title: z.string().trim().max(70).optional(), description: z.string().trim().max(170).optional(), canonical: optionalUrl, noindex: z.boolean().default(false) }),
}).superRefine((value, context) => { if (value.publicationStatus === 'scheduled' && !value.scheduledAt) context.addIssue({ code: 'custom', path: ['scheduledAt'], message: 'Choose a scheduled publication date.' }); });

export type AdminMovieInput = z.infer<typeof adminMovieSchema>;

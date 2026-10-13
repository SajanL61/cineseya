import { z } from 'zod';

export const createTranscodeJobSchema = z.object({
  assetId: z.string().trim().min(1),
  contentId: z.string().trim().min(1),
  contentType: z.enum(['movie', 'episode']).default('movie'),
  requestedRenditions: z.array(z.enum(['360p', '480p', '720p', '1080p'])).max(4).default([]),
  language: z.string().trim().max(80).optional(),
  defaultAudio: z.string().trim().max(80).optional(),
  subtitleHandling: z.enum(['separate', 'ignore']).default('separate'),
  notes: z.string().trim().max(2_000).optional(),
  keepMaster: z.boolean().default(true),
  force: z.boolean().default(false),
});

export const transcodeJobActionSchema = z.object({ action: z.enum(['retry', 'cancel', 'reprocess']) });

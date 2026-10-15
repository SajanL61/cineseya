import { z } from 'zod';

export const subtitleFormats = ['srt', 'ass', 'vtt', 'zip'] as const;

export const subtitlePatchSchema = z.object({
  expectedUpdatedAt: z.coerce.date().optional(),
  status: z.enum(['draft', 'published', 'disabled']).optional(),
  verified: z.boolean().optional(),
  contentType: z.enum(['movie', 'episode']).optional(),
  contentId: z.string().optional(),
  translatorId: z.string().optional(),
  language: z.string().trim().min(2).max(80).optional(),
  languageCode: z.string().trim().min(2).max(12).toLowerCase().optional(),
  releaseMatches: z.array(z.string().trim().min(1).max(240)).max(30).optional(),
  fps: z.number().positive().max(240).nullable().optional(),
  version: z.number().int().min(1).max(100).optional(),
  hearingImpaired: z.boolean().optional(),
  replacementAssetId: z.string().optional(),
}).strict().superRefine((value, context) => {
  const hasContentType = value.contentType !== undefined;
  const hasContentId = value.contentId !== undefined;
  if (hasContentType !== hasContentId) context.addIssue({ code: 'custom', path: ['contentId'], message: 'Content type and content selection must be updated together.' });
  if (value.contentId !== undefined && !/^[a-f\d]{24}$/i.test(value.contentId)) context.addIssue({ code: 'custom', path: ['contentId'], message: 'The selected content record is invalid.' });
  if (value.translatorId !== undefined && !/^[a-f\d]{24}$/i.test(value.translatorId)) context.addIssue({ code: 'custom', path: ['translatorId'], message: 'The selected translator is invalid.' });
  if (value.replacementAssetId !== undefined && !/^[a-f\d]{24}$/i.test(value.replacementAssetId)) context.addIssue({ code: 'custom', path: ['replacementAssetId'], message: 'The replacement upload is invalid.' });
  if (isSubtitleMetadataPatch(value) && !value.expectedUpdatedAt) context.addIssue({ code: 'custom', path: ['expectedUpdatedAt'], message: 'Reload this subtitle before saving changes.' });
});

export type SubtitlePatchInput = z.infer<typeof subtitlePatchSchema>;

const metadataFields: Array<keyof SubtitlePatchInput> = [
  'contentType', 'contentId', 'translatorId', 'language', 'languageCode', 'releaseMatches', 'fps', 'version', 'hearingImpaired', 'replacementAssetId',
];

export function isSubtitleMetadataPatch(input: Partial<SubtitlePatchInput>) {
  return metadataFields.some((field) => input[field] !== undefined);
}

export function shouldNotifySubtitlePublished(previousStatus: string, nextStatus: string) {
  return previousStatus !== 'published' && nextStatus === 'published';
}

export function subtitleRevisionFilter(id: string, input: SubtitlePatchInput) {
  return { _id: id, ...(isSubtitleMetadataPatch(input) ? { updatedAt: input.expectedUpdatedAt } : {}) };
}

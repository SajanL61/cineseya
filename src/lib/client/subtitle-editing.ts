export type SubtitleContentType = 'movie' | 'episode';
export type SubtitleSelection = { id: string; label: string };

export type SubtitleEditableRecord = {
  id: string;
  fileName: string;
  fileSize: number;
  format: string;
  contentType: SubtitleContentType;
  contentId: string;
  contentLabel: string;
  contentMissing: boolean;
  translatorId: string;
  translatorLabel: string;
  translatorMissing: boolean;
  language: string;
  languageCode: string;
  releaseMatches: string[];
  fps: number | null;
  version: number;
  hearingImpaired: boolean;
  status: string;
  verified: boolean;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
};

export type SubtitleEditValues = {
  contentType: SubtitleContentType;
  content: SubtitleSelection;
  translator: SubtitleSelection;
  language: string;
  languageCode: string;
  releaseMatches: string[];
  fps: number | null;
  version: number;
  hearingImpaired: boolean;
};

export function subtitleEditPayload(record: SubtitleEditableRecord, values: SubtitleEditValues, replacementAssetId?: string) {
  return {
    expectedUpdatedAt: record.updatedAt,
    contentType: values.contentType,
    contentId: values.content.id,
    translatorId: values.translator.id,
    language: values.language.trim(),
    languageCode: values.languageCode.trim().toLocaleLowerCase(),
    releaseMatches: values.releaseMatches.map((value) => value.trim()).filter(Boolean),
    fps: values.fps,
    version: values.version,
    hearingImpaired: values.hearingImpaired,
    ...(replacementAssetId ? { replacementAssetId } : {}),
  };
}

export function subtitleAssociationChanged(record: SubtitleEditableRecord, values: SubtitleEditValues) {
  return record.contentType !== values.contentType || record.contentId !== values.content.id;
}

export function subtitleAssociationConfirmation(record: SubtitleEditableRecord, values: SubtitleEditValues) {
  return [
    'Change the linked content for this subtitle?',
    '',
    `Old: ${record.contentLabel}`,
    `New: ${values.content.label}`,
    '',
    'This will move the subtitle to the new public movie or episode page.',
  ].join('\n');
}

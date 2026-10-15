import { describe, expect, it } from 'vitest';
import { subtitleAssociationChanged, subtitleAssociationConfirmation, subtitleEditPayload, type SubtitleEditableRecord, type SubtitleEditValues } from '../src/lib/client/subtitle-editing';
import { shouldNotifySubtitlePublished, subtitlePatchSchema, subtitleRevisionFilter } from '../src/lib/validation/subtitle';

const record: SubtitleEditableRecord = {
  id: '67abc123def4567890abc123', fileName: 'release.si.srt', fileSize: 1200, format: 'srt',
  contentType: 'movie', contentId: '67abc123def4567890abc124', contentLabel: 'The Youth (2026)', contentMissing: false,
  translatorId: '67abc123def4567890abc125', translatorLabel: 'Nethmi Perera', translatorMissing: false,
  language: 'Sinhala', languageCode: 'si', releaseMatches: ['1080p WEB-DL'], fps: 23.976, version: 1,
  hearingImpaired: false, status: 'draft', verified: false, downloadCount: 42,
  createdAt: '2026-10-15T00:00:00.000Z', updatedAt: '2026-10-15T01:00:00.000Z',
};

const values: SubtitleEditValues = {
  contentType: 'movie', content: { id: record.contentId, label: record.contentLabel },
  translator: { id: record.translatorId, label: record.translatorLabel }, language: 'Sinhala', languageCode: 'si',
  releaseMatches: ['1080p WEB-DL'], fps: 23.976, version: 1, hearingImpaired: false,
};

describe('subtitle editing', () => {
  it('builds a metadata-only update without file or publication mutations', () => {
    const payload = subtitleEditPayload(record, { ...values, language: 'Sinhala Updated' });
    expect(payload).toMatchObject({ expectedUpdatedAt: record.updatedAt, contentId: record.contentId, translatorId: record.translatorId, language: 'Sinhala Updated' });
    expect(payload).not.toHaveProperty('replacementAssetId');
    expect(payload).not.toHaveProperty('status');
    expect(payload).not.toHaveProperty('verified');
    expect(payload).not.toHaveProperty('fileKey');
  });

  it('references a validated replacement asset without accepting client file metadata', () => {
    const payload = subtitleEditPayload(record, values, '67abc123def4567890abc127');
    expect(payload.replacementAssetId).toBe('67abc123def4567890abc127');
    expect(payload).not.toHaveProperty('fileName');
    expect(payload).not.toHaveProperty('fileSize');
    expect(payload).not.toHaveProperty('format');
    expect(subtitlePatchSchema.safeParse(payload).success).toBe(true);
  });

  it('accepts only allowlisted editable fields and requires a revision for metadata edits', () => {
    expect(subtitlePatchSchema.safeParse({ language: 'Sinhala' }).success).toBe(false);
    expect(subtitlePatchSchema.safeParse({ language: 'Sinhala', expectedUpdatedAt: record.updatedAt }).success).toBe(true);
    expect(subtitlePatchSchema.safeParse({ expectedUpdatedAt: record.updatedAt, fileKey: 'arbitrary/object.srt' }).success).toBe(false);
    expect(subtitlePatchSchema.safeParse({ status: 'published' }).success).toBe(true);
  });

  it('uses updatedAt in the atomic filter for edit conflict protection', () => {
    const input = subtitlePatchSchema.parse({ language: 'Sinhala Updated', expectedUpdatedAt: record.updatedAt });
    expect(subtitleRevisionFilter(record.id, input)).toEqual({ _id: record.id, updatedAt: new Date(record.updatedAt) });
  });

  it('shows old and new titles before moving a subtitle', () => {
    const moved = { ...values, contentType: 'episode' as const, content: { id: '67abc123def4567890abc126', label: 'Series · S1 E2 · Episode' } };
    expect(subtitleAssociationChanged(record, moved)).toBe(true);
    expect(subtitleAssociationConfirmation(record, moved)).toContain('Old: The Youth (2026)');
    expect(subtitleAssociationConfirmation(record, moved)).toContain('New: Series · S1 E2 · Episode');
  });

  it('notifies only on the first transition into published state', () => {
    expect(shouldNotifySubtitlePublished('draft', 'published')).toBe(true);
    expect(shouldNotifySubtitlePublished('published', 'published')).toBe(false);
    expect(shouldNotifySubtitlePublished('published', 'disabled')).toBe(false);
  });
});

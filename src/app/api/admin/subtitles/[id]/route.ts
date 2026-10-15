import { isValidObjectId } from 'mongoose';
import { assertMutationRequest, requirePermission } from '@/lib/auth';
import { connectDb } from '@/lib/db';
import { apiError } from '@/lib/http';
import { AuditLog, Episode, MediaAsset, Movie, Series, Subtitle, TranslatorProfile } from '@/models';
import { publishSubtitleNotifications } from '@/services/notifications';
import { shouldNotifySubtitlePublished, subtitleFormats, subtitlePatchSchema, subtitleRevisionFilter } from '@/lib/validation/subtitle';

type ContentSummary = { type: 'movie' | 'episode'; id: string; label: string; missing: boolean; seriesId?: string };
type ReplacementAsset = { _id: unknown; objectKey: unknown; fileName: unknown; size: unknown };

const plain = (value: unknown) => value as Record<string, unknown>;
const sameList = (left: unknown, right: string[]) => JSON.stringify(Array.isArray(left) ? left.map(String) : []) === JSON.stringify(right);
const extensionOf = (fileName: string) => fileName.split('.').pop()?.toLocaleLowerCase() ?? '';

async function contentSummary(row: Record<string, unknown>): Promise<ContentSummary> {
  if (row.movie) {
    const movie = await Movie.findById(row.movie).select('title year').lean();
    return { type: 'movie', id: String(row.movie), label: movie ? `${movie.title} (${movie.year})` : 'Missing linked movie', missing: !movie };
  }
  const episode = row.episode ? await Episode.findById(row.episode).select('title series seasonNumber episodeNumber').lean() : null;
  const series = episode ? await Series.findById(episode.series).select('title').lean() : null;
  return {
    type: 'episode', id: String(row.episode ?? ''),
    label: episode ? `${series?.title ?? 'Unknown series'} · S${episode.seasonNumber} E${episode.episodeNumber} · ${episode.title}` : 'Missing linked episode',
    missing: !episode, seriesId: episode ? String(episode.series) : row.series ? String(row.series) : undefined,
  };
}

async function editableSubtitle(id: string) {
  const subtitle = await Subtitle.findById(id).lean();
  if (!subtitle) throw Object.assign(new Error('Subtitle was not found.'), { status: 404, code: 'NOT_FOUND' });
  return plain(subtitle);
}

async function assertTranslatorOwnership(user: { id: string; role: string }, subtitle: Record<string, unknown>) {
  if (user.role !== 'translator') return;
  const profile = await TranslatorProfile.findOne({ user: user.id }).select('_id').lean();
  if (!profile || String(profile._id) !== String(subtitle.translator)) throw Object.assign(new Error('You may edit only your own subtitle records.'), { status: 403, code: 'FORBIDDEN' });
}

function responseRecord(row: Record<string, unknown>, content: ContentSummary, translator: Record<string, unknown> | null) {
  return {
    id: String(row._id), fileName: String(row.fileName), fileSize: Number(row.fileSize), format: String(row.format),
    contentType: content.type, contentId: content.id, contentLabel: content.label, contentMissing: content.missing,
    translatorId: String(row.translator ?? ''), translatorLabel: translator ? String(translator.displayName) : 'Missing translator profile', translatorMissing: !translator,
    language: String(row.language), languageCode: String(row.languageCode), releaseMatches: Array.isArray(row.releaseMatches) ? row.releaseMatches.map(String) : [],
    fps: row.fps === undefined || row.fps === null ? null : Number(row.fps), version: Number(row.version), hearingImpaired: Boolean(row.hearingImpaired),
    status: String(row.status), verified: Boolean(row.verified), downloadCount: Number(row.downloadCount),
    createdAt: new Date(row.createdAt as Date).toISOString(), updatedAt: new Date(row.updatedAt as Date).toISOString(),
  };
}

export async function GET(_request: Request, { params }: RouteContext<'/api/admin/subtitles/[id]'>) {
  try {
    await requirePermission('subtitles.read');
    const { id } = await params;
    if (!isValidObjectId(id)) throw Object.assign(new Error('Subtitle was not found.'), { status: 404, code: 'NOT_FOUND' });
    await connectDb();
    const subtitle = await editableSubtitle(id);
    const [content, translator] = await Promise.all([contentSummary(subtitle), TranslatorProfile.findById(subtitle.translator).select('displayName').lean()]);
    return Response.json({ subtitle: responseRecord(subtitle, content, translator ? plain(translator) : null) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext<'/api/admin/subtitles/[id]'>) {
  try {
    const session = await requirePermission('subtitles.update');
    await assertMutationRequest(request, session);
    const { id } = await params;
    if (!isValidObjectId(id)) throw Object.assign(new Error('Subtitle was not found.'), { status: 404, code: 'NOT_FOUND' });
    const input = subtitlePatchSchema.parse(await request.json());
    await connectDb();
    const current = await editableSubtitle(id);
    await assertTranslatorOwnership(session.user, current);
    const canVerify = session.user.permissions.includes('subtitles.verify');
    if ((String(current.status) === 'published' || input.status === 'published' || input.verified !== undefined) && !canVerify) throw Object.assign(new Error('Verification permission is required to publish, verify, or edit a published subtitle.'), { status: 403, code: 'FORBIDDEN' });

    const beforeContent = await contentSummary(current);
    const set: Record<string, unknown> = {};
    const unset: Record<string, 1> = {};
    const changes: Record<string, { before: unknown; after: unknown }> = {};
    let invalidatesReview = false;
    let replacementAsset: ReplacementAsset | null = null;

    const change = (field: string, before: unknown, after: unknown, invalidates = false) => {
      const equal = Array.isArray(after) ? sameList(before, after.map(String)) : String(before ?? '') === String(after ?? '');
      if (equal) return false;
      set[field] = after;
      changes[field] = { before: before ?? null, after: after ?? null };
      if (invalidates) invalidatesReview = true;
      return true;
    };

    let nextContent = beforeContent;
    if (input.contentType && input.contentId) {
      if (input.contentType === 'movie') {
        const movie = await Movie.findById(input.contentId).select('title year').lean();
        if (!movie) throw Object.assign(new Error('The selected movie was not found.'), { status: 422, code: 'CONTENT_NOT_FOUND' });
        nextContent = { type: 'movie', id: input.contentId, label: `${movie.title} (${movie.year})`, missing: false };
        if (beforeContent.type !== 'movie' || beforeContent.id !== input.contentId) {
          set.movie = movie._id; unset.episode = 1; unset.series = 1; invalidatesReview = true;
          changes.content = { before: beforeContent, after: nextContent };
        }
      } else {
        const episode = await Episode.findById(input.contentId).select('title series seasonNumber episodeNumber').lean();
        if (!episode) throw Object.assign(new Error('The selected episode was not found.'), { status: 422, code: 'CONTENT_NOT_FOUND' });
        const series = await Series.findById(episode.series).select('title').lean();
        if (!series) throw Object.assign(new Error('The selected episode is missing its series.'), { status: 422, code: 'CONTENT_NOT_FOUND' });
        nextContent = { type: 'episode', id: input.contentId, label: `${series.title} · S${episode.seasonNumber} E${episode.episodeNumber} · ${episode.title}`, missing: false, seriesId: String(series._id) };
        if (beforeContent.type !== 'episode' || beforeContent.id !== input.contentId || String(current.series ?? '') !== String(series._id)) {
          set.episode = episode._id; set.series = series._id; unset.movie = 1; invalidatesReview = true;
          changes.content = { before: beforeContent, after: nextContent };
        }
      }
    }

    if (input.translatorId) {
      const translator = await TranslatorProfile.findById(input.translatorId).select('displayName user').lean();
      if (!translator) throw Object.assign(new Error('The selected translator profile was not found.'), { status: 422, code: 'TRANSLATOR_NOT_FOUND' });
      if (session.user.role === 'translator' && String(translator.user ?? '') !== session.user.id) throw Object.assign(new Error('Translators cannot assign another translator profile.'), { status: 403, code: 'FORBIDDEN' });
      change('translator', current.translator, translator._id, true);
      if (changes.translator) changes.translator = { before: String(current.translator), after: { id: String(translator._id), label: String(translator.displayName) } };
    }
    if (input.language !== undefined) change('language', current.language, input.language, true);
    if (input.languageCode !== undefined) change('languageCode', current.languageCode, input.languageCode, true);
    if (input.releaseMatches !== undefined) change('releaseMatches', current.releaseMatches, input.releaseMatches, true);
    if (input.fps !== undefined) {
      const before = current.fps ?? null;
      if (String(before ?? '') !== String(input.fps ?? '')) {
        if (input.fps === null) unset.fps = 1; else set.fps = input.fps;
        changes.fps = { before, after: input.fps }; invalidatesReview = true;
      }
    }
    if (input.hearingImpaired !== undefined) change('hearingImpaired', Boolean(current.hearingImpaired), input.hearingImpaired, true);
    if (input.version !== undefined && !input.replacementAssetId) change('version', current.version, input.version, true);

    if (input.replacementAssetId) {
      const asset = await MediaAsset.findOne({ _id: input.replacementAssetId, kind: 'subtitle', status: 'active', uploadedBy: session.user.id, linkedId: { $exists: false }, 'metadata.replacementFor': id }).lean();
      replacementAsset = asset ? plain(asset) as ReplacementAsset : null;
      if (!replacementAsset) throw Object.assign(new Error('The validated replacement upload was not found or has already been used.'), { status: 422, code: 'REPLACEMENT_NOT_FOUND' });
      const replacementFormat = extensionOf(String(replacementAsset.fileName));
      if (!subtitleFormats.includes(replacementFormat as typeof subtitleFormats[number])) throw Object.assign(new Error('The replacement subtitle format is not supported.'), { status: 422, code: 'FORMAT_MISMATCH' });
      if (Number(current.version) >= 100) throw Object.assign(new Error('The subtitle version must be below 100 before replacing its file.'), { status: 422, code: 'VERSION_LIMIT' });
      set.fileKey = replacementAsset.objectKey; set.fileName = replacementAsset.fileName; set.fileSize = replacementAsset.size; set.format = replacementFormat;
      set.version = Number(current.version) + 1; invalidatesReview = true;
      changes.file = { before: { fileName: current.fileName, format: current.format, fileSize: current.fileSize, version: current.version }, after: { fileName: replacementAsset.fileName, format: replacementFormat, fileSize: replacementAsset.size, version: set.version } };
    }

    if (input.status !== undefined) change('status', current.status, input.status);
    if (input.verified !== undefined) change('verified', Boolean(current.verified), input.verified);
    if (invalidatesReview) {
      set.verified = false;
      if (Boolean(current.verified)) changes.verified = { before: true, after: false };
    }

    if (!Object.keys(changes).length) {
      const translator = await TranslatorProfile.findById(current.translator).select('displayName').lean();
      return Response.json({ id, status: current.status, verified: current.verified, subtitle: responseRecord(current, beforeContent, translator ? plain(translator) : null), notificationsCreated: 0 });
    }

    let assetReserved = false;
    if (replacementAsset) {
      const reserved = await MediaAsset.findOneAndUpdate({ _id: replacementAsset._id, linkedId: { $exists: false } }, { $set: { linkedModel: 'SubtitleReplacement', linkedId: current._id } }, { new: true });
      if (!reserved) throw Object.assign(new Error('The replacement upload has already been used.'), { status: 409, code: 'REPLACEMENT_CONFLICT' });
      assetReserved = true;
    }

    const filter = subtitleRevisionFilter(id, input);
    const update = { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) };
    const updatedDocument = await Subtitle.findOneAndUpdate(filter, update, { new: true, runValidators: true });
    if (!updatedDocument) {
      if (assetReserved && replacementAsset) await MediaAsset.updateOne({ _id: replacementAsset._id, linkedModel: 'SubtitleReplacement', linkedId: current._id }, { $unset: { linkedModel: 1, linkedId: 1 } }).catch(() => undefined);
      if (await Subtitle.exists({ _id: id })) throw Object.assign(new Error('This subtitle was changed by another administrator. Reload it and review the latest values before saving.'), { status: 409, code: 'EDIT_CONFLICT' });
      throw Object.assign(new Error('Subtitle was not found.'), { status: 404, code: 'NOT_FOUND' });
    }
    if (replacementAsset) await MediaAsset.updateOne({ _id: replacementAsset._id, linkedModel: 'SubtitleReplacement', linkedId: updatedDocument._id }, { $set: { linkedModel: 'Subtitle' } });

    const updated = plain(updatedDocument.toObject());
    const delivery = shouldNotifySubtitlePublished(String(current.status), String(updated.status)) ? await publishSubtitleNotifications(id) : undefined;
    await AuditLog.create({ actor: session.user.id, action: 'subtitle.update', entity: 'Subtitle', entityId: id, metadata: { changes, replacementAssetId: replacementAsset ? String(replacementAsset._id) : undefined, notificationRecipients: delivery?.recipients, notificationsCreated: delivery?.notifications } });
    const translator = await TranslatorProfile.findById(updated.translator).select('displayName').lean();
    return Response.json({ id, status: updated.status, verified: updated.verified, subtitle: responseRecord(updated, nextContent, translator ? plain(translator) : null), notificationsCreated: delivery?.notifications ?? 0 });
  } catch (error) { return apiError(error); }
}

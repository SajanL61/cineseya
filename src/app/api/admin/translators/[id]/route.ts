import { isValidObjectId } from 'mongoose';
import { assertMutationRequest, requirePermission } from '@/lib/auth';
import { connectDb } from '@/lib/db';
import { apiError } from '@/lib/http';
import { translatorProfileInputSchema, type TranslatorProfileInput } from '@/lib/validation/translator';
import { AuditLog, MediaAsset, Subtitle, TranslatorProfile, User } from '@/models';

function notFound() {
  return Object.assign(new Error('Translator profile was not found.'), { status: 404, code: 'NOT_FOUND' });
}

function conflict(message: string, code: string) {
  return Object.assign(new Error(message), { status: 409, code });
}

async function ensureAvailable(id: string, input: TranslatorProfileInput) {
  const [slugMatch, user, userMatch] = await Promise.all([
    TranslatorProfile.exists({ _id: { $ne: id }, slug: input.slug }),
    input.userId ? User.exists({ _id: input.userId, active: true }) : Promise.resolve(true),
    input.userId ? TranslatorProfile.exists({ _id: { $ne: id }, user: input.userId }) : Promise.resolve(false),
  ]);
  if (slugMatch) throw conflict('That translator slug is already in use.', 'SLUG_CONFLICT');
  if (!user) throw Object.assign(new Error('The selected active user account was not found.'), { status: 422, code: 'USER_NOT_FOUND' });
  if (userMatch) throw conflict('That user account already has a translator profile.', 'USER_CONFLICT');
}

export async function PATCH(request: Request, { params }: RouteContext<'/api/admin/translators/[id]'>) {
  try {
    const session = await requirePermission('content.update');
    await assertMutationRequest(request, session);
    const { id } = await params;
    if (!isValidObjectId(id)) throw notFound();
    const input = translatorProfileInputSchema.parse(await request.json());
    await connectDb();
    const profile = await TranslatorProfile.findById(id);
    if (!profile) throw notFound();
    const previousVerified = Boolean(profile.verified);
    const previousUserId = profile.user ? String(profile.user) : null;
    const previousAvatar = String(profile.avatarUrl || '');
    if (input.verified !== previousVerified && !session.user.permissions.includes('subtitles.verify')) {
      throw Object.assign(new Error('Subtitle verification permission is required to change verification.'), { status: 403, code: 'FORBIDDEN' });
    }
    if (input.userId !== previousUserId && !session.user.permissions.includes('users.update')) {
      throw Object.assign(new Error('User management permission is required to change the linked account.'), { status: 403, code: 'FORBIDDEN' });
    }
    await ensureAvailable(id, input);
    profile.set({
      displayName: input.displayName,
      slug: input.slug,
      bio: input.bio || undefined,
      avatarUrl: input.avatarUrl || undefined,
      user: input.userId || undefined,
      verified: input.verified,
    });
    try {
      await profile.save();
    } catch (error) {
      if ((error as { code?: number }).code === 11000) throw conflict('The slug or linked user account is already in use.', 'TRANSLATOR_CONFLICT');
      throw error;
    }
    if (previousAvatar && previousAvatar !== input.avatarUrl) {
      await MediaAsset.updateOne(
        { objectKey: previousAvatar, kind: 'avatar', linkedModel: 'TranslatorProfile', linkedId: profile._id },
        { $set: { status: 'orphan' }, $unset: { linkedModel: 1, linkedId: 1 } },
      );
    }
    if (input.avatarUrl) {
      await MediaAsset.updateOne(
        { objectKey: input.avatarUrl, kind: 'avatar', status: 'active' },
        { $set: { linkedModel: 'TranslatorProfile', linkedId: profile._id } },
      );
    }
    await AuditLog.create({
      actor: session.user.id,
      action: 'translator.update',
      entity: 'TranslatorProfile',
      entityId: id,
      metadata: { slug: profile.slug, verified: profile.verified, userId: input.userId },
    });
    return Response.json({ id, slug: profile.slug }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, { params }: RouteContext<'/api/admin/translators/[id]'>) {
  try {
    const session = await requirePermission('subtitles.delete');
    await assertMutationRequest(request, session);
    const { id } = await params;
    if (!isValidObjectId(id)) throw notFound();
    await connectDb();
    const profile = await TranslatorProfile.findById(id).select('displayName slug').lean();
    if (!profile) throw notFound();
    const subtitleCount = await Subtitle.countDocuments({ translator: id });
    if (subtitleCount) {
      throw conflict(`This profile credits ${subtitleCount} subtitle${subtitleCount === 1 ? '' : 's'} and cannot be deleted. Reassign those subtitles first.`, 'TRANSLATOR_IN_USE');
    }
    await TranslatorProfile.deleteOne({ _id: id });
    await MediaAsset.updateMany(
      { linkedModel: 'TranslatorProfile', linkedId: id },
      { $set: { status: 'orphan' }, $unset: { linkedModel: 1, linkedId: 1 } },
    );
    await AuditLog.create({
      actor: session.user.id,
      action: 'translator.delete',
      entity: 'TranslatorProfile',
      entityId: id,
      metadata: { displayName: profile.displayName, slug: profile.slug },
    });
    return Response.json({ id, deleted: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
}

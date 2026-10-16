import { assertMutationRequest, requirePermission } from '@/lib/auth';
import { connectDb } from '@/lib/db';
import { apiError } from '@/lib/http';
import { translatorProfileInputSchema, type TranslatorProfileInput } from '@/lib/validation/translator';
import { AuditLog, MediaAsset, TranslatorProfile, User } from '@/models';

function conflict(message: string, code: string) {
  return Object.assign(new Error(message), { status: 409, code });
}

async function ensureAvailable(input: TranslatorProfileInput) {
  const [slugMatch, user, userMatch] = await Promise.all([
    TranslatorProfile.exists({ slug: input.slug }),
    input.userId ? User.exists({ _id: input.userId, active: true }) : Promise.resolve(true),
    input.userId ? TranslatorProfile.exists({ user: input.userId }) : Promise.resolve(false),
  ]);
  if (slugMatch) throw conflict('That translator slug is already in use.', 'SLUG_CONFLICT');
  if (!user) throw Object.assign(new Error('The selected active user account was not found.'), { status: 422, code: 'USER_NOT_FOUND' });
  if (userMatch) throw conflict('That user account already has a translator profile.', 'USER_CONFLICT');
}

export async function POST(request: Request) {
  try {
    const session = await requirePermission('content.create');
    await assertMutationRequest(request, session);
    const input = translatorProfileInputSchema.parse(await request.json());
    if (input.verified && !session.user.permissions.includes('subtitles.verify')) {
      throw Object.assign(new Error('Subtitle verification permission is required to verify a translator.'), { status: 403, code: 'FORBIDDEN' });
    }
    if (input.userId && !session.user.permissions.includes('users.update')) {
      throw Object.assign(new Error('User management permission is required to link an account.'), { status: 403, code: 'FORBIDDEN' });
    }
    await connectDb();
    await ensureAvailable(input);
    let profile;
    try {
      profile = await TranslatorProfile.create({
        displayName: input.displayName,
        slug: input.slug,
        bio: input.bio || undefined,
        avatarUrl: input.avatarUrl || undefined,
        user: input.userId || undefined,
        verified: input.verified,
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) throw conflict('The slug or linked user account is already in use.', 'TRANSLATOR_CONFLICT');
      throw error;
    }
    if (input.avatarUrl) {
      await MediaAsset.updateOne(
        { objectKey: input.avatarUrl, kind: 'avatar', status: 'active' },
        { $set: { linkedModel: 'TranslatorProfile', linkedId: profile._id } },
      );
    }
    await AuditLog.create({
      actor: session.user.id,
      action: 'translator.create',
      entity: 'TranslatorProfile',
      entityId: String(profile._id),
      metadata: { slug: profile.slug, verified: profile.verified, userId: input.userId },
    });
    return Response.json({ id: String(profile._id), slug: profile.slug }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
}

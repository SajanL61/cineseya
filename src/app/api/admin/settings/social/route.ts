import { z } from 'zod';
import { assertMutationRequest, requirePermission } from '@/lib/auth';
import { connectDb } from '@/lib/db';
import { apiError } from '@/lib/http';
import { AuditLog, SiteSetting } from '@/models';
import { SOCIAL_SETTING_KEY, getSocialSettings } from '@/services/site-settings';

const optionalUrl = z.union([z.literal(''), z.url().refine((value) => new URL(value).protocol === 'https:', 'Use an HTTPS URL.')]).transform((value) => value || undefined);
const schema = z.object({ facebook: optionalUrl.optional(), telegram: optionalUrl.optional(), whatsapp: optionalUrl.optional(), instagram: optionalUrl.optional(), youtube: optionalUrl.optional(), tiktok: optionalUrl.optional(), x: optionalUrl.optional(), website: z.url().refine((value) => new URL(value).protocol === 'https:', 'Use an HTTPS URL.') });

export async function GET() {
  try { await requirePermission('settings.read'); return Response.json(await getSocialSettings(), { headers: { 'Cache-Control': 'private, no-store' } }); }
  catch (error) { return apiError(error); }
}

export async function PATCH(request: Request) {
  try {
    const session = await requirePermission('settings.update'); await assertMutationRequest(request, session); const input = schema.parse(await request.json()); await connectDb();
    await SiteSetting.findOneAndUpdate({ key: SOCIAL_SETTING_KEY }, { $set: { value: input } }, { upsert: true, new: true });
    await AuditLog.create({ actor: session.user.id, action: 'social.settings.update', entity: 'SiteSetting', entityId: SOCIAL_SETTING_KEY, metadata: { platforms: Object.entries(input).filter(([, value]) => Boolean(value)).map(([key]) => key) } });
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error); }
}

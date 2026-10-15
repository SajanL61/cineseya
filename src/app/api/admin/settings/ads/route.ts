import { revalidatePath } from 'next/cache';
import { assertMutationRequest, requirePermission } from '@/lib/auth';
import { connectDb } from '@/lib/db';
import { apiError } from '@/lib/http';
import { adSettingsDiagnostics } from '@/lib/ads';
import { adSettingsUpdateSchema, assertLiveConfiguration, persistedAdSettings } from '@/lib/validation/ads';
import { AuditLog, SiteSetting } from '@/models';
import { AD_SETTING_KEY, getAdSettings } from '@/services/ad-settings';

export async function GET() {
  try {
    await requirePermission('settings.read');
    const settings = await getAdSettings();
    return Response.json({ settings, diagnostics: adSettingsDiagnostics(settings) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error); }
}

export async function PATCH(request: Request) {
  try {
    const session = await requirePermission('settings.update');
    await assertMutationRequest(request, session);
    const input = adSettingsUpdateSchema.parse(await request.json());
    const previous = await getAdSettings();
    const activationRequired = previous.mode !== 'live' || !previous.masterEnabled;
    assertLiveConfiguration(input, activationRequired);
    const settings = persistedAdSettings(input, session.user.displayName);
    await connectDb();
    await SiteSetting.findOneAndUpdate({ key: AD_SETTING_KEY }, { $set: { value: settings } }, { upsert: true, new: true, runValidators: true });
    await AuditLog.create({
      actor: session.user.id, action: 'advertising.settings.update', entity: 'SiteSetting', entityId: AD_SETTING_KEY,
      metadata: { previousMode: previous.mode, mode: settings.mode, previousMasterEnabled: previous.masterEnabled, masterEnabled: settings.masterEnabled, changedPlacements: Object.keys(settings.placements), reviewCount: settings.reviews.length },
    });
    revalidatePath('/', 'layout');
    return Response.json({ ok: true, settings, diagnostics: adSettingsDiagnostics(settings) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error); }
}

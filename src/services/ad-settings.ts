import 'server-only';
import { connectDb } from '@/lib/db';
import { useDemoData } from '@/lib/env';
import { defaultAdSettings, type AdSettings, AD_PLACEMENTS } from '@/lib/ads';
import { SiteSetting } from '@/models';

export const AD_SETTING_KEY = 'advertising.adsense';

function mergeSettings(value: unknown): AdSettings {
  const stored = value && typeof value === 'object' ? value as Partial<AdSettings> : {};
  const placements: Partial<AdSettings['placements']> = stored.placements && typeof stored.placements === 'object' ? stored.placements : {};
  return {
    ...defaultAdSettings,
    ...stored,
    version: 1,
    placements: Object.fromEntries(AD_PLACEMENTS.map((placement) => [placement, { ...defaultAdSettings.placements[placement], ...(placements[placement] ?? {}) }])) as AdSettings['placements'],
    routeExclusions: Array.isArray(stored.routeExclusions) ? stored.routeExclusions.filter((item): item is string => typeof item === 'string') : defaultAdSettings.routeExclusions,
    reviews: Array.isArray(stored.reviews) ? stored.reviews : [],
    consent: { ...defaultAdSettings.consent, ...(stored.consent ?? {}) },
    adsTxt: { ...defaultAdSettings.adsTxt, ...(stored.adsTxt ?? {}) },
  };
}

export async function getAdSettings(): Promise<AdSettings> {
  if (useDemoData) return structuredClone(defaultAdSettings);
  await connectDb();
  const row = await SiteSetting.findOne({ key: AD_SETTING_KEY }).select('value').lean();
  return mergeSettings(row?.value);
}

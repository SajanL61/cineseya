import 'server-only';
import { connectDb } from '@/lib/db';
import { siteUrl, useDemoData } from '@/lib/env';
import { SiteSetting } from '@/models';

export const SOCIAL_SETTING_KEY = 'social.community';
export type SocialSettings = { facebook?: string; telegram?: string; whatsapp?: string; instagram?: string; youtube?: string; tiktok?: string; x?: string; website: string };
const defaults: SocialSettings = { website: siteUrl };

export async function getSocialSettings(): Promise<SocialSettings> {
  if (useDemoData) return defaults;
  await connectDb();
  const row = await SiteSetting.findOne({ key: SOCIAL_SETTING_KEY }).select('value').lean();
  const value = row?.value && typeof row.value === 'object' ? row.value as Record<string, unknown> : {};
  const result: SocialSettings = { website: typeof value.website === 'string' && value.website ? value.website : siteUrl };
  for (const key of ['facebook', 'telegram', 'whatsapp', 'instagram', 'youtube', 'tiktok', 'x'] as const) if (typeof value[key] === 'string' && value[key]) result[key] = value[key];
  return result;
}

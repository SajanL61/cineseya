import { z } from 'zod';
import { AD_PLACEMENTS, DEFAULT_AD_ROUTE_EXCLUSIONS, type AdSettings, isValidAdUnitId, isValidPublisherId } from '@/lib/ads';

const route = z.string().trim().min(1).max(300).refine((value) => value.startsWith('/') && !value.includes('://') && !/[<>]/.test(value), 'Use a local route beginning with /.');
const hostname = z.string().trim().toLowerCase().min(1).max(253).refine((value) => {
  if (value.includes('/') || value.includes(':')) return false;
  try { return new URL(`https://${value}`).hostname === value; } catch { return false; }
}, 'Enter a hostname without a protocol or path.');
const placementSchema = z.object({
  enabled: z.boolean(), unitId: z.string().trim().max(20), desktop: z.boolean(), mobile: z.boolean(),
}).superRefine((value, context) => {
  if (value.unitId && !isValidAdUnitId(value.unitId)) context.addIssue({ code: 'custom', path: ['unitId'], message: 'Use the numeric ad-unit ID from AdSense.' });
  if (value.enabled && !value.desktop && !value.mobile) context.addIssue({ code: 'custom', message: 'Enable desktop, mobile, or disable this placement.' });
});
const reviewSchema = z.object({
  route,
  title: z.string().trim().min(1).max(160),
  primaryLanguage: z.string().trim().toLowerCase().min(2).max(12),
  state: z.enum(['not_reviewed', 'unsupported_language', 'insufficient_original_content', 'rights_review_incomplete', 'excluded', 'ready']),
  originalContent: z.boolean(), rightsReviewed: z.boolean(), excluded: z.boolean(), notes: z.string().trim().max(1000),
  reviewedAt: z.string().datetime().optional(), reviewedBy: z.string().trim().max(120).optional(),
});
const adsTxtEntry = z.string().trim().min(1).max(500).refine((value) => {
  if (/[<>\r\n]/.test(value)) return false;
  const parts = value.split(',').map((item) => item.trim());
  return (parts.length === 3 || parts.length === 4) && /^[a-z0-9.-]+$/i.test(parts[0] || '') && /^[a-z0-9._-]+$/i.test(parts[1] || '') && /^(DIRECT|RESELLER)$/i.test(parts[2] || '') && (!parts[3] || /^[a-z0-9]+$/i.test(parts[3]));
}, 'Enter one valid ads.txt seller record per line.');

const placements = Object.fromEntries(AD_PLACEMENTS.map((placement) => [placement, placementSchema])) as Record<(typeof AD_PLACEMENTS)[number], typeof placementSchema>;

export const adSettingsUpdateSchema = z.object({
  version: z.literal(1),
  mode: z.enum(['disabled', 'mock', 'live']),
  masterEnabled: z.boolean(), siteApprovalConfirmed: z.boolean(), autoAdsConfirmedOff: z.boolean(),
  publisherId: z.string().trim().max(32).refine((value) => !value || isValidPublisherId(value), 'Use ca-pub- followed by 16 digits.'),
  productionHosts: z.array(hostname).max(20).transform((items) => [...new Set(items)]),
  placements: z.object(placements),
  routeExclusions: z.array(route).max(100).transform((items) => [...new Set([...DEFAULT_AD_ROUTE_EXCLUSIONS, ...items])]),
  reviews: z.array(reviewSchema).max(200).superRefine((items, context) => {
    const seen = new Set<string>();
    items.forEach((item, index) => { if (seen.has(item.route)) context.addIssue({ code: 'custom', path: [index, 'route'], message: 'Each route may have only one review.' }); seen.add(item.route); });
  }),
  consent: z.object({ provider: z.enum(['none', 'google-privacy-messaging', 'certified-third-party']), configured: z.boolean(), providerName: z.string().trim().max(120) }),
  adsTxt: z.object({ includeGoogleSeller: z.boolean(), additionalEntries: z.array(adsTxtEntry).max(100) }),
  confirmLiveActivation: z.boolean().optional(),
});

export type AdSettingsUpdateInput = z.infer<typeof adSettingsUpdateSchema>;

export function assertLiveConfiguration(input: AdSettingsUpdateInput, activationRequired: boolean) {
  if (input.mode !== 'live' || !input.masterEnabled) return;
  const problems: string[] = [];
  if (activationRequired && input.confirmLiveActivation !== true) problems.push('Confirm live activation explicitly.');
  if (!input.siteApprovalConfirmed) problems.push('Confirm the site is Ready in the real AdSense account.');
  if (!input.autoAdsConfirmedOff) problems.push('Confirm Auto ads are off in the AdSense dashboard.');
  if (!isValidPublisherId(input.publisherId)) problems.push('Configure a valid publisher ID.');
  if (!input.productionHosts.length) problems.push('Configure at least one production hostname.');
  if (!input.consent.configured || input.consent.provider !== 'google-privacy-messaging') problems.push('Configure and confirm Google Privacy & messaging. Third-party CMP serving stays blocked until its lifecycle is implemented.');
  for (const placement of AD_PLACEMENTS) if (input.placements[placement].enabled && !isValidAdUnitId(input.placements[placement].unitId)) problems.push(`Configure ${placement}'s ad-unit ID or disable it.`);
  if (problems.length) throw Object.assign(new Error(problems.join(' ')), { status: 422, code: 'ADS_LIVE_CONFIGURATION_INCOMPLETE' });
}

export function persistedAdSettings(input: AdSettingsUpdateInput, actor: string, now = new Date()): AdSettings {
  return {
    version: 1, mode: input.mode, masterEnabled: input.masterEnabled, siteApprovalConfirmed: input.siteApprovalConfirmed,
    autoAdsConfirmedOff: input.autoAdsConfirmedOff, publisherId: input.publisherId, productionHosts: input.productionHosts,
    placements: input.placements, routeExclusions: input.routeExclusions, reviews: input.reviews.map((review) => review.state === 'ready' ? { ...review, reviewedAt: now.toISOString(), reviewedBy: actor } : review),
    consent: input.consent, adsTxt: input.adsTxt, lastChangedAt: now.toISOString(), lastChangedBy: actor,
  };
}

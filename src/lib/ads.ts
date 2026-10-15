export const AD_PLACEMENTS = [
  'HOME_AFTER_TRENDING',
  'HOME_AFTER_TOP_RATED',
  'MOVIE_EDITORIAL',
  'MOVIE_SIDEBAR',
  'SUBTITLE_AFTER_NOTES',
  'COLLECTION_MID',
] as const;

export type AdPlacement = (typeof AD_PLACEMENTS)[number];
export type AdMode = 'disabled' | 'mock' | 'live';
export type AdReviewState =
  | 'not_reviewed'
  | 'unsupported_language'
  | 'insufficient_original_content'
  | 'rights_review_incomplete'
  | 'excluded'
  | 'ready';

export type AdPlacementSettings = {
  enabled: boolean;
  unitId: string;
  desktop: boolean;
  mobile: boolean;
};

export type AdPageReview = {
  route: string;
  title: string;
  primaryLanguage: string;
  state: AdReviewState;
  originalContent: boolean;
  rightsReviewed: boolean;
  excluded: boolean;
  notes: string;
  reviewedAt?: string;
  reviewedBy?: string;
};

export type AdSettings = {
  version: 1;
  mode: AdMode;
  masterEnabled: boolean;
  siteApprovalConfirmed: boolean;
  autoAdsConfirmedOff: boolean;
  publisherId: string;
  productionHosts: string[];
  placements: Record<AdPlacement, AdPlacementSettings>;
  routeExclusions: string[];
  reviews: AdPageReview[];
  consent: {
    provider: 'none' | 'google-privacy-messaging' | 'certified-third-party';
    configured: boolean;
    providerName: string;
  };
  adsTxt: {
    includeGoogleSeller: boolean;
    additionalEntries: string[];
  };
  lastChangedAt?: string;
  lastChangedBy?: string;
};

export type AdPageContext = {
  route: string;
  published: boolean;
  hasContent: boolean;
  requiresOriginalEditorial?: boolean;
  publisherText?: string;
};

export type AdRenderDecision = {
  render: 'none' | 'mock' | 'live';
  reasons: string[];
  publisherId?: string;
  unitId?: string;
  desktop: boolean;
  mobile: boolean;
};

const placementDefaults: Record<AdPlacement, AdPlacementSettings> = {
  HOME_AFTER_TRENDING: { enabled: true, unitId: '', desktop: true, mobile: true },
  HOME_AFTER_TOP_RATED: { enabled: true, unitId: '', desktop: true, mobile: true },
  MOVIE_EDITORIAL: { enabled: false, unitId: '', desktop: true, mobile: true },
  MOVIE_SIDEBAR: { enabled: false, unitId: '', desktop: true, mobile: false },
  SUBTITLE_AFTER_NOTES: { enabled: false, unitId: '', desktop: true, mobile: true },
  COLLECTION_MID: { enabled: false, unitId: '', desktop: true, mobile: true },
};

export const DEFAULT_AD_ROUTE_EXCLUSIONS = [
  '/admin*', '/login', '/register', '/profile*', '/watch*', '/download*', '/search*',
  '/privacy', '/terms', '/copyright', '/contact', '/takedown', '/accessibility', '/offline',
];

export const defaultAdSettings: AdSettings = {
  version: 1,
  mode: 'mock',
  masterEnabled: false,
  siteApprovalConfirmed: false,
  autoAdsConfirmedOff: false,
  publisherId: '',
  productionHosts: ['cineseya.lk', 'www.cineseya.lk'],
  placements: placementDefaults,
  routeExclusions: DEFAULT_AD_ROUTE_EXCLUSIONS,
  reviews: [],
  consent: { provider: 'none', configured: false, providerName: '' },
  adsTxt: { includeGoogleSeller: false, additionalEntries: [] },
};

export const AD_REVIEW_LABELS: Record<AdReviewState, string> = {
  not_reviewed: 'Not reviewed',
  unsupported_language: 'Unsupported primary language',
  insufficient_original_content: 'Insufficient original content',
  rights_review_incomplete: 'Rights review incomplete',
  excluded: 'Excluded route',
  ready: 'Ready for owner activation',
};

const supportedLanguageCodes = new Set([
  'ar', 'bn', 'bg', 'ca', 'zh', 'zh-cn', 'zh-tw', 'hr', 'cs', 'da', 'nl', 'en', 'et', 'fil', 'fi', 'fr', 'de', 'el',
  'gu', 'he', 'hi', 'hu', 'id', 'it', 'ja', 'kn', 'ko', 'lv', 'lt', 'ms', 'ml', 'mr', 'no', 'pl', 'pt', 'pa', 'ro',
  'ru', 'sr', 'sk', 'sl', 'es', 'sv', 'ta', 'te', 'th', 'tr', 'uk', 'ur', 'vi',
]);

export function isValidPublisherId(value: string) {
  return /^ca-pub-\d{16}$/.test(value);
}

export function isValidAdUnitId(value: string) {
  return /^\d{4,20}$/.test(value);
}

export function isSupportedPublisherLanguage(value: string) {
  return supportedLanguageCodes.has(value.trim().toLowerCase());
}

export function isSinhalaDominant(value: string) {
  const sinhala = value.match(/[\u0D80-\u0DFF]/g)?.length ?? 0;
  const otherLetters = value.match(/[A-Za-z\u0B80-\u0BFF]/g)?.length ?? 0;
  return sinhala > 0 && sinhala > otherLetters;
}

export function googleSellerId(publisherId: string) {
  return isValidPublisherId(publisherId) ? publisherId.slice(3) : undefined;
}

export function googleAdsTxtLine(publisherId: string) {
  const seller = googleSellerId(publisherId);
  return seller ? `google.com, ${seller}, DIRECT, f08c47fec0942fa0` : undefined;
}

export function routeMatchesExclusion(route: string, exclusion: string) {
  const normalized = route !== '/' ? route.replace(/\/$/, '') : route;
  const rule = exclusion.trim();
  if (!rule.startsWith('/')) return false;
  if (rule.endsWith('*')) {
    const prefix = rule.slice(0, -1).replace(/\/$/, '');
    return normalized === prefix || normalized.startsWith(`${prefix}/`);
  }
  return normalized === (rule !== '/' ? rule.replace(/\/$/, '') : rule);
}

export function findAdPageReview(settings: AdSettings, route: string) {
  const normalized = route !== '/' ? route.replace(/\/$/, '') : route;
  return settings.reviews.find((review) => (review.route !== '/' ? review.route.replace(/\/$/, '') : review.route) === normalized);
}

export function evaluateAdEligibility(input: {
  settings: AdSettings;
  placement: AdPlacement;
  page: AdPageContext;
  hostname: string;
  production: boolean;
}): AdRenderDecision {
  const { settings, placement, page } = input;
  const placementSettings = settings.placements[placement];
  const reasons: string[] = [];
  const excluded = settings.routeExclusions.some((rule) => routeMatchesExclusion(page.route, rule));

  if (!page.hasContent) reasons.push('The required content section is empty.');
  if (excluded) reasons.push('This route is excluded from advertising.');
  if (!placementSettings.enabled) reasons.push('This placement is disabled.');
  if (!placementSettings.desktop && !placementSettings.mobile) reasons.push('This placement has no enabled viewport.');
  if (reasons.length) return { render: 'none', reasons, desktop: placementSettings.desktop, mobile: placementSettings.mobile };

  if (settings.mode === 'mock') {
    return { render: 'mock', reasons: ['Mock preview mode never contacts Google.'], desktop: placementSettings.desktop, mobile: placementSettings.mobile };
  }
  if (settings.mode === 'disabled') return { render: 'none', reasons: ['Advertising is disabled.'], desktop: placementSettings.desktop, mobile: placementSettings.mobile };

  const review = findAdPageReview(settings, page.route);
  if (!input.production) reasons.push('Live ads are limited to production.');
  if (!settings.masterEnabled) reasons.push('The master ad-request switch is off.');
  if (!settings.siteApprovalConfirmed) reasons.push('The owner has not confirmed Ready status in AdSense.');
  if (!settings.autoAdsConfirmedOff) reasons.push('Auto ads have not been confirmed off in AdSense.');
  if (!isValidPublisherId(settings.publisherId)) reasons.push('The publisher ID is missing or invalid.');
  if (!isValidAdUnitId(placementSettings.unitId)) reasons.push('The ad-unit ID is missing or invalid.');
  if (!settings.productionHosts.includes(input.hostname.toLowerCase())) reasons.push('The current hostname is not approved.');
  if (!settings.consent.configured || settings.consent.provider !== 'google-privacy-messaging') reasons.push('The implemented Google Privacy & messaging consent lifecycle is not confirmed.');
  if (!page.published) reasons.push('The page is not public and published.');
  if (page.publisherText && isSinhalaDominant(page.publisherText)) reasons.push('The rendered publisher content is Sinhala-dominant.');
  if (!review) reasons.push('This exact page has not been reviewed.');
  if (review) {
    if (review.excluded || review.state === 'excluded') reasons.push('The editorial review excludes this page.');
    if (review.state !== 'ready') reasons.push(AD_REVIEW_LABELS[review.state]);
    if (!isSupportedPublisherLanguage(review.primaryLanguage)) reasons.push('The publisher content uses an unsupported primary language.');
    if (!review.rightsReviewed) reasons.push('The rights review is incomplete.');
    if (!review.originalContent) reasons.push('Sufficient original publisher content is not confirmed.');
    if (page.requiresOriginalEditorial && !review.originalContent) reasons.push('Substantial original editorial content is not confirmed.');
  }

  return reasons.length
    ? { render: 'none', reasons, desktop: placementSettings.desktop, mobile: placementSettings.mobile }
    : { render: 'live', reasons: [], publisherId: settings.publisherId, unitId: placementSettings.unitId, desktop: placementSettings.desktop, mobile: placementSettings.mobile };
}

export function adSettingsDiagnostics(settings: AdSettings) {
  const diagnostics: Array<{ level: 'ok' | 'warning' | 'error' | 'info'; message: string }> = [];
  diagnostics.push(settings.masterEnabled
    ? { level: 'warning', message: 'The master ad-request switch is ON.' }
    : { level: 'ok', message: 'The master ad-request switch is OFF; no live requests can start.' });
  diagnostics.push(settings.mode === 'live'
    ? { level: 'warning', message: 'Global mode is Live. Exact page eligibility still applies.' }
    : { level: 'ok', message: settings.mode === 'mock' ? 'Mock preview mode makes no advertising requests.' : 'Advertising mode is disabled.' });
  if (!isValidPublisherId(settings.publisherId)) diagnostics.push({ level: 'error', message: 'Publisher ID is missing or invalid (expected ca-pub- plus 16 digits).' });
  if (!settings.siteApprovalConfirmed) diagnostics.push({ level: 'warning', message: 'Owner confirmation of the site Ready status is missing.' });
  if (!settings.autoAdsConfirmedOff) diagnostics.push({ level: 'warning', message: 'Auto ads have not been confirmed OFF in the AdSense dashboard.' });
  if (!settings.consent.configured || settings.consent.provider !== 'google-privacy-messaging') diagnostics.push({ level: 'error', message: 'Google Privacy & messaging has not been confirmed. Other CMPs remain blocked until their lifecycle is implemented in CineSeya.' });
  for (const placement of AD_PLACEMENTS) {
    const value = settings.placements[placement];
    if (value.enabled && !isValidAdUnitId(value.unitId)) diagnostics.push({ level: 'warning', message: `${placement} has no valid numeric ad-unit ID.` });
  }
  const googleLine = googleAdsTxtLine(settings.publisherId);
  diagnostics.push(settings.adsTxt.includeGoogleSeller && googleLine
    ? { level: 'ok', message: 'The Google seller line is configured for /ads.txt.' }
    : { level: 'warning', message: 'The Google seller line is not currently published in /ads.txt.' });
  diagnostics.push({ level: 'info', message: 'Auto ads remain a dashboard setting; CineSeya does not claim to change it remotely.' });
  diagnostics.push({ level: 'ok', message: 'Nonce-based CSP is installed; admin responses exclude Google advertising origins.' });
  diagnostics.push({ level: 'info', message: 'Admin routes never load the AdSense script. Public script failures are non-fatal and reported in the browser console.' });
  return diagnostics;
}

import { describe, expect, it } from 'vitest';
import {
  defaultAdSettings, evaluateAdEligibility, googleAdsTxtLine, isSinhalaDominant, isSupportedPublisherLanguage, routeMatchesExclusion, type AdSettings,
} from '@/lib/ads';
import { adSettingsUpdateSchema, assertLiveConfiguration } from '@/lib/validation/ads';

function settings(overrides: Partial<AdSettings> = {}): AdSettings {
  const base = structuredClone(defaultAdSettings);
  return {
    ...base,
    mode: 'live', masterEnabled: true, siteApprovalConfirmed: true, autoAdsConfirmedOff: true,
    publisherId: 'ca-pub-1234567890123456', productionHosts: ['cineseya.lk'],
    consent: { provider: 'google-privacy-messaging', configured: true, providerName: 'Google Privacy & messaging' },
    placements: { ...base.placements, HOME_AFTER_TRENDING: { enabled: true, unitId: '1234567890', desktop: true, mobile: true } },
    reviews: [{ route: '/', title: 'Homepage', primaryLanguage: 'en', state: 'ready', originalContent: true, rightsReviewed: true, excluded: false, notes: '' }],
    ...overrides,
  };
}

const page = { route: '/', published: true, hasContent: true };

describe('AdSense eligibility', () => {
  it('uses non-clickable mock mode without producing a live decision', () => {
    const result = evaluateAdEligibility({ settings: defaultAdSettings, placement: 'HOME_AFTER_TRENDING', page, hostname: 'localhost', production: false });
    expect(result.render).toBe('mock');
    expect(result.publisherId).toBeUndefined();
    expect(result.unitId).toBeUndefined();
  });

  it('allows one fully reviewed production placement', () => {
    const result = evaluateAdEligibility({ settings: settings(), placement: 'HOME_AFTER_TRENDING', page, hostname: 'cineseya.lk', production: true });
    expect(result).toMatchObject({ render: 'live', publisherId: 'ca-pub-1234567890123456', unitId: '1234567890' });
  });

  it.each([
    ['not production', { production: false }],
    ['unapproved host', { hostname: 'preview.onrender.com' }],
    ['unpublished content', { page: { ...page, published: false } }],
    ['empty content', { page: { ...page, hasContent: false } }],
  ])('fails closed when %s', (_label, override) => {
    const result = evaluateAdEligibility({ settings: settings(), placement: 'HOME_AFTER_TRENDING', page, hostname: 'cineseya.lk', production: true, ...override });
    expect(result.render).toBe('none');
  });

  it('does not treat Sinhala publisher content as English', () => {
    const sinhala = settings({ reviews: [{ route: '/', title: 'Sinhala homepage', primaryLanguage: 'si', state: 'ready', originalContent: true, rightsReviewed: true, excluded: false, notes: '' }] });
    const result = evaluateAdEligibility({ settings: sinhala, placement: 'HOME_AFTER_TRENDING', page, hostname: 'cineseya.lk', production: true });
    expect(isSupportedPublisherLanguage('si')).toBe(false);
    expect(result.render).toBe('none');
    expect(result.reasons).toContain('The publisher content uses an unsupported primary language.');
  });

  it('blocks visibly Sinhala-dominant publisher text even when a review is mislabeled', () => {
    const publisherText = 'මෙය සිංහල භාෂාවෙන් ලියූ සම්පූර්ණ කතා විස්තරයකි English';
    const result = evaluateAdEligibility({ settings: settings(), placement: 'HOME_AFTER_TRENDING', page: { ...page, publisherText }, hostname: 'cineseya.lk', production: true });
    expect(isSinhalaDominant(publisherText)).toBe(true);
    expect(result.render).toBe('none');
    expect(result.reasons).toContain('The rendered publisher content is Sinhala-dominant.');
  });

  it('does not serve on unreviewed or excluded routes', () => {
    expect(evaluateAdEligibility({ settings: settings({ reviews: [] }), placement: 'HOME_AFTER_TRENDING', page, hostname: 'cineseya.lk', production: true }).render).toBe('none');
    expect(evaluateAdEligibility({ settings: settings(), placement: 'HOME_AFTER_TRENDING', page: { ...page, route: '/admin/ads' }, hostname: 'cineseya.lk', production: true }).render).toBe('none');
    expect(routeMatchesExclusion('/download/ready/token', '/download*')).toBe(true);
  });

  it('requires original editorial content for the movie editorial placement', () => {
    const value = settings({
      placements: { ...settings().placements, MOVIE_EDITORIAL: { enabled: true, unitId: '9876543210', desktop: true, mobile: true } },
      reviews: [{ route: '/movies/example', title: 'Example', primaryLanguage: 'en', state: 'ready', originalContent: false, rightsReviewed: true, excluded: false, notes: '' }],
    });
    const result = evaluateAdEligibility({ settings: value, placement: 'MOVIE_EDITORIAL', page: { route: '/movies/example', published: true, hasContent: true, requiresOriginalEditorial: true }, hostname: 'cineseya.lk', production: true });
    expect(result.render).toBe('none');
    expect(result.reasons).toContain('Substantial original editorial content is not confirmed.');
  });
});

describe('AdSense settings validation', () => {
  it('derives the matching Google ads.txt seller identifier', () => {
    expect(googleAdsTxtLine('ca-pub-1234567890123456')).toBe('google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0');
    expect(googleAdsTxtLine('publisher')).toBeUndefined();
  });

  it('rejects incomplete live activation and accepts an emergency master-off save', () => {
    const incomplete = adSettingsUpdateSchema.parse({ ...structuredClone(defaultAdSettings), mode: 'live', masterEnabled: true, confirmLiveActivation: true });
    expect(() => assertLiveConfiguration(incomplete, true)).toThrow(/Ready/);
    const stopped = adSettingsUpdateSchema.parse({ ...structuredClone(defaultAdSettings), mode: 'live', masterEnabled: false });
    expect(() => assertLiveConfiguration(stopped, false)).not.toThrow();
  });

  it('rejects arbitrary ads.txt markup', () => {
    const input = structuredClone(defaultAdSettings);
    input.adsTxt.additionalEntries = ['<script>alert(1)</script>'];
    expect(adSettingsUpdateSchema.safeParse(input).success).toBe(false);
  });
});

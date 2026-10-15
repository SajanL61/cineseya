import { describe, expect, it } from 'vitest';
import { metadata as rootMetadata } from '@/app/layout';
import { metadata as homeMetadata } from '@/app/(public)/page';
import { metadata as adminMetadata } from '@/app/(admin)/admin/layout';
import { metadata as profileMetadata } from '@/app/(public)/profile/page';
import { metadata as notificationsMetadata } from '@/app/(public)/profile/notifications/page';
import { metadata as searchMetadata } from '@/app/(public)/search/page';
import { metadata as watchlistMetadata } from '@/app/(public)/watchlist/page';
import { generateMetadata as movieMetadata } from '@/app/(public)/movies/[slug]/page';
import { generateMetadata as seriesMetadata } from '@/app/(public)/tv/[slug]/page';
import { generateMetadata as episodeMetadata } from '@/app/(public)/tv/[slug]/[season]/[episode]/page';
import { generateMetadata as translatorMetadata } from '@/app/(public)/translator/[slug]/page';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import { demoMovies, demoSeries, demoTranslators } from '@/data/demo';
import {
  SEO_DEFAULT_TITLE,
  SEO_ORIGIN,
  breadcrumbJsonLd,
  canonicalOverride,
  canonicalUrl,
  conciseDescription,
  hasSinhalaSubtitle,
  publicSeoImage,
  siteIdentityJsonLd,
} from '@/lib/seo';

describe('CineSeya search identity', () => {
  it('uses the production apex and preferred homepage title', () => {
    expect(SEO_ORIGIN).toBe('https://cineseya.lk');
    expect(new URL(String(rootMetadata.metadataBase)).origin).toBe(SEO_ORIGIN);
    expect(homeMetadata.title).toEqual({ absolute: SEO_DEFAULT_TITLE });
    expect(homeMetadata.alternates).toEqual({ canonical: '/' });
    expect(JSON.stringify(rootMetadata.icons)).toContain('/favicon.ico');
    expect(JSON.stringify(rootMetadata.icons)).toContain('/icon-512.png');
  });

  it('builds homepage-only Site and Organization identity from configured official links', () => {
    const { organization, website } = siteIdentityJsonLd({
      facebook: 'https://www.facebook.com/cineseya',
      x: 'https://x.com/cineseya',
      website: 'https://cineseya.lk',
    });
    expect(organization).toMatchObject({ '@type': 'Organization', name: 'CineSeya', url: SEO_ORIGIN });
    expect(organization.sameAs).toEqual(['https://www.facebook.com/cineseya', 'https://x.com/cineseya']);
    expect(website).toMatchObject({ '@type': 'WebSite', name: 'CineSeya', url: SEO_ORIGIN });
  });

  it('keeps canonical overrides on the apex without query permutations', () => {
    expect(canonicalOverride('https://cineseya.lk/movies/sintel', '/movies/sintel')).toBe('https://cineseya.lk/movies/sintel');
    expect(canonicalOverride('https://cinerusubs.onrender.com/movies/sintel', '/movies/sintel')).toBe('https://cineseya.lk/movies/sintel');
    expect(canonicalOverride('https://cineseya.lk/movies/sintel?draft=1', '/movies/sintel')).toBe('https://cineseya.lk/movies/sintel');
  });

  it('allows public HTTPS artwork but blocks private R2 endpoints', () => {
    expect(publicSeoImage('/media/sintel-poster.svg')).toBe('https://cineseya.lk/media/sintel-poster.svg');
    expect(publicSeoImage('https://image.tmdb.org/t/p/w780/example.jpg')).toBe('https://image.tmdb.org/t/p/w780/example.jpg');
    expect(publicSeoImage('https://account.r2.cloudflarestorage.com/private/object?X-Amz-Signature=secret')).toBe('https://cineseya.lk/og-default.png');
  });

  it('recognizes Sinhala availability and builds canonical breadcrumbs', () => {
    expect(hasSinhalaSubtitle(['English', 'Sinhala'])).toBe(true);
    expect(hasSinhalaSubtitle(['English', 'Tamil'])).toBe(false);
    const breadcrumbs = breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Movies', path: '/movies' }]);
    expect(breadcrumbs.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Home', item: canonicalUrl('/') },
      { '@type': 'ListItem', position: 2, name: 'Movies', item: canonicalUrl('/movies') },
    ]);
  });

  it('truncates long descriptions without collapsing them to an ellipsis', () => {
    const description = conciseDescription('Averylongwordwithoutspaces'.repeat(12), 'fallback', 80);
    expect(description.length).toBe(80);
    expect(description).not.toBe('…');
  });
});

describe('dynamic public metadata', () => {
  it('generates canonical movie, series, episode, and translator metadata', async () => {
    const movie = demoMovies[0]!;
    const series = demoSeries[0]!;
    const episode = series.seasons[0]!.episodes[0]!;
    const translator = demoTranslators[0]!;
    const [movieResult, seriesResult, episodeResult, translatorResult] = await Promise.all([
      movieMetadata({ params: Promise.resolve({ slug: movie.slug }) }),
      seriesMetadata({ params: Promise.resolve({ slug: series.slug }) }),
      episodeMetadata({ params: Promise.resolve({ slug: series.slug, season: `season-${episode.seasonNumber}`, episode: `episode-${episode.episodeNumber}` }) }),
      translatorMetadata({ params: Promise.resolve({ slug: translator.slug }) }),
    ]);
    expect(String(movieResult.alternates?.canonical)).toContain(`/movies/${movie.slug}`);
    expect(String(movieResult.title)).toContain(movie.title);
    expect(String(seriesResult.alternates?.canonical)).toContain(`/tv/${series.slug}`);
    expect(String(seriesResult.title)).toContain(series.title);
    expect(String(episodeResult.alternates?.canonical)).toContain(`/season-${episode.seasonNumber}/episode-${episode.episodeNumber}`);
    expect(String(episodeResult.title)).toContain(episode.title);
    expect(String(translatorResult.alternates?.canonical)).toContain(`/translator/${translator.slug}`);
    expect(String(translatorResult.title)).toContain(translator.displayName);
    expect(JSON.stringify([movieResult, seriesResult, episodeResult, translatorResult])).not.toContain('r2.cloudflarestorage.com');
  });

  it('keeps private and internal routes noindex', () => {
    for (const value of [adminMetadata, profileMetadata, notificationsMetadata, searchMetadata, watchlistMetadata]) {
      expect((value.robots as { index?: boolean }).index).toBe(false);
    }
  });
});

describe('crawl controls and sitemap quality', () => {
  it('publishes the canonical robots host and protects private routes', () => {
    const value = robots();
    expect(value.host).toBe(SEO_ORIGIN);
    expect(value.sitemap).toBe(`${SEO_ORIGIN}/sitemap.xml`);
    const rules = Array.isArray(value.rules) ? value.rules : [value.rules];
    const disallow = rules.flatMap((rule) => rule.disallow ?? []);
    expect(disallow).toEqual(expect.arrayContaining(['/admin/', '/api/', '/profile', '/watch/', '/download/', '/search']));
    expect(disallow).not.toContain('/icon-512.png');
  });

  it('lists only canonical public URLs, including episodes and translators', async () => {
    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(10);
    expect(entries.every((entry) => entry.url.startsWith(`${SEO_ORIGIN}/`))).toBe(true);
    expect(entries.some((entry) => entry.url.includes('/season-') && entry.url.includes('/episode-'))).toBe(true);
    expect(entries.some((entry) => entry.url.includes('/translator/'))).toBe(true);
    expect(entries.some((entry) => /\/(admin|api|profile|watch|download|search)(\/|$)/.test(entry.url))).toBe(false);
    expect(entries.some((entry) => entry.url.includes('cinerusubs.onrender.com'))).toBe(false);
  });

  it('never adds draft or archived movies to the sitemap', async () => {
    const draft = { ...demoMovies[0]!, id: 'draft-seo-test', slug: 'draft-seo-test', publicationStatus: 'draft' as const };
    const archived = { ...demoMovies[0]!, id: 'archived-seo-test', slug: 'archived-seo-test', publicationStatus: 'archived' as const };
    demoMovies.push(draft, archived);
    try {
      const entries = await sitemap();
      expect(entries.some((entry) => entry.url.endsWith('/movies/draft-seo-test'))).toBe(false);
      expect(entries.some((entry) => entry.url.endsWith('/movies/archived-seo-test'))).toBe(false);
    } finally {
      demoMovies.splice(-2, 2);
    }
  });
});

import type { MetadataRoute } from 'next';
import { getMovies, getSeries, getSubtitles, getTranslators } from '@/services/catalog';
import { canonicalUrl, isoDate, publicSeoImage } from '@/lib/seo';

export const dynamic = 'force-dynamic';

const staticPaths = [
  '', '/movies', '/tv', '/subtitles', '/discover', '/genres', '/languages',
  '/about', '/contact', '/privacy', '/terms', '/copyright', '/takedown', '/accessibility',
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [movies, series, subtitles, translators] = await Promise.all([
    getMovies(), getSeries(), getSubtitles(), getTranslators(),
  ]);
  const staticEntries: MetadataRoute.Sitemap = staticPaths.map((path) => ({
    url: canonicalUrl(path || '/'),
    changeFrequency: path === '' ? 'daily' : 'weekly',
    priority: path === '' ? 1 : .7,
  }));
  const languageSlugs: Record<string, string> = { si: 'sinhala', en: 'english', ta: 'tamil' };
  const latestLanguageUpdates = new Map<string, string>();
  for (const subtitle of subtitles) {
    if (!languageSlugs[subtitle.languageCode]) continue;
    const previous = latestLanguageUpdates.get(subtitle.languageCode);
    if (!previous || subtitle.updatedAt > previous) latestLanguageUpdates.set(subtitle.languageCode, subtitle.updatedAt);
  }
  const subtitleLanguages: MetadataRoute.Sitemap = [...latestLanguageUpdates].map(([code, updatedAt]) => ({
    url: canonicalUrl(`/subtitles/${languageSlugs[code]}`),
    lastModified: updatedAt,
    changeFrequency: 'daily',
    priority: .7,
  }));
  const movieEntries: MetadataRoute.Sitemap = movies.map((movie) => ({
    url: canonicalUrl(`/movies/${movie.slug}`),
    lastModified: isoDate(movie.updatedAt ?? movie.publishedAt ?? movie.releaseDate),
    changeFrequency: 'weekly',
    priority: .8,
    images: [publicSeoImage(movie.posterUrl)],
  }));
  const seriesEntries: MetadataRoute.Sitemap = series.flatMap((item) => [
    {
      url: canonicalUrl(`/tv/${item.slug}`),
      lastModified: isoDate(item.updatedAt ?? item.publishedAt),
      changeFrequency: 'weekly' as const,
      priority: .8,
      images: [publicSeoImage(item.posterUrl)],
    },
    ...item.seasons.flatMap((season) => season.episodes.map((episode) => ({
      url: canonicalUrl(`/tv/${item.slug}/season-${episode.seasonNumber}/episode-${episode.episodeNumber}`),
      lastModified: isoDate(episode.updatedAt ?? episode.releaseDate),
      changeFrequency: 'weekly' as const,
      priority: .7,
      images: [publicSeoImage(episode.thumbnailUrl)],
    }))),
  ]);
  const translatorEntries: MetadataRoute.Sitemap = translators.map((translator) => ({
    url: canonicalUrl(`/translator/${translator.slug}`),
    lastModified: isoDate(translator.updatedAt ?? translator.joinedAt),
    changeFrequency: 'weekly',
    priority: .6,
  }));
  return [...staticEntries, ...movieEntries, ...seriesEntries, ...subtitleLanguages, ...translatorEntries];
}

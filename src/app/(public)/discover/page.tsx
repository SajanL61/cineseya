import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DiscoverFilters } from '@/components/discover/discover-filters';
import { CatalogGrid } from '@/components/movie/catalog-grid';
import { getMovies } from '@/services/catalog';
import type { DiscoverFilters as Filters } from '@/types/content';
import { socialMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const params = await searchParams;
  const filtered = Object.values(params).some((value) => value !== undefined && value !== '');
  const title = 'Discover Movies & TV Series';
  const description = 'Explore the CineSeya catalogue by genre, language, country, year and subtitle availability.';
  return {
    title,
    description,
    alternates: { canonical: '/discover' },
    robots: filtered ? { index: false, follow: true } : { index: true, follow: true },
    ...socialMetadata(title, description, '/discover'),
  };
}

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const value = (key: string) => typeof raw[key] === 'string' ? raw[key] as string : undefined;
  const filters: Filters = { q: value('q'), type: value('type') as Filters['type'], genre: value('genre'), language: value('language'), country: value('country'), year: value('year'), rating: value('rating'), quality: value('quality'), subtitleLanguage: value('subtitleLanguage'), releaseType: value('releaseType'), sort: value('sort') as Filters['sort'] };
  const movies = filters.type === 'tv' ? [] : await getMovies(filters);
  return <div className="page-shell discover-page"><header className="page-heading"><div><span>Find your next story</span><h1>Discover</h1><p>Shape the catalogue around what matters to you. Every filter is reflected in the URL so your view is easy to save and share.</p></div><strong className="result-count">{movies.length} matches</strong></header><Suspense fallback={<div className="filter-skeleton"/>}><DiscoverFilters /></Suspense><CatalogGrid movies={movies} emptyTitle={filters.type === 'tv' ? 'TV results live in the series catalogue' : 'No titles match these filters'}/></div>;
}

import type { Metadata } from 'next';
import { CatalogGrid } from '@/components/movie/catalog-grid';
import { getMovies } from '@/services/catalog';
import type { DiscoverFilters } from '@/types/content';
import { socialMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const params = await searchParams;
  const filtered = Object.values(params).some((value) => value !== undefined && value !== '');
  const title = 'Movies with Sinhala Subtitles';
  const description = 'Browse published movies, release details, trailers and matched Sinhala subtitle availability on CineSeya.';
  return {
    title,
    description,
    alternates: { canonical: '/movies' },
    robots: filtered ? { index: false, follow: true } : { index: true, follow: true },
    ...socialMetadata(title, description, '/movies'),
  };
}

export default async function MoviesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const filters: DiscoverFilters = { sort: typeof params.sort === 'string' ? params.sort as DiscoverFilters['sort'] : 'newest', genre: typeof params.genre === 'string' ? params.genre : undefined, language: typeof params.language === 'string' ? params.language : undefined };
  const movies = await getMovies(filters);
  return <div className="page-shell"><header className="page-heading"><div><span>Explore the catalogue</span><h1>Movies</h1><p lang="si">අලුත්ම නිර්මාණවල සිට ජනප්‍රිය පැරණි නිර්මාණ දක්වා—ගැළපෙන සබ්ටයිටල් එක ඉක්මනින් සොයාගන්න.</p></div><strong className="result-count">{movies.length} titles</strong></header><CatalogGrid movies={movies}/></div>;
}

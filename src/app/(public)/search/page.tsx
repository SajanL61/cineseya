import type { Metadata } from 'next';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { CatalogGrid } from '@/components/movie/catalog-grid';
import { SeriesCard } from '@/components/tv/series-card';
import { getMovies, getSearchSuggestions, searchSeries } from '@/services/catalog';
import { SearchEventTracker } from '@/components/search/search-event-tracker';

export const metadata: Metadata = { title: 'Search', alternates: { canonical: '/search' }, robots: { index: false, follow: true } };
export const dynamic = 'force-dynamic';

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams;
  const [movies, series, suggestions] = q ? await Promise.all([getMovies({ q }), searchSeries(q), getSearchSuggestions(q)]) : [[], [], []];
  const people = suggestions.filter((item) => item.type === 'person' || item.type === 'translator');
  const resultCount = movies.length + series.length + people.length;
  return <div className="page-shell search-page"><SearchEventTracker query={q} resultCount={resultCount}/><header className="page-heading"><div><span>Fuzzy, Sinhala-aware discovery</span><h1>{q ? `Results for “${q}”` : 'Search CineSeya.lk'}</h1><p>Search English, original, Sinhala and alternative titles, actors, directors, genres, countries, languages and translators.</p></div></header><form className="search-page-form"><Search/><input name="q" defaultValue={q} placeholder="Movie, series, actor or translator…" autoFocus/><button>Search</button></form>{q && <><section className="search-results-section"><h2>Movies <span>{movies.length}</span></h2><CatalogGrid movies={movies} emptyTitle="No matching movies"/></section>{series.length > 0 && <section className="search-results-section"><h2>TV Series <span>{series.length}</span></h2><div className="catalog-grid series-catalog">{series.map((item) => <SeriesCard key={item.id} series={item}/>)}</div></section>}{people.length > 0 && <section className="search-results-section"><h2>People & Translators <span>{people.length}</span></h2><div className="search-people-results">{people.map((item) => <Link key={`${item.type}-${item.slug}`} href={item.type === 'person' ? `/person/${item.slug}` : `/translator/${item.slug}`}><b>{item.title}</b><small>{item.subtitle}</small></Link>)}</div></section>}{resultCount === 0 && <div className="inline-empty">No close matches yet. Try fewer words, a person&apos;s name, the original title, or a common title variation.</div>}</>}</div>;
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { getMovies } from '@/services/catalog';
import { socialMetadata } from '@/lib/seo';

const title = 'Movie & TV Genres'; const description = 'Browse published movies and TV series by genre on CineSeya.';
export const metadata: Metadata = { title, description, alternates: { canonical: '/genres' }, ...socialMetadata(title, description, '/genres') };
export const dynamic = 'force-dynamic';
export default async function GenresPage() { const movies = await getMovies(); const genres = Array.from(new Set(movies.flatMap((movie) => movie.genres))).sort(); return <div className="page-shell"><header className="page-heading"><div><span>Browse by mood</span><h1>Genres</h1><p>Move from animation to mystery, classic comedy to science fiction.</p></div></header><div className="taxonomy-grid">{genres.map((genre,index) => <Link href={`/discover?genre=${encodeURIComponent(genre)}`} key={genre}><b>{String(index+1).padStart(2,'0')}</b><h2>{genre}</h2><span>{movies.filter((movie) => movie.genres.includes(genre)).length} titles</span><i>Explore →</i></Link>)}</div></div>; }

import { Play, Star } from 'lucide-react';
import Link from 'next/link';
import { CinePoster } from '@/components/ui/cine-artwork';
import type { SeriesRecord } from '@/types/content';
import { WatchlistButton } from '@/components/movie/watchlist-button';

export function SeriesCard({ series, priority = false }: { series: SeriesRecord; priority?: boolean }) {
  const episodes = series.seasons.reduce((count, season) => count + season.episodes.length, 0);
  return <article className="movie-card series-card"><div className="movie-card-art"><Link href={`/tv/${series.slug}`}><CinePoster src={series.posterUrl} alt={`${series.title} poster`} focalPoint={series.posterFocalPoint} fillContainer preload={priority} sizes="(max-width: 700px) 42vw, 200px" /></Link><div className="card-badges">{series.trending && <span className="badge-hot">TRENDING</span>}<span>{series.seasons.length} SEASON{series.seasons.length === 1 ? '' : 'S'}</span></div><div className="card-quick-actions"><Link href={`/tv/${series.slug}`} aria-label={`Open ${series.title}`}><Play /></Link><WatchlistButton id={series.id} type="series" slug={series.slug} title={series.title} posterUrl={series.posterUrl} posterFocalPoint={series.posterFocalPoint}/></div><span className="subtitle-ribbon">{episodes} EPISODE{episodes === 1 ? '' : 'S'}</span></div><div className="movie-card-copy"><Link href={`/tv/${series.slug}`}><h3>{series.title}</h3></Link><p><span>{series.year}</span><i/><span>{series.status}</span>{series.tmdbRating && <><i/><span className="card-rating"><Star/>{series.tmdbRating.toFixed(1)}</span></>}</p></div></article>;
}

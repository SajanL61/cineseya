import { Play, Star } from 'lucide-react';
import Link from 'next/link';
import { CinePoster } from '@/components/ui/cine-artwork';
import type { MovieRecord } from '@/types/content';
import { WatchlistButton } from './watchlist-button';

const releaseSourcePattern = /\b(WEB[- ]?DL|WEBRip|BluRay|HDRip|HDTV|DVDRip)\b/i;
const videoQualityPattern = /\b(2160p|1080p|720p|4K|2K|FHD|HD|SD)\b/i;

function normalizeVideoQuality(value?: string) {
  if (!value) return undefined;
  const normalized = value.toUpperCase();
  if (normalized === '2160P') return '4K';
  if (normalized === '1080P') return 'FHD';
  if (normalized === '720P') return 'HD';
  return normalized;
}

export function getMoviePosterBadges(movie: MovieRecord) {
  const mediaDescription = movie.qualities.join(' ');
  return {
    language: movie.languages[0],
    source: movie.releaseType ?? mediaDescription.match(releaseSourcePattern)?.[0],
    quality: normalizeVideoQuality(movie.videoQuality ?? mediaDescription.match(videoQualityPattern)?.[0]),
  };
}

export function MovieCard({ movie, priority = false }: { movie: MovieRecord; priority?: boolean }) {
  const rating = movie.imdbRating ?? movie.tmdbRating;
  const badges = getMoviePosterBadges(movie);
  const badgeLabel = [badges.language, badges.source, badges.quality].filter(Boolean).join(', ');
  return <article className="movie-card">
    <div className="movie-card-art">
      <Link href={`/movies/${movie.slug}`} aria-label={`View ${movie.title}`}><CinePoster src={movie.posterUrl} alt={`${movie.title} poster`} focalPoint={movie.posterFocalPoint} fillContainer preload={priority} sizes="(max-width: 520px) 42vw, (max-width: 1000px) 25vw, 190px" /></Link>
      {badgeLabel && <div className="movie-category-badges" aria-label={`Media details: ${badgeLabel}`}>
        {badges.language && <span className="badge-language">{badges.language}</span>}
        {badges.source && <span className="badge-source">{badges.source}</span>}
        {badges.quality && <span className="badge-quality">{badges.quality}</span>}
      </div>}
      {movie.trending && <span className="card-trending-badge">TRENDING</span>}
      <div className="card-quick-actions"><Link href={`/movies/${movie.slug}`} aria-label={`Open ${movie.title}`}><Play /></Link><WatchlistButton id={movie.id} slug={movie.slug} title={movie.title} posterUrl={movie.posterUrl} posterFocalPoint={movie.posterFocalPoint} /></div>
      {movie.subtitleLanguages.includes('Sinhala') && <span className="subtitle-ribbon">සිංහල SUB</span>}
    </div>
    <div className="movie-card-copy"><Link href={`/movies/${movie.slug}`}><h3>{movie.title}</h3></Link><p><span>{movie.year}</span><i /> <span>{movie.languages[0]}</span>{rating && <><i /><span className="card-rating"><Star />{rating.toFixed(1)}</span></>}</p></div>
  </article>;
}

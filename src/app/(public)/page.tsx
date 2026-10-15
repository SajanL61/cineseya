import type { Metadata } from 'next';
import Link from 'next/link';
import { MediaRow } from '@/components/movie/media-row';
import { TrendingHeroCarousel } from '@/components/movie/trending-hero-carousel';
import { SubtitleCard } from '@/components/subtitle/subtitle-card';
import { SeriesCard } from '@/components/tv/series-card';
import { getMovies, getSeries, getSubtitles } from '@/services/catalog';
import { currentUser } from '@/lib/auth';
import { getContinueWatching } from '@/services/viewing';
import { ContinueWatchingRow } from '@/components/player/continue-watching-row';
import { headers } from 'next/headers';
import { AdPageLoader } from '@/components/ads/ad-page-loader';
import { AdSlot } from '@/components/ads/ad-slot';
import { evaluateAdEligibility } from '@/lib/ads';
import { getAdSettings } from '@/services/ad-settings';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { alternates: { canonical: '/' } };

export default async function HomePage() {
  const user = await currentUser();
  const [movies, series, subtitles, continueWatching, adSettings, requestHeaders] = await Promise.all([getMovies(), getSeries(), getSubtitles(), user ? getContinueWatching(user.id) : Promise.resolve([]), getAdSettings(), headers()]);
  const trending = movies.filter((movie) => movie.trending);
  const carouselMovies = [...trending, ...movies.filter((movie) => !movie.trending)].slice(0, 6);
  const topRated = [...movies].sort((a, b) => (b.imdbRating ?? 0) - (a.imdbRating ?? 0));
  const newReleases = [...movies].sort((a, b) => b.year - a.year);
  const hostname = (requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host') ?? '').split(':')[0]!.toLowerCase();
  const publisherText = ['Trending Now', 'Latest Sinhala Subtitles', 'New Releases', 'Top Rated', 'Latest TV Episodes', 'Editors Picks', 'Animation', 'Most Downloaded Subtitles', ...carouselMovies.flatMap((movie) => [movie.title, movie.overview])].join(' ');
  const adInput = { settings: adSettings, page: { route: '/', published: true, hasContent: true, publisherText }, hostname, production: process.env.NODE_ENV === 'production' };
  const afterTrending = evaluateAdEligibility({ ...adInput, placement: 'HOME_AFTER_TRENDING', page: { ...adInput.page, hasContent: trending.length > 0 } });
  const afterTopRated = evaluateAdEligibility({ ...adInput, placement: 'HOME_AFTER_TOP_RATED', page: { ...adInput.page, hasContent: topRated.length > 0 } });
  const live = [afterTrending, afterTopRated].find((decision) => decision.render === 'live');
  return <>
    <AdPageLoader enabled={Boolean(live)} publisherId={live?.publisherId}/>
    <TrendingHeroCarousel movies={carouselMovies}/>
    <div className="home-content">
      <ContinueWatchingRow items={continueWatching}/>
      <MediaRow eyebrow="What everyone is watching" title="Trending Now" href="/discover?sort=trending" movies={trending} />
      <AdSlot placement="HOME_AFTER_TRENDING" decision={afterTrending} format="horizontal"/>
      <section className="media-section subtitle-home-section"><header className="section-heading"><div><span>Freshly timed and reviewed</span><h2>Latest Sinhala Subtitles</h2></div><Link href="/subtitles/sinhala">View all <span aria-hidden="true">→</span></Link></header><div className="subtitle-home-list">{subtitles.filter((subtitle) => subtitle.languageCode === 'si').slice(0, 3).map((subtitle) => <SubtitleCard key={subtitle.id} subtitle={subtitle} compact />)}</div></section>
      <MediaRow eyebrow="Recently added" title="New Releases" href="/movies?sort=newest" movies={newReleases} />
      <MediaRow eyebrow="Audience favourites" title="Top Rated" href="/discover?sort=rating" movies={topRated} />
      <AdSlot placement="HOME_AFTER_TOP_RATED" decision={afterTopRated} format="horizontal"/>
      <section className="media-section"><header className="section-heading"><div><span>Continue the story</span><h2>Latest TV Episodes</h2></div><Link href="/tv">View all <span aria-hidden="true">→</span></Link></header><div className="media-row series-row">{series.map((item) => <SeriesCard key={item.id} series={item}/>)}</div></section>
      <MediaRow eyebrow="Curated by CineSeya.lk" title="Editors’ Picks" href="/discover?sort=rating" movies={movies.filter((movie) => movie.editorPick)} />
      <MediaRow eyebrow="Open and licensed animation" title="Animation" href="/discover?genre=Animation" movies={movies.filter((movie) => movie.genres.includes('Animation'))} />
      <MediaRow eyebrow="Most trusted releases" title="Most Downloaded Subtitles" href="/subtitles?sort=downloads" movies={[...movies].sort((a,b) => b.subtitleDownloadCount-a.subtitleDownloadCount)} />
    </div>
  </>;
}

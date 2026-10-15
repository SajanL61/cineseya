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
import { getSocialSettings } from '@/services/site-settings';
import { NonceJsonLd } from '@/components/seo/nonce-json-ld';
import {
  SEO_DEFAULT_DESCRIPTION,
  SEO_DEFAULT_IMAGE,
  SEO_DEFAULT_TITLE,
  SEO_ORIGIN,
  siteIdentityJsonLd,
} from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: { absolute: SEO_DEFAULT_TITLE },
  description: SEO_DEFAULT_DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    title: SEO_DEFAULT_TITLE,
    description: SEO_DEFAULT_DESCRIPTION,
    url: SEO_ORIGIN,
    images: [{ url: SEO_DEFAULT_IMAGE, width: 1200, height: 630, alt: 'CineSeya' }],
  },
  twitter: { card: 'summary_large_image', title: SEO_DEFAULT_TITLE, description: SEO_DEFAULT_DESCRIPTION, images: [SEO_DEFAULT_IMAGE] },
};

export default async function HomePage() {
  const user = await currentUser();
  const [movies, series, subtitles, continueWatching, adSettings, socialSettings, requestHeaders] = await Promise.all([getMovies(), getSeries(), getSubtitles(), user ? getContinueWatching(user.id) : Promise.resolve([]), getAdSettings(), getSocialSettings(), headers()]);
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
  const { organization, website } = siteIdentityJsonLd(socialSettings);
  return <>
    <NonceJsonLd value={organization}/>
    <NonceJsonLd value={website}/>
    <AdPageLoader enabled={Boolean(live)} publisherId={live?.publisherId}/>
    <TrendingHeroCarousel movies={carouselMovies}/>
    <div className="home-content">
      <section className="home-seo-intro" aria-labelledby="home-seo-heading">
        <span className="section-label">Discover with CineSeya</span>
        <h1 id="home-seo-heading">Movies, TV Series &amp; Sinhala Subtitles</h1>
        <p>CineSeya helps Sri Lankan audiences discover movies and TV series, find release-matched Sinhala subtitles, and recognize the translators behind each published file.</p>
        <nav aria-label="Featured CineSeya destinations"><Link href="/movies">Browse movies</Link><Link href="/tv">Explore TV series</Link><Link href="/subtitles/sinhala">Find Sinhala subtitles</Link></nav>
      </section>
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

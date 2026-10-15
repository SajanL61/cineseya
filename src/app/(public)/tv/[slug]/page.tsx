import type { Metadata } from "next";
import { Star } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CommunityPanel } from "@/components/community/community-panel";
import { WatchlistButton } from "@/components/movie/watchlist-button";
import { SeasonBrowser } from "@/components/tv/season-browser";
import { currentUser } from "@/lib/auth";
import { rightsLabel } from "@/lib/rights";
import { getSeriesBySlug } from "@/services/catalog";
import { CineBackdrop, CinePoster } from "@/components/ui/cine-artwork";
import { NonceJsonLd } from "@/components/seo/nonce-json-ld";
import {
  breadcrumbJsonLd,
  canonicalUrl,
  conciseDescription,
  hasSinhalaSubtitle,
  publicSeoImage,
} from "@/lib/seo";

export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const series = await getSeriesBySlug(slug);
  if (!series) return {};
  const route = `/tv/${series.slug}`;
  const hasSinhala = hasSinhalaSubtitle(series.seasons.flatMap((season) => season.episodes.flatMap((episode) => episode.subtitleLanguages)));
  const title = `${series.title} (${series.year}) TV Series${hasSinhala ? ' Sinhala Subtitles' : ''}`;
  const description = conciseDescription(`${series.title} season and episode guide${hasSinhala ? ' with published Sinhala subtitles' : ''}. ${series.overview}`, `TV series details for ${series.title} on CineSeya.`);
  const image = publicSeoImage(series.backdropUrl, publicSeoImage(series.posterUrl));
  return {
    title,
    description,
    alternates: { canonical: route },
    openGraph: { type: 'video.tv_show', siteName: 'CineSeya', title, description, url: canonicalUrl(route), images: [{ url: image, alt: `${series.title} (${series.year})` }] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}
export default async function SeriesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const series = await getSeriesBySlug(slug);
  if (!series) notFound();
  const user = await currentUser();
  const episodeCount = series.seasons.reduce(
    (sum, item) => sum + item.episodes.length,
    0,
  );
  const route = `/tv/${series.slug}`;
  const directors = (series.crew ?? []).filter((credit) => credit.role?.toLowerCase().includes('director'));
  const schema = {
    "@context": "https://schema.org",
    "@type": "TVSeries",
    "@id": `${canonicalUrl(route)}#series`,
    url: canonicalUrl(route),
    name: series.title,
    alternateName: [series.originalTitle, series.sinhalaTitle].filter(Boolean),
    description: series.overview,
    image: publicSeoImage(series.posterUrl),
    contentRating: series.ageRating && series.ageRating !== 'NR' ? series.ageRating : undefined,
    inLanguage: series.languages,
    numberOfSeasons: series.seasons.length,
    numberOfEpisodes: episodeCount,
    genre: series.genres,
    actor: (series.cast ?? []).map((credit) => ({ '@type': 'Person', name: credit.name })),
    director: directors.map((credit) => ({ '@type': 'Person', name: credit.name })),
    sameAs: [
      series.imdbId ? `https://www.imdb.com/title/${series.imdbId}/` : undefined,
      series.tmdbId ? `https://www.themoviedb.org/tv/${series.tmdbId}` : undefined,
    ].filter(Boolean),
  };
  const breadcrumb = breadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: 'TV Series', path: '/tv' },
    { name: series.title, path: route },
  ]);
  return (
    <>
      <NonceJsonLd value={schema} />
      <NonceJsonLd value={breadcrumb} />
      <article className="series-page">
        <header className="series-hero">
          <div className="detail-backdrop">
            <CineBackdrop
              src={series.backdropUrl}
              alt=""
              focalPoint={series.backdropFocalPoint}
              fillContainer
              preload
              sizes="100vw"
            />
          </div>
          <div className="series-hero-inner">
            <div className="detail-poster">
              <CinePoster
                src={series.posterUrl}
                alt={`${series.title} (${series.year}) poster`}
                focalPoint={series.posterFocalPoint}
                fillContainer
                sizes="250px"
              />
            </div>
            <div>
              <nav aria-label="Breadcrumb">
                <Link href="/">Home</Link>
                <span>/</span>
                <Link href="/tv">TV Series</Link>
                <span>/</span>
                <span>{series.title}</span>
              </nav>
              <span className="detail-kicker">{series.genres.join(" · ")}</span>
              <h1>{series.title}</h1>
              {series.sinhalaTitle && (
                <p className="sinhala-title" lang="si">
                  {series.sinhalaTitle}
                </p>
              )}
              <div className="detail-meta">
                <span>{series.year}</span>
                <i />
                <span>
                  {series.seasons.length} season
                  {series.seasons.length === 1 ? "" : "s"}
                </span>
                <i />
                <span>{episodeCount} episodes</span>
                <i />
                <span>{series.status}</span>
              </div>
              {series.tmdbRating && (
                <div className="rating-row">
                  <span>
                    <b>Rating</b>
                    <strong>
                      <Star />
                      {series.tmdbRating.toFixed(1)}
                    </strong>
                  </span>
                  <span className={`rights-chip rights-${series.rightsStatus}`}>
                    {rightsLabel(series.rightsStatus)}
                  </span>
                </div>
              )}
              <p className="detail-overview">{series.overview}</p>
              <div className="detail-secondary">
                <WatchlistButton
                  id={series.id}
                  type="series"
                  slug={series.slug}
                  title={series.title}
                  posterUrl={series.posterUrl}
                  posterFocalPoint={series.posterFocalPoint}
                  label
                />
              </div>
            </div>
          </div>
        </header>
        <div className="series-content">
          <header>
            <span className="section-label">Episode guide</span>
            <h2>Seasons & Episodes</h2>
          </header>
          <SeasonBrowser seriesSlug={series.slug} seasons={series.seasons} />
          <section className="detail-section">
            <span className="section-label">Community</span>
            <h2>Ratings & Comments</h2>
            <CommunityPanel
              type="series"
              id={series.id}
              authenticated={Boolean(user)}
            />
          </section>
        </div>
      </article>
    </>
  );
}

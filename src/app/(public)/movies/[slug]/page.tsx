import type { Metadata } from "next";
import { Download, ExternalLink, Play, ShieldAlert, Star } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ShareButton } from "@/components/movie/share-dialog";
import { TrailerDialog } from "@/components/movie/trailer-dialog";
import { WatchlistButton } from "@/components/movie/watchlist-button";
import { SubtitleCard } from "@/components/subtitle/subtitle-card";
import { mayDistributeFullMedia, rightsLabel } from "@/lib/rights";
import {
  getActiveMediaVersions,
  getMovieBySlug,
  getMovies,
  getSubtitlesForMovie,
} from "@/services/catalog";
import { currentUser } from "@/lib/auth";
import { CommunityPanel } from "@/components/community/community-panel";
import { DownloadOptions } from "@/components/movie/download-server-options";
import { CineBackdrop, CinePoster } from "@/components/ui/cine-artwork";
import { getReadyStreamForContent } from "@/services/media";
import type { MediaVersionDto } from "@/types/media";
import { SubtitleInterest } from "@/components/subtitle/subtitle-interest";
import { getSubtitleInterest } from "@/services/subtitle-interest";
import { headers } from "next/headers";
import { NonceJsonLd } from "@/components/seo/nonce-json-ld";
import { AdPageLoader } from "@/components/ads/ad-page-loader";
import { AdSlot } from "@/components/ads/ad-slot";
import { evaluateAdEligibility } from "@/lib/ads";
import { getAdSettings } from "@/services/ad-settings";
import {
  breadcrumbJsonLd,
  canonicalOverride,
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
  const movie = await getMovieBySlug(slug);
  if (!movie) return {};
  const sinhalaAvailable = hasSinhalaSubtitle(movie.subtitleLanguages);
  const title = movie.seo?.title?.trim() ||
    `${movie.title} (${movie.year}) ${sinhalaAvailable ? "Sinhala Subtitles" : "Movie Details"}`;
  const description = conciseDescription(
    movie.seo?.description ||
      `${movie.title} (${movie.year}) ${sinhalaAvailable ? "has published Sinhala subtitles on CineSeya. " : "movie details on CineSeya. "}${movie.overview}`,
    `Movie details for ${movie.title} on CineSeya.`,
  );
  const route = `/movies/${movie.slug}`;
  const canonical = canonicalOverride(movie.seo?.canonical, route);
  const image = publicSeoImage(movie.backdropUrl, publicSeoImage(movie.posterUrl));
  return {
    title,
    description,
    alternates: { canonical },
    robots: movie.seo?.noindex ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      type: "video.movie",
      siteName: "CineSeya",
      title,
      description,
      images: [{ url: image, alt: `${movie.title} (${movie.year})` }],
      url: canonical,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function MovieDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const movie = await getMovieBySlug(slug);
  if (!movie) notFound();
  const [
    subtitles,
    related,
    downloadVersions,
    user,
    stream,
    adSettings,
    requestHeaders,
  ] = await Promise.all([
    getSubtitlesForMovie(movie.id),
    getMovies({ genre: movie.genres[0] }),
    getActiveMediaVersions(movie.id, "movie"),
    currentUser(),
    getReadyStreamForContent(movie.id, "movie"),
    getAdSettings(),
    headers(),
  ]);
  const subtitleInterest = subtitles.some((item) => item.languageCode === "si")
    ? null
    : await getSubtitleInterest("movie", movie.id, user?.id);
  const versions: MediaVersionDto[] = stream
    ? downloadVersions.length
      ? [
          {
            ...downloadVersions[0]!,
            id: stream.id,
            downloadId: downloadVersions[0]!.id,
          },
          ...downloadVersions.slice(1),
        ]
      : [
          {
            id: stream.id,
            _id: stream.id,
            contentType: "movie",
            quality: stream.qualities.at(-1) || "Auto",
            resolution: "Adaptive",
            releaseType: "HLS",
            videoCodec: "H264",
            audioCodec: "AAC",
            container: "HLS",
            audioLanguages: movie.languages,
            embeddedSubtitleLanguages: movie.subtitleLanguages,
            fileName: "Adaptive stream",
            fileSize: 0,
            rightsStatus: movie.rightsStatus,
            directAvailable: false,
            mirrors: [],
          },
        ]
    : downloadVersions;
  const distributable =
    mayDistributeFullMedia(movie.rightsStatus) && downloadVersions.length > 0;
  const streamable =
    mayDistributeFullMedia(movie.rightsStatus) && Boolean(stream);
  const director = movie.crew.find((credit) =>
    credit.role?.toLowerCase().includes("director"),
  );
  const route = `/movies/${movie.slug}`;
  const hostname = (
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    ""
  )
    .split(":")[0]!
    .toLowerCase();
  const adInput = {
    settings: adSettings,
    page: {
      route,
      published: movie.publicationStatus === "published",
      hasContent: Boolean(movie.overview.trim()),
      requiresOriginalEditorial: true,
      publisherText: [
        movie.title,
        movie.originalTitle,
        movie.sinhalaTitle,
        movie.overview,
      ]
        .filter(Boolean)
        .join(" "),
    },
    hostname,
    production: process.env.NODE_ENV === "production",
  };
  const editorialAd = evaluateAdEligibility({
    ...adInput,
    placement: "MOVIE_EDITORIAL",
  });
  const sidebarAd = evaluateAdEligibility({
    ...adInput,
    placement: "MOVIE_SIDEBAR",
    page: { ...adInput.page, requiresOriginalEditorial: false },
  });
  const liveAd = [editorialAd, sidebarAd].find(
    (decision) => decision.render === "live",
  );
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Movie",
    "@id": `${canonicalUrl(route)}#movie`,
    url: canonicalUrl(route),
    name: movie.title,
    alternateName: [movie.originalTitle, movie.sinhalaTitle].filter(Boolean),
    datePublished: movie.releaseDate,
    duration: movie.runtime > 0 ? `PT${movie.runtime}M` : undefined,
    description: movie.overview,
    image: publicSeoImage(movie.posterUrl),
    genre: movie.genres,
    inLanguage: movie.languages,
    contentRating: movie.ageRating && movie.ageRating !== "NR" ? movie.ageRating : undefined,
    countryOfOrigin: movie.countries.map((name) => ({
      "@type": "Country",
      name,
    })),
    actor: movie.cast.map((credit) => ({ "@type": "Person", name: credit.name })),
    director: director ? { "@type": "Person", name: director.name } : undefined,
    sameAs: [
      movie.imdbId ? `https://www.imdb.com/title/${movie.imdbId}/` : undefined,
      movie.tmdbId ? `https://www.themoviedb.org/movie/${movie.tmdbId}` : undefined,
    ].filter(Boolean),
  };
  const breadcrumb = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Movies", path: "/movies" },
    { name: movie.title, path: route },
  ]);
  return (
    <>
      <NonceJsonLd value={jsonLd} />
      <NonceJsonLd value={breadcrumb} />
      <AdPageLoader
        enabled={Boolean(liveAd)}
        publisherId={liveAd?.publisherId}
      />
      <article className="detail-page">
        <header className="detail-hero">
          <div className="detail-backdrop">
            <CineBackdrop
              src={movie.backdropUrl}
              alt=""
              focalPoint={movie.backdropFocalPoint}
              fillContainer
              preload
              sizes="100vw"
            />
          </div>
          <div className="detail-hero-inner">
            <div className="detail-poster">
              <CinePoster
                src={movie.posterUrl}
                alt={`${movie.title} (${movie.year}) poster`}
                focalPoint={movie.posterFocalPoint}
                fillContainer
                sizes="260px"
              />
            </div>
            <div className="detail-title">
              <nav aria-label="Breadcrumb">
                <Link href="/">Home</Link>
                <span>/</span>
                <Link href="/movies">Movies</Link>
                <span>/</span>
                <span>{movie.title}</span>
              </nav>
              <span className="detail-kicker">{movie.genres.join(" · ")}</span>
              <h1>{movie.title}</h1>
              {movie.originalTitle && movie.originalTitle !== movie.title && (
                <p className="original-title">{movie.originalTitle}</p>
              )}
              {movie.sinhalaTitle && (
                <p className="sinhala-title" lang="si">
                  {movie.sinhalaTitle}
                </p>
              )}
              <div className="detail-meta">
                <span>{movie.year}</span>
                <i />
                <span>{movie.runtime} min</span>
                <i />
                <span>{movie.ageRating}</span>
                <i />
                <span>{movie.languages.join(", ")}</span>
                <i />
                <span>{movie.releaseStatus}</span>
              </div>
              <div className="rating-row">
                {movie.imdbRating && (
                  <span>
                    <b>IMDb</b>
                    <strong>
                      <Star />
                      {movie.imdbRating.toFixed(1)}
                    </strong>
                  </span>
                )}
                {movie.tmdbRating && (
                  <span>
                    <b>TMDb</b>
                    <strong>
                      <Star />
                      {movie.tmdbRating.toFixed(1)}
                    </strong>
                  </span>
                )}
                <span className={`rights-chip rights-${movie.rightsStatus}`}>
                  {rightsLabel(movie.rightsStatus)}
                </span>
              </div>
              <p className="detail-overview">{movie.overview}</p>
              <div className="detail-actions">
                {movie.trailerUrl && (
                  <TrailerDialog title={movie.title} url={movie.trailerUrl} />
                )}{" "}
                {streamable && (
                  <Link
                    className="action-button"
                    href={`/watch/${versions[0]!.id}`}
                  >
                    <Play />
                    Watch Online
                  </Link>
                )}{" "}
                {distributable && (
                  <DownloadOptions
                    title={movie.title}
                    posterUrl={movie.posterUrl}
                    posterFocalPoint={movie.posterFocalPoint}
                    versions={versions}
                  />
                )}{" "}
                {subtitles[0] && (
                  <a
                    className="action-button subtitle-action"
                    href={`/api/subtitles/${subtitles[0].id}/download`}
                  >
                    <Download />
                    Download Sinhala Subtitle
                  </a>
                )}
              </div>
              <div className="detail-secondary">
                <WatchlistButton
                  id={movie.id}
                  slug={movie.slug}
                  title={movie.title}
                  posterUrl={movie.posterUrl}
                  posterFocalPoint={movie.posterFocalPoint}
                  label
                />
                <ShareButton title={movie.title} />
              </div>
            </div>
          </div>
        </header>
        <nav className="detail-tabs" aria-label="Movie sections">
          <a href="#overview">Overview</a>
          <a href="#subtitles">
            Subtitles <span>{subtitles.length}</span>
          </a>
          <a href="#media">Media</a>
          <a href="#cast">Cast & Crew</a>
          <a href="#reviews">Reviews</a>
          <a href="#details">Details</a>
        </nav>
        <div className="detail-content">
          <div className="detail-main">
            <section id="overview" className="detail-section">
              <span className="section-label">Story</span>
              <h2>Overview</h2>
              <p className="long-overview">{movie.overview}</p>
              <div className="facts-grid">
                <div>
                  <span>Director</span>
                  <b>{director?.name ?? "Not listed"}</b>
                </div>
                <div>
                  <span>Release date</span>
                  <b>
                    {new Date(movie.releaseDate).toLocaleDateString("en-LK", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </b>
                </div>
                <div>
                  <span>Countries</span>
                  <b>{movie.countries.join(", ")}</b>
                </div>
                <div>
                  <span>Languages</span>
                  <b>{movie.languages.join(", ")}</b>
                </div>
                <div>
                  <span>Genres</span>
                  <b>{movie.genres.join(", ")}</b>
                </div>
                <div>
                  <span>Runtime</span>
                  <b>{movie.runtime} minutes</b>
                </div>
              </div>
              <AdSlot
                placement="MOVIE_EDITORIAL"
                decision={editorialAd}
                format="horizontal"
              />
            </section>
            <section id="subtitles" className="detail-section">
              <span className="section-label">Matched downloads</span>
              <h2>Subtitles</h2>
              {subtitles.length ? (
                <div className="subtitle-list">
                  {subtitles.map((subtitle) => (
                    <SubtitleCard key={subtitle.id} subtitle={subtitle} />
                  ))}
                </div>
              ) : (
                <div className="inline-empty">
                  No published subtitles are attached to this title.
                </div>
              )}
              {subtitleInterest && (
                <SubtitleInterest
                  contentType="movie"
                  contentId={movie.id}
                  title={movie.title}
                  authenticated={Boolean(user)}
                  initial={subtitleInterest}
                />
              )}
            </section>
            <section id="media" className="detail-section">
              <span className="section-label">Available versions</span>
              <h2>Downloads</h2>
              {distributable ? (
                <>
                  <div className="media-version-list">
                    {versions.map((version) => (
                      <div key={version.id}>
                        <span>
                          <b>{version.quality}</b>
                          <small>
                            {version.releaseType} ·{" "}
                            {version.videoCodec ?? "Video"} ·{" "}
                            {version.resolution}
                          </small>
                        </span>
                        <em>
                          {(version.fileSize / 1_000_000_000).toFixed(1)} GB
                        </em>
                      </div>
                    ))}
                  </div>
                  <DownloadOptions
                    title={movie.title}
                    posterUrl={movie.posterUrl}
                    posterFocalPoint={movie.posterFocalPoint}
                    versions={versions}
                  />
                </>
              ) : (
                <div className="rights-notice">
                  <ShieldAlert />
                  <div>
                    <b>Full media is not available from CineSeya.lk</b>
                    <p>
                      {movie.rightsStatus === "subtitle_only" ||
                      movie.rightsStatus === "unavailable"
                        ? "This listing is limited to metadata, trailers, reviews, subtitles and legitimate external information."
                        : "No verified distributable media version is active for this title."}
                    </p>
                  </div>
                </div>
              )}
            </section>
            <section id="cast" className="detail-section">
              <span className="section-label">People</span>
              <h2>Cast & Crew</h2>
              <div className="credits-grid">
                {[...movie.cast, ...movie.crew].map((credit, index) => (
                  <Link
                    href={`/person/${credit.slug}`}
                    key={`${credit.slug}-${index}`}
                  >
                    <span className={credit.profileUrl ? "has-image" : undefined}>
                      {credit.profileUrl ? (
                        <Image
                          src={credit.profileUrl}
                          alt={`${credit.name} profile`}
                          width={56}
                          height={56}
                          sizes="56px"
                        />
                      ) : (
                        credit.name
                          .split(" ")
                          .map((word) => word[0])
                          .join("")
                          .slice(0, 2)
                      )}
                    </span>
                    <b>{credit.name}</b>
                    <small>{credit.character ?? credit.role ?? "Cast"}</small>
                  </Link>
                ))}
              </div>
            </section>
            <section id="reviews" className="detail-section">
              <span className="section-label">Community</span>
              <h2>Reviews & Comments</h2>
              <CommunityPanel
                type="movie"
                id={movie.id}
                authenticated={Boolean(user)}
              />
            </section>
          </div>
          <aside className="detail-sidebar">
            <section id="details">
              <h2>Title details</h2>
              <dl>
                <div>
                  <dt>Original title</dt>
                  <dd>{movie.originalTitle ?? movie.title}</dd>
                </div>
                <div>
                  <dt>Year</dt>
                  <dd>{movie.year}</dd>
                </div>
                <div>
                  <dt>Age rating</dt>
                  <dd>{movie.ageRating}</dd>
                </div>
                <div>
                  <dt>Quality</dt>
                  <dd>{movie.qualities.join(", ") || "Metadata only"}</dd>
                </div>
                <div>
                  <dt>Subtitle languages</dt>
                  <dd>
                    {movie.subtitleLanguages.join(", ") || "None attached"}
                  </dd>
                </div>
              </dl>
            </section>
            <AdSlot
              placement="MOVIE_SIDEBAR"
              decision={sidebarAd}
              format="rectangle"
              desktopBreakpoint={1200}
            />
            <section>
              <h2>External information</h2>
              {movie.imdbId && (
                <a
                  href={`https://www.imdb.com/title/${movie.imdbId}/`}
                  target="_blank"
                  rel="noreferrer"
                >
                  IMDb <ExternalLink />
                </a>
              )}
              {movie.tmdbId && (
                <a
                  href={`https://www.themoviedb.org/movie/${movie.tmdbId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  TMDb <ExternalLink />
                </a>
              )}
              <a
                href={`https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(movie.title)}`}
                target="_blank"
                rel="noreferrer"
              >
                Wikipedia <ExternalLink />
              </a>
            </section>
            <section className="rights-sidebar">
              <h2>Content access</h2>
              <p>
                Rights status: <b>{rightsLabel(movie.rightsStatus)}</b>
              </p>
              <small>
                CineSeya.lk enables full media controls only for owned, licensed
                or public-domain files that an administrator has explicitly
                activated.
              </small>
            </section>
          </aside>
        </div>
        {related.filter((item) => item.id !== movie.id).length > 0 && (
          <section className="detail-related">
            <header>
              <span>You may also like</span>
              <h2>Related titles</h2>
            </header>
            <div className="catalog-grid compact-grid">
              {related
                .filter((item) => item.id !== movie.id)
                .slice(0, 6)
                .map((item) => (
                  <Link href={`/movies/${item.slug}`} key={item.id}>
                    <span>
                      <CinePoster
                        src={item.posterUrl}
                        alt=""
                        focalPoint={item.posterFocalPoint}
                        fillContainer
                        sizes="150px"
                      />
                    </span>
                    <b>{item.title}</b>
                    <small>{item.year}</small>
                  </Link>
                ))}
            </div>
          </section>
        )}
      </article>
    </>
  );
}

import type { Metadata } from "next";
import {
  CalendarDays,
  Clock3,
  Download,
  Languages,
  Play,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SubtitleCard } from "@/components/subtitle/subtitle-card";
import { mayDistributeFullMedia, rightsLabel } from "@/lib/rights";
import {
  getActiveMediaVersions,
  getSeriesBySlug,
  getSubtitlesForEpisode,
} from "@/services/catalog";
import { CineBackdrop } from "@/components/ui/cine-artwork";
import { currentUser } from "@/lib/auth";
import { SubtitleInterest } from "@/components/subtitle/subtitle-interest";
import { getSubtitleInterest } from "@/services/subtitle-interest";
import { getReadyStreamForContent } from "@/services/media";
import { NonceJsonLd } from "@/components/seo/nonce-json-ld";
import {
  breadcrumbJsonLd,
  canonicalUrl,
  conciseDescription,
  hasSinhalaSubtitle,
  publicSeoImage,
} from "@/lib/seo";

export const dynamic = "force-dynamic";
const segmentNumber = (value: string, prefix: string) =>
  Number(value.replace(new RegExp(`^${prefix}-`), ""));
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; season: string; episode: string }>;
}): Promise<Metadata> {
  const p = await params;
  const s = await getSeriesBySlug(p.slug);
  const e = s?.seasons
    .find((x) => x.seasonNumber === segmentNumber(p.season, "season"))
    ?.episodes.find(
      (x) => x.episodeNumber === segmentNumber(p.episode, "episode"),
    );
  if (!e || !s) return {};
  const route = `/tv/${s.slug}/season-${e.seasonNumber}/episode-${e.episodeNumber}`;
  const sinhalaAvailable = hasSinhalaSubtitle(e.subtitleLanguages);
  const title = `${s.title} S${e.seasonNumber} E${e.episodeNumber}: ${e.title}${sinhalaAvailable ? ' Sinhala Subtitles' : ''}`;
  const description = conciseDescription(`${s.title} season ${e.seasonNumber}, episode ${e.episodeNumber}: ${e.title}${sinhalaAvailable ? ' with published Sinhala subtitles' : ''}. ${e.overview}`, `Episode details for ${s.title}: ${e.title} on CineSeya.`);
  const image = publicSeoImage(e.thumbnailUrl, publicSeoImage(s.backdropUrl));
  return {
    title,
    description,
    alternates: { canonical: route },
    openGraph: { type: 'video.episode', siteName: 'CineSeya', title, description, url: canonicalUrl(route), images: [{ url: image, alt: `${s.title}: ${e.title}` }] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}
export default async function EpisodePage({
  params,
}: {
  params: Promise<{ slug: string; season: string; episode: string }>;
}) {
  const p = await params;
  const series = await getSeriesBySlug(p.slug);
  const season = series?.seasons.find(
    (item) => item.seasonNumber === segmentNumber(p.season, "season"),
  );
  const episode = season?.episodes.find(
    (item) => item.episodeNumber === segmentNumber(p.episode, "episode"),
  );
  if (!series || !season || !episode) notFound();
  const [versions, subtitles, stream, user] = await Promise.all([
    getActiveMediaVersions(episode.id, "episode"),
    getSubtitlesForEpisode(episode.id),
    getReadyStreamForContent(episode.id, "episode"),
    currentUser(),
  ]);
  const interest = subtitles.some((item) => item.languageCode === "si")
    ? null
    : await getSubtitleInterest("episode", episode.id, user?.id);
  const allEpisodes = series.seasons
    .flatMap((item) => item.episodes)
    .sort(
      (left, right) =>
        left.seasonNumber - right.seasonNumber ||
        left.episodeNumber - right.episodeNumber,
    );
  const episodeIndex = allEpisodes.findIndex((item) => item.id === episode.id);
  const previous = episodeIndex > 0 ? allEpisodes[episodeIndex - 1] : undefined;
  const next = episodeIndex >= 0 ? allEpisodes[episodeIndex + 1] : undefined;
  const distributable =
    mayDistributeFullMedia(episode.rightsStatus) && versions.length > 0;
  const streamable =
    mayDistributeFullMedia(episode.rightsStatus) && Boolean(stream);
  const route = `/tv/${series.slug}/season-${episode.seasonNumber}/episode-${episode.episodeNumber}`;
  const schema = {
    "@context": "https://schema.org",
    "@type": "TVEpisode",
    "@id": `${canonicalUrl(route)}#episode`,
    url: canonicalUrl(route),
    name: episode.title,
    description: episode.overview,
    episodeNumber: episode.episodeNumber,
    datePublished: episode.releaseDate || undefined,
    duration: episode.runtime > 0 ? `PT${episode.runtime}M` : undefined,
    image: publicSeoImage(episode.thumbnailUrl),
    inLanguage: series.languages,
    partOfSeason: {
      "@type": "TVSeason",
      seasonNumber: season.seasonNumber,
      name: season.title,
    },
    partOfSeries: {
      "@type": "TVSeries",
      name: series.title,
      url: canonicalUrl(`/tv/${series.slug}`),
    },
  };
  const breadcrumb = breadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: 'TV Series', path: '/tv' },
    { name: series.title, path: `/tv/${series.slug}` },
    { name: `Season ${season.seasonNumber}, Episode ${episode.episodeNumber}`, path: route },
  ]);
  const episodeHref = (item: typeof episode) =>
    `/tv/${series.slug}/season-${item.seasonNumber}/episode-${item.episodeNumber}`;
  return (
    <>
      <NonceJsonLd value={schema} />
      <NonceJsonLd value={breadcrumb} />
      <article className="episode-page">
        <header>
          <div>
            <CineBackdrop
              src={episode.thumbnailUrl}
              alt=""
              fillContainer
              preload
              sizes="100vw"
            />
          </div>
          <section>
            <nav aria-label="Breadcrumb">
              <Link href="/tv">TV Series</Link>
              <span>/</span>
              <Link href={`/tv/${series.slug}`}>{series.title}</Link>
              <span>/</span>
              <span>{episode.title}</span>
            </nav>
            <span className="detail-kicker">
              Season {season.seasonNumber} · Episode {episode.episodeNumber}
            </span>
            <h1>{episode.title}</h1>
            <p>{episode.overview}</p>
            <div className="episode-meta">
              <span>
                <Clock3 />
                {episode.runtime} min
              </span>
              <span>
                <CalendarDays />
                {new Date(episode.releaseDate).toLocaleDateString("en-LK", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <span>
                <Languages />
                {subtitles.length} subtitle{subtitles.length === 1 ? "" : "s"}
              </span>
            </div>
            <span className={`rights-chip rights-${episode.rightsStatus}`}>
              {rightsLabel(episode.rightsStatus)}
            </span>
            {streamable && (
              <Link className="action-button" href={`/watch/${stream!.id}`}>
                <Play />
                Watch Online
              </Link>
            )}
          </section>
        </header>
        <div className="episode-body">
          <nav className="episode-adjacent" aria-label="Episode navigation">
            {previous ? (
              <Link href={episodeHref(previous)}>
                ← Previous Episode<small>{previous.title}</small>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link href={episodeHref(next)}>
                Next Episode →<small>{next.title}</small>
              </Link>
            ) : null}
          </nav>
          <h2>Episode access</h2>
          {distributable ? (
            <div className="media-version-list">
              {versions.map((version) => (
                <div key={String(version._id)}>
                  <span>
                    <b>{String(version.resolution ?? version.quality)}</b>
                    <small>
                      {String(version.releaseType ?? "Authorized release")}
                    </small>
                  </span>
                  <em>
                    {(Number(version.fileSize) / 1_000_000_000).toFixed(1)} GB
                  </em>
                  {!streamable && (
                    <Link href={`/watch/${String(version._id)}`}>
                      <Play />
                      Watch
                    </Link>
                  )}
                  <a href={`/download/${String(version._id)}`}>
                    <Download />
                    Download
                  </a>
                </div>
              ))}
            </div>
          ) : !streamable ? (
            <div className="rights-notice">
              <ShieldAlert />
              <div>
                <b>No authorized full-media version is active</b>
                <p>
                  Metadata and subtitle access remain available for this
                  episode.
                </p>
              </div>
            </div>
          ) : null}
          <section id="subtitles" className="detail-section">
            <span className="section-label">Matched releases</span>
            <h2>Episode subtitles</h2>
            {subtitles.length > 0 ? (
              <div className="subtitle-list">
                {subtitles.map((subtitle) => (
                  <SubtitleCard key={subtitle.id} subtitle={subtitle} />
                ))}
              </div>
            ) : (
              <div className="inline-empty">
                No published subtitles are attached to this episode.
              </div>
            )}
            {interest && (
              <SubtitleInterest
                contentType="episode"
                contentId={episode.id}
                title={`${series.title}: ${episode.title}`}
                authenticated={Boolean(user)}
                initial={interest}
              />
            )}
          </section>
          <Link className="action-button secondary" href={`/tv/${series.slug}`}>
            Back to episode guide
          </Link>
        </div>
      </article>
    </>
  );
}

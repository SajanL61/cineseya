"use client";

import { CalendarDays, Clock3, Languages, Play } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { SeasonRecord } from "@/types/content";
import { CineBackdrop } from "@/components/ui/cine-artwork";

export function SeasonBrowser({
  seriesSlug,
  seasons,
}: {
  seriesSlug: string;
  seasons: SeasonRecord[];
}) {
  const [selected, setSelected] = useState(seasons[0]?.seasonNumber ?? 1);
  const season =
    seasons.find((item) => item.seasonNumber === selected) ?? seasons[0];
  if (!season) return null;
  return (
    <section className="season-browser">
      <div className="season-tabs" role="tablist" aria-label="Seasons">
        {seasons.map((item) => (
          <button
            role="tab"
            aria-selected={selected === item.seasonNumber}
            className={selected === item.seasonNumber ? "active" : ""}
            onClick={() => setSelected(item.seasonNumber)}
            key={item.id}
          >
            Season {item.seasonNumber}
            <small>{item.episodes.length} episodes</small>
          </button>
        ))}
      </div>
      <div className="episode-list">
        {season.episodes.map((episode) => (
          <article className="episode-card" key={episode.id}>
            <Link
              className="episode-thumb"
              href={`/tv/${seriesSlug}/season-${episode.seasonNumber}/episode-${episode.episodeNumber}`}
            >
              <CineBackdrop
                src={episode.thumbnailUrl}
                alt=""
                fillContainer
                sizes="230px"
              />
              <span>
                <Play />
              </span>
            </Link>
            <div>
              <span className="episode-number">
                S{String(episode.seasonNumber).padStart(2, "0")} · E
                {String(episode.episodeNumber).padStart(2, "0")}
              </span>
              <h3>
                <Link
                  href={`/tv/${seriesSlug}/season-${episode.seasonNumber}/episode-${episode.episodeNumber}`}
                >
                  {episode.title}
                </Link>
              </h3>
              <p>{episode.overview}</p>
              <footer>
                <span>
                  <Clock3 />
                  {episode.runtime} min
                </span>
                <span>
                  <CalendarDays />
                  {new Date(episode.releaseDate).toLocaleDateString("en-LK", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                <span>
                  <Languages />
                  {episode.subtitleLanguages.join(", ")} subtitles
                </span>
              </footer>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

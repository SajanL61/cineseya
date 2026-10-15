import type { Metadata } from "next";
import { SeriesCard } from "@/components/tv/series-card";
import { getSeries } from "@/services/catalog";

export const metadata: Metadata = {
  title: "TV Series",
  description:
    "Browse TV series, seasons, episodes and episode-specific subtitles.",
};
export const dynamic = "force-dynamic";
export default async function TvPage() {
  const series = await getSeries();
  return (
    <div className="page-shell">
      <header className="page-heading">
        <div>
          <span>Stories that continue</span>
          <h1>TV Series</h1>
          <p>
            Purpose-built season and episode navigation with subtitle
            availability attached to the exact episode.
          </p>
        </div>
        <strong className="result-count">{series.length} series</strong>
      </header>
      <div className="catalog-grid series-catalog">
        {series.map((item, index) => (
          <SeriesCard key={item.id} series={item} priority={index === 0} />
        ))}
      </div>
    </div>
  );
}

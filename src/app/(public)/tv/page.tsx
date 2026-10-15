import type { Metadata } from "next";
import { SeriesCard } from "@/components/tv/series-card";
import { getSeries } from "@/services/catalog";
import { socialMetadata } from "@/lib/seo";

const title = "TV Series & Episode Subtitles";
const description = "Browse published TV series, season guides, episode details and subtitles matched to the correct episode.";
export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/tv" },
  ...socialMetadata(title, description, '/tv'),
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

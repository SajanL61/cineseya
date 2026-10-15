import { isValidObjectId } from "mongoose";
import { notFound } from "next/navigation";
import { SeriesForm } from "@/components/admin/series-form";
import { SeasonManager } from "@/components/admin/season-manager";
import { requirePagePermission } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { resolvePublicAssetUrl } from "@/lib/assets";
import { Episode, MediaAsset, Season, Series } from "@/models";
export const metadata = { title: "Edit TV series" };
export default async function Page({
  params,
}: PageProps<"/admin/series/[id]">) {
  await requirePagePermission("content.update", "/admin/series");
  const { id } = await params;
  if (!isValidObjectId(id)) notFound();
  await connectDb();
  const series = await Series.findById(id).lean();
  if (!series) notFound();
  const artworkAssets = await MediaAsset.find({
    objectKey: { $in: [series.posterUrl, series.backdropUrl].filter(Boolean) },
    status: "active",
  })
    .select("objectKey metadata")
    .lean();
  const artworkMetadata = new Map(
    artworkAssets.map((asset) => [String(asset.objectKey), asset.metadata]),
  );
  const seasons = await Season.find({ series: id })
    .sort({ seasonNumber: 1 })
    .lean();
  const records = await Promise.all(
    seasons.map(async (season) => ({
      id: String(season._id),
      seasonNumber: Number(season.seasonNumber),
      title: String(season.title || `Season ${season.seasonNumber}`),
      episodes: (
        await Episode.find({ season: season._id })
          .select("episodeNumber title")
          .sort({ episodeNumber: 1 })
          .lean()
      ).map((episode) => ({
        id: String(episode._id),
        episodeNumber: Number(episode.episodeNumber),
        title: String(episode.title),
      })),
    })),
  );
  const initial = JSON.parse(JSON.stringify(series));
  initial._posterPreviewUrl = resolvePublicAssetUrl(
    series.posterUrl,
    "/media/fallback-poster.svg",
  );
  initial._backdropPreviewUrl = resolvePublicAssetUrl(
    series.backdropUrl,
    "/media/fallback-backdrop.svg",
  );
  initial._posterMetadata = artworkMetadata.get(String(series.posterUrl));
  initial._backdropMetadata = artworkMetadata.get(String(series.backdropUrl));
  return (
    <>
      <header className="admin-page-head">
        <div>
          <span>Catalog editor</span>
          <h1>Edit {String(series.title)}</h1>
          <p>Maintain series metadata and its normalized episode structure.</p>
        </div>
      </header>
      <SeriesForm initial={initial} />
      <SeasonManager seriesId={id} seasons={records} />
    </>
  );
}

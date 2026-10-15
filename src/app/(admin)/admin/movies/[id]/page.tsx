import { isValidObjectId } from "mongoose";
import { notFound } from "next/navigation";
import { MovieForm } from "@/components/admin/movie-form";
import { requirePagePermission } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { MediaAsset, Movie } from "@/models";
import {
  MediaVersionManager,
  type VersionRow,
} from "@/components/admin/enhanced-media-version-manager";
import { getAdminMediaVersions } from "@/services/admin";
import {
  MasterStreamUpload,
  type JobRow,
} from "@/components/admin/master-stream-upload";
import { getAdminTranscodeJobsForContent } from "@/services/transcoding";
import { resolvePublicAssetUrl } from "@/lib/assets";
export const metadata = { title: "Edit movie" };
export default async function EditMoviePage({
  params,
}: PageProps<"/admin/movies/[id]">) {
  const { user } = await requirePagePermission(
    "content.update",
    "/admin/movies",
  );
  const { id } = await params;
  if (!isValidObjectId(id)) notFound();
  await connectDb();
  const [movie, versions, jobs] = await Promise.all([
    Movie.findById(id).lean(),
    user.permissions.includes("media.read")
      ? getAdminMediaVersions(id)
      : Promise.resolve([]),
    user.permissions.includes("media.read")
      ? getAdminTranscodeJobsForContent(id, "movie")
      : Promise.resolve([]),
  ]);
  if (!movie) notFound();
  const artworkAssets = await MediaAsset.find({
    objectKey: { $in: [movie.posterUrl, movie.backdropUrl].filter(Boolean) },
    status: "active",
  })
    .select("objectKey metadata")
    .lean();
  const artworkMetadata = new Map(
    artworkAssets.map((asset) => [String(asset.objectKey), asset.metadata]),
  );
  const initial = JSON.parse(JSON.stringify(movie));
  initial._posterPreviewUrl = resolvePublicAssetUrl(
    movie.posterUrl,
    "/media/fallback-poster.svg",
  );
  initial._backdropPreviewUrl = resolvePublicAssetUrl(
    movie.backdropUrl,
    "/media/fallback-backdrop.svg",
  );
  initial._posterMetadata = artworkMetadata.get(String(movie.posterUrl));
  initial._backdropMetadata = artworkMetadata.get(String(movie.backdropUrl));
  return (
    <>
      <header className="admin-page-head">
        <div>
          <span>Catalog editor</span>
          <h1>Edit {String(movie.title)}</h1>
          <p>
            Changes are validated, permission-checked and written to the audit
            trail.
          </p>
        </div>
      </header>
      <MovieForm initial={initial} />
      {user.permissions.includes("media.upload") && (
        <>
          <MasterStreamUpload
            contentId={id}
            rightsStatus={String(movie.rightsStatus)}
            initialJobs={jobs as unknown as JobRow[]}
          />
          <MediaVersionManager
            contentId={id}
            initialVersions={versions as unknown as VersionRow[]}
          />
        </>
      )}
    </>
  );
}

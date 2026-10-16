import { adminMovieSchema } from "@/lib/validation/movie";
import { assertMutationRequest, requirePermission } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { apiError } from "@/lib/http";
import { AuditLog, Movie } from "@/models";
import { enrichMovieCreditProfiles } from "@/services/tmdb-people";

export async function GET(request: Request) {
  try {
    await requirePermission("content.read");
    await connectDb();
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.slice(0, 80);
    const filter = q
      ? {
          title: {
            $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            $options: "i",
          },
        }
      : {};
    const items = await Movie.find(filter)
      .select("title slug year publicationStatus rightsStatus updatedAt")
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();
    return Response.json(
      { items },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requirePermission("content.create");
    await assertMutationRequest(request, session);
    const input = await enrichMovieCreditProfiles(
      adminMovieSchema.parse(await request.json()),
    );
    if (
      input.publicationStatus === "published" &&
      !session.user.permissions.includes("content.publish")
    )
      throw Object.assign(new Error("Publishing permission is required."), {
        status: 403,
        code: "FORBIDDEN",
      });
    await connectDb();
    const movie = await Movie.create({
      ...input,
      publishedAt:
        input.publicationStatus === "published" ? new Date() : undefined,
      createdBy: session.user.id,
      updatedBy: session.user.id,
    });
    await AuditLog.create({
      actor: session.user.id,
      action: "movie.create",
      entity: "Movie",
      entityId: String(movie._id),
      metadata: {
        title: movie.title,
        publicationStatus: movie.publicationStatus,
        rightsStatus: movie.rightsStatus,
        artwork: {
          posterUrl: movie.posterUrl,
          backdropUrl: movie.backdropUrl,
          posterFocalPoint: movie.posterFocalPoint,
          backdropFocalPoint: movie.backdropFocalPoint,
        },
      },
    });
    return Response.json(
      { id: String(movie._id), slug: movie.slug },
      { status: 201 },
    );
  } catch (error) {
    if ((error as { code?: number }).code === 11000)
      return Response.json(
        {
          error: {
            code: "SLUG_EXISTS",
            message: "That movie slug is already in use.",
          },
        },
        { status: 409 },
      );
    return apiError(error);
  }
}

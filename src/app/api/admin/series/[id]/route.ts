import { isValidObjectId } from "mongoose";
import { assertMutationRequest, requirePermission } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { apiError } from "@/lib/http";
import { adminSeriesSchema } from "@/lib/validation/series";
import { AuditLog, Series } from "@/models";
export async function PATCH(
  request: Request,
  { params }: RouteContext<"/api/admin/series/[id]">,
) {
  try {
    const session = await requirePermission("content.update");
    await assertMutationRequest(request, session);
    const { id } = await params;
    if (!isValidObjectId(id))
      throw Object.assign(new Error("Series was not found."), {
        status: 404,
        code: "NOT_FOUND",
      });
    const input = adminSeriesSchema.parse(await request.json());
    if (
      input.publicationStatus === "published" &&
      !session.user.permissions.includes("content.publish")
    )
      throw Object.assign(new Error("Publishing permission is required."), {
        status: 403,
        code: "FORBIDDEN",
      });
    await connectDb();
    const series = await Series.findById(id);
    if (!series)
      throw Object.assign(new Error("Series was not found."), {
        status: 404,
        code: "NOT_FOUND",
      });
    const firstPublish =
      input.publicationStatus === "published" &&
      series.publicationStatus !== "published";
    const artworkBefore = {
      posterUrl: series.posterUrl,
      backdropUrl: series.backdropUrl,
      posterFocalPoint: series.posterFocalPoint,
      backdropFocalPoint: series.backdropFocalPoint,
    };
    series.set({
      ...input,
      publishedAt: firstPublish ? new Date() : series.publishedAt,
      updatedBy: session.user.id,
    });
    await series.save();
    const artworkAfter = {
      posterUrl: series.posterUrl,
      backdropUrl: series.backdropUrl,
      posterFocalPoint: series.posterFocalPoint,
      backdropFocalPoint: series.backdropFocalPoint,
    };
    const artworkChanged = JSON.stringify(artworkBefore) !== JSON.stringify(artworkAfter);
    await AuditLog.create({
      actor: session.user.id,
      action: "series.update",
      entity: "Series",
      entityId: id,
      metadata: {
        title: series.title,
        publicationStatus: series.publicationStatus,
        rightsStatus: series.rightsStatus,
        artworkChanged,
        ...(artworkChanged ? { artworkBefore, artworkAfter } : {}),
      },
    });
    return Response.json({ id });
  } catch (error) {
    return apiError(error);
  }
}

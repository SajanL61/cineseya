import { assertMutationRequest, requirePermission } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { apiError } from "@/lib/http";
import { adminSeriesSchema } from "@/lib/validation/series";
import { AuditLog, Series } from "@/models";
export async function POST(request: Request) {
  try {
    const session = await requirePermission("content.create");
    await assertMutationRequest(request, session);
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
    const series = await Series.create({
      ...input,
      publishedAt:
        input.publicationStatus === "published" ? new Date() : undefined,
      createdBy: session.user.id,
      updatedBy: session.user.id,
    });
    await AuditLog.create({
      actor: session.user.id,
      action: "series.create",
      entity: "Series",
      entityId: String(series._id),
      metadata: {
        title: series.title,
        rightsStatus: series.rightsStatus,
        artwork: {
          posterUrl: series.posterUrl,
          backdropUrl: series.backdropUrl,
          posterFocalPoint: series.posterFocalPoint,
          backdropFocalPoint: series.backdropFocalPoint,
        },
      },
    });
    return Response.json({ id: String(series._id) }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

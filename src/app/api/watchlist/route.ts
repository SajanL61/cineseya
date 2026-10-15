import { isValidObjectId, Types } from "mongoose";
import { z } from "zod";
import { assertMutationRequest, currentSession } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { apiError } from "@/lib/http";
import { Movie, Series, Watchlist } from "@/models";
import { resolvePublicAssetUrl } from "@/lib/assets";

const itemSchema = z.object({
  contentType: z.enum(["movie", "series"]),
  contentId: z.string(),
});
const mutationSchema = z.union([
  z.object({ items: z.array(itemSchema).max(250) }),
  itemSchema.extend({ action: z.enum(["add", "remove"]) }),
]);
type SavedItem = {
  contentType: "movie" | "series";
  contentId: Types.ObjectId;
  addedAt: Date;
};
async function dto(userId: string) {
  const list = await Watchlist.findOne({ user: userId }).lean();
  const items =
    (list?.items as
      | Array<{ contentType: string; contentId: Types.ObjectId; addedAt: Date }>
      | undefined) ?? [];
  return Promise.all(
    items.map(async (item) => {
      const model = item.contentType === "movie" ? Movie : Series;
      const content = await model
        .findOne({ _id: item.contentId, publicationStatus: "published" })
        .select("title slug posterUrl posterFocalPoint")
        .lean();
      return content
        ? {
            id: String(content._id),
            type: item.contentType,
            slug: String(content.slug),
            title: String(content.title),
            posterUrl: resolvePublicAssetUrl(
              content.posterUrl,
              "/media/fallback-poster.svg",
            ),
            posterFocalPoint: content.posterFocalPoint,
            addedAt: new Date(item.addedAt).toISOString(),
          }
        : null;
    }),
  ).then((values) => values.filter(Boolean));
}
export async function GET() {
  try {
    const session = await currentSession();
    if (!session)
      throw Object.assign(new Error("Authentication is required."), {
        status: 401,
        code: "AUTH_REQUIRED",
      });
    await connectDb();
    return Response.json(
      { items: await dto(session.user.id) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    const session = await currentSession();
    if (!session)
      throw Object.assign(new Error("Authentication is required."), {
        status: 401,
        code: "AUTH_REQUIRED",
      });
    await assertMutationRequest(request, session);
    const input = mutationSchema.parse(await request.json());
    await connectDb();
    const list = await Watchlist.findOneAndUpdate(
      { user: session.user.id },
      { $setOnInsert: { user: session.user.id, items: [] } },
      { upsert: true, new: true },
    );
    let saved = (list.items as SavedItem[] | undefined) ?? [];
    if ("items" in input) {
      for (const item of input.items) {
        if (!isValidObjectId(item.contentId)) continue;
        const model = item.contentType === "movie" ? Movie : Series;
        if (
          !(await model.exists({
            _id: item.contentId,
            publicationStatus: "published",
          }))
        )
          continue;
        const exists = saved.some(
          (entry) =>
            entry.contentType === item.contentType &&
            String(entry.contentId) === item.contentId,
        );
        if (!exists)
          saved.push({
            contentType: item.contentType,
            contentId: new Types.ObjectId(item.contentId),
            addedAt: new Date(),
          });
      }
    } else {
      if (!isValidObjectId(input.contentId))
        throw Object.assign(new Error("Content was not found."), {
          status: 404,
          code: "NOT_FOUND",
        });
      const model = input.contentType === "movie" ? Movie : Series;
      if (
        input.action === "add" &&
        !(await model.exists({
          _id: input.contentId,
          publicationStatus: "published",
        }))
      )
        throw Object.assign(new Error("Content was not found."), {
          status: 404,
          code: "NOT_FOUND",
        });
      saved =
        input.action === "remove"
          ? saved.filter(
              (entry) =>
                !(
                  entry.contentType === input.contentType &&
                  String(entry.contentId) === input.contentId
                ),
            )
          : saved.some(
                (entry) =>
                  entry.contentType === input.contentType &&
                  String(entry.contentId) === input.contentId,
              )
            ? saved
            : [
                ...saved,
                {
                  contentType: input.contentType,
                  contentId: new Types.ObjectId(input.contentId),
                  addedAt: new Date(),
                },
              ];
    }
    list.set("items", saved);
    await list.save();
    return Response.json({ items: await dto(session.user.id) });
  } catch (error) {
    return apiError(error);
  }
}

import { z } from 'zod';
import { requirePermission } from '@/lib/auth';
import { connectDb } from '@/lib/db';
import { apiError } from '@/lib/http';
import { Episode, Movie, Series, TranslatorProfile } from '@/models';

const querySchema = z.object({
  type: z.enum(['movie', 'episode', 'translator']),
  q: z.string().trim().max(80).default(''),
});

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function GET(request: Request) {
  try {
    await requirePermission('subtitles.read');
    const url = new URL(request.url);
    const input = querySchema.parse({ type: url.searchParams.get('type'), q: url.searchParams.get('q') ?? '' });
    await connectDb();
    const search = input.q ? { $regex: escapeRegex(input.q), $options: 'i' as const } : undefined;

    if (input.type === 'movie') {
      const rows = await Movie.find(search ? { title: search } : {}).select('title year').sort({ updatedAt: -1 }).limit(20).lean();
      return Response.json({ items: rows.map((row) => ({ id: String(row._id), label: `${row.title} (${row.year})`, title: String(row.title), year: Number(row.year) })) }, { headers: { 'Cache-Control': 'private, no-store' } });
    }

    if (input.type === 'translator') {
      const rows = await TranslatorProfile.find(search ? { displayName: search } : {}).select('displayName slug verified').sort({ displayName: 1 }).limit(20).lean();
      return Response.json({ items: rows.map((row) => ({ id: String(row._id), label: String(row.displayName), slug: String(row.slug), verified: Boolean(row.verified) })) }, { headers: { 'Cache-Control': 'private, no-store' } });
    }

    const matchingSeries = search ? await Series.find({ title: search }).select('_id').limit(20).lean() : [];
    const filter = search ? { $or: [{ title: search }, { series: { $in: matchingSeries.map((series) => series._id) } }] } : {};
    const episodes = await Episode.find(filter).select('series seasonNumber episodeNumber title').sort({ updatedAt: -1 }).limit(20).lean();
    const seriesRows = episodes.length ? await Series.find({ _id: { $in: episodes.map((episode) => episode.series) } }).select('title').lean() : [];
    const seriesTitles = new Map(seriesRows.map((series) => [String(series._id), String(series.title)]));
    return Response.json({ items: episodes.map((episode) => ({
      id: String(episode._id),
      label: `${seriesTitles.get(String(episode.series)) ?? 'Unknown series'} · S${episode.seasonNumber} E${episode.episodeNumber} · ${episode.title}`,
      title: String(episode.title),
      seriesTitle: seriesTitles.get(String(episode.series)) ?? 'Unknown series',
      seasonNumber: Number(episode.seasonNumber),
      episodeNumber: Number(episode.episodeNumber),
    })) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return apiError(error);
  }
}

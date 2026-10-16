import { z } from 'zod';
import { requirePermission } from '@/lib/auth';
import { env } from '@/lib/env';
import { apiError } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';

const responseSchema = z.object({
  id: z.number(), title: z.string(), original_title: z.string().optional(), overview: z.string().optional(), release_date: z.string().optional(), runtime: z.number().nullable().optional(),
  imdb_id: z.string().nullable().optional(), vote_average: z.number().optional(), poster_path: z.string().nullable().optional(), backdrop_path: z.string().nullable().optional(),
  genres: z.array(z.object({ name: z.string() })).default([]), spoken_languages: z.array(z.object({ english_name: z.string().optional(), name: z.string() })).default([]),
  production_countries: z.array(z.object({ name: z.string() })).default([]),
  credits: z.object({ cast: z.array(z.object({ id: z.number().int().positive(), name: z.string(), character: z.string().optional(), profile_path: z.string().nullable().optional() })).default([]), crew: z.array(z.object({ id: z.number().int().positive(), name: z.string(), job: z.string().optional(), profile_path: z.string().nullable().optional() })).default([]) }).optional(),
  videos: z.object({ results: z.array(z.object({ site: z.string(), type: z.string(), key: z.string(), official: z.boolean().optional() })).default([]) }).optional(),
});

const slugify = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export async function GET(request: Request) {
  try {
    await requirePermission('content.update');
    await enforceRateLimit(request, 'tmdb-preview', 30, 60_000);
    if (!env.TMDB_API_TOKEN) throw Object.assign(new Error('TMDb importing is not configured.'), { status: 503, code: 'TMDB_UNAVAILABLE' });
    const id = z.coerce.number().int().positive().parse(new URL(request.url).searchParams.get('id'));
    const response = await fetch(`https://api.themoviedb.org/3/movie/${id}?append_to_response=credits,videos&language=en-US`, {
      headers: { Authorization: `Bearer ${env.TMDB_API_TOKEN}`, Accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 404) throw Object.assign(new Error('TMDb could not find that movie ID.'), { status: 404, code: 'TMDB_NOT_FOUND' });
    if (!response.ok) throw Object.assign(new Error('TMDb metadata could not be loaded.'), { status: 502, code: 'TMDB_ERROR' });
    const movie = responseSchema.parse(await response.json());
    const trailer = movie.videos?.results.find((video) => video.site === 'YouTube' && video.type === 'Trailer' && video.official)
      ?? movie.videos?.results.find((video) => video.site === 'YouTube' && video.type === 'Trailer');
    const releaseYear = Number(movie.release_date?.slice(0, 4));
    const titleSlug = slugify(movie.title);
    return Response.json({ preview: {
      title: movie.title, originalTitle: movie.original_title ?? movie.title, overview: movie.overview ?? '', year: Number.isFinite(releaseYear) ? releaseYear : undefined,
      releaseDate: movie.release_date, runtime: movie.runtime ?? undefined, genres: movie.genres.map((item) => item.name),
      languages: movie.spoken_languages.map((item) => item.english_name || item.name), countries: movie.production_countries.map((item) => item.name),
      posterUrl: movie.poster_path ? `https://image.tmdb.org/t/p/w780${movie.poster_path}` : undefined,
      backdropUrl: movie.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : undefined,
      trailerUrl: trailer ? `https://www.youtube-nocookie.com/embed/${trailer.key}` : undefined, imdbId: movie.imdb_id ?? undefined,
      tmdbId: String(movie.id), tmdbRating: movie.vote_average, cast: movie.credits?.cast.slice(0, 20).map((item) => `${item.name} | ${item.character ?? 'Cast'} | ${item.id}`) ?? [],
      crew: movie.credits?.crew.filter((item) => ['Director','Writer','Screenplay','Producer'].includes(item.job ?? '')).slice(0, 20).map((item) => `${item.name} | ${item.job} | ${item.id}`) ?? [],
      suggestedSlug: titleSlug ? `${titleSlug}${releaseYear ? `-${releaseYear}` : ''}` : undefined,
    } }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return apiError(error); }
}

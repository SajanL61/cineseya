import "server-only";
import { z } from "zod";
import { env } from "@/lib/env";
import type { AdminMovieInput } from "@/lib/validation/movie";

const personSchema = z.object({
  id: z.number().int().positive(),
  profile_path: z.string().nullable().optional(),
});

type Credit = AdminMovieInput["cast"][number];

async function loadProfile(personId: string) {
  const response = await fetch(
    `https://api.themoviedb.org/3/person/${encodeURIComponent(personId)}?language=en-US`,
    {
      headers: {
        Authorization: `Bearer ${env.TMDB_API_TOKEN}`,
        Accept: "application/json",
      },
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (response.status === 404)
    throw Object.assign(
      new Error(`TMDB person ID ${personId} could not be found.`),
      { status: 400, code: "TMDB_PERSON_NOT_FOUND" },
    );
  if (!response.ok)
    throw Object.assign(
      new Error(`TMDB could not load person ID ${personId}. Try again.`),
      { status: 502, code: "TMDB_PERSON_ERROR" },
    );
  const person = personSchema.parse(await response.json());
  return person.profile_path
    ? `https://image.tmdb.org/t/p/w185${person.profile_path}`
    : undefined;
}

function applyProfiles(
  credits: Credit[],
  profiles: Map<string, string | undefined>,
) {
  return credits.map((credit) => ({
    ...credit,
    profileUrl:
      credit.profileUrl ||
      (credit.tmdbPersonId ? profiles.get(credit.tmdbPersonId) : undefined),
  }));
}

export async function enrichMovieCreditProfiles(input: AdminMovieInput) {
  const unresolvedIds = [
    ...new Set(
      [...input.cast, ...input.crew]
        .filter((credit) => credit.tmdbPersonId && !credit.profileUrl)
        .map((credit) => credit.tmdbPersonId as string),
    ),
  ];
  if (!unresolvedIds.length) return input;
  if (!env.TMDB_API_TOKEN)
    throw Object.assign(
      new Error(
        "TMDB importing is not configured, so person images cannot be loaded.",
      ),
      { status: 503, code: "TMDB_UNAVAILABLE" },
    );
  const profiles = new Map(
    await Promise.all(
      unresolvedIds.map(async (personId) => [
        personId,
        await loadProfile(personId),
      ] as const),
    ),
  );
  return {
    ...input,
    cast: applyProfiles(input.cast, profiles),
    crew: applyProfiles(input.crew, profiles),
  };
}

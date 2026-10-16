import { afterEach, describe, expect, it, vi } from "vitest";
import type { AdminMovieInput } from "../src/lib/validation/movie";

vi.mock("../src/lib/env", () => ({
  env: { TMDB_API_TOKEN: "test-tmdb-token" },
}));

import { enrichMovieCreditProfiles } from "../src/services/tmdb-people";

describe("TMDB person profile enrichment", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("loads one trusted portrait for matching cast and crew person IDs", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ id: 69899, profile_path: "/zachary.jpg" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const input = {
      cast: [
        {
          name: "Zachary Levi",
          slug: "zachary-levi",
          character: "Tucker",
          tmdbPersonId: "69899",
        },
      ],
      crew: [
        {
          name: "Zachary Levi",
          slug: "zachary-levi",
          role: "Producer",
          tmdbPersonId: "69899",
        },
      ],
    } as AdminMovieInput;

    const result = await enrichMovieCreditProfiles(input);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.cast[0].profileUrl).toBe(
      "https://image.tmdb.org/t/p/w185/zachary.jpg",
    );
    expect(result.crew[0].profileUrl).toBe(
      "https://image.tmdb.org/t/p/w185/zachary.jpg",
    );
  });
});

import { describe, expect, it } from "vitest";

import {
  buildTmdbRequest,
  normalizeTmdbCredential,
} from "../src/services/tmdb-client";

describe("TMDB client configuration", () => {
  it("uses a Read Access Token as a bearer credential", () => {
    const request = buildTmdbRequest(
      "/person/69899",
      { language: "en-US" },
      "Bearer eyJ-test-token",
    );

    expect(request.url).toBe(
      "https://api.themoviedb.org/3/person/69899?language=en-US",
    );
    expect(request.headers.get("Authorization")).toBe(
      "Bearer eyJ-test-token",
    );
  });

  it("also accepts a v3 API key", () => {
    const apiKey = "0123456789abcdef0123456789abcdef";
    const request = buildTmdbRequest(
      "/movie/1228834",
      { language: "en-US" },
      apiKey,
    );

    const url = new URL(request.url);
    expect(url.searchParams.get("api_key")).toBe(apiKey);
    expect(request.headers.has("Authorization")).toBe(false);
  });

  it("normalizes copied quotes and a Bearer prefix", () => {
    expect(normalizeTmdbCredential('"Bearer eyJ-token"')).toBe("eyJ-token");
  });

  it("returns an actionable error when the credential is missing", () => {
    expect(() => buildTmdbRequest("/person/69899", {}, "")).toThrow(
      "Add TMDB_API_TOKEN in Render",
    );
  });
});

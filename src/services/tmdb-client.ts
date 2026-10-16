import "server-only";
import { env } from "@/lib/env";

type TmdbFetchInit = RequestInit & {
  next?: { revalidate?: number };
};

function configurationError(message: string, code: string, status: number) {
  return Object.assign(new Error(message), {
    status,
    code,
    expose: true,
  });
}

export function normalizeTmdbCredential(value?: string) {
  let credential = value?.trim() ?? "";
  if (
    credential.length >= 2 &&
    ((credential.startsWith('"') && credential.endsWith('"')) ||
      (credential.startsWith("'") && credential.endsWith("'")))
  )
    credential = credential.slice(1, -1).trim();
  return credential.replace(/^Bearer\s+/i, "").trim();
}

export function buildTmdbRequest(
  path: string,
  parameters: Record<string, string> = {},
  rawCredential = env.TMDB_API_TOKEN,
) {
  const credential = normalizeTmdbCredential(rawCredential);
  if (!credential)
    throw configurationError(
      "TMDB is not configured. Add TMDB_API_TOKEN in Render, then redeploy the service.",
      "TMDB_UNAVAILABLE",
      503,
    );

  const url = new URL(
    path.startsWith("/")
      ? `https://api.themoviedb.org/3${path}`
      : `https://api.themoviedb.org/3/${path}`,
  );
  for (const [key, value] of Object.entries(parameters))
    url.searchParams.set(key, value);

  const headers = new Headers({ Accept: "application/json" });
  if (/^[a-f\d]{32}$/i.test(credential))
    url.searchParams.set("api_key", credential);
  else headers.set("Authorization", `Bearer ${credential}`);

  return { url: url.toString(), headers };
}

export async function fetchTmdb(
  path: string,
  parameters: Record<string, string>,
  init: TmdbFetchInit = {},
) {
  const request = buildTmdbRequest(path, parameters);
  const headers = new Headers(init.headers);
  request.headers.forEach((value, key) => headers.set(key, value));
  const response = await fetch(request.url, { ...init, headers });

  if (response.status === 401 || response.status === 403)
    throw configurationError(
      "TMDB rejected the configured credential. In Render, set TMDB_API_TOKEN to the API Read Access Token or API Key, then redeploy.",
      "TMDB_AUTH_INVALID",
      502,
    );
  if (response.status === 429)
    throw configurationError(
      "TMDB has temporarily rate-limited requests. Wait briefly and try again.",
      "TMDB_RATE_LIMITED",
      503,
    );
  return response;
}

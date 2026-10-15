"use client";

import {
  AlertTriangle,
  Archive,
  Check,
  ChevronDown,
  ExternalLink,
  LoaderCircle,
  Save,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArtworkField } from "@/components/admin/artwork-field";
import { TmdbImporter } from "@/components/admin/tmdb-importer";
import { readCsrfToken } from "@/lib/client/browser-brand";

type InitialMovie = Record<string, unknown> & {
  _id?: string;
  title?: string;
  slug?: string;
};
const list = (value: unknown) => (Array.isArray(value) ? value.join(", ") : "");
const credits = (value: unknown, key: "character" | "role") =>
  Array.isArray(value)
    ? value
        .map((item) => {
          const row = item as Record<string, unknown>;
          return `${String(row.name ?? "")} | ${String(row[key] ?? "")}`;
        })
        .join("\n")
    : "";
const parseCredits = (value: string, key: "character" | "role") =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [name, ...details] = line.split("|").map((part) => part.trim());
      const slug =
        name
          .normalize("NFKD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLocaleLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "") || `person-${index + 1}`;
      return { name, slug, [key]: details.join(" | ") || undefined };
    });
const date = (value: unknown) =>
  value ? new Date(String(value)).toISOString().slice(0, 10) : "";
const dateTime = (value: unknown) =>
  value ? new Date(String(value)).toISOString().slice(0, 16) : "";
const csrf = readCsrfToken;

export function MovieForm({ initial }: { initial?: InitialMovie }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const editing = Boolean(initial?._id);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) || "").trim();
    const values = (key: string) =>
      value(key)
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
    const number = (key: string) => {
      const raw = value(key);
      return raw ? Number(raw) : undefined;
    };
    const payload = {
      title: value("title"),
      originalTitle: value("originalTitle"),
      sinhalaTitle: value("sinhalaTitle"),
      alternativeTitles: values("alternativeTitles"),
      searchAliases: values("searchAliases"),
      slug: value("slug"),
      overview: value("overview"),
      year: number("year"),
      releaseDate: value("releaseDate"),
      runtime: number("runtime"),
      ageRating: value("ageRating"),
      genres: values("genres"),
      languages: values("languages"),
      countries: values("countries"),
      releaseType: value("releaseType") || undefined,
      videoQuality: value("videoQuality") || undefined,
      cast: parseCredits(value("cast"), "character"),
      crew: parseCredits(value("crew"), "role"),
      posterUrl: value("posterUrl"),
      backdropUrl: value("backdropUrl"),
      posterFocalPoint: {
        x: number("posterFocalX"),
        y: number("posterFocalY"),
      },
      backdropFocalPoint: {
        x: number("backdropFocalX"),
        y: number("backdropFocalY"),
      },
      trailerUrl: value("trailerUrl"),
      imdbId: value("imdbId"),
      tmdbId: value("tmdbId"),
      imdbRating: number("imdbRating"),
      tmdbRating: number("tmdbRating"),
      rightsStatus: value("rightsStatus"),
      publicationStatus: value("publicationStatus"),
      releaseStatus: value("releaseStatus"),
      scheduledAt: value("scheduledAt") || undefined,
      featured: form.has("featured"),
      trending: form.has("trending"),
      editorPick: form.has("editorPick"),
      seo: {
        title: value("seoTitle"),
        description: value("seoDescription"),
        canonical: value("seoCanonical"),
        noindex: form.has("seoNoindex"),
      },
    };
    try {
      const response = await fetch(
        editing
          ? `/api/admin/movies/${String(initial?._id)}`
          : "/api/admin/movies",
        {
          method: editing ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": csrf(),
          },
          body: JSON.stringify(payload),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error?.message || "Unable to save the movie.");
      setMessage("Saved successfully.");
      if (!editing) router.replace(`/admin/movies/${result.id}`);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save the movie.",
      );
    } finally {
      setPending(false);
    }
  }
  async function archive() {
    if (
      !initial?._id ||
      !confirm("Archive this movie? Public pages will stop showing it.")
    )
      return;
    setPending(true);
    const response = await fetch(`/api/admin/movies/${String(initial._id)}`, {
      method: "DELETE",
      headers: { "x-csrf-token": csrf() },
    });
    if (response.ok) {
      router.push("/admin/movies");
      router.refresh();
    } else {
      const result = await response.json();
      setMessage(result.error?.message || "Unable to archive the movie.");
      setPending(false);
    }
  }
  return (
    <form className="admin-editor" onSubmit={submit}>
      <div className="admin-editor-toolbar">
        <div>
          {editing && initial?.slug ? (
            <Link href={`/movies/${initial.slug}`} target="_blank">
              View public page <ExternalLink />
            </Link>
          ) : (
            <span>New catalog record</span>
          )}
        </div>
        <div>
          {editing && (
            <button
              className="admin-danger"
              type="button"
              onClick={archive}
              disabled={pending}
            >
              <Archive /> Archive
            </button>
          )}
          <button className="admin-primary" disabled={pending}>
            {pending ? <LoaderCircle className="spin" /> : <Save />}
            {editing ? "Save changes" : "Create movie"}
          </button>
        </div>
      </div>
      {message && (
        <p
          className={
            message === "Saved successfully."
              ? "admin-success"
              : "admin-form-error"
          }
        >
          {message === "Saved successfully." ? <Check /> : <AlertTriangle />}
          {message}
        </p>
      )}
      <TmdbImporter />
      <details open>
        <summary>
          <span>1</span>Core details
          <ChevronDown />
        </summary>
        <div className="admin-form-grid">
          <label>
            Title
            <input
              name="title"
              required
              maxLength={240}
              defaultValue={String(initial?.title || "")}
            />
          </label>
          <label>
            Original title
            <input
              name="originalTitle"
              maxLength={240}
              defaultValue={String(initial?.originalTitle || "")}
            />
          </label>
          <label>
            Sinhala title
            <input
              name="sinhalaTitle"
              lang="si"
              maxLength={240}
              defaultValue={String(initial?.sinhalaTitle || "")}
            />
          </label>
          <label>
            Slug
            <input
              name="slug"
              required
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              defaultValue={String(initial?.slug || "")}
            />
          </label>
          <label className="span-2">
            Overview
            <textarea
              name="overview"
              required
              minLength={20}
              rows={7}
              defaultValue={String(initial?.overview || "")}
            />
          </label>
          <label>
            Release year
            <input
              name="year"
              type="number"
              min={1888}
              max={2200}
              required
              defaultValue={String(initial?.year || "")}
            />
          </label>
          <label>
            Release date
            <input
              name="releaseDate"
              type="date"
              required
              defaultValue={date(initial?.releaseDate)}
            />
          </label>
          <label>
            Runtime (minutes)
            <input
              name="runtime"
              type="number"
              min={0}
              max={1500}
              required
              defaultValue={String(initial?.runtime ?? "")}
            />
          </label>
          <label>
            Age rating
            <input
              name="ageRating"
              defaultValue={String(initial?.ageRating || "")}
            />
          </label>
        </div>
      </details>
      <details open>
        <summary>
          <span>2</span>Discovery & artwork
          <ChevronDown />
        </summary>
        <div className="admin-form-grid">
          <label>
            Genres
            <input
              name="genres"
              required
              placeholder="Drama, Mystery"
              defaultValue={list(initial?.genres)}
            />
            <small>Comma separated</small>
          </label>
          <label>
            Languages
            <input
              name="languages"
              required
              placeholder="English, Sinhala"
              defaultValue={list(initial?.languages)}
            />
            <small>The first language appears on the poster badge.</small>
          </label>
          <label>
            Countries
            <input
              name="countries"
              required
              placeholder="Sri Lanka"
              defaultValue={list(initial?.countries)}
            />
          </label>
          <label>
            Release status
            <input
              name="releaseStatus"
              defaultValue={String(initial?.releaseStatus || "Released")}
            />
          </label>
          <label>
            Poster source badge
            <input
              name="releaseType"
              list="movie-release-types"
              maxLength={32}
              placeholder="WEBRip"
              defaultValue={String(initial?.releaseType || "")}
            />
            <datalist id="movie-release-types">
              <option value="WEBRip" />
              <option value="WEB-DL" />
              <option value="BluRay" />
              <option value="HDRip" />
              <option value="HDTV" />
              <option value="DVDRip" />
            </datalist>
          </label>
          <label>
            Poster quality badge
            <input
              name="videoQuality"
              list="movie-video-qualities"
              maxLength={16}
              placeholder="FHD"
              defaultValue={String(initial?.videoQuality || "")}
            />
            <datalist id="movie-video-qualities">
              <option value="SD" />
              <option value="HD" />
              <option value="FHD" />
              <option value="2K" />
              <option value="4K" />
            </datalist>
            <small>
              Shown with language and source at the top of the poster.
            </small>
          </label>
          <label className="span-2">
            Cast
            <textarea
              name="cast"
              rows={5}
              placeholder="Performer | Character"
              defaultValue={credits(initial?.cast, "character")}
            />
            <small>One credit per line</small>
          </label>
          <label className="span-2">
            Crew
            <textarea
              name="crew"
              rows={5}
              placeholder="Person | Director"
              defaultValue={credits(initial?.crew, "role")}
            />
            <small>One credit per line</small>
          </label>
          <ArtworkField
            kind="poster"
            linkedModel="Movie"
            linkedId={initial?._id}
            initialUrl={String(
              initial?.posterUrl || "/media/fallback-poster.svg",
            )}
            initialPreviewUrl={String(
              initial?._posterPreviewUrl ||
                initial?.posterUrl ||
                "/media/fallback-poster.svg",
            )}
            initialFocalPoint={initial?.posterFocalPoint}
            initialMetadata={initial?._posterMetadata}
          />
          <ArtworkField
            kind="backdrop"
            linkedModel="Movie"
            linkedId={initial?._id}
            initialUrl={String(
              initial?.backdropUrl || "/media/fallback-backdrop.svg",
            )}
            initialPreviewUrl={String(
              initial?._backdropPreviewUrl ||
                initial?.backdropUrl ||
                "/media/fallback-backdrop.svg",
            )}
            initialFocalPoint={initial?.backdropFocalPoint}
            initialMetadata={initial?._backdropMetadata}
          />
          <label className="span-2">
            Trailer embed URL
            <input
              name="trailerUrl"
              type="url"
              defaultValue={String(initial?.trailerUrl || "")}
            />
          </label>
        </div>
      </details>
      <details open>
        <summary>
          <span>3</span>External metadata
          <ChevronDown />
        </summary>
        <div className="admin-form-grid">
          <label>
            IMDb ID
            <input
              name="imdbId"
              placeholder="tt1234567"
              defaultValue={String(initial?.imdbId || "")}
            />
          </label>
          <label>
            TMDb ID
            <input name="tmdbId" defaultValue={String(initial?.tmdbId || "")} />
          </label>
          <label>
            IMDb rating
            <input
              name="imdbRating"
              type="number"
              step="0.1"
              min={0}
              max={10}
              defaultValue={String(initial?.imdbRating ?? "")}
            />
          </label>
          <label>
            TMDb rating
            <input
              name="tmdbRating"
              type="number"
              step="0.1"
              min={0}
              max={10}
              defaultValue={String(initial?.tmdbRating ?? "")}
            />
          </label>
        </div>
      </details>
      <details open className="rights-editor">
        <summary>
          <span>
            <ShieldCheck />
          </span>
          Rights & publication
          <ChevronDown />
        </summary>
        <div className="admin-form-grid">
          <label>
            Distribution rights
            <select
              name="rightsStatus"
              required
              defaultValue={String(initial?.rightsStatus || "subtitle_only")}
            >
              <option value="subtitle_only">
                Subtitle only — no full media
              </option>
              <option value="owned">Owned by CineSeya.lk</option>
              <option value="licensed">Licensed for distribution</option>
              <option value="public_domain">Verified public domain</option>
              <option value="unavailable">Unavailable</option>
            </select>
            <small>This field is enforced again on every media download.</small>
          </label>
          <label>
            Publication status
            <select
              name="publicationStatus"
              required
              defaultValue={String(initial?.publicationStatus || "draft")}
            >
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label>
            Schedule date & time
            <input
              name="scheduledAt"
              type="datetime-local"
              defaultValue={dateTime(initial?.scheduledAt)}
            />
          </label>
          <div className="admin-checks">
            <label>
              <input
                type="checkbox"
                name="featured"
                defaultChecked={Boolean(initial?.featured)}
              />{" "}
              Featured
            </label>
            <label>
              <input
                type="checkbox"
                name="trending"
                defaultChecked={Boolean(initial?.trending)}
              />{" "}
              Trending
            </label>
            <label>
              <input
                type="checkbox"
                name="editorPick"
                defaultChecked={Boolean(initial?.editorPick)}
              />{" "}
              Editor&apos;s pick
            </label>
          </div>
        </div>
      </details>
      <details>
        <summary>
          <span>5</span>Search metadata
          <ChevronDown />
        </summary>
        <div className="admin-form-grid">
          <label className="span-2">
            Alternative titles
            <input
              name="alternativeTitles"
              maxLength={2000}
              placeholder="International title, release variation"
              defaultValue={list(initial?.alternativeTitles)}
            />
            <small>Comma separated. Canonical titles are never changed.</small>
          </label>
          <label className="span-2">
            Search aliases / optional transliteration
            <input
              name="searchAliases"
              maxLength={2000}
              placeholder="Common misspelling, Sinhala typed with English letters"
              defaultValue={list(initial?.searchAliases)}
            />
            <small>
              Discovery-only aliases; they never replace an official title.
            </small>
          </label>
          <label className="span-2">
            SEO title
            <input
              name="seoTitle"
              maxLength={70}
              defaultValue={String(
                (initial?.seo as Record<string, unknown> | undefined)?.title ||
                  "",
              )}
            />
          </label>
          <label className="span-2">
            SEO description
            <textarea
              name="seoDescription"
              maxLength={170}
              rows={3}
              defaultValue={String(
                (initial?.seo as Record<string, unknown> | undefined)
                  ?.description || "",
              )}
            />
          </label>
          <label className="span-2">
            Canonical URL
            <input
              name="seoCanonical"
              type="url"
              defaultValue={String(
                (initial?.seo as Record<string, unknown> | undefined)
                  ?.canonical || "",
              )}
            />
          </label>
          <label className="check-line">
            <input
              type="checkbox"
              name="seoNoindex"
              defaultChecked={Boolean(
                (initial?.seo as Record<string, unknown> | undefined)?.noindex,
              )}
            />{" "}
            Prevent search indexing
          </label>
        </div>
      </details>
    </form>
  );
}

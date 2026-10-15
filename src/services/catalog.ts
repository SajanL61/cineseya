import "server-only";
import { connectDb } from "@/lib/db";
import { useDemoData } from "@/lib/env";
import { resolvePublicAssetUrl } from "@/lib/assets";
import {
  Episode,
  MediaVersion,
  Movie,
  Season,
  Series,
  Subtitle,
  TranslatorProfile,
} from "@/models";
import {
  demoMovies,
  demoSeries,
  demoSubtitles,
  demoTranslators,
} from "@/data/demo";
import type {
  DiscoverFilters,
  MovieRecord,
  SeriesRecord,
  SubtitleRecord,
  TranslatorRecord,
} from "@/types/content";
import { getPublicMediaVersions } from "@/services/downloads";
import { rankSearchCandidates, searchMatchScore } from "@/lib/search";
import { normalizeFocalPoint } from "@/lib/artwork";

const normalize = (value: string) =>
  value.normalize("NFKC").trim().toLocaleLowerCase();
const fullMediaRights = ["owned", "licensed", "public_domain"];
const asDocument = (value: unknown) =>
  value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
const referenceId = (value: unknown) =>
  String(asDocument(value)?._id ?? value ?? "");
const optionalIsoDate = (value: unknown) => {
  if (!value) return undefined;
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
};

function filterMovies(items: MovieRecord[], filters: DiscoverFilters = {}) {
  let result = [...items];
  if (filters.q) {
    result = rankSearchCandidates(
      filters.q,
      result.map((movie) => ({
        item: movie,
        values: [
          movie.title,
          movie.originalTitle,
          movie.sinhalaTitle,
          ...(movie.alternativeTitles ?? []),
          ...(movie.searchAliases ?? []),
          movie.director,
          ...movie.cast.flatMap((credit) => [credit.name, credit.character]),
          ...movie.crew.flatMap((credit) => [credit.name, credit.role]),
          ...movie.genres,
          ...movie.languages,
          ...movie.countries,
          movie.year,
        ],
      })),
    );
  }
  if (filters.genre)
    result = result.filter((movie) =>
      movie.genres.some(
        (genre) => normalize(genre) === normalize(filters.genre!),
      ),
    );
  if (filters.language)
    result = result.filter((movie) =>
      movie.languages.some(
        (language) => normalize(language) === normalize(filters.language!),
      ),
    );
  if (filters.country)
    result = result.filter((movie) =>
      movie.countries.some(
        (country) => normalize(country) === normalize(filters.country!),
      ),
    );
  if (filters.year)
    result = result.filter((movie) => String(movie.year) === filters.year);
  if (filters.rating)
    result = result.filter(
      (movie) =>
        (movie.imdbRating ?? movie.tmdbRating ?? 0) >= Number(filters.rating),
    );
  if (filters.quality)
    result = result.filter((movie) =>
      movie.qualities.some((quality) =>
        normalize(quality).includes(normalize(filters.quality!)),
      ),
    );
  if (filters.subtitleLanguage)
    result = result.filter((movie) =>
      movie.subtitleLanguages.some(
        (language) =>
          normalize(language) === normalize(filters.subtitleLanguage!),
      ),
    );
  if (filters.q && !filters.sort) return result;
  const sort = filters.sort ?? "trending";
  result.sort((a, b) =>
    sort === "newest"
      ? b.year - a.year
      : sort === "rating"
        ? (b.imdbRating ?? b.tmdbRating ?? 0) -
          (a.imdbRating ?? a.tmdbRating ?? 0)
        : sort === "downloads"
          ? b.subtitleDownloadCount - a.subtitleDownloadCount
          : sort === "views" || sort === "popularity"
            ? b.viewCount - a.viewCount
            : Number(b.trending) - Number(a.trending) ||
              b.viewCount - a.viewCount,
  );
  return result;
}

function toMovieRecord(document: Record<string, unknown>): MovieRecord {
  const releaseDate = document.releaseDate
    ? new Date(document.releaseDate as string).toISOString().slice(0, 10)
    : `${document.year}-01-01`;
  return {
    id: String(document._id),
    title: String(document.title),
    originalTitle: document.originalTitle
      ? String(document.originalTitle)
      : undefined,
    sinhalaTitle: document.sinhalaTitle
      ? String(document.sinhalaTitle)
      : undefined,
    alternativeTitles:
      (document.alternativeTitles as string[] | undefined) ?? [],
    searchAliases: (document.searchAliases as string[] | undefined) ?? [],
    slug: String(document.slug),
    overview: String(document.overview),
    year: Number(document.year),
    releaseDate,
    runtime: Number(document.runtime ?? 0),
    ageRating: String(document.ageRating ?? "NR"),
    genres: (document.genres as string[] | undefined) ?? [],
    languages: (document.languages as string[] | undefined) ?? [],
    countries: (document.countries as string[] | undefined) ?? [],
    releaseType: document.releaseType
      ? String(document.releaseType)
      : undefined,
    videoQuality: document.videoQuality
      ? String(document.videoQuality)
      : undefined,
    posterUrl: resolvePublicAssetUrl(
      document.posterUrl,
      "/media/fallback-poster.svg",
    )!,
    backdropUrl: resolvePublicAssetUrl(
      document.backdropUrl,
      "/media/fallback-backdrop.svg",
    )!,
    posterFocalPoint: normalizeFocalPoint(document.posterFocalPoint),
    backdropFocalPoint: normalizeFocalPoint(document.backdropFocalPoint),
    trailerUrl: document.trailerUrl ? String(document.trailerUrl) : undefined,
    imdbId: document.imdbId ? String(document.imdbId) : undefined,
    tmdbId: document.tmdbId ? String(document.tmdbId) : undefined,
    imdbRating: document.imdbRating ? Number(document.imdbRating) : undefined,
    tmdbRating: document.tmdbRating ? Number(document.tmdbRating) : undefined,
    cast: (document.cast as MovieRecord["cast"] | undefined) ?? [],
    crew: (document.crew as MovieRecord["crew"] | undefined) ?? [],
    director: document.director ? String(document.director) : undefined,
    rightsStatus: document.rightsStatus as MovieRecord["rightsStatus"],
    featured: Boolean(document.featured),
    trending: Boolean(document.trending),
    editorPick: Boolean(document.editorPick),
    viewCount: Number(document.viewCount ?? 0),
    subtitleDownloadCount: Number(document.subtitleDownloadCount ?? 0),
    publicationStatus:
      document.publicationStatus as MovieRecord["publicationStatus"],
    qualities: [],
    subtitleLanguages: [],
    releaseStatus: String(document.releaseStatus ?? "Released"),
    seo: asDocument(document.seo) as MovieRecord["seo"],
    publishedAt: optionalIsoDate(document.publishedAt),
    updatedAt: optionalIsoDate(document.updatedAt),
  };
}

async function enrichMovieRecords(documents: Record<string, unknown>[]) {
  const records = documents.map(toMovieRecord);
  if (!documents.length) return records;
  const ids = documents.map((document) => document._id);
  const [versions, subtitles] = await Promise.all([
    MediaVersion.find({
      contentType: "movie",
      contentId: { $in: ids },
      active: true,
      rightsStatus: { $in: fullMediaRights },
    })
      .select("contentId quality resolution releaseType")
      .lean(),
    Subtitle.find({ movie: { $in: ids }, status: "published" })
      .select("movie language")
      .lean(),
  ]);
  const qualities = new Map<string, Set<string>>();
  const primaryVersions = new Map<
    string,
    { releaseType?: string; videoQuality?: string }
  >();
  const languages = new Map<string, Set<string>>();
  for (const version of versions) {
    const key = String(version.contentId);
    const label = [version.resolution || version.quality, version.releaseType]
      .filter(Boolean)
      .join(" ");
    if (label)
      (qualities.get(key) ?? qualities.set(key, new Set()).get(key)!).add(
        String(label),
      );
    if (!primaryVersions.has(key))
      primaryVersions.set(key, {
        releaseType: version.releaseType
          ? String(version.releaseType)
          : undefined,
        videoQuality:
          version.resolution || version.quality
            ? String(version.resolution || version.quality)
            : undefined,
      });
  }
  for (const subtitle of subtitles) {
    const key = String(subtitle.movie);
    if (subtitle.language)
      (languages.get(key) ?? languages.set(key, new Set()).get(key)!).add(
        String(subtitle.language),
      );
  }
  return records.map((record) => ({
    ...record,
    releaseType:
      primaryVersions.get(record.id)?.releaseType ?? record.releaseType,
    videoQuality:
      primaryVersions.get(record.id)?.videoQuality ?? record.videoQuality,
    qualities: fullMediaRights.includes(record.rightsStatus)
      ? [...(qualities.get(record.id) ?? [])]
      : [],
    subtitleLanguages: [...(languages.get(record.id) ?? [])],
  }));
}

export async function getMovies(filters: DiscoverFilters = {}) {
  if (useDemoData) return filterMovies(demoMovies.filter((movie) => movie.publicationStatus === 'published'), filters);
  await connectDb();
  const query: Record<string, unknown> = { publicationStatus: "published" };
  if (filters.genre) query.genres = filters.genre;
  if (filters.language) query.languages = filters.language;
  if (filters.country) query.countries = filters.country;
  if (filters.year) query.year = Number(filters.year);
  const rows = await Movie.find(query)
    .sort({ trending: -1, viewCount: -1, publishedAt: -1 })
    .limit(filters.q ? 500 : 96)
    .lean();
  return filterMovies(
    await enrichMovieRecords(rows as Record<string, unknown>[]),
    filters,
  );
}

export async function getMovieBySlug(slug: string) {
  if (useDemoData)
    return demoMovies.find((movie) => movie.slug === slug) ?? null;
  await connectDb();
  const row = await Movie.findOne({
    slug,
    publicationStatus: "published",
  }).lean();
  return row
    ? (await enrichMovieRecords([row as Record<string, unknown>]))[0]
    : null;
}

export async function getSeries(): Promise<SeriesRecord[]> {
  if (useDemoData) return demoSeries;
  await connectDb();
  const seriesRows = await Series.find({ publicationStatus: "published" })
    .sort({ trending: -1, publishedAt: -1 })
    .lean();
  return Promise.all(
    seriesRows.map(async (row) => {
      const seasonRows = await Season.find({
        series: row._id,
        publicationStatus: "published",
      })
        .sort({ seasonNumber: 1 })
        .lean();
      const seasons = await Promise.all(
        seasonRows.map(async (season) => {
          const episodeRows = await Episode.find({
            season: season._id,
            publicationStatus: "published",
          })
            .sort({ episodeNumber: 1 })
            .lean();
          const subtitleRows = episodeRows.length
            ? await Subtitle.find({
                episode: { $in: episodeRows.map((episode) => episode._id) },
                status: "published",
              })
                .select("episode language")
                .lean()
            : [];
          const languagesByEpisode = new Map<string, Set<string>>();
          for (const subtitle of subtitleRows)
            (
              languagesByEpisode.get(String(subtitle.episode)) ??
              languagesByEpisode
                .set(String(subtitle.episode), new Set())
                .get(String(subtitle.episode))!
            ).add(String(subtitle.language));
          return {
            id: String(season._id),
            seasonNumber: Number(season.seasonNumber),
            title: String(season.title ?? `Season ${season.seasonNumber}`),
            episodes: episodeRows.map((episode) => ({
              id: String(episode._id),
              seasonNumber: Number(episode.seasonNumber),
              episodeNumber: Number(episode.episodeNumber),
              title: String(episode.title),
              slug: String(episode.slug),
              overview: String(episode.overview ?? ""),
              runtime: Number(episode.runtime ?? 0),
              releaseDate: episode.releaseDate
                ? new Date(episode.releaseDate as Date)
                    .toISOString()
                    .slice(0, 10)
                : "",
              thumbnailUrl: resolvePublicAssetUrl(
                episode.thumbnailUrl,
                "/media/fallback-backdrop.svg",
              )!,
              subtitleLanguages: [
                ...(languagesByEpisode.get(String(episode._id)) ?? []),
              ],
              rightsStatus:
                episode.rightsStatus as SeriesRecord["rightsStatus"],
              updatedAt: optionalIsoDate(episode.updatedAt),
            })),
          };
        }),
      );
      return {
        id: String(row._id),
        title: String(row.title),
        originalTitle: row.originalTitle
          ? String(row.originalTitle)
          : undefined,
        sinhalaTitle: row.sinhalaTitle ? String(row.sinhalaTitle) : undefined,
        alternativeTitles:
          (row.alternativeTitles as string[] | undefined) ?? [],
        searchAliases: (row.searchAliases as string[] | undefined) ?? [],
        slug: String(row.slug),
        overview: String(row.overview),
        year: Number(row.year),
        ageRating: String(row.ageRating ?? "NR"),
        genres: (row.genres as string[] | undefined) ?? [],
        languages: (row.languages as string[] | undefined) ?? [],
        countries: (row.countries as string[] | undefined) ?? [],
        cast: (row.cast as SeriesRecord["cast"] | undefined) ?? [],
        crew: (row.crew as SeriesRecord["crew"] | undefined) ?? [],
        posterUrl: resolvePublicAssetUrl(
          row.posterUrl,
          "/media/fallback-poster.svg",
        )!,
        backdropUrl: resolvePublicAssetUrl(
          row.backdropUrl,
          "/media/fallback-backdrop.svg",
        )!,
        posterFocalPoint: normalizeFocalPoint(row.posterFocalPoint),
        backdropFocalPoint: normalizeFocalPoint(row.backdropFocalPoint),
        imdbRating: row.imdbRating ? Number(row.imdbRating) : undefined,
        tmdbRating: row.tmdbRating ? Number(row.tmdbRating) : undefined,
        status: String(row.status ?? "Unknown"),
        rightsStatus: row.rightsStatus as SeriesRecord["rightsStatus"],
        seasons,
        featured: Boolean(row.featured),
        trending: Boolean(row.trending),
        trailerUrl: row.trailerUrl ? String(row.trailerUrl) : undefined,
        imdbId: row.imdbId ? String(row.imdbId) : undefined,
        tmdbId: row.tmdbId ? String(row.tmdbId) : undefined,
        publishedAt: optionalIsoDate(row.publishedAt),
        updatedAt: optionalIsoDate(row.updatedAt),
      } satisfies SeriesRecord;
    }),
  );
}

export async function getSeriesBySlug(slug: string) {
  return (await getSeries()).find((series) => series.slug === slug) ?? null;
}

export async function searchSeries(query: string) {
  const series = await getSeries();
  return rankSearchCandidates(
    query,
    series.map((item) => ({
      item,
      values: [
        item.title,
        item.originalTitle,
        item.sinhalaTitle,
        ...(item.alternativeTitles ?? []),
        ...(item.searchAliases ?? []),
        ...item.genres,
        ...item.languages,
        ...item.countries,
        item.year,
        ...(item.cast ?? []).flatMap((credit) => [
          credit.name,
          credit.character,
        ]),
        ...(item.crew ?? []).flatMap((credit) => [credit.name, credit.role]),
      ],
    })),
  );
}

export async function getSubtitles(
  languageCode?: string,
): Promise<SubtitleRecord[]> {
  if (useDemoData)
    return demoSubtitles.filter(
      (subtitle) => subtitle.status === 'published' && (!languageCode || subtitle.languageCode === languageCode),
    );
  await connectDb();
  const rows = await Subtitle.find({
    status: "published",
    ...(languageCode ? { languageCode } : {}),
  })
    .populate("translator", "displayName slug avatarUrl")
    .populate("movie", "title slug posterUrl posterFocalPoint")
    .populate("series", "title slug posterUrl posterFocalPoint")
    .populate({
      path: "episode",
      select: "title seasonNumber episodeNumber thumbnailUrl series",
      populate: {
        path: "series",
        select: "title slug posterUrl posterFocalPoint",
      },
    })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  return rows.map((row) => {
    const movie = asDocument(row.movie);
    const directSeries = asDocument(row.series);
    const episode = asDocument(row.episode);
    const episodeSeries = asDocument(episode?.series);
    const series = directSeries ?? episodeSeries;
    const translator = asDocument(row.translator);
    const contentSlug = String(movie?.slug ?? series?.slug ?? "");
    const contentTitle = movie
      ? String(movie.title)
      : episode
        ? `${String(series?.title ?? "TV Series")} — S${episode.seasonNumber} E${episode.episodeNumber}: ${String(episode.title)}`
        : String(series?.title ?? "TV Series");
    const contentHref = movie
      ? `/movies/${contentSlug}`
      : episode
        ? `/tv/${contentSlug}/season-${episode.seasonNumber}/episode-${episode.episodeNumber}`
        : `/tv/${contentSlug}`;
    return {
      id: String(row._id),
      movieId: row.movie ? referenceId(row.movie) : undefined,
      seriesId: row.series
        ? referenceId(row.series)
        : episodeSeries
          ? referenceId(episodeSeries)
          : undefined,
      episodeId: row.episode ? referenceId(row.episode) : undefined,
      contentSlug,
      contentHref,
      contentTitle,
      contentPosterUrl: resolvePublicAssetUrl(
        movie?.posterUrl ?? episode?.thumbnailUrl ?? series?.posterUrl,
        "/media/fallback-poster.svg",
      )!,
      contentPosterFocalPoint: normalizeFocalPoint(
        movie?.posterFocalPoint ?? series?.posterFocalPoint,
      ),
      language: String(row.language),
      languageCode: String(row.languageCode),
      translatorId: referenceId(row.translator),
      translatorName: String(
        translator?.displayName ?? "CineSeya.lk Translator",
      ),
      translatorSlug: String(translator?.slug ?? ""),
      translatorAvatarUrl: resolvePublicAssetUrl(translator?.avatarUrl),
      releaseMatches: (row.releaseMatches as string[] | undefined) ?? [],
      fps: row.fps ? Number(row.fps) : undefined,
      format: row.format as SubtitleRecord["format"],
      hearingImpaired: Boolean(row.hearingImpaired),
      fileName: String(row.fileName),
      fileSize: Number(row.fileSize),
      version: Number(row.version),
      verified: Boolean(row.verified),
      downloadCount: Number(row.downloadCount),
      status: row.status as SubtitleRecord["status"],
      createdAt: new Date(row.createdAt as Date).toISOString(),
      updatedAt: new Date(row.updatedAt as Date).toISOString(),
    } satisfies SubtitleRecord;
  });
}

export async function getSubtitlesForMovie(movieId: string) {
  return (await getSubtitles()).filter(
    (subtitle) => subtitle.movieId === movieId,
  );
}

export async function getSubtitlesForEpisode(episodeId: string) {
  return (await getSubtitles()).filter(
    (subtitle) => subtitle.episodeId === episodeId,
  );
}

export async function getTranslatorBySlug(
  slug: string,
): Promise<TranslatorRecord | null> {
  if (useDemoData)
    return (
      demoTranslators.find((translator) => translator.slug === slug) ?? null
    );
  await connectDb();
  const row = await TranslatorProfile.findOne({ slug }).lean();
  if (!row) return null;
  return {
    id: String(row._id),
    slug: String(row.slug),
    displayName: String(row.displayName),
    avatarUrl: resolvePublicAssetUrl(row.avatarUrl),
    bio: String(row.bio ?? ""),
    joinedAt: new Date(row.createdAt as Date).toISOString(),
    verified: Boolean(row.verified),
    totalSubtitles: Number(row.totalSubtitles ?? 0),
    totalDownloads: Number(row.totalDownloads ?? 0),
    averageRating: Number(row.averageRating ?? 0),
    updatedAt: optionalIsoDate(row.updatedAt),
  };
}

export async function getTranslators(): Promise<TranslatorRecord[]> {
  if (useDemoData) return demoTranslators;
  await connectDb();
  const publishedTranslatorIds = await Subtitle.distinct('translator', { status: 'published' });
  const rows = await TranslatorProfile.find({ _id: { $in: publishedTranslatorIds } })
    .sort({ verified: -1, totalSubtitles: -1, displayName: 1 })
    .lean();
  return rows.map((row) => ({
    id: String(row._id),
    slug: String(row.slug),
    displayName: String(row.displayName),
    avatarUrl: resolvePublicAssetUrl(row.avatarUrl),
    bio: String(row.bio ?? ""),
    joinedAt: new Date(row.createdAt as Date).toISOString(),
    verified: Boolean(row.verified),
    totalSubtitles: Number(row.totalSubtitles ?? 0),
    totalDownloads: Number(row.totalDownloads ?? 0),
    averageRating: Number(row.averageRating ?? 0),
    updatedAt: optionalIsoDate(row.updatedAt),
  }));
}

export async function getTranslatorSubtitles(translatorId: string) {
  return (await getSubtitles()).filter(
    (subtitle) => subtitle.translatorId === translatorId,
  );
}

async function getBasicSearchSuggestions(query: string) {
  const q = normalize(query);
  if (q.length < 2) return [];
  const [movies, series, subtitles] = await Promise.all([
    getMovies({ q }),
    getSeries(),
    getSubtitles(),
  ]);
  const movieItems = movies
    .slice(0, 6)
    .map((movie) => ({
      type: "movie",
      title: movie.title,
      subtitle: `${movie.year} · ${movie.genres[0] ?? "Movie"}`,
      slug: movie.slug,
      image: movie.posterUrl,
      focalPoint: movie.posterFocalPoint,
    }));
  const seriesItems = series
    .filter((item) =>
      [item.title, item.sinhalaTitle, ...item.genres]
        .filter(Boolean)
        .some((value) => normalize(String(value)).includes(q)),
    )
    .slice(0, 4)
    .map((item) => ({
      type: "series",
      title: item.title,
      subtitle: `${item.year} · TV Series`,
      slug: item.slug,
      image: item.posterUrl,
      focalPoint: item.posterFocalPoint,
    }));
  const translatorRows = useDemoData
    ? demoTranslators
    : await TranslatorProfile.find({
        displayName: {
          $regex: query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          $options: "i",
        },
      })
        .select("displayName slug avatarUrl")
        .limit(3)
        .lean();
  const translatorItems = translatorRows
    .filter((item) => normalize(String(item.displayName)).includes(q))
    .slice(0, 3)
    .map((item) => ({
      type: "translator",
      title: String(item.displayName),
      subtitle: "Subtitle translator",
      slug: String(item.slug),
      image: resolvePublicAssetUrl(item.avatarUrl),
    }));
  const subtitleItems = subtitles
    .filter((item) => normalize(item.contentTitle).includes(q))
    .slice(0, 3)
    .map((item) => ({
      type: "subtitle",
      title: `${item.contentTitle} · ${item.language}`,
      subtitle: `${item.format.toUpperCase()} · ${item.downloadCount.toLocaleString()} downloads`,
      slug: item.contentSlug,
      href: `${item.contentHref ?? `/movies/${item.contentSlug}`}#subtitles`,
      image: item.contentPosterUrl,
      focalPoint: item.contentPosterFocalPoint,
    }));
  return [
    ...movieItems,
    ...seriesItems,
    ...translatorItems,
    ...subtitleItems,
  ].slice(0, 10);
}

export async function getSearchSuggestions(query: string) {
  const q = normalize(query);
  if (q.length < 2) return [];
  const [movies, series, subtitles, translatorRows] = await Promise.all([
    getMovies({ q }),
    getSeries(),
    getSubtitles(),
    useDemoData
      ? Promise.resolve(demoTranslators)
      : TranslatorProfile.find()
          .select("displayName slug avatarUrl")
          .sort({ totalDownloads: -1 })
          .limit(100)
          .lean(),
  ]);
  const movieItems = movies
    .slice(0, 6)
    .map((movie) => ({
      type: "movie",
      title: movie.title,
      subtitle: `${movie.year} · ${movie.genres[0] ?? "Movie"}`,
      slug: movie.slug,
      image: movie.posterUrl,
      focalPoint: movie.posterFocalPoint,
    }));
  const matchedSeries = rankSearchCandidates(
    query,
    series.map((item) => ({
      item,
      values: [
        item.title,
        item.originalTitle,
        item.sinhalaTitle,
        ...(item.alternativeTitles ?? []),
        ...(item.searchAliases ?? []),
        ...item.genres,
        ...item.languages,
        ...item.countries,
        item.year,
        ...(item.cast ?? []).flatMap((credit) => [
          credit.name,
          credit.character,
        ]),
        ...(item.crew ?? []).flatMap((credit) => [credit.name, credit.role]),
      ],
    })),
  );
  const seriesItems = matchedSeries
    .slice(0, 4)
    .map((item) => ({
      type: "series",
      title: item.title,
      subtitle: `${item.year} · TV Series`,
      slug: item.slug,
      image: item.posterUrl,
      focalPoint: item.posterFocalPoint,
    }));
  const matchedTranslators = rankSearchCandidates(
    query,
    translatorRows.map((item) => ({
      item,
      values: [String(item.displayName ?? ""), String(item.slug ?? "")],
    })),
  );
  const translatorItems = matchedTranslators
    .slice(0, 3)
    .map((item) => ({
      type: "translator",
      title: String(item.displayName),
      subtitle: "Subtitle translator",
      slug: String(item.slug),
      image: resolvePublicAssetUrl(item.avatarUrl),
    }));
  const matchedSubtitles = [...subtitles]
    .map((item) => ({
      item,
      score: searchMatchScore(query, [
        item.contentTitle,
        item.language,
        item.translatorName,
      ]),
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .map(({ item }) => item);
  const subtitleItems = matchedSubtitles
    .slice(0, 3)
    .map((item) => ({
      type: "subtitle",
      title: `${item.contentTitle} · ${item.language}`,
      subtitle: `${item.format.toUpperCase()} · ${item.downloadCount.toLocaleString()} downloads`,
      slug: item.contentSlug,
      href: `${item.contentHref ?? `/movies/${item.contentSlug}`}#subtitles`,
      image: item.contentPosterUrl,
      focalPoint: item.contentPosterFocalPoint,
    }));
  const people = new Map<
    string,
    { type: string; title: string; subtitle: string; slug: string }
  >();
  for (const movie of movies.slice(0, 20))
    for (const credit of [...movie.cast, ...movie.crew]) {
      if (
        !people.has(credit.slug) &&
        searchMatchScore(query, [credit.name, credit.character, credit.role]) >
          0
      )
        people.set(credit.slug, {
          type: "person",
          title: credit.name,
          subtitle: credit.character || credit.role || "Cast & crew",
          slug: credit.slug,
        });
    }
  for (const item of matchedSeries.slice(0, 10))
    for (const credit of [...(item.cast ?? []), ...(item.crew ?? [])]) {
      if (
        !people.has(credit.slug) &&
        searchMatchScore(query, [credit.name, credit.character, credit.role]) >
          0
      )
        people.set(credit.slug, {
          type: "person",
          title: credit.name,
          subtitle: credit.character || credit.role || "Cast & crew",
          slug: credit.slug,
        });
    }
  const items = [
    ...movieItems,
    ...seriesItems,
    ...people.values(),
    ...translatorItems,
    ...subtitleItems,
  ].slice(0, 12);
  return items.length ? items : getBasicSearchSuggestions(query);
}

export async function getActiveMediaVersions(
  contentId: string,
  contentType: "movie" | "episode",
) {
  return getPublicMediaVersions(contentId, contentType);
}

export const RIGHTS_STATUSES = ['subtitle_only', 'owned', 'licensed', 'public_domain', 'unavailable'] as const;
export type RightsStatus = (typeof RIGHTS_STATUSES)[number];
export type PublicationStatus = 'draft' | 'scheduled' | 'published' | 'archived';
export type FocalPoint = { x: number; y: number };
export type SeoFields = {
  title?: string;
  description?: string;
  canonical?: string;
  noindex?: boolean;
};

export type PersonCredit = {
  name: string;
  slug: string;
  role?: string;
  character?: string;
  profileUrl?: string;
};

export type MovieRecord = {
  id: string;
  title: string;
  originalTitle?: string;
  sinhalaTitle?: string;
  alternativeTitles?: string[];
  searchAliases?: string[];
  slug: string;
  overview: string;
  year: number;
  releaseDate: string;
  runtime: number;
  ageRating: string;
  genres: string[];
  languages: string[];
  countries: string[];
  releaseType?: string;
  videoQuality?: string;
  posterUrl: string;
  backdropUrl: string;
  posterFocalPoint?: FocalPoint;
  backdropFocalPoint?: FocalPoint;
  trailerUrl?: string;
  imdbId?: string;
  tmdbId?: string;
  imdbRating?: number;
  tmdbRating?: number;
  cast: PersonCredit[];
  crew: PersonCredit[];
  director?: string;
  rightsStatus: RightsStatus;
  featured: boolean;
  trending: boolean;
  editorPick: boolean;
  viewCount: number;
  subtitleDownloadCount: number;
  publicationStatus: PublicationStatus;
  qualities: string[];
  subtitleLanguages: string[];
  releaseStatus: string;
  seo?: SeoFields;
  publishedAt?: string;
  updatedAt?: string;
};

export type EpisodeRecord = {
  id: string;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  slug: string;
  overview: string;
  runtime: number;
  releaseDate: string;
  thumbnailUrl: string;
  subtitleLanguages: string[];
  rightsStatus: RightsStatus;
  updatedAt?: string;
};

export type SeasonRecord = {
  id: string;
  seasonNumber: number;
  title: string;
  episodes: EpisodeRecord[];
};

export type SeriesRecord = {
  id: string;
  title: string;
  originalTitle?: string;
  sinhalaTitle?: string;
  alternativeTitles?: string[];
  searchAliases?: string[];
  slug: string;
  overview: string;
  year: number;
  ageRating: string;
  genres: string[];
  languages: string[];
  countries: string[];
  cast?: PersonCredit[];
  crew?: PersonCredit[];
  posterUrl: string;
  backdropUrl: string;
  posterFocalPoint?: FocalPoint;
  backdropFocalPoint?: FocalPoint;
  imdbRating?: number;
  tmdbRating?: number;
  status: string;
  rightsStatus: RightsStatus;
  seasons: SeasonRecord[];
  featured: boolean;
  trending: boolean;
  trailerUrl?: string;
  imdbId?: string;
  tmdbId?: string;
  publishedAt?: string;
  updatedAt?: string;
};

export type SubtitleRecord = {
  id: string;
  movieId?: string;
  seriesId?: string;
  episodeId?: string;
  contentSlug: string;
  contentHref?: string;
  contentTitle: string;
  contentPosterUrl: string;
  contentPosterFocalPoint?: FocalPoint;
  language: string;
  languageCode: string;
  translatorId: string;
  translatorName: string;
  translatorSlug: string;
  translatorAvatarUrl?: string;
  releaseMatches: string[];
  fps?: number;
  format: 'srt' | 'ass' | 'vtt' | 'zip';
  hearingImpaired: boolean;
  fileName: string;
  fileSize: number;
  version: number;
  verified: boolean;
  downloadCount: number;
  status: 'draft' | 'published' | 'disabled';
  createdAt: string;
  updatedAt: string;
};

export type TranslatorRecord = {
  id: string;
  slug: string;
  displayName: string;
  avatarUrl?: string;
  bio: string;
  joinedAt: string;
  verified: boolean;
  totalSubtitles: number;
  totalDownloads: number;
  averageRating: number;
  updatedAt?: string;
};

export type DiscoverFilters = {
  q?: string;
  type?: 'movie' | 'tv';
  genre?: string;
  language?: string;
  country?: string;
  year?: string;
  rating?: string;
  quality?: string;
  subtitleLanguage?: string;
  releaseType?: string;
  sort?: 'trending' | 'newest' | 'rating' | 'popularity' | 'views' | 'downloads';
};

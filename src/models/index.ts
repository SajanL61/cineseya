import mongoose, { type Model, Schema } from 'mongoose';
import { RIGHTS_STATUSES } from '@/types/content';

type LooseDocument = Record<string, unknown>;
const existingOrCreate = (name: string, schema: Schema) =>
  (mongoose.models[name] as Model<LooseDocument> | undefined) ?? mongoose.model<LooseDocument>(name, schema);

const slug = { type: String, required: true, unique: true, lowercase: true, trim: true, index: true };
const objectKey = { type: String, trim: true };
const publication = { type: String, enum: ['draft', 'scheduled', 'published', 'archived'], default: 'draft', index: true };
const rights = { type: String, enum: RIGHTS_STATUSES, required: true, default: 'subtitle_only', index: true };
const personCreditSchema = new Schema(
  { name: { type: String, required: true }, slug: { type: String, required: true }, role: String, character: String, profileKey: String },
  { _id: false },
);
const focalPointSchema = new Schema(
  { x: { type: Number, min: 0, max: 100, required: true }, y: { type: Number, min: 0, max: 100, required: true } },
  { _id: false },
);

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    displayName: { type: String, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['super_admin', 'admin', 'editor', 'translator', 'moderator', 'viewer', 'user'],
      default: 'user',
      index: true,
    },
    permissions: [{ type: String }],
    avatarKey: String,
    locale: { type: String, enum: ['en', 'si'], default: 'en' },
    preferences: { subtitleLanguages: [String], contentLanguages: [String], reducedMotion: Boolean },
    active: { type: Boolean, default: true, index: true },
    emailVerifiedAt: Date,
    passwordChangedAt: Date,
    lastLoginAt: Date,
  },
  { timestamps: true },
);

const sessionSchema = new Schema(
  {
    tokenHash: { type: String, required: true, unique: true, select: false },
    csrfHash: { type: String, required: true, select: false },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    expiresAt: { type: Date, required: true, expires: 0 },
    lastSeenAt: Date,
    ipHash: String,
    userAgentHash: String,
  },
  { timestamps: true },
);

const movieSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    type: { type: String, enum: ['movie'], default: 'movie', immutable: true },
    originalTitle: String,
    sinhalaTitle: String,
    alternativeTitles: [{ type: String, trim: true, maxlength: 240 }],
    searchAliases: [{ type: String, trim: true, maxlength: 240 }],
    slug,
    overview: { type: String, required: true, maxlength: 8_000 },
    shortDescription: { type: String, maxlength: 500 },
    year: { type: Number, required: true, index: true },
    releaseDate: Date,
    runtime: { type: Number, min: 0 },
    ageRating: String,
    genres: [{ type: String, index: true }],
    languages: [{ type: String, index: true }],
    countries: [{ type: String, index: true }],
    releaseType: { type: String, trim: true, maxlength: 32 },
    videoQuality: { type: String, trim: true, maxlength: 16 },
    posterKey: objectKey,
    posterUrl: String,
    posterFocalPoint: focalPointSchema,
    backdropKey: objectKey,
    backdropUrl: String,
    backdropFocalPoint: focalPointSchema,
    trailerUrl: String,
    imdbId: { type: String, sparse: true, index: true },
    tmdbId: { type: String, sparse: true, index: true },
    imdbRating: { type: Number, min: 0, max: 10 },
    tmdbRating: { type: Number, min: 0, max: 10 },
    director: String,
    cast: [personCreditSchema],
    crew: [personCreditSchema],
    rightsStatus: rights,
    featured: { type: Boolean, default: false, index: true },
    trending: { type: Boolean, default: false, index: true },
    editorPick: { type: Boolean, default: false, index: true },
    viewCount: { type: Number, default: 0, min: 0 },
    subtitleDownloadCount: { type: Number, default: 0, min: 0 },
    mediaDownloadCount: { type: Number, default: 0, min: 0 },
    publicationStatus: publication,
    publishedAt: Date,
    scheduledAt: Date,
    releaseStatus: { type: String, default: 'released' },
    seo: { title: String, description: String, canonical: String, noindex: Boolean },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, optimisticConcurrency: true },
);
movieSchema.index({ title: 'text', originalTitle: 'text', sinhalaTitle: 'text', overview: 'text' });
movieSchema.index({ publicationStatus: 1, publishedAt: -1 });
movieSchema.index({ publicationStatus: 1, trending: -1, viewCount: -1 });

const seriesSchema = new Schema(
  {
    title: { type: String, required: true }, originalTitle: String, sinhalaTitle: String,
    alternativeTitles: [{ type: String, trim: true, maxlength: 240 }], searchAliases: [{ type: String, trim: true, maxlength: 240 }],
    slug, overview: { type: String, required: true },
    year: { type: Number, required: true, index: true }, ageRating: String, genres: [{ type: String, index: true }],
    languages: [{ type: String, index: true }], countries: [{ type: String, index: true }], posterKey: String, posterUrl: String,
    posterFocalPoint: focalPointSchema, backdropKey: String, backdropUrl: String, backdropFocalPoint: focalPointSchema,
    trailerUrl: String, imdbId: String, tmdbId: String, imdbRating: Number, tmdbRating: Number,
    cast: [personCreditSchema], crew: [personCreditSchema], status: { type: String, default: 'returning' }, rightsStatus: rights,
    featured: { type: Boolean, default: false, index: true }, trending: { type: Boolean, default: false, index: true },
    viewCount: { type: Number, default: 0 }, publicationStatus: publication, publishedAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }, updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, optimisticConcurrency: true },
);
seriesSchema.index({ title: 'text', originalTitle: 'text', sinhalaTitle: 'text', overview: 'text' });
seriesSchema.index({ publicationStatus: 1, trending: -1, viewCount: -1 });

const seasonSchema = new Schema(
  {
    series: { type: Schema.Types.ObjectId, ref: 'Series', required: true, index: true }, seasonNumber: { type: Number, required: true },
    title: String, overview: String, posterKey: String, releaseDate: Date, publicationStatus: publication,
  },
  { timestamps: true },
);
seasonSchema.index({ series: 1, seasonNumber: 1 }, { unique: true });

const episodeSchema = new Schema(
  {
    series: { type: Schema.Types.ObjectId, ref: 'Series', required: true, index: true },
    season: { type: Schema.Types.ObjectId, ref: 'Season', required: true, index: true },
    seasonNumber: { type: Number, required: true }, episodeNumber: { type: Number, required: true }, title: { type: String, required: true },
    slug: { type: String, required: true, lowercase: true }, overview: String, runtime: Number, releaseDate: Date, thumbnailKey: String,
    thumbnailUrl: String, rightsStatus: rights, publicationStatus: publication, viewCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);
episodeSchema.index({ series: 1, seasonNumber: 1, episodeNumber: 1 }, { unique: true });
episodeSchema.index({ series: 1, slug: 1 }, { unique: true });

const subtitleSchema = new Schema(
  {
    movie: { type: Schema.Types.ObjectId, ref: 'Movie', index: true }, series: { type: Schema.Types.ObjectId, ref: 'Series', index: true },
    episode: { type: Schema.Types.ObjectId, ref: 'Episode', index: true }, language: { type: String, required: true, index: true },
    languageCode: { type: String, required: true, lowercase: true, index: true }, translator: { type: Schema.Types.ObjectId, ref: 'TranslatorProfile', required: true, index: true },
    releaseMatches: [{ type: String }], fps: Number, format: { type: String, enum: ['srt', 'ass', 'vtt', 'zip'], required: true },
    hearingImpaired: { type: Boolean, default: false }, fileKey: { type: String, required: true }, fileName: { type: String, required: true },
    fileSize: { type: Number, required: true, min: 1 }, version: { type: Number, default: 1, min: 1 }, verified: { type: Boolean, default: false, index: true },
    featured: { type: Boolean, default: false }, downloadCount: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['draft', 'published', 'disabled'], default: 'draft', index: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' }, checksum: String,
  },
  { timestamps: true, optimisticConcurrency: true },
);
subtitleSchema.index({ movie: 1, languageCode: 1, status: 1, createdAt: -1 });
subtitleSchema.index({ episode: 1, languageCode: 1, status: 1, createdAt: -1 });
subtitleSchema.index({ translator: 1, status: 1, createdAt: -1 });

const translatorSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', unique: true, sparse: true }, slug, displayName: { type: String, required: true },
    avatarKey: String, avatarUrl: String, bio: { type: String, maxlength: 2_000 }, verified: { type: Boolean, default: false, index: true },
    totalSubtitles: { type: Number, default: 0 }, totalDownloads: { type: Number, default: 0 }, averageRating: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const mediaAssetSchema = new Schema(
  {
    objectKey: { type: String, required: true, unique: true }, bucket: { type: String, required: true }, kind: { type: String, enum: ['poster', 'backdrop', 'subtitle', 'media', 'avatar', 'other'], required: true, index: true },
    fileName: String, mimeType: String, size: { type: Number, min: 0 }, checksum: String, status: { type: String, enum: ['pending', 'active', 'missing', 'orphan', 'disabled', 'pending_deletion'], default: 'pending', index: true },
    linkedModel: String, linkedId: Schema.Types.ObjectId, uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' }, metadata: Schema.Types.Mixed,
  },
  { timestamps: true },
);
mediaAssetSchema.index({ kind: 1, status: 1, createdAt: -1 });

const mediaVersionSchema = new Schema(
  {
    contentId: { type: Schema.Types.ObjectId, required: true, index: true }, contentType: { type: String, enum: ['movie', 'episode'], required: true, index: true },
    quality: { type: String, enum: ['480p', '720p', '1080p', '1440p', '2160p'], required: true }, resolution: { type: String, required: true },
    releaseType: { type: String, enum: ['WEB-DL', 'WEBRip', 'BluRay', 'HDRip', 'DVDRip', 'Other'], required: true },
    videoCodec: { type: String, enum: ['H264', 'H265', 'AV1'], required: true }, audioCodec: String,
    container: { type: String, enum: ['MP4', 'MKV', 'WEBM'], required: true }, audioLanguages: [String], embeddedSubtitleLanguages: [String],
    fileName: { type: String, required: true }, fileSize: { type: Number, min: 1, required: true }, r2ObjectKey: { type: String, required: true, unique: true },
    storageBucket: { type: String, required: true }, streamingManifestKey: String,
    rightsStatus: rights, regionRestrictions: [String], active: { type: Boolean, default: false, index: true }, downloadCount: { type: Number, default: 0, min: 0 },
    deletionStatus: { type: String, enum: ['active', 'pending_deletion', 'retained', 'deleted'], default: 'active', index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }, updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
mediaVersionSchema.index({ contentId: 1, contentType: 1, active: 1 });
mediaVersionSchema.index({ active: 1, rightsStatus: 1, createdAt: -1 });

const downloadMirrorSchema = new Schema(
  {
    mediaVersion: { type: Schema.Types.ObjectId, ref: 'MediaVersion', required: true, index: true },
    providerName: { type: String, required: true, trim: true, maxlength: 80 },
    providerType: { type: String, enum: ['dotflix', 'telegram', 'backup', 'external', 'cloud_drive', 'custom'], required: true, index: true },
    label: { type: String, trim: true, maxlength: 80 },
    url: { type: String, required: true, select: false }, priority: { type: Number, default: 100, index: true },
    supportsResume: { type: Boolean, default: false }, supportsRange: { type: Boolean, default: false }, requiresLogin: { type: Boolean, default: false }, active: { type: Boolean, default: true, index: true },
    lastCheckedAt: Date, lastSuccessfulAt: Date, latencyMs: { type: Number, min: 0 }, failureCount: { type: Number, min: 0, default: 0 },
    healthStatus: { type: String, enum: ['unknown', 'online', 'slow', 'offline', 'disabled', 'unavailable'], default: 'unknown', index: true },
    notes: { type: String, trim: true, maxlength: 2_000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }, updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
downloadMirrorSchema.index({ mediaVersion: 1, active: 1, priority: 1 });

const downloadVerificationSessionSchema = new Schema(
  {
    tokenHash: { type: String, required: true, unique: true, select: false },
    readyTokenHash: { type: String, unique: true, sparse: true, select: false },
    mediaVersion: { type: Schema.Types.ObjectId, ref: 'MediaVersion', required: true, index: true },
    subtitle: { type: Schema.Types.ObjectId, ref: 'Subtitle', index: true },
    mirror: { type: Schema.Types.ObjectId, ref: 'DownloadMirror', index: true },
    providerType: { type: String, enum: ['direct', 'dotflix', 'telegram', 'backup', 'external', 'cloud_drive', 'custom'], required: true },
    clientKeyHash: { type: String, required: true, index: true, select: false },
    step1CompletedAt: Date,
    step2CompletedAt: Date,
    step3CompletedAt: Date,
    expiresAt: { type: Date, required: true, expires: 0, index: true },
  },
  { timestamps: true },
);
downloadVerificationSessionSchema.index({ mediaVersion: 1, expiresAt: 1 });

const renditionSchema = new Schema(
  {
    name: { type: String, required: true }, width: { type: Number, required: true, min: 2 }, height: { type: Number, required: true, min: 2 },
    videoBitrate: { type: Number, required: true, min: 1 }, audioBitrate: { type: Number, required: true, min: 0 },
    bandwidth: { type: Number, required: true, min: 1 }, averageBandwidth: { type: Number, required: true, min: 1 }, codecs: { type: String, required: true },
    playlistKey: { type: String, required: true }, segmentCount: { type: Number, required: true, min: 1 }, bytes: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const mediaStreamSchema = new Schema(
  {
    contentId: { type: Schema.Types.ObjectId, required: true, index: true },
    contentType: { type: String, enum: ['movie', 'episode'], required: true, index: true },
    masterAsset: { type: Schema.Types.ObjectId, ref: 'MediaAsset', required: true, index: true },
    profileVersion: { type: String, required: true, index: true },
    status: { type: String, enum: ['processing', 'ready', 'failed', 'deleting', 'deleted'], default: 'processing', index: true },
    prefix: { type: String, required: true, unique: true },
    manifestKey: String,
    renditions: [renditionSchema],
    source: {
      width: Number, height: Number, duration: Number, frameRate: Number, videoCodec: String, audioCodec: String,
      bitrate: Number, aspectRatio: String, audioStreams: [Schema.Types.Mixed], subtitleStreams: [Schema.Types.Mixed],
    },
    totalBytes: { type: Number, default: 0, min: 0 },
    segmentCount: { type: Number, default: 0, min: 0 },
    rightsStatus: rights,
    active: { type: Boolean, default: false, index: true },
    verifiedAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
mediaStreamSchema.index({ contentId: 1, contentType: 1, status: 1, active: 1 });
mediaStreamSchema.index({ masterAsset: 1, profileVersion: 1, createdAt: -1 });

const transcodeJobSchema = new Schema(
  {
    contentType: { type: String, enum: ['movie', 'episode'], required: true, index: true },
    contentId: { type: Schema.Types.ObjectId, required: true, index: true },
    masterAsset: { type: Schema.Types.ObjectId, ref: 'MediaAsset', required: true, index: true },
    masterObjectKey: { type: String, required: true },
    stream: { type: Schema.Types.ObjectId, ref: 'MediaStream', required: true, index: true },
    dedupeKey: { type: String, required: true, unique: true },
    profileVersion: { type: String, required: true },
    status: { type: String, enum: ['queued', 'processing', 'uploading', 'completed', 'failed', 'cancelled'], default: 'queued', index: true },
    source: {
      width: Number, height: Number, duration: Number, frameRate: Number, videoCodec: String, audioCodec: String,
      bitrate: Number, aspectRatio: String, audioStreams: [Schema.Types.Mixed], subtitleStreams: [Schema.Types.Mixed],
    },
    requestedRenditions: [{ type: String }],
    completedRenditions: [renditionSchema],
    progressPercent: { type: Number, default: 0, min: 0, max: 100 },
    currentStage: { type: String, default: 'queued' },
    startedAt: Date, completedAt: Date, failedAt: Date,
    errorCode: String,
    safeErrorMessage: { type: String, maxlength: 500 },
    attempts: { type: Number, default: 0, min: 0 },
    workerId: String,
    lockedAt: Date,
    cancellationRequestedAt: Date,
    language: String,
    defaultAudio: String,
    subtitleHandling: { type: String, enum: ['separate', 'ignore'], default: 'separate' },
    notes: { type: String, maxlength: 2_000 },
    keepMaster: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);
transcodeJobSchema.index({ status: 1, createdAt: 1 });
transcodeJobSchema.index({ status: 1, lockedAt: 1 });

const streamSessionSchema = new Schema(
  {
    tokenHash: { type: String, required: true, unique: true, select: false },
    mediaStream: { type: Schema.Types.ObjectId, ref: 'MediaStream', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    clientKeyHash: { type: String, required: true, index: true, select: false },
    expiresAt: { type: Date, required: true, expires: 0, index: true },
    lastAccessAt: { type: Date, required: true },
  },
  { timestamps: true },
);

const workerHeartbeatSchema = new Schema(
  {
    workerId: { type: String, required: true, unique: true },
    status: { type: String, enum: ['online', 'busy', 'stopping'], required: true },
    currentJob: { type: Schema.Types.ObjectId, ref: 'TranscodeJob' },
    progressPercent: { type: Number, min: 0, max: 100 },
    version: String,
    lastHeartbeatAt: { type: Date, required: true, index: true },
  },
  { timestamps: true },
);

const taxonomySchema = new Schema(
  { name: { type: String, required: true }, slug, description: String, localeNames: Schema.Types.Mixed, visible: { type: Boolean, default: true }, displayOrder: { type: Number, default: 0 } },
  { timestamps: true },
);

const collectionSchema = new Schema(
  { name: { type: String, required: true }, slug, description: String, posterKey: String, movieIds: [{ type: Schema.Types.ObjectId, ref: 'Movie' }], seriesIds: [{ type: Schema.Types.ObjectId, ref: 'Series' }], visible: { type: Boolean, default: true }, displayOrder: { type: Number, default: 0 } },
  { timestamps: true },
);

const commentSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }, targetType: { type: String, enum: ['movie', 'series', 'episode', 'subtitle'], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true }, parent: { type: Schema.Types.ObjectId, ref: 'Comment' }, body: { type: String, required: true, maxlength: 2_000 },
    status: { type: String, enum: ['visible', 'hidden', 'deleted'], default: 'visible', index: true }, likeCount: { type: Number, default: 0 }, editedAt: Date,
  },
  { timestamps: true },
);
commentSchema.index({ targetType: 1, targetId: 1, status: 1, createdAt: -1 });

const commentLikeSchema = new Schema(
  { user: { type: Schema.Types.ObjectId, ref: 'User', required: true }, comment: { type: Schema.Types.ObjectId, ref: 'Comment', required: true, index: true } },
  { timestamps: true },
);
commentLikeSchema.index({ user: 1, comment: 1 }, { unique: true });

const ratingSchema = new Schema(
  { user: { type: Schema.Types.ObjectId, ref: 'User', required: true }, targetType: { type: String, enum: ['movie', 'series', 'subtitle'], required: true }, targetId: { type: Schema.Types.ObjectId, required: true }, value: { type: Number, min: 1, max: 10, required: true } },
  { timestamps: true },
);
ratingSchema.index({ user: 1, targetType: 1, targetId: 1 }, { unique: true });

const watchlistSchema = new Schema(
  { user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true }, items: [{ contentType: { type: String, enum: ['movie', 'series'] }, contentId: Schema.Types.ObjectId, addedAt: { type: Date, default: Date.now } }] },
  { timestamps: true },
);

const progressSchema = new Schema(
  { user: { type: Schema.Types.ObjectId, ref: 'User', required: true }, contentType: { type: String, enum: ['movie', 'episode'], required: true }, contentId: { type: Schema.Types.ObjectId, required: true }, seconds: { type: Number, min: 0 }, duration: { type: Number, min: 0 }, completed: { type: Boolean, default: false }, lastViewedAt: { type: Date, default: Date.now } },
  { timestamps: true },
);
progressSchema.index({ user: 1, contentType: 1, contentId: 1 }, { unique: true });
progressSchema.index({ user: 1, lastViewedAt: -1 });

const subtitleSubscriptionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    contentType: { type: String, enum: ['movie', 'episode'], required: true, index: true },
    contentId: { type: Schema.Types.ObjectId, required: true, index: true },
    languageCode: { type: String, required: true, lowercase: true, trim: true, index: true },
  },
  { timestamps: true },
);
subtitleSubscriptionSchema.index({ user: 1, contentType: 1, contentId: 1, languageCode: 1 }, { unique: true });
subtitleSubscriptionSchema.index({ contentType: 1, contentId: 1, languageCode: 1, createdAt: -1 });

const subtitleRequestSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    contentType: { type: String, enum: ['movie', 'episode'], required: true, index: true },
    contentId: { type: Schema.Types.ObjectId, required: true, index: true },
    languageCode: { type: String, required: true, lowercase: true, trim: true, index: true },
    status: { type: String, enum: ['open', 'fulfilled', 'withdrawn'], default: 'open', index: true },
    fulfilledAt: Date,
    fulfilledBySubtitle: { type: Schema.Types.ObjectId, ref: 'Subtitle' },
  },
  { timestamps: true },
);
subtitleRequestSchema.index({ user: 1, contentType: 1, contentId: 1, languageCode: 1 }, { unique: true });
subtitleRequestSchema.index({ status: 1, languageCode: 1, createdAt: -1 });

const downloadEventSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', index: true }, kind: { type: String, enum: ['subtitle', 'media'], required: true, index: true },
    targetId: { type: Schema.Types.ObjectId, required: true, index: true }, contentId: Schema.Types.ObjectId,
    mediaVersion: { type: Schema.Types.ObjectId, ref: 'MediaVersion', index: true }, movie: { type: Schema.Types.ObjectId, ref: 'Movie', index: true },
    providerType: { type: String, enum: ['direct', 'external', 'telegram', 'cloud_drive', 'custom', 'subtitle'] },
    status: { type: String, enum: ['started', 'redirected', 'failed'], default: 'started', index: true },
    ipHash: String, countryCode: String, userAgentFamily: String, deviceCategory: { type: String, enum: ['mobile', 'tablet', 'desktop', 'unknown'], default: 'unknown' },
  },
  { timestamps: true },
);
downloadEventSchema.index({ kind: 1, createdAt: -1 });
downloadEventSchema.index({ mediaVersion: 1, createdAt: -1 });

const analyticsEventSchema = new Schema(
  {
    eventType: {
      type: String,
      enum: ['direct_download_started', 'mirror_click', 'dotflix_click', 'telegram_mirror_click', 'subtitle_download', 'whatsapp_share', 'facebook_share', 'telegram_share', 'copy_link', 'watch_started', 'watch_25_percent', 'watch_50_percent', 'watch_75_percent', 'watch_completed', 'quality_selected', 'data_saver_enabled', 'buffer_event'],
      required: true,
      index: true,
    },
    contentType: { type: String, enum: ['movie', 'series', 'episode', 'subtitle', 'page'], index: true },
    contentId: { type: String, trim: true, maxlength: 120, index: true },
    mediaVersion: { type: Schema.Types.ObjectId, ref: 'MediaVersion', index: true },
    mirror: { type: Schema.Types.ObjectId, ref: 'DownloadMirror', index: true },
    providerType: { type: String, trim: true, maxlength: 40, index: true },
    quality: { type: String, trim: true, maxlength: 20, index: true },
    durationSeconds: { type: Number, min: 0, max: 86_400 },
    path: { type: String, trim: true, maxlength: 500 },
    ipHash: { type: String, select: false },
    deviceCategory: { type: String, enum: ['mobile', 'tablet', 'desktop', 'unknown'], default: 'unknown' },
  },
  { timestamps: true },
);
analyticsEventSchema.index({ eventType: 1, createdAt: -1 });
analyticsEventSchema.index({ contentId: 1, createdAt: -1 });

const searchEventSchema = new Schema(
  { user: { type: Schema.Types.ObjectId, ref: 'User', index: true }, query: { type: String, required: true, index: true }, normalizedQuery: { type: String, required: true, index: true }, resultCount: { type: Number, min: 0 }, ipHash: String, locale: String },
  { timestamps: true },
);
searchEventSchema.index({ normalizedQuery: 1, createdAt: -1 });

const takedownSchema = new Schema(
  { requester: { type: String, required: true }, email: { type: String, required: true }, contentUrl: { type: String, required: true }, reason: { type: String, required: true }, status: { type: String, enum: ['new', 'reviewing', 'resolved', 'rejected'], default: 'new', index: true }, notes: String, resolution: String, resolvedAt: Date, assignedTo: { type: Schema.Types.ObjectId, ref: 'User' } },
  { timestamps: true },
);

const homepageSectionSchema = new Schema(
  { key: { type: String, required: true, unique: true }, title: { type: String, required: true }, type: { type: String, required: true }, enabled: { type: Boolean, default: true, index: true }, displayOrder: { type: Number, default: 0, index: true }, contentIds: [Schema.Types.ObjectId], settings: Schema.Types.Mixed },
  { timestamps: true },
);

const simpleSettingSchema = new Schema({ key: { type: String, required: true, unique: true }, value: Schema.Types.Mixed }, { timestamps: true });
const auditSchema = new Schema(
  { actor: { type: Schema.Types.ObjectId, ref: 'User', index: true }, action: { type: String, required: true, index: true }, entity: { type: String, required: true, index: true }, entityId: String, metadata: Schema.Types.Mixed, ipHash: String },
  { timestamps: true },
);
auditSchema.index({ entity: 1, entityId: 1, createdAt: -1 });

const reportSchema = new Schema(
  { reporter: { type: Schema.Types.ObjectId, ref: 'User' }, targetType: { type: String, required: true }, targetId: { type: Schema.Types.ObjectId, required: true }, reason: { type: String, required: true }, details: String, status: { type: String, enum: ['new', 'reviewing', 'resolved', 'rejected'], default: 'new', index: true }, assignedTo: { type: Schema.Types.ObjectId, ref: 'User' } },
  { timestamps: true },
);
const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true, index: true },
    category: { type: String, required: true, default: 'account', index: true },
    eventKey: { type: String, trim: true },
    payload: Schema.Types.Mixed,
    channels: [{ type: String, enum: ['in_app', 'web_push', 'email', 'telegram'] }],
    delivery: Schema.Types.Mixed,
    readAt: Date,
  },
  { timestamps: true },
);
notificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ user: 1, eventKey: 1 }, { unique: true, sparse: true });

const notificationPreferenceSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    subtitlePublished: {
      inApp: { type: Boolean, default: true }, webPush: { type: Boolean, default: false },
      email: { type: Boolean, default: false }, telegram: { type: Boolean, default: false },
    },
    episodePublished: { inApp: { type: Boolean, default: true }, webPush: { type: Boolean, default: false }, email: { type: Boolean, default: false }, telegram: { type: Boolean, default: false } },
    translatorPublished: { inApp: { type: Boolean, default: true }, webPush: { type: Boolean, default: false }, email: { type: Boolean, default: false }, telegram: { type: Boolean, default: false } },
    commentReply: { inApp: { type: Boolean, default: true }, webPush: { type: Boolean, default: false }, email: { type: Boolean, default: false }, telegram: { type: Boolean, default: false } },
    adminAnnouncement: { inApp: { type: Boolean, default: true }, webPush: { type: Boolean, default: false }, email: { type: Boolean, default: false }, telegram: { type: Boolean, default: false } },
  },
  { timestamps: true },
);

const contactMessageSchema = new Schema(
  { requester: { type: String, required: true }, email: { type: String, required: true }, message: { type: String, required: true }, status: { type: String, enum: ['new','reviewing','resolved'], default: 'new', index: true } },
  { timestamps: true },
);

const rateLimitSchema = new Schema(
  { keyHash: { type: String, required: true, index: true }, action: { type: String, required: true, index: true }, windowStart: { type: Date, required: true }, count: { type: Number, default: 1 }, expiresAt: { type: Date, required: true, expires: 0 } },
  { timestamps: true },
);
rateLimitSchema.index({ keyHash: 1, action: 1, windowStart: 1 }, { unique: true });

export const User = existingOrCreate('User', userSchema);
export const Session = existingOrCreate('Session', sessionSchema);
export const Movie = existingOrCreate('Movie', movieSchema);
export const Series = existingOrCreate('Series', seriesSchema);
export const Season = existingOrCreate('Season', seasonSchema);
export const Episode = existingOrCreate('Episode', episodeSchema);
export const Subtitle = existingOrCreate('Subtitle', subtitleSchema);
export const TranslatorProfile = existingOrCreate('TranslatorProfile', translatorSchema);
export const MediaAsset = existingOrCreate('MediaAsset', mediaAssetSchema);
export const MediaVersion = existingOrCreate('MediaVersion', mediaVersionSchema);
export const DownloadMirror = existingOrCreate('DownloadMirror', downloadMirrorSchema);
export const DownloadVerificationSession = existingOrCreate('DownloadVerificationSession', downloadVerificationSessionSchema);
export const MediaStream = existingOrCreate('MediaStream', mediaStreamSchema);
export const TranscodeJob = existingOrCreate('TranscodeJob', transcodeJobSchema);
export const StreamSession = existingOrCreate('StreamSession', streamSessionSchema);
export const WorkerHeartbeat = existingOrCreate('WorkerHeartbeat', workerHeartbeatSchema);
export const Genre = existingOrCreate('Genre', taxonomySchema);
export const Language = existingOrCreate('Language', taxonomySchema.clone());
export const Collection = existingOrCreate('Collection', collectionSchema);
export const Comment = existingOrCreate('Comment', commentSchema);
export const CommentLike = existingOrCreate('CommentLike', commentLikeSchema);
export const Rating = existingOrCreate('Rating', ratingSchema);
export const Watchlist = existingOrCreate('Watchlist', watchlistSchema);
export const ViewingProgress = existingOrCreate('ViewingProgress', progressSchema);
export const SubtitleSubscription = existingOrCreate('SubtitleSubscription', subtitleSubscriptionSchema);
export const SubtitleRequest = existingOrCreate('SubtitleRequest', subtitleRequestSchema);
export const DownloadEvent = existingOrCreate('DownloadEvent', downloadEventSchema);
export const AnalyticsEvent = existingOrCreate('AnalyticsEvent', analyticsEventSchema);
export const SearchEvent = existingOrCreate('SearchEvent', searchEventSchema);
export const TakedownRequest = existingOrCreate('TakedownRequest', takedownSchema);
export const SiteSetting = existingOrCreate('SiteSetting', simpleSettingSchema);
export const HomepageSection = existingOrCreate('HomepageSection', homepageSectionSchema);
export const AuditLog = existingOrCreate('AuditLog', auditSchema);
export const Report = existingOrCreate('Report', reportSchema);
export const Notification = existingOrCreate('Notification', notificationSchema);
export const NotificationPreference = existingOrCreate('NotificationPreference', notificationPreferenceSchema);
export const ContactMessage = existingOrCreate('ContactMessage', contactMessageSchema);
export const RateLimitEvent = existingOrCreate('RateLimitEvent', rateLimitSchema);

export const cineSeyaModels = [
  User, Session, Movie, Series, Season, Episode, Subtitle, TranslatorProfile, MediaAsset, MediaVersion, DownloadMirror, DownloadVerificationSession,
  MediaStream, TranscodeJob, StreamSession, WorkerHeartbeat, Genre, Language,
  Collection, Comment, CommentLike, Rating, Watchlist, ViewingProgress, SubtitleSubscription, SubtitleRequest, DownloadEvent, AnalyticsEvent, SearchEvent, TakedownRequest, SiteSetting,
  HomepageSection, AuditLog, Report, Notification, NotificationPreference, ContactMessage, RateLimitEvent,
];

export async function ensureCineSeyaIndexes() {
  await Promise.all(cineSeyaModels.map((model) => model.createIndexes()));
}

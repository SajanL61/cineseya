# CineSeya adaptive streaming architecture

## Separation of responsibilities

Streaming and direct downloads are intentionally different products:

- A streaming **master** is a private `MediaAsset` under `masters/movies/<movieId>/<assetId>/`. It creates a `TranscodeJob` and is never exposed to a browser as a public URL.
- A ready `MediaStream` points to a private HLS package under `streams/movies/<movieId>/<streamId>/`. It owns the adaptive manifest and rendition metadata.
- A direct download remains an independent `MediaVersion` under `downloads/movies/...`, with its exact size, codec, release type, mirrors, and secure download workflow. HLS segments are never offered as movie downloads.
- MongoDB contains metadata, state, object keys, and short-lived session hashes only. Video bytes remain in Cloudflare R2.

The Next.js service signs uploads and queues work. It never runs FFmpeg in a request. `scripts/transcode-worker.ts` is the only FFmpeg process and must run as a separate Render background worker.

## Processing lifecycle

1. An administrator with `media.upload` uploads MP4, MKV, MOV, or WEBM directly from the browser to private R2 using the existing multipart endpoints.
2. The API rechecks the title rights and creates one deduplicated job for the master asset and `TRANSCODE_PROFILE_VERSION`.
3. A worker atomically claims the oldest queued job. A stale 15-minute lock can be recovered; two workers cannot claim the same job.
4. `ffprobe` verifies the real video stream, dimensions, duration, frame rate, codec, audio/subtitle streams, aspect ratio, and bitrate. The filename and administrator-entered labels are not trusted.
5. Profiles at or below the source height are selected. A 720p source receives 360p, 480p, and 720p only. Sources below 480p retain their source height.
6. FFmpeg emits H.264 Main/yuv420p video, AAC audio, aligned keyframes, six-second MPEG-TS segments, and VOD playlists. The configured targets are 600 kbps (360p), 900 kbps (480p), 2 Mbps (720p), and 4 Mbps (1080p).
7. The worker writes a master playlist with configured `BANDWIDTH`, `AVERAGE-BANDWIDTH`, `RESOLUTION`, and `CODECS`, uploads the complete package with correct MIME types, verifies `master.m3u8` in R2, and only then marks the stream ready.
8. Temporary input/output is removed in `finally` after success, failure, or cancellation. Partial uploaded stream packages are removed after failure; the source master is retained by default.

Progress writes are throttled to at most once every three seconds. The database stores a short safe error and error code, never raw FFmpeg command lines or large logs.

## Secure playback

The movie page exposes Watch Online only for a ready stream whose title and stream both have `owned`, `licensed`, or `public_domain` rights. The player bootstraps an opaque `StreamSession` through a same-origin, rate-limited endpoint. The session is bound to a random HttpOnly/SameSite client cookie, so a copied stream token is not sufficient while legitimate mobile viewers can move between Wi-Fi and cellular networks without an IP-binding failure. Only hashes are stored in MongoDB.

The browser requests `/api/stream/<token>/master.m3u8`. Every manifest and segment request verifies the session, client fingerprint, expiry, ready state, and path scope before proxying the private R2 object. No R2 credentials or permanent signed URLs appear in playlists. Published SRT subtitles are converted to WebVTT at delivery time while their original SRT downloads remain unchanged.

The player uses native HLS when available and dynamically loads `hls.js` otherwise. Auto is the default. Mobile starts conservatively, Data Saver caps automatic selection at 480p (with 360p fallback), and manual selection disables the cap. Estimates beside quality choices are calculated from manifest bitrates and are labelled estimates.

## Local development

Node.js does not install FFmpeg. Install `ffmpeg` and `ffprobe` separately and make both commands available on `PATH`. The worker fails visibly at startup if either is missing; it never downloads executables at runtime.

Use a short, legally distributable 60-second sample first:

```powershell
$env:TRANSCODE_WORKER_ENABLED='true'
npm.cmd run worker:transcode:local
```

Run the web service separately with `npm run dev`. Local FFmpeg was not present when this implementation was validated, so a real encode remains an operator test.

## Render background worker

`render.yaml` declares `cineseya-transcoder` as a separate Node background worker. Render's current native runtime includes FFmpeg at build and runtime. The service polls MongoDB and receives no public traffic.

- Build: `npm ci`
- Start: `npm run worker:transcode`
- Initial concurrency: `1`
- Graceful shutdown allowance: `300` seconds
- Temporary storage: ephemeral `TRANSCODE_TEMP_DIR`; provision enough free space for the downloaded master plus all generated HLS output.

Copy the existing `MONGODB_URI`, R2 account credentials, endpoint, and current media bucket into the worker's secret environment. Keep `MONGODB_DB=cinerusubs`. Do not rename a populated R2 bucket without migrating its objects, and do not enable `TRANSCODE_WORKER_ENABLED` on the web service.

Before synchronizing the Blueprint, review the worker plan's CPU, RAM, ephemeral-disk capacity, and cost. Start with one worker and one FFmpeg process. The repository does not deploy or start the production worker automatically.

## Production acceptance test

1. Run `npm run sync-indexes` after deployment.
2. Upload one authorized 60-second 1080p sample from a movie's Streaming panel.
3. Confirm master upload, atomic job claim, ffprobe metadata, four renditions, manifest verification, and a recent worker heartbeat in Admin → Transcoding.
4. Confirm Auto, forced 480p, Data Saver, forced 1080p, seeking, network fallback without restart, and selectable Sinhala WebVTT.
5. Change title rights to `subtitle_only` and confirm a new watch session is denied.
6. Test a larger file only after monitoring CPU, memory, temporary disk, processing time, and R2 request/storage usage for the sample.

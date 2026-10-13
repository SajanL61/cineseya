# Download and storage architecture

## Storage boundaries

`cineseya-media` is private and contains full video files, HLS manifests/segments, and subtitle files. `cineseya-assets` contains posters, backdrops, avatars, and other presentation assets. Every `MediaAsset` stores its bucket and object key; every `MediaVersion` binds its direct file to the media bucket. Public API responses omit object keys, bucket credentials, mirror target URLs, and presigned R2 URLs.

Object keys are generated on the server from a sanitized basename and random UUID:

```text
media/movies/<content-id>/<uuid>/<safe-file-name>
media/episodes/<content-id>/<uuid>/<safe-file-name>
subtitles/movies/<content-id>/<uuid>-<safe-file-name>
posters/movies/<content-id>/<uuid>-<safe-file-name>
```

The uploader uses single-part presigned `PUT` for small files and 100 MiB multipart parts for files over 500 MiB. The admin interface reports percent, speed, ETA, and current part; it can pause between parts, resume, retry a failed part three times, or abort the multipart upload. Completion checks R2 metadata before creating the asset record.

## Direct-download sequence

1. A title page receives safe media-version and mirror metadata only.
2. The user opens the quality-grouped download modal and selects CineSeya Direct or a real configured mirror.
3. `/api/download/verify/file` checks live rights, the active asset, file size, object availability, or the selected mirror's server-side health result. It stores only a hash of the opaque 10-minute verification token.
4. `/api/download/verify/security` enforces step order, client binding, same-origin policy, rate limits, and Cloudflare Turnstile when configured.
5. `/api/download/verify/generate` repeats rights, media, asset, deletion, and server checks before issuing an opaque ready-page reference.
6. The ready page calls `/api/download/<media-version-id>` only after all steps. That endpoint reloads authorization and creates a 90-second AES-256-GCM payload with an HMAC-SHA-256 signature.
7. `/api/download/file/<token>` verifies and decrypts the token, repeats live authorization and object-scope checks, increments counters, and records the event.
8. With `DOWNLOAD_WORKER_ENABLED=false`, the gateway redirects to a short-lived R2 attachment URL. With the Worker enabled, it redirects to `${DOWNLOAD_DOMAIN}/v1/files/<token>`; the Worker verifies signature, expiry, media-bucket scope, and object key, then streams the R2 object with `GET`, `HEAD`, byte-range, `206`, `Content-Range`, and `Accept-Ranges` support.

Tokens carry no credentials. They expire quickly, are scoped to one bucket/key/version, and are sent only through no-store pages and responses. Rotating `DOWNLOAD_SIGNING_SECRET` invalidates outstanding tokens.

## Mirrors and health

Mirror target URLs remain server-side. Public responses expose provider metadata and a verification-page path. The final redirect requires a completed verification session, reloads version/title state, checks distribution rights, validates the destination again, rate-limits, records the provider click, and then redirects. Admins may add, prioritize, enable, disable, delete, edit, reorder, and health-check HTTPS mirrors. URL validation rejects embedded credentials, localhost, loopback, link-local, private IPv4/IPv6 targets, metadata services, and DNS names resolving to private addresses.

## HLS playback

When `streamingManifestKey` is present, the watch service prefers HLS and the client uses native HLS or `hls.js`. The player exposes automatic/manual quality, multiple audio tracks, subtitles, volume, speed, picture-in-picture, fullscreen, progress sync, and keyboard controls (Space, left/right arrows, M, F). A direct MP4/WebM file remains an authorized fallback.

For production HLS, manifests and every referenced segment must be delivered through an authorization-aware media gateway or contain separately authorized URLs. Signing only a private master-manifest object does not authorize relative R2 segment requests.

## Deletion lifecycle

Disabling a version removes it from public selection without deleting bytes. Deletion marks the version/asset `pending_deletion`; cleanup should run only after retention and reference checks. The storage dashboard shows both buckets, object counts/bytes by kind, growth windows, largest files, recent uploads, database records missing objects, and unreferenced objects. Never bulk-delete audit findings without manual review and a recoverable backup.

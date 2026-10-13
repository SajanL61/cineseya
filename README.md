# CineSeya

CineSeya is a Next.js movie, TV-series, and subtitle discovery platform with Sinhala-first subtitle support, authorized-media playback/downloads, an editorial admin system, and private Cloudflare R2 storage workflows.

The application is a complete migration of the former clothing-store repository. The preserved baseline is available on the Git branch `backup/clothing-store-baseline`; production code uses only the isolated MongoDB database `cinerusubs`.

## Stack

- Next.js 16.3 App Router, React 19.3, and TypeScript
- Tailwind CSS 4 plus a token-driven cinematic component layer
- MongoDB Atlas and Mongoose
- Two private Cloudflare R2 buckets, multipart uploads, short-lived encrypted download tokens, and an optional range-aware download Worker
- Argon2id passwords, opaque database sessions, CSRF protection, granular RBAC, and audit logs
- Vitest and Playwright browser smoke tests

## Local setup

Install Node.js 22 or newer, then:

```powershell
Copy-Item .env.example .env
npm.cmd ci
npm.cmd run dev
```

Open `http://localhost:4001`. With no `MONGODB_URI`, or with `CINESEYA_DEMO_MODE=true`, public pages use the bundled editorial demo catalog; accounts, admin, uploads, and downloads require MongoDB.

For a database-backed installation, create a MongoDB user restricted to the `cinerusubs` database, configure `.env`, and run:

```powershell
npm.cmd run seed
$env:SUPER_ADMIN_NAME='Site Administrator'
$env:SUPER_ADMIN_EMAIL='admin@example.com'
$env:SUPER_ADMIN_PASSWORD='a unique 16+ character password'
npm.cmd run create-super-admin
Remove-Item Env:SUPER_ADMIN_PASSWORD
npm.cmd run dev
```

The admin sign-in is `/admin/login`. Seeded subtitle metadata remains in draft until a real R2 file is uploaded and verified.

## Verification

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
node tests/public-browser-smoke.mjs
```

## Production requirements

Set every required value in `.env.example`. Production startup fails closed when MongoDB, R2 credentials, HTTPS site URL, or independent secure secrets are missing. The database name must remain exactly `cinerusubs`.

The production web service uses `https://cineseya.lk` as its canonical origin. `render.yaml` declares `cineseya.lk` as the custom domain; connect and verify its DNS in Render before disabling the legacy Render subdomain.

The platform enforces rights at both presentation and data-delivery boundaries. Full media is available only when both the title and media version are active and marked `owned`, `licensed`, or `public_domain`. `subtitle_only` and `unavailable` titles expose metadata, trailers, community features, and subtitle downloads only.

Keep the configured media bucket private. New installations can use `cineseya-media` and `cineseya-assets`; existing bucket names must stay unchanged until their objects are deliberately migrated. Configure upload CORS for the exact site origin, expose only intentionally public artwork through `https://assets.cineseya.lk`, and route protected file traffic through the configured `DOWNLOAD_DOMAIN` or the built-in token-validated route. Never expose R2 credentials through `NEXT_PUBLIC_*` variables.

See [operations](docs/OPERATIONS.md), [feature audit and Phase A result](docs/FEATURE_AUDIT_PHASE_A.md), [adaptive streaming architecture](docs/STREAMING_ARCHITECTURE.md), [download architecture](docs/DOWNLOAD_ARCHITECTURE.md), [SmartReact protection](docs/SMARTREACT_PROTECTION.md), [migration audit](docs/MIGRATION_AUDIT.md), and [environment template](.env.example) for deployment and security details.

## Main routes

- Public: `/`, `/movies`, `/tv`, `/subtitles`, `/discover`, `/search`, `/watchlist`, `/translator/[slug]`, and `/profile/notifications`
- Accounts: `/login`, `/register`, `/profile`
- Protected media: `/watch/[mediaId]`, branded `/download/[mediaId]`, and token issuance at `/api/download/[mediaVersionId]`
- Admin: `/admin` and the content, subtitle-request, media, user, moderation, analytics, legal, settings, and audit sections beneath it
- Health: `/api/health`

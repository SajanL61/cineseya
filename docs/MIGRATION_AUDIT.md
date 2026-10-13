# CineSeya migration audit

Date: 2026-10-05  
Baseline commit: `287c3e8`  
Baseline branch: `backup/clothing-store-baseline`  
Migration branch: `migration/cineseya`

Premium delivery backup: `backup/pre-premium-download-upgrade-20261008`
Premium delivery branch: `upgrade/premium-downloads`

## Source architecture

The baseline is a same-origin React 19/Vite SSR application served by Express 5 with Mongoose and MongoDB. Public routing is implemented by manual pathname checks. Admin authentication uses Argon2id, hashed database sessions, an HTTP-only same-site cookie, per-session CSRF tokens, permission checks, rate limiting, and audit records. Render configuration starts a web process and a reservation-expiry worker.

## Reuse map

- Authentication security properties, session invalidation, password hashing, CSRF design, and permission checks.
- Mongo connection/config validation, Zod request validation, safe API error responses, transaction/idempotency patterns, and audit logging.
- Responsive admin navigation, tables, dialogs, loading/empty/error states, safe managed-content rendering, and Lucide icon consistency.
- SSR metadata, robots/sitemap, responsive browser checks, and deployment documentation patterns.

## Retirement map

Product variants, inventory, orders, reservations, payments, coupons, delivery zones, returns, cart, checkout, order tracking, pricing, COD/bank transfer, commerce workers, commerce tests, and STYLEHUB branding are retired only after their CineSeya replacements pass the applicable phase gate.

## Data isolation

CineSeya always connects with the explicit database name `cinerusubs`. It does not rename, migrate into, or reuse the `clothing_store` database. Administrator accounts are recreated through a one-time command. Commerce customer and order data are not copied.

## Phase gates

1. Next.js/Tailwind runtime, data models, rights policy, public discovery UI.
2. Authentication, RBAC, administrative CRUD and moderation.
3. R2 uploads, validation, storage inventory and controlled downloads.
4. User library, comments, ratings, translator profiles, player/progress and analytics.
5. SEO, i18n, PWA, security review, automated/browser validation and legacy removal.

Each phase requires install integrity, lint, typecheck, tests, production build, and visual checks appropriate to the work completed.

The premium delivery upgrade adds strict live database-name verification, explicit SmartReact rejection, separate media/assets R2 buckets, structured storage keys, media versions and mirrors, multipart admin upload controls, an opaque token download gateway, an optional range-aware Cloudflare Worker, a branded preparation page, an availability-aware download modal, two-bucket storage reporting, and adaptive HLS player controls. External Atlas/R2/domain claims remain deployment checks rather than repository test claims.

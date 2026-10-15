# CineSeya Google Search setup

Production search identity is fixed to `https://cineseya.lk`. The application emits canonical URLs, sitemap URLs, structured data, icons, and social previews from that origin. `www.cineseya.lk` and the legacy `cinerusubs.onrender.com` host are permanently redirected by Next.js while preserving the path and query string.

## 1. Production environment

Set these values on Render, then deploy the latest commit:

```env
NEXT_PUBLIC_SITE_URL=https://cineseya.lk
NEXT_PUBLIC_SITE_NAME=CineSeya.lk
GOOGLE_SITE_VERIFICATION=google-provided-verification-token
```

Keep `MONGODB_DB=cinerusubs`. The SEO implementation does not rename or migrate the database and does not expose R2 media keys or signed URLs.

At Cloudflare, keep the apex domain proxied and redirect HTTP to HTTPS. The application handles the known alternate hosts, but an edge redirect from `www` to the apex is also recommended so the redirect happens before Render. Do not create a blanket user-agent bypass for Googlebot. If a WAF rule affects crawlers, use Cloudflare Verified Bots or Google IP verification rather than trusting a spoofable user-agent string.

## 2. Google Search Console

1. Add a **Domain property** for `cineseya.lk`.
2. Verify it with the DNS TXT record Google provides. The environment token is an additional HTML-tag verification method, not a replacement for Domain-property DNS verification.
3. Submit `https://cineseya.lk/sitemap.xml` under **Sitemaps**.
4. Inspect the homepage and one published movie, TV series, episode, subtitle language page, and translator page with **URL inspection**.
5. Request indexing only after the live URL returns `200`, the declared canonical is the same apex URL, and rendered HTML contains the expected content.

Search Console discovery, crawling, processing, and search presentation are controlled by Google. Deployment cannot guarantee immediate indexing, sitelinks, a particular favicon, or a specific ranking.

## 3. Validation checklist

After every SEO-related deployment:

- Open `/robots.txt`; confirm the host and sitemap use `https://cineseya.lk` and public assets are not blocked.
- Open `/sitemap.xml`; confirm it contains only published public movies, series, episodes, subtitle-language pages, and translators with published work.
- Confirm `/admin`, `/profile`, `/watch`, `/download`, `/login`, `/register`, `/search`, and `/watchlist` are absent from the sitemap and use noindex metadata where they render HTML.
- Inspect page source, not only the browser DOM, for the title, description, canonical, Open Graph tags, Twitter tags, and JSON-LD.
- Test the homepage `Organization` and `WebSite` JSON-LD, movie `Movie` JSON-LD, series `TVSeries` JSON-LD, episode `TVEpisode` JSON-LD, translator `ProfilePage`/`Person` JSON-LD, and breadcrumbs with Google Rich Results Test and Schema.org Validator.
- Confirm structured data contains no fabricated rating, review, address, phone number, or social profile.
- Confirm schema images use public HTTPS URLs and never contain R2 API hosts, object keys, signed query parameters, or private media URLs.
- Request `/favicon.ico`, `/icon-48.png`, `/icon-192.png`, `/icon-512.png`, `/apple-touch-icon.png`, and `/og-default.png` directly and confirm `200` responses.
- Test permanent redirects for the `www` and legacy Render hosts while preserving paths and query strings.
- Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.

## 4. Favicon and site-name refresh

Google may retain an older favicon or site label after deployment. Keep the icon files and homepage identity stable, use URL inspection to request a homepage recrawl, and allow time for Google to recrawl and reprocess the site. Avoid changing icon paths between releases.

## 5. Official identity links

Only URLs saved under **Admin → Settings → Social & Community** are included in homepage Organization `sameAs`. Add only official profiles controlled by CineSeya. Leaving a field blank is safer than publishing an unverified profile.

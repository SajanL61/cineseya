# CineSeya Feature Audit and Phase A Upgrade

Audit date: 2026-10-13
Scope: existing `CineSeya` repository only
Database boundary: MongoDB remains `cinerusubs`; `SmartReact` is not accessed or modified.

## Pre-implementation audit

| # | Area | Status before Phase A |
|---:|---|---|
| 1 | Sinhala-first discovery | PARTIAL |
| 2 | Notify Me for Sinhala subtitle | MISSING |
| 3 | Subtitle requests | MISSING |
| 4 | Verified translators | PARTIAL |
| 5 | Subtitle quality/version system | PARTIAL |
| 6 | Continue Watching | PARTIAL |
| 7 | Next episode experience | MISSING |
| 8 | Personalized home | MISSING |
| 9 | Recommendation engine | MISSING |
| 10 | Watched status/movie diary | PARTIAL |
| 11 | User lists | MISSING |
| 12 | Editorial lists | PARTIAL |
| 13 | User stats/year in review | MISSING |
| 14 | Legal where-to-watch | MISSING |
| 15 | Advanced discover | PARTIAL |
| 16 | Search experience | PARTIAL |
| 17 | Search analytics | PARTIAL |
| 18 | Notification foundation | PARTIAL |
| 19 | Web push | MISSING |
| 20 | PWA | PARTIAL |
| 21 | Adaptive HLS/Data Saver architecture | EXISTS |
| 22 | Estimated data usage | EXISTS |
| 23 | Player improvements | PARTIAL |
| 24 | Subtitle styling | MISSING |
| 25 | Download/mirror reliability | PARTIAL |
| 26 | File trust information | PARTIAL |
| 27 | Social publishing | PARTIAL |
| 28 | Social share | EXISTS |
| 29 | Community | PARTIAL |
| 30 | Activity feed | MISSING |
| 31 | Homepage sections | PARTIAL |
| 32 | Movie page | PARTIAL |
| 33 | TV series page | PARTIAL |
| 34 | Cast/person page | PARTIAL |
| 35 | TMDb importer | PARTIAL |
| 36 | Internationalization | MISSING |
| 37 | SEO structured data/sitemaps | PARTIAL |
| 38 | Google discovery | PARTIAL |
| 39 | Performance | PARTIAL |
| 40 | Mobile performance | PARTIAL |
| 41 | Accessibility | PARTIAL |
| 42 | Ads | MISSING |
| 43 | Optional membership architecture | MISSING |
| 44 | Trust/legal controls | PARTIAL |
| 45 | Content status | PARTIAL |
| 46 | Most requested subtitles | MISSING |
| 47 | Admin publish workflow | PARTIAL |
| 48 | Admin operational dashboard | PARTIAL |
| 49 | Content quality score | MISSING |
| 50 | Observability | PARTIAL |
| 51 | Uptime guidance | EXISTS |
| 52 | Backup guidance | EXISTS |
| 53 | Security controls | EXISTS |
| 54 | Privacy self-service | MISSING |

The detailed evidence behind these classifications is in the corresponding models, services, routes, pages, components, PWA files, security configuration, and operations documentation reviewed before implementation.

## Required pre-change report

1. Existing strengths: secure adaptive HLS/Data Saver, estimated bitrate usage, separate protected downloads, viewing-progress persistence, notification storage/page, search-event storage, translator profiles, PWA shell, canonical sharing, rights enforcement, and security controls.
2. Partial areas: search, progress UX, translator/subtitle quality UI, discover, notification delivery, PWA, SEO, accessibility, admin operations, and independent rights controls.
3. Missing high-value areas: subtitle subscriptions/requests, publication-triggered notifications, Continue Watching UI, next-episode UX, recommendations, diary/lists/stats, legal availability, push, localization, ads, and privacy self-service.
4. Duplicate work avoided: HLS worker/session security, Data Saver, progress persistence, existing Notification/SearchEvent models, share system, PWA shell, and direct/mirror download architecture were extended rather than replaced.
5. Database changes: subtitle subscription/request collections with compound unique indexes; notification preferences, channel metadata, and idempotency; optional alternative title/search alias fields. No database rename.
6. API changes: authenticated subtitle-interest mutations, privacy-minimized search event capture, live trending searches, and existing publish-route notification dispatch.
7. UI changes: subtitle interest controls, request count, admin demand queue, Continue Watching, episode navigation/countdown, fuzzy result types, highlighting, and working keyboard selection.
8. Security: existing session/CSRF checks, same-origin enforcement, rate limits, content/ObjectId validation, canonical links, private R2 behavior, and idempotent notifications remain enforced.
9. Highest-value phase: subtitle alerts/requests/real notifications, then Continue Watching/next episode, then Sinhala/fuzzy search.
10. Estimated risk: medium. Additive schemas are low risk; publication side effects and playback navigation are medium risk; bounded fuzzy search is medium risk and should be monitored as the catalog grows.

## Phase A result

- `SubtitleSubscription` and `SubtitleRequest` are implemented with the required unique key (`user + contentType + contentId + languageCode`). Requests use idempotent upserts and automatically subscribe the requester.
- Publishing a Sinhala subtitle fulfills matching open requests and creates one idempotent in-app notification per subscriber/requester. Web push, email, and Telegram are represented as preference/delivery channels but intentionally have no unofficial delivery implementation.
- Movie and episode pages show Notify Me and Request Sinhala Subtitle only while Sinhala subtitles are unavailable.
- Admin has an aggregated request queue with Most Requested, Newest, and Upcoming ordering.
- Homepage Continue Watching uses existing `ViewingProgress`, exact resume positions, licensed playable media, progress bars, and time remaining.
- Episode detail/player paths provide previous/next controls. The ten-second transition is triggered only by the media `ended` event and respects the locally stored autoplay preference; pause/resume never navigates.
- Existing adaptive HLS, Data Saver, manual quality, estimates, and direct-download separation were retained without duplication.
- Search now considers canonical/original/Sinhala/alternative titles, curated transliteration aliases, cast, crew, genres, country, language, translator, and year; a bounded fuzzy scorer tolerates small misspellings.
- Overlay Up/Down/Enter navigation now works, matched substrings are highlighted, and production trending terms come from privacy-minimized `SearchEvent` aggregates rather than a hardcoded list.

## Deferred after Phase A

Phases B–D remain deliberately separate changes: recommendations/personalization, diary/lists/follows/discover expansion, legal provider availability, social publishing, real web push, user statistics, complete localization, SEO expansion, ad settings, external monitoring, and privacy self-service.

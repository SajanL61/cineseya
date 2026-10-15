# CineSeya AdSense operations

The integration is delivered in mock-preview mode with the master request switch off. Mock boxes are non-clickable and do not load Google code. Live serving must not be enabled until every item below is complete and the owner has explicitly approved activation.

## Values the owner must copy from AdSense

- The real publisher ID in `ca-pub-0000000000000000` format.
- One numeric display ad-unit ID for each placement that will be enabled.
- The exact ads.txt seller record supplied by AdSense. CineSeya derives Google's standard `google.com, pub-…, DIRECT, f08c47fec0942fa0` record from the configured publisher ID; compare it with the account before publishing it.
- The real site status from AdSense. A CineSeya checkbox records that the owner checked the account; it is not Google approval.

Never paste JavaScript or HTML into Ad Management. The application accepts only validated IDs, hostnames, route rules, review records and ads.txt seller records.

## Dashboard and consent setup

1. Add and verify `cineseya.lk` in AdSense using a supported verification method. Verification is separate from serving live ads.
2. Create responsive display units for only the placements you intend to enable.
3. Keep Auto ads off. CineSeya uses manual placements, and its local acknowledgement cannot change the AdSense dashboard.
4. In AdSense, open **Privacy & messaging**, configure and publish the required messages, including the EEA, UK and Switzerland flow. Confirm that the chosen CMP is Google-certified and uses the required TCF integration.
5. Test consent, rejection, revocation, and the footer **Privacy and cookie settings** control. Do not invent or override consent signals.
6. In CineSeya **Admin → Ad Management**, configure IDs, hosts, the CMP, ads.txt, placements, exclusions and exact page reviews. Keep the master switch off while testing.
7. Verify production CSP reports and browser console output on the real deployment. The policy intentionally uses a narrow nonce-based Google allowlist; if Google changes a required endpoint, review Google's current CSP guidance before changing it. Do not add blanket wildcards.
8. Only after owner approval, select Live, turn on the master switch, read the confirmation and save.

## Editorial review

Every live page needs an exact route review. The primary publisher-content language is separate from movie audio, subtitle language and navigation language. Sinhala is not currently on Google's supported publisher-language list, so Sinhala-dominant pages must be marked unsupported or excluded. Do not relabel or rewrite Sinhala content to bypass this rule.

Movie editorial placements require substantial original commentary. Imported or duplicated descriptions do not qualify merely because an administrator checks a box; the checkbox records an editorial decision and must reflect the actual page.

## Placements and current availability

- `HOME_AFTER_TRENDING`: mock-enabled after the complete Trending Now section.
- `HOME_AFTER_TOP_RATED`: mock-enabled after the complete Top Rated section.
- `MOVIE_EDITORIAL`: disabled initially; requires substantial original editorial content and an exact review.
- `MOVIE_SIDEBAR`: disabled initially; desktop only at 1200px or wider and non-sticky.
- `SUBTITLE_AFTER_NOTES`: disabled because CineSeya currently has no standalone subtitle detail route with substantial notes.
- `COLLECTION_MID`: disabled because CineSeya currently has no genuinely curated public collection route.

No placements exist on admin, authentication, accounts, watch/player, download verification, search, legal/forms, empty/error, unpublished, or Sinhala-dominant pages.

## ads.txt verification

1. Enable the derived Google seller line only after comparing it with AdSense.
2. Preserve other legitimate seller records in the additional entries field.
3. Open `https://cineseya.lk/ads.txt` without signing in. It must return HTTP 200 and `text/plain`.
4. Confirm that the `pub-` identifier matches the configured `ca-pub-` identifier exactly.
5. Use the AdSense ads.txt status after Google recrawls the root domain. Crawling and status updates are not immediate.

## Rollback

Open **Admin → Ad Management**, turn off **Master switch: allow new live ad requests**, and save. This prevents new CineSeya ad requests. Ads already rendered in open tabs may remain until those documents are closed or navigated away. If the admin is unavailable, disable live serving in AdSense and redeploy with the stored advertising setting changed to disabled through an audited maintenance procedure.

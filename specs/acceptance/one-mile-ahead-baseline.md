---
title: One Mile Ahead — baseline acceptance criteria
status: draft
created: 2026-10-02
baseline-commit: 04bf5b05e412d9c2b7c0d16b287a09a6d8d8b15a
tldr: "Acceptance criteria recovered from the app as imported at 04bf5b0, in the SpecDLC form (alias, polarity, claim, falsifier). Each one carries the reading taken at that commit: passed against a named check, refuted with a witness, or no check yet. Open-intent items record current behaviour the owner has not confirmed. Cloudflare criteria are platform-bound and refine one portable hosting criterion."
---

# One Mile Ahead — baseline acceptance criteria

## How to read this

The form follows `SpecDLC-Research/specs/event-vocabulary.md` (§3.5 aliases, §5.1 AC fields, §6 verdicts) and the AC table in `specs/verdict-runner.md`.

- **Alias** is `OMA-KIND-CAT-N`. `KIND` is `FUNC`, `UX`, `SEC`, `TECH` or `DATA`.
- **Polarity** is `obligation` (always holds), `prohibition` (never happens) or `possibility` (can be made to happen). A system that does nothing satisfies every prohibition, so each prohibition names the AC it pairs with.
- **Level** is `portable` unless the section says `bound`. Portable ACs hold on any static host. Bound ACs name Cloudflare Workers static assets and refine `OMA-TECH-HOST-1`.
- **Reading at 04bf5b0** uses the vocabulary's verdict values. Where a later fix changed the reading, the row says so:
  - `passed` cites the checks it rests on.
  - `refuted` gives a witness that someone else can reproduce.
  - `no check` means no check exists yet, so there is no verdict.

  These are review readings. No ledger exists for this project and nothing was appended.
- **Independence.** Every `passed` below rests on tests that the app's own implementer wrote, so under the research's independence principle these are the weakest grade of evidence. Tags such as `[AC:HOOK-02]` are the test-name tags already in the repo. The specs those tags point at are not in the repo (see the review, §5).

Readings were taken with `npm test` (229 tests, all passing), `npm run typecheck`, `npm run build`, `npm run lint`, and a Chromium run of the production build against a three-marker synthetic dataset. The real dataset was not available at first, so ACs that depend on it were marked `not_judgeable`. **Update, 2026-10-02:** the owner then supplied the 2026-02-28 `markers.json`. It showed that the map, Nearby and Get Directions were wrong for 88% of real markers (`OMA-DATA-PIPE-2`), so the `passed` readings below for `OMA-FUNC-NEAR-1`, `OMA-FUNC-MAP-1` and `OMA-FUNC-DETAIL-2` held only on synthetic or unit-test data until that fix. With the corrected data and the research files, all 36 e2e runs pass at f3afca8 (18 tests on Chromium and Mobile Chrome), including Learn More and Nearby at the Alamo; `npm test` passed 240 tests in the same run.

**Done when:**
- every AC in sections 1–8 has a `passed` reading from a check the implementer did not write, or the owner has explicitly retired it;
- every `refuted` AC is fixed, or accepted with a written reason;
- each open-intent item (section 9) is answered and becomes an AC or is dropped;
- the section 10 ACs pass against the deployed hostname.

## 1. Loading and offline data

| Alias | Polarity | Claim | Falsified if | Reading at 04bf5b0 |
|---|---|---|---|---|
| `OMA-FUNC-LOAD-1` | obligation | On first launch with no local data, the app downloads the marker dataset, stores every record in IndexedDB, then shows the Search tab | After a successful download, the IndexedDB marker count differs from the dataset's record count, or the Search tab never appears | `passed`: `src/db/__tests__/seed.test.ts` [DB-seed-01, 02, 05]; Chromium run of the build (3 of 3 records seeded, Search shown) |
| `OMA-FUNC-LOAD-2` | obligation | Once seeded, the app relaunches to the Search tab with the network off | A relaunch with the network disabled shows the loading or error screen | `no check`. The code path (seed flag plus precached shell) suggests it holds |
| `OMA-FUNC-LOAD-3` | prohibition | An interrupted download or seed never leaves the app treating partial data as complete. Pairs with `LOAD-1` | After a seed interrupted part-way, the next launch reaches the Search tab with fewer markers than the dataset | `passed` (partial): `seed.test.ts` [DB-seed-02, 04]. The seed flag is written last and partial rows are cleared on retry (`src/db/seed.ts:33`, `:47`). No interruption test |
| `OMA-FUNC-LOAD-4` | possibility | When the dataset cannot be fetched, the user sees the error and a Try Again control that restarts loading | A fetch failure leaves the user on a spinner with no message or no retry | `passed`: `LoadingScreen.test.tsx` [LOAD-04] (component only) |

## 2. Looking up a marker by number

| Alias | Polarity | Claim | Falsified if | Reading at 04bf5b0 |
|---|---|---|---|---|
| `OMA-FUNC-LOOKUP-1` | obligation | Typing the full number of an existing marker shows that marker as the first result | For some existing number N, the first result after typing N is not marker N | `passed`: `marker-number-search.test.ts` [search-001-01, 04]; Chromium run ("95" gave #95, then #9500) |
| `OMA-FUNC-LOOKUP-2` | possibility | Typing a digits-only prefix shows the exact match (if any) first, then the lowest-numbered markers whose numbers start with it, in numeric order, up to 20 in all. *Tightened 2026-10-13 from "up to 20 … ordered numerically".* | A digits-only prefix that some marker number starts with shows no results or more than 20; or a shown marker has a higher number than some unshown marker that also starts with the prefix | `refuted` at 04bf5b0 under the tightened claim. Witness: with numbers 1, 2, 10–13, 19, 100 and 1000 and a limit of 4, "1" gave 1, 10, 100, 1000 instead of 1, 10, 11, 12. Cause: `.limit()` ran in the index's string order before the numeric sort (`src/search/markerNumberSearch.ts`); PR #11 found it. **Fixed on `claude/ts-fixes-lint`:** the prefix range is read as keys only, sorted, then cut. `marker-number-search.test.ts` [OMA-FUNC-LOOKUP-2] failed before the fix and passes after. Same author for test and fix, so an independent check is still owed. The earlier `passed` rested on [search-001-02, 06] and [HOOK-02], which never had more matches than the limit |
| `OMA-FUNC-LOOKUP-3` | prohibition | A number that matches no marker shows "No markers found" and never an unrelated marker. Pairs with `LOOKUP-2` | A digits-only query that no marker number starts with shows any result | `passed`: [search-001-03], `SearchPage.test.tsx` [PAGE-03] |
| `OMA-FUNC-LOOKUP-4` | prohibition | The results on screen always answer the query currently in the box. Pairs with `LOOKUP-2` | After the query changes and loading ends, results for an earlier query are displayed | `refuted`. Witness: query "1", then "12". The lookup for "1" resolves after the one for "12", and the screen shows #1 and #10 under "12". Cause: `src/hooks/useMarkerSearch.ts:32-47` sets results with no staleness check. Reproduced with a throwaway test that controls when each lookup resolves. **Fixed on `claude/determined-mendel-q94t8t`:** `useMarkerSearch.test.ts` [OMA-FUNC-LOOKUP-4] failed before the fix and passes after. The same agent wrote both the test and the fix, so an independent check is still owed. |

## 3. Keyword search

| Alias | Polarity | Claim | Falsified if | Reading at 04bf5b0 |
|---|---|---|---|---|
| `OMA-FUNC-SEARCH-1` | possibility | A query that is not all digits finds markers by title, county, city or inscription text, tolerates small misspellings, and returns at most 20 | A title, county, city or inscription term present in the data finds nothing, or more than 20 results appear | `refuted` (2026-10-13). Witness: a unique word placed in an inscription at about character 10 or 30 is found, but at about 60, 120 or 300 it is not. Fuse's default `location`/`distance` with `threshold: 0.4` (`src/search/searchEngine.ts`) means most inscription text can't be searched. PR #11 reported this first; it was reproduced here with `SearchEngine`. The earlier `passed` rested on `fuse-search.test.ts` [SEARCH-01–05, 08] and [HOOK-03], whose inscription cases put the term near the start. **Fixed on `claude/ts-fixes-lint`:** `SearchEngine` adds an exact, case-insensitive scan of inscriptions (every query word, anywhere) to the fuzzy Fuse pass. `fuse-search.test.ts` [OMA-FUNC-SEARCH-1] places a unique word at characters 10, 60, 120 and 300; the last three failed before the fix and all pass after. Same author for test and fix, so an independent check is still owed. Limit: a misspelled word deep in an inscription is still not found, because only the first ~40 characters of a field get fuzzy matching. Fuse's `ignoreLocation: true` would cover that, but on the 2026-10-13 CSV build it made each search about 5× slower on the main thread (≈1.7 s vs ≈0.35 s here) and let more noise into the top 20 |
| `OMA-FUNC-SEARCH-2` | obligation | A marker whose title matches ranks above markers that match only in inscription text | For some query, a text-only match ranks above a title match | `passed` (one case): [SEARCH-09] |

## 4. Marker detail

| Alias | Polarity | Claim | Falsified if | Reading at 04bf5b0 |
|---|---|---|---|---|
| `OMA-FUNC-DETAIL-1` | obligation | Opening a marker shows its number, title, city and county, date, size, subject codes, an RTHL badge when it is a Recorded Texas Historic Landmark, and the full inscription | Any of these fields is present in the record but missing or truncated on the detail view | `passed`: `MarkerDetail.test.tsx` [MD-01–07, 11] |
| `OMA-FUNC-DETAIL-2` | obligation | A marker with coordinates offers Get Directions to its latitude and longitude | A marker with non-zero coordinates has no directions link, or the link's destination differs from its coordinates | `passed`: [MD-08] |
| `OMA-FUNC-DETAIL-3` | prohibition | A marker without coordinates never offers directions. Pairs with `DETAIL-2` | A marker at 0,0 shows a Get Directions link | `no check`. The code guards it (`src/pages/MarkerDetail.tsx:48`) |

## 5. Nearby

| Alias | Polarity | Claim | Falsified if | Reading at 04bf5b0 |
|---|---|---|---|---|
| `OMA-FUNC-NEAR-1` | obligation | With location permission, Nearby lists up to 50 markers ordered by great-circle distance from the device, each with distance and compass direction | The list is out of distance order, exceeds 50, or omits distance or direction | `passed`: `useNearbyMarkers.test.ts` [NEAR-02, 03, 05], `NearbyPage.test.tsx` [NEARBY-02, 03] |
| `OMA-FUNC-NEAR-2` | prohibition | Markers without coordinates never appear in Nearby. Pairs with `NEAR-1` | A marker at 0,0 appears in the list | `passed`: [NEAR-04] |
| `OMA-FUNC-NEAR-3` | possibility | When location is denied or unavailable, Nearby says so instead of waiting forever | A geolocation error leaves "Getting your location..." on screen | `passed` (hook level): `useGeolocation.test.ts` [GEO-03] |
| `OMA-FUNC-NEAR-4` | obligation | Distances are within 0.5% of the WGS84 geodesic distance | For some pair of points in Texas, the shown distance is off by more than 0.5% | `passed` for one pair in review: Austin to Houston came out at 146.24 mi against a 146.49 mi geodesic (0.17%). The repo's tests [UTIL-02, 03] accept anything from 140 to 155 mi, roughly ±5%, so they would not catch a 0.5% error |

## 6. Map

| Alias | Polarity | Claim | Falsified if | Reading at 04bf5b0 |
|---|---|---|---|---|
| `OMA-FUNC-MAP-1` | obligation | The Map tab shows every marker that has coordinates, clustered, starting over Texas. Tapping a pin opens a popup with title and number, and tapping the popup opens the marker's detail | A marker with coordinates never appears at any zoom, or the popup does not lead to the detail | `passed` (partial): `MapPage.test.tsx` [MAP-03, 04] with Leaflet mocked; Chromium run showed all 3 pins and their popups. Popup-to-detail was untested; `MapPage.test.tsx` [OMA-FUNC-MAP-1] now covers it, and a Chromium run of the fixed build opened the detail from a popup |
| `OMA-SEC-MAP-2` | prohibition | Text from marker records is never interpreted as HTML anywhere in the app. Pairs with `MAP-1` | A record whose title contains markup is rendered as markup, or runs script, in any view | `refuted`. Witness: a record titled `<img src=x onerror="window.__injected=1">` set `window.__injected` to 1 as soon as its map popup opened. Cause: `src/pages/MapPage.tsx:51` interpolates `m.title` into a popup HTML string. The views React renders escape it correctly. **Fixed on `claude/determined-mendel-q94t8t`:** `MapPage.test.tsx` [OMA-SEC-MAP-2] failed before the fix and passes after. The same agent wrote both the test and the fix, so an independent check is still owed. A Chromium run of the fixed build showed the title as plain text, with no element created and no script run |

## 7. Learn More and featured markers

| Alias | Polarity | Claim | Falsified if | Reading at 04bf5b0 |
|---|---|---|---|---|
| `OMA-FUNC-LEARN-1` | obligation | A marker listed in `data/research/manifest.json` shows a Learn More section. The section starts expanded and collapses on tap. Each link shows a title, a source badge and a description, and opens in a new tab | A researched marker shows no section, or a link lacks any of those parts | `passed`: `LearnMoreSection.test.tsx`, `LearnMoreLink.test.tsx`; Chromium run (1 link for #95) |
| `OMA-FUNC-LEARN-2` | prohibition | A marker without research shows no Learn More section at all, never an empty one. Pairs with `LEARN-1` | An unresearched marker shows the section | `passed`: `LearnMoreSection.test.tsx` ("renders nothing when research is null") |
| `OMA-FUNC-LEARN-3` | possibility | If the manifest fetch fails once (for example offline), Learn More and featured markers work again when the network returns, without reloading the app | After one failed manifest fetch and a restored network, no researched marker shows Learn More until reload | `refuted`. Witness: `fetchManifest()` rejected once, then a second call returned the same rejection without calling `fetch` again. Cause: `src/hooks/useMarkerResearch.ts:12-20` keeps the rejected promise. **Fixed on `claude/determined-mendel-q94t8t`:** `useMarkerResearch.test.ts` [OMA-FUNC-LEARN-3] failed before the fix and passes after. The same agent wrote both the test and the fix, so an independent check is still owed. |
| `OMA-FUNC-LEARN-4` | prohibition | A research file's links are never attributed to anything but the three known sections (Grokipedia, Wikipedia, Related). Headings that happen to name a built-in object property, such as `## Constructor` or `## __proto__`, contribute no links. Pairs with `LEARN-1`. *Added 2026-10-13.* | For some heading other than the three, the projected research contains links from that section, or a link whose `source` is not one of `grokipedia`, `wikipedia` or `curated` | `refuted` at 04bf5b0. Witness: a research file with a `## Constructor` section gave its links `source` = the `Object` function, and `## __proto__` gave an object. `SECTION_MAP[heading.toLowerCase()]` read `Object.prototype` (`src/projectors/researchProjector.ts`); PR #11 found it. **Fixed on `claude/ts-fixes-lint`:** the lookup is a `Map`. `researchProjector.test.ts` [OMA-FUNC-LEARN-4] failed for both headings before the fix and passes after. Same author for test and fix, so an independent check is still owed |
| `OMA-FUNC-FEAT-1` | possibility | With an empty query, Search shows up to 3 researched markers chosen at random | With research present and the query empty, no featured cards ever appear | `passed`: `useFeaturedMarkers.test.ts`, `SearchPage.test.tsx`; Chromium run (1 card) |

## 8. Install, accessibility and engineering

| Alias | Polarity | Claim | Falsified if | Reading at 04bf5b0 |
|---|---|---|---|---|
| `OMA-FUNC-PWA-1` | obligation | The production build is installable: a web manifest with name, 192 and 512 px icons, `display: standalone` and `start_url: /`, and a service worker registered at `/sw.js` | The built `index.html` lacks the manifest link or the worker registration, or the manifest lacks those fields | `passed`: inspection of `dist/` from `npm run build`. `e2e/pwa-install.test.ts` was not run |
| `OMA-UX-A11Y-1` | obligation | Every control that opens a marker can be reached and activated with the keyboard alone | A result card, featured card or map popup cannot be focused with Tab or activated with Enter | `refuted`. Witness: `src/components/MarkerCard.tsx:13` and `FeaturedMarkerCard.tsx:20` are `<article onClick>` elements with no `tabIndex`, role or key handler |
| `OMA-TECH-BUILD-1` | obligation | On a clean checkout, `npm ci`, `npm run typecheck`, `npm test` and `npm run build` all succeed | Any of them exits non-zero | `passed`: Node 22.22, 30 files and 229 tests |
| `OMA-TECH-BUILD-2` | obligation | `npm run lint` succeeds | It exits non-zero | `refuted`. ESLint 10.0.2 finds no `eslint.config.*` and stops. **Fixed on `claude/ts-fixes-lint`:** a minimal flat config (typescript-eslint recommended plus react-hooks' flat recommended config). Its first run reported 5 problems in four hooks: 4 `react-hooks/set-state-in-effect` and 1 `react-hooks/exhaustive-deps`. They were fixed in code, with no rules turned off, and `npm run lint` now exits 0 |
| `OMA-TECH-HOST-1` | obligation | The production build is a static site. Serving `dist/` with the marker data from the root of any HTTPS origin gives a working app with no server code | Some feature needs a server-side handler, or fails when served as plain files | `passed`: `vite preview` plus the Chromium run (load, lookup, detail, Learn More and map all worked) |
| `OMA-DATA-PIPE-1` | obligation | `scripts/prepare-data.ts` merges the THC CSV with shapefile coordinates, preferring shapefile coordinates and falling back to UTM conversion | A marker whose shapefile point is inside Texas gets UTM-derived coordinates, or one with in-Texas UTM data only gets 0,0. The corrections table (`scripts/coordinate-corrections.ts`) may override both, by design | `passed`: `scripts/__tests__/prepare-data.test.ts`. Known source gap: five shapefile points (961, 22599, 12711, 9113, 7987) sit 170–500 km from their town while their CSV UTM value is within about 2 km of it. A county-distance check that prefers UTM in that case would fix them (issue #4) |
| `OMA-DATA-PIPE-2` | obligation | Every published marker has a number and a title, and its coordinates are either inside Texas bounds (lat 25.8–36.5, lng −106.6 to −93.5) or exactly 0,0 | Any record in the published `markers.json` breaks this | `refuted` on the 2026-02-28 data. Witness: 15,203 of 17,368 records carry raw shapefile coordinates in NAD83 / Texas State Mapping System metres (EPSG:3081), not degrees. Six more carry bad CSV UTM values, so 15,209 (88%) have no usable position; for example #95 has `lat` 808429.497 and `lng` 1146593.682. The pipeline copied shapefile geometry without reprojecting it (`scripts/prepare-data.ts`). **Fixed on `claude/determined-mendel-q94t8t`:** shapefile points are reprojected (`scripts/texas-mapping.ts`), a coordinate outside Texas falls back to the CSV's UTM value or 0,0, and the run stops if fewer than 85% of markers have coordinates. Applied to the supplied file, this gives 15,865 markers (91%) inside the Texas bounding box (`TEXAS_BOUNDS`: lat 25.5–36.8, lng −106.9 to −93.2), with #95 at 29.426111, −98.486733, 70 m from the Cenotaph. The corrections table (`scripts/coordinate-corrections.ts`, 7029ed3) adds four more and moves #11159, so a rebuild at the branch tip gives 15,869. The new `e2e/nearby.test.ts` [OMA-FUNC-NEAR-1] fails on the original file and passes on the corrected one. Six markers have bad CSV UTM values; none of them is in the shapefile. #8923, #14550 and #16270 are labelled zone 15 but are zone 14. #10856 has a mistyped northing (2648020 for 3648020). #11159 converts to a point in Arkansas. #17081's northing has lost a digit. `scripts/coordinate-corrections.ts` corrects 5 of the 6. Still open: #17081 (Leesburg Cemetery) has no coordinates, and 12 points sit 150–600 km from their county median. Six of those are UTM-derived (23812, 7927, 10485, 14261, 18586, 16489) and six are reprojected shapefile points (961, 22599, 12711, 9113, 22461, 7987) (see issue #4). **At the branch tip (7029ed3) the claim as written still fails for one record:** #10485 Prude Ranch (Jeff Davis County) is at 27.197808, −106.632709, which is in Chihuahua, Mexico. It passes the pipeline because the code's `TEXAS_BOUNDS` box (lat 25.5–36.8, lng −106.9 to −93.2) is looser than this AC, so it needs a correction-table entry. A rebuild at the tip gives 15,869 markers with coordinates and 1,499 at 0,0, so its SHA-256 differs from the `19DFEF02…` pre-corrections file |

## 9. Open intent: current behaviour the owner has not confirmed

Each item records what the app does today. The owner decides whether it is intended. An answer becomes an AC in the matching section, or the item is dropped.

| # | Behaviour at 04bf5b0 | Question |
|---|---|---|
| I1 | Once seeded, the app never fetches marker data again. A newer dataset reaches existing installs only if the user presses "Re-download Data" (`src/hooks/useDataLoader.ts:43`, `src/db/seed.ts:27`) | Should a deploy with new data reach existing users automatically, for example with a dataset version checked on launch? |
| I2 | Going back from a marker detail clears the search query and reshuffles the featured markers. The map also resets, because `App.tsx:35` unmounts the tabs. The e2e test "back button returns to search results" only checks that the input is visible | Should Back restore the previous query and results? |
| I3 | There are no URLs per marker. Browser Back leaves the app, and a marker cannot be shared as a link | Are deep links such as `/marker/95` wanted? This decides whether Cloudflare needs SPA fallback (section 10) |
| I4 | The search box uses `inputmode="search"` (a text keyboard). The test asserting this is named "has numeric inputmode for number keyboard" (`SearchInput.test.tsx:26`) | For a driver reading a highway sign, should the default keyboard be numeric? |
| I5 | Nearby re-reads and re-sorts every marker (about 17,000) on each high-accuracy GPS fix (`useNearbyMarkers.ts:30`) | Is this battery and CPU cost acceptable while driving, or should updates be throttled by distance moved? |
| I6 | Map tiles come from the public `{a,b,c}.tile.openstreetmap.org` servers. Pin icons come from `unpkg.com` (`MapPage.tsx:15-17, 81`) | Is the public OSM tile service acceptable for a public launch under its usage policy? Should pin icons be bundled so pins render offline? |

## 10. Cloudflare (`bound`, binds `cloudflare-workers-static-assets`, refines `OMA-TECH-HOST-1`)

These ACs are proposed. Nothing is deployed yet, so none has a reading. The limits are from Cloudflare's documentation as of 2026-10-02: 25 MiB per file, 20,000 files per version on the free plan and 100,000 on paid, and static-asset requests free and unlimited.

| Alias | Polarity | Claim | Falsified if |
|---|---|---|---|
| `OMA-TECH-EDGE-1` | obligation | The app is deployed as an assets-only Worker with no Worker script, so every request is a free static-asset request | The Wrangler config has a `main` entry, or any request invokes Worker code |
| `OMA-TECH-EDGE-2` | prohibition | No deployed file exceeds 25 MiB, and the deployment stays under 20,000 files. Pairs with `EDGE-3` | The build output has a file over 25 MiB, or 20,000 or more files |
| `OMA-TECH-EDGE-3` | obligation | The app is served from the root of its own hostname (a Custom Domain). `/`, `/sw.js`, `/manifest.webmanifest` and `/data/markers.json` all return 200 from that origin | Any of these returns non-200, or the app is reachable only under a path prefix |
| `OMA-TECH-EDGE-4` | obligation | `/data/markers.json` is sent compressed to clients that accept compression | A request with `Accept-Encoding: br, gzip` receives a response with no `Content-Encoding` |
| `OMA-TECH-EDGE-5` | obligation | A deploy built from a fresh clone of the repo, with no files from a developer's disk, ships the marker dataset and research files | On such a deploy, `/data/markers.json` or `/data/research/manifest.json` returns 404 |
| `OMA-SEC-EDGE-6` | obligation | Every HTML response carries a Content-Security-Policy that allows scripts only from the app's own origin | An HTML response lacks the header, or the policy permits inline or third-party script |

**Pre-deploy check for `EDGE-6` (2026-10-13):** `e2e/csp-headers.test.ts` serves `dist/` with `public/_headers` applied as Cloudflare does (`scripts/serve-dist-with-headers.mjs`). It checks that every HTML response's `script-src` is exactly `'self' 'wasm-unsafe-eval'`, that inline script and `eval` stay blocked, and that the WASM engine compiles. `'wasm-unsafe-eval'` allows WebAssembly compilation only, so the claim still holds. It was added for #11, because `script-src 'self'` alone refused to compile the engine. The test failed against that policy and passes with the new one. It is still not a reading against the deployed hostname.

---
title: One Mile Ahead — launch audit and proposed acceptance criteria
status: draft
created: 2026-10-21
revised: 2026-10-21 (owner answers Q1–Q7; two-tier Done when)
audited-commit: f02f48c (Release rel-20261021-c3bfbc20)
audited-host: https://onemileahead.specdlc.com
refines: specs/acceptance/one-mile-ahead-baseline.md
tldr: "First readings against the deployed hostname, plus the owner's answers to Q1–Q7. EDGE-5, LEARN-* and FEAT-1 are retired until research files ship. EDGE-4 is tightened and EDGE-6 amended for Cloudflare Web Analytics in the baseline. 29 new ACs: 24 refuted (live or in code), 1 passed, 4 with no check yet. Done when is split into launch blockers and post-launch work."
---

# One Mile Ahead — launch audit and proposed ACs

## How this was read

The form follows the baseline: alias, polarity, claim, falsifier, reading. Readings use the baseline's verdict values.

**Live readings** were taken on 2026-10-21 in a Chromium-based browser against `https://onemileahead.specdlc.com`, at a 375×812 mobile viewport.
- HTTP facts come from same-origin `fetch` and the Resource Timing API.
- Geolocation was stubbed in-page: a fixed point at the Fort Worth Stockyards for Nearby, and a northbound drive on I-35W at 29 m/s with 1 s fixes for Ahead.
- Offline relaunch (`LOAD-2`) was not exercised. The browser pane can't cut the network.

**Code readings** were taken at `f02f48c`:
- `npm ci`, `lint`, `typecheck` and `build` all pass.
- `npm test`: 250 of 251 pass.
- `cargo +stable test --workspace --release`: all pass.
- e2e: not run, because Chromium couldn't be downloaded.

Every reading below comes from a reviewer who did not write the code. Under the independence principle, the `passed` readings here are stronger evidence than the baseline's.

## 0. Done when

### Launch blockers

Each item is done when its AC has a `passed` reading against the deployed hostname, or, for retirements, when the baseline records the retirement with its reason.

1. **Learn More hidden; a useful home screen (Q4).**
   - `EDGE-5`, `LEARN-1`–`LEARN-4` and `FEAT-1` are retired in the baseline. The reason: no research files ship yet, so the feature is hidden until they do.
   - `OMA-UX-HIDE-1`: no Learn More or featured UI, and no requests under `/data/research/`.
   - `OMA-UX-HOME-1`: an intro with example queries replaces the featured markers.
2. `OMA-UX-INPUT-1`: the text keyboard by default, with digits-only queries still doing a number lookup (Q3).
3. `OMA-FUNC-LOOKUP-5`: "#95" and "marker 95" find #95.
4. `OMA-FUNC-SEARCH-3`: title matches rank above city- and county-only matches.
5. `OMA-TECH-CI-1`: deploy waits for Verify.
6. `OMA-TECH-BUILD-1`: `npm test` passes on a clean checkout. It is refuted at HEAD by the differential timeout.
7. `OMA-TECH-EDGE-7` and `OMA-UX-PRIV-1`: the Web Analytics beacon loads with no CSP violation, and a disclosure line says so (Q6). `PRIV-1` was not in the owner's blocker list; it is placed here because Q6 ties the disclosure to allowing the beacon. Move it to post-launch if the owner prefers.
8. `OMA-UX-A11Y-1`: every control that opens a marker works from the keyboard.
9. `OMA-SEC-EDGE-8`: HSTS, Referrer-Policy and Permissions-Policy.
10. `OMA-DATA-PIPE-3`: a rebuild from the repo can't bring back #10485's bad coordinates.

### Post-launch

Everything else, each to a `passed` reading or a written retirement:
- `SEARCH-4`
- `PERF-1` (on a real phone)
- `NAV-1`
- `NAV-2` (deep links, decided yes)
- `A11Y-2`
- `NEAR-5`, `NEAR-6`, `NEAR-7`
- `MAP-3`, `MAP-4`, `MAP-5`
- `AHEAD-2`, `AHEAD-3`, `AHEAD-4`, `AHEAD-5`
- `DATA-VER-1`, `UX-DATA-2`
- `ABOUT-1`

Ahead becomes a default tab once `AHEAD-2` passes (Q1). Until then, the README doesn't advertise it.

## 1. Section 10 (Cloudflare), first readings against the deployed hostname

| Alias | Reading 2026-10-21 |
|---|---|
| `OMA-TECH-EDGE-1` | `passed` (config). `wrangler.jsonc` has no `main`, and responses carry `cf-cache-status`, which means they are asset responses. Watch: the comment in `wrangler.jsonc:5` plans a Worker script for the marker API (issue #2), and that would refute this AC. Decide first whether EDGE-1 is retired or the API goes on a separate hostname. |
| `OMA-TECH-EDGE-2` | `passed`. The build has 14 files. The largest is `data/markers.json` at 17,764,384 B, which is under 25 MiB. |
| `OMA-TECH-EDGE-3` | `passed`. `/`, `/sw.js`, `/manifest.webmanifest` and `/data/markers.json` return 200 from the root of the custom domain. |
| `OMA-TECH-EDGE-4` | `passed` under the tightened falsifier. The falsifier now names any of `zstd`, `br` or `gzip` (baseline, 2026-10-21). The browser offered all three and got `content-encoding: zstd`: 5,410,488 B on the wire for 17,764,384 B decoded. |
| `OMA-TECH-EDGE-5` | `refuted` live: `/data/research/manifest.json` and `/data/research/95.md` both return 404. Then **retired** by the owner (Q4), because research is hidden until files ship. The dataset half stays covered by `EDGE-3` and the clean-checkout deploy. |
| `OMA-SEC-EDGE-6` | `passed` under both the original and the amended claim. The live `script-src` is `'self' 'wasm-unsafe-eval'`, and the engine compiles. The amended claim (Q6) also allows `https://static.cloudflareinsights.com`. `e2e/csp-headers.test.ts` must expect that host once `EDGE-7` is fixed. |

## 2. Baseline ACs re-read at f02f48c and live

| Alias | New reading | Note |
|---|---|---|
| `OMA-TECH-BUILD-1` | **`refuted`** | `src/engine/__tests__/differential.test.ts:176` ("lookup: identical to searchByMarkerNumber") times out at 120 s. This happens because the full 17,371-record `markers.json` is now committed, so `skipIf(!available)` no longer skips it. It runs under fake-indexeddb on 2 vCPUs. Fix: sample the dataset, or give the test a separate, longer-running job. |
| `OMA-UX-A11Y-1` | **`refuted`** (live) | Result cards are `<article>` with `tabIndex = -1` and no role. The map popup body is a click-only `div`. |
| `OMA-FUNC-LOOKUP-1` | `passed` (live) | "95" → #95 first. |
| `OMA-FUNC-LOOKUP-3` | `passed` (live) | "99999" → "No markers found". |
| `OMA-FUNC-NEAR-1` | `passed` (live) | At the Stockyards: 50 results, in distance order, each with distance and direction; first in about 0.46 s. |
| `OMA-FUNC-NEAR-3` | `passed` (live), but see `UX-NEAR-5` | On denial it shows the raw browser string "User denied Geolocation". |
| `OMA-FUNC-MAP-1` | `passed` (live, partial) | Clusters render over Texas and OSM tiles load. Popup-to-detail was not exercised live. |
| `OMA-FUNC-DETAIL-1`, `-2` | `passed` (live, #95) | Directions go to 29.426111, −98.486733. |
| `OMA-FUNC-LEARN-1`–`4`, `OMA-FUNC-FEAT-1` | `refuted` in production, then **retired** (Q4) | No research is deployed. The retirement is recorded in each baseline row. Re-adopt them unchanged with the release that ships research. |
| `OMA-DATA-PIPE-2` | `passed` on the committed data, with a gap | The file has 17,371 records: 0 outside the AC's bounds, 1,468 at 0,0, and #10485 now at 0,0. **But** the repo can't reproduce it. `coordinate-corrections.ts` has no entry for #10485, and `texas-bounds.ts` is still the looser box. A rebuild could bring back the Chihuahua point. See `DATA-PIPE-3`. |
| Open intent I1–I6 | answered 2026-10-21 | The answers are recorded in the baseline's section 9 and below. I4's description was stale: the box had moved to `inputMode="numeric"`, and Q3 reverses that. |

## 3. Proposed acceptance criteria

The "Reading" column is the live or code reading at 2026-10-21. **Tier** is `launch` or `post` (section 0).

### 3.1 Search and lookup

| Alias | Tier | Polarity | Claim | Falsified if | Reading |
|---|---|---|---|---|---|
| `OMA-FUNC-LOOKUP-5` | launch | possibility | A number written the way people write it on a sign or in a note ("#95", "No. 95", "marker 95") is treated as marker number 95 | For some existing N, the first result for "#N" or "marker N" is not marker N | **`refuted`**. "#95" gave #3935, #9965, … (dates in inscriptions). "marker 95" gave #184, #695, #696 |
| `OMA-FUNC-SEARCH-3` | launch | obligation | A marker whose title contains every query word ranks above markers that match only on city or county. Extends `SEARCH-2` | For some query, a city- or county-only match ranks above a title match | **`refuted`**. "alamo" puts five markers in Alamo (Hidalgo County) ahead of #95 Alamo Cenotaph, which comes 6th |
| `OMA-FUNC-SEARCH-4` | post | prohibition | A keyword query never returns a marker that has no word within edit distance 1 of some query word, in any searched field. Pairs with `SEARCH-1` | Some result shares no such word with the query | **`refuted`**. "alamoo" gave #12663 Malakoff, #15828 Salado and #3912 Palacios Cemetery, and no Alamo |
| `OMA-UX-PERF-1` | post | obligation | On a real mid-range phone, named in the reading, results for a typed query appear within 300 ms at p95, and typing never drops characters | p95 above 300 ms over a fixed set of 20 queries on that phone | `no check`. Stays `no check` until measured on a real phone. *Context only, not a reading:* desktop Chromium took 200–850 ms per query on the main thread |
| `OMA-UX-INPUT-1` | launch | obligation | The search box opens the text keyboard. A query of digits only still runs the number lookup (`LOOKUP-1`–`3`). No keyboard toggle (Q3) | `inputmode` is `numeric`, `decimal` or `tel`; or a digits-only query does not return the number-lookup results | **`refuted`**. `inputmode="numeric"` (`SearchInput.tsx:14`), and `SearchInput.test.tsx:26-28` asserts `numeric`, so the test changes with the fix |

### 3.2 Home, navigation, state

| Alias | Tier | Polarity | Claim | Falsified if | Reading |
|---|---|---|---|---|---|
| `OMA-UX-HOME-1` | launch | prohibition | With an empty query, Search is never blank. It shows a short intro to the app and example queries: at least one marker number and one keyword. Replaces the featured-markers route (Q4) | A first-time visitor sees only the search box and the tab bar, or no example query | **`refuted`** (live screenshot) |
| `OMA-UX-HIDE-1` | launch | prohibition | Until research files ship, the app shows no Learn More section and no featured-marker UI, and requests nothing under `/data/research/`. Pairs with `HOME-1`; replaces the retired `LEARN-*` / `FEAT-1` (Q4) | Any Learn More or featured UI renders, or any request goes to `/data/research/` | **`refuted`**. Live: every launch requests `/data/research/manifest.json`, opening #95 requests `/data/research/95.md`, and both return 404 |
| `OMA-FUNC-NAV-1` | post | obligation | Back from a marker detail returns to the same query, the same results and the same scroll position. Answers I2 | After Back, the query box or the results differ from before | **`refuted`**. After Back the query is "" and there are 0 results |
| `OMA-FUNC-NAV-2` | post | possibility | `/marker/{N}` opens marker N's detail on a cold load, and browser Back from a detail stays in the app. Decided yes (Q2); binds `not_found_handling: "single-page-application"` | `/marker/95` returns 404 or a blank app, or Back leaves the site | **`refuted`**. `/marker/95` → 404, and `history.length` stays 1 after opening a detail |
| `OMA-UX-A11Y-2` | post | obligation | The settings drawer moves focus inside when it opens, closes on Escape, and returns focus to the gear | Escape leaves the drawer open, or focus stays behind it | **`refuted`**. Escape didn't close it, and focus stayed on the page |

### 3.3 Nearby and Map

| Alias | Tier | Polarity | Claim | Falsified if | Reading |
|---|---|---|---|---|---|
| `OMA-UX-NEAR-5` | post | obligation | When location is denied or unavailable, Nearby and Ahead explain it in plain words and offer a next step (how to enable it, or open the Map). Refines `NEAR-3` | The browser's raw error text is shown, or there is no action | **`refuted`**. "Location unavailable: User denied Geolocation", with nothing else |
| `OMA-UX-NEAR-6` | post | obligation | With a location but no marker within the search limit, Nearby says so | An empty list renders with no message | `no check`. The code has no empty-state message |
| `OMA-UX-NEAR-7` | post | prohibition | Nearby re-queries and re-sorts markers only on the first fix, or after the device has moved about 50 m from the last query point (Q7). Pairs with `NEAR-1` | A fix less than 50 m from the last query point triggers a re-read or re-sort of the markers | **`refuted`** (code). `useNearbyMarkers.ts:73` runs `db.markers.toArray()` and a full sort on every change of lat or lng. WASM-by-default is deferred (Q7) |
| `OMA-FUNC-MAP-3` | post | possibility | The Map can center on the user's location in one tap | There is no such control | **`refuted`**. There is no locate control |
| `OMA-UX-MAP-4` | post | obligation | Pin icons are served from the app's own origin and are precached, so once seeded, pins render offline (Q5) | Any pin icon is requested from another origin, or offline pins are missing or appear as broken images | **`refuted`** (code). Icons come from `unpkg.com` (`MapPage.tsx:15-17`), and the service worker has no route for them |
| `OMA-TECH-MAP-5` | post | obligation | Map tiles come from the public OSM service on its single host, `https://tile.openstreetmap.org`, with OSM attribution shown (Q5) | A tile is requested from `{a,b,c}.tile.openstreetmap.org` or any other host, or the attribution is missing | **`refuted`** (live). Tiles load from `https://c.tile.openstreetmap.org/...`; the attribution is present |

### 3.4 Ahead (the app's name)

Ahead works today only behind `?engine=wasm`.
- **Q1:** it becomes a default tab once `AHEAD-2` passes. The README stops advertising it until then (done in the spec-drift PR).
- `AHEAD-1` already passes behind the flag.

| Alias | Tier | Polarity | Claim | Falsified if | Reading |
|---|---|---|---|---|---|
| `OMA-FUNC-AHEAD-1` | — | obligation | Driving in a straight line at highway speed, a marker inside the corridor cues once, between 0.9 and 1.0 mi before it | A marker in the corridor never cues, or cues twice on one pass | `passed` (live, flagged). On a simulated I-35W drive at 29 m/s, #1470 cued at 0.9 mi and only once |
| `OMA-UX-AHEAD-2` | post | prohibition | The cue area never holds more than the 2 most recent cues, and a cue is removed once its marker is behind the vehicle. Pairs with `AHEAD-1`. **Gates Ahead becoming a default tab (Q1)** | More than 2 cues are visible, or a cue stays after its marker is passed | **`refuted`**. After 2 simulated minutes, 6 stacked cues pushed the list off screen |
| `OMA-UX-AHEAD-3` | post | possibility | The user can turn on spoken cues, using the browser's speech synthesis | No audible cue can be enabled | **`refuted`**. Cues are text only; `speechSynthesis` is available but unused |
| `OMA-UX-AHEAD-4` | post | possibility | While Ahead is open and moving, the screen stays awake (Wake Lock API, where supported) | The screen sleeps during a drive with Ahead open on a supporting browser | `no check`. There is no wake-lock code |
| `OMA-UX-AHEAD-5` | post | obligation | A jump status ("Location jumped…") resolves within 5 s of steady fixes at any speed up to 90 m/s | The status persists for more than 5 s of consistent fixes under 90 m/s | `no check`. Live, the status held indefinitely at 116 m/s, which is above the limit and so correct. This AC pins the boundary |

### 3.5 Data freshness and settings

| Alias | Tier | Polarity | Claim | Falsified if | Reading |
|---|---|---|---|---|---|
| `OMA-FUNC-DATA-VER-1` | post | obligation | On launch with the network up, the app compares its stored dataset version with the deployed one and re-seeds when the deployed one is newer, keeping the old copy usable until the new seed completes. Answers I1 | After a deploy with new data, an existing install still shows old data after two launches online | **`refuted`** (code). There is a single `dataSeeded` flag and no version |
| `OMA-UX-DATA-2` | post | prohibition | Re-download Data never discards the local copy without a confirmation. Pairs with `DATA-VER-1` | One tap deletes the database | **`refuted`** (code). `SettingsDrawer.tsx:54-62` has no confirm, and `deleteDatabase` is not awaited while Dexie holds an open connection |
| `OMA-UX-ABOUT-1` | post | obligation | Settings shows the deployed release ID and the dataset's date and record count, taken from the build | The shown values differ from the deployed release or the data | **`refuted`** (code). "v1.0.0" and "17,000+" are hard-coded |

### 3.6 Edge, security, delivery

| Alias | Tier | Polarity | Claim | Falsified if | Reading |
|---|---|---|---|---|---|
| `OMA-TECH-EDGE-7` | launch | prohibition | A cold load of `/` produces no CSP violation. The policy allows `https://static.cloudflareinsights.com` in `script-src` and `https://cloudflareinsights.com` in `connect-src`, so the Cloudflare Web Analytics beacon loads and reports (Q6). Pairs with `EDGE-6` | Any CSP violation in the console on a cold load of `/`, or the beacon script or its report request is blocked | **`refuted`**. Cloudflare injects `static.cloudflareinsights.com/beacon.min.js`, and the current `script-src` blocks it on every load |
| `OMA-UX-PRIV-1` | launch | obligation | The app discloses in one plain line, reachable from Settings, that it uses Cloudflare Web Analytics, which is cookieless and collects aggregate page-view data (Q6). Pairs with `EDGE-7` | Analytics runs while no such line exists in the app | **`refuted`**. There is no disclosure (`SettingsDrawer.tsx`). See the note under Q6 about Fondue |
| `OMA-SEC-EDGE-8` | launch | obligation | HTML responses carry `Strict-Transport-Security`, `Referrer-Policy: strict-origin-when-cross-origin` (or stricter), and a `Permissions-Policy` that limits geolocation to `self` | Any of the three is missing | **`refuted`**. Only `CSP` and `X-Content-Type-Options` are set |
| `OMA-TECH-CI-1` | launch | obligation | A push to `main` deploys only after Verify (unit, Rust and e2e) passes on that commit | `deploy.yml` can run on a commit whose Verify failed | **`refuted`** (code). Deploy has no `needs:` on Verify and runs no tests itself |
| `OMA-DATA-PIPE-3` | launch | obligation | The published `markers.json` is reproducible from the repo: the pipeline plus inputs pinned by SHA-256 give a byte-identical file, and the pipeline's bounds equal `DATA-PIPE-2`'s | A rebuild differs, or `TEXAS_BOUNDS` ≠ the AC's box | **`refuted`** (code). The #10485 fix is not in `coordinate-corrections.ts`, and the bounds differ |

## 4. Owner decisions (answered 2026-10-21)

| # | Question | Answer | Effect |
|---|---|---|---|
| Q1 | Does Ahead graduate from the flag? | It becomes a default tab after `UX-AHEAD-2` (cue stacking) is fixed. Until then, the README stops advertising it | `AHEAD-2` gates the change; README edit in the spec-drift PR |
| Q2 | I3: deep links? | Yes: `/marker/N` with SPA fallback | `NAV-2` stays (post-launch) |
| Q3 | I4: default keyboard? | Text keyboard by default. A digits-only query still does a number lookup. No toggle for now | `UX-INPUT-1` reworded (launch) |
| Q4 | Learn More at launch? | Hide it until research files ship. Retire `LEARN-*`, `FEAT-1` and `EDGE-5` with that as the written reason. Replace `HOME-1`'s featured markers with a short intro and example queries | Retirements recorded in the baseline; `HOME-1` reworded; `HIDE-1` added (launch) |
| Q5 | I6: map tiles and icons? | Keep public OSM for launch on the single `tile.openstreetmap.org` host. Serve pin icons from the site instead of unpkg. Revisit a keyed provider only if traffic grows | `MAP-4` reworded, `MAP-5` added (post-launch). CSP `img-src` can then drop `https://unpkg.com` and name `https://tile.openstreetmap.org` |
| Q6 | Cloudflare Web Analytics? | Keep it. Allow `static.cloudflareinsights.com` in `script-src` and `cloudflareinsights.com` in `connect-src`, and add a disclosure line, matching Fondue | `EDGE-6` amended in the baseline; `EDGE-7` reworded; `PRIV-1` added (launch) |
| Q7 | I5: Nearby cost? | Re-query after about 50 m of movement. Leave WASM-by-default for later | `NEAR-7` added (post-launch) |

**Note on Q6 and Fondue (2026-10-21).** On `fondue.specdlc.com` the Cloudflare beacon loads. But there is no CSP header, and no disclosure line is visible on the page. Fondue's own `ac/FONDUE-SITE-4.md` claims the site "sends no analytics or visitor data", so that AC is refuted by its live site. So "matching Fondue" here means: the same analytics product, but with the CSP allowance and the disclosure that Fondue doesn't have yet. `PRIV-1`'s wording is a proposal, and Fondue may need the same fix.

## 5. Spec drift to clean up (no behaviour change)

These are handled in a separate pull request, `specs/drift-cleanup-2026-10-21`. Kept here as the record.

**`requirements/data-pipeline.md`**
- AC-DP-05 names `markers.json.gz` with a 5 MB limit. The app fetches plain JSON, and gzip -9 of the current file is 5.87 MB.
- AC-DP-06 calls for `fuse-index.json`. It is never loaded, and its weights and threshold differ from the runtime's.
- It says "UTM zones 13/14". The converter takes any zone, and the data has zone-15 records.
- It doesn't mention EPSG:3081 reprojection, the corrections table, or the 85% stop.
- The bounds differ from the code, the counts say 17,368 where the data has 17,371, and the status still says DRAFT.

**`requirements/project-setup.md`** is marked COMPLETE, but lists things that aren't there:
- `scripts/skills/`, `.claude/commands/` and `src/map/`: none exist.
- `data/` "gitignored": `.gitignore` no longer lists `data/`.
- `design/project-setup.md` points to a "plan file" that doesn't exist.

**`requirements/learn-more.md`**: AC-LM-13..15 (the `/research-marker` command) and `scripts/skills/marker-researcher.ts` aren't in the repo. Mark them out-of-repo or move them.

**`requirements/wasm-engine.md`**
- `prototypes/` is absent, so `./build.sh` fails at its last step.
- The INDEX.md note points to a file that doesn't exist.
- `design/wasm-engine.md` says a cue is "spoken". It isn't (see `AHEAD-3`).

**`README.md`**
- It says "Both paths answer the same commands" and presents Ahead as a feature. The default path has no Ahead (Q1).

**Smaller items**
- `src/engine/__tests__/datasetPath.ts:5` calls `markers.json` gitignored. It's tracked.
- The Map filters 0,0 markers with `&&`; Nearby uses `||`. This is a code change, so it is **not** in the drift PR. No data hits the difference today; unify them in a code PR.

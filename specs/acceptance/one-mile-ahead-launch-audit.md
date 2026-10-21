---
title: One Mile Ahead — launch audit and proposed acceptance criteria
status: draft
created: 2026-10-21
audited-commit: f02f48c (Release rel-20261021-c3bfbc20)
audited-host: https://onemileahead.specdlc.com
refines: specs/acceptance/one-mile-ahead-baseline.md
tldr: "First readings against the deployed hostname. Section 10 (Cloudflare) mostly passes; EDGE-5 is refuted because no research files ship, so Learn More and featured markers are absent in production. Two baseline ACs regress at HEAD (BUILD-1 times out, A11Y-1 still refuted). 25 new ACs are proposed; 19 are already refuted (live or in code), 1 passes, 5 have no check yet. Four requirement docs have drifted from the code."
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

## 0. What to fix first

1. **Ship research data or retire Learn More.** Production has no `/data/research/`, so `LEARN-1`, `FEAT-1` and `EDGE-5` fail live, and the home screen is blank (`UX-HOME-1`).
2. **Make keyword search usable on a phone.** The search box opens a numeric keypad (`UX-INPUT-1`). "alamo" ranks the town of Alamo above the Alamo Cenotaph (`SEARCH-3`). A misspelling returns unrelated markers (`SEARCH-4`). "#95" doesn't find #95 (`LOOKUP-5`).
3. **Gate deploy on tests, and fix the test that times out.** `deploy.yml` doesn't depend on Verify, and `npm test` currently fails (`TECH-CI-1`, `BUILD-1`).
4. **Stop the edge from injecting a blocked script.** Cloudflare Web Analytics adds a beacon, and the CSP refuses it on every page load (`TECH-EDGE-7`).
5. **Keyboard access to results** (`A11Y-1`, open since the baseline).
6. **Owner decisions** (section 4). Several new ACs can't be written finally until these are answered, starting with I3 (deep links) and the future of the Ahead tab.

## 1. Section 10 (Cloudflare), first readings against the deployed hostname

| Alias | Reading 2026-10-21 |
|---|---|
| `OMA-TECH-EDGE-1` | `passed` (config). `wrangler.jsonc` has no `main`, and responses carry `cf-cache-status`, which means they are asset responses. Watch: the comment in `wrangler.jsonc:5` plans a Worker script for the marker API (issue #2), and that would refute this AC. Decide first whether EDGE-1 is retired or the API goes on a separate hostname. |
| `OMA-TECH-EDGE-2` | `passed`. The build has 14 files. The largest is `data/markers.json` at 17,764,384 B, which is under 25 MiB. |
| `OMA-TECH-EDGE-3` | `passed`. `/`, `/sw.js`, `/manifest.webmanifest` and `/data/markers.json` return 200 from the root of the custom domain. |
| `OMA-TECH-EDGE-4` | `passed`. `markers.json` arrives with `content-encoding: zstd`: 5,410,488 B on the wire for 17,764,384 B decoded. **Tighten:** the falsifier names `br, gzip`, but browsers also offer `zstd`. Reword it to "a request offering any of `zstd`, `br` or `gzip` receives a compressed response". |
| `OMA-TECH-EDGE-5` | **`refuted`.** Witness: `GET /data/research/manifest.json` → 404, and `GET /data/research/95.md` → 404. The repo has no `public/data/research/`, and the deploy builds from a clean clone. |
| `OMA-SEC-EDGE-6` | `passed`. Every response carries `script-src 'self' 'wasm-unsafe-eval'`, and the engine compiles under `?engine=wasm`. Side effect: see `TECH-EDGE-7`. |

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
| `OMA-FUNC-LEARN-1`, `OMA-FUNC-FEAT-1` | **`refuted` in production** | No research is deployed (`EDGE-5`). Both pass only on fixtures. |
| `OMA-DATA-PIPE-2` | `passed` on the committed data, with a gap | The file has 17,371 records: 0 outside the AC's bounds, 1,468 at 0,0, and #10485 now at 0,0. **But** the repo can't reproduce it. `coordinate-corrections.ts` has no entry for #10485, and `texas-bounds.ts` is still the looser box. A rebuild could bring back the Chihuahua point. See `DATA-PIPE-3`. |
| Open intent I4 | description stale | The box is now `inputMode="numeric"`, not `search`. See `UX-INPUT-1`. |

## 3. Proposed acceptance criteria

The "Reading" column is the live or code reading at 2026-10-21.

### 3.1 Search and lookup

| Alias | Polarity | Claim | Falsified if | Reading |
|---|---|---|---|---|
| `OMA-FUNC-LOOKUP-5` | possibility | A number written the way people write it on a sign or in a note ("#95", "No. 95", "marker 95") is treated as marker number 95 | For some existing N, the first result for "#N" or "marker N" is not marker N | **`refuted`**. "#95" gave #3935, #9965, … (dates in inscriptions). "marker 95" gave #184, #695, #696 |
| `OMA-FUNC-SEARCH-3` | obligation | A marker whose title contains every query word ranks above markers that match only on city or county. Extends `SEARCH-2` | For some query, a city- or county-only match ranks above a title match | **`refuted`**. "alamo" puts five markers in Alamo (Hidalgo County) ahead of #95 Alamo Cenotaph, which comes 6th |
| `OMA-FUNC-SEARCH-4` | prohibition | A keyword query never returns a marker that has no word within edit distance 1 of some query word, in any searched field. Pairs with `SEARCH-1` | Some result shares no such word with the query | **`refuted`**. "alamoo" gave #12663 Malakoff, #15828 Salado and #3912 Palacios Cemetery, and no Alamo |
| `OMA-UX-PERF-1` | obligation | On a mid-range phone profile (4× CPU throttle), results for a typed query appear within 300 ms at p95, and typing never drops characters | p95 above 300 ms over a fixed set of 20 queries | `no check`. Desktop live: 200–850 ms per query ("alamo" 847 ms), on the main thread. Likely refuted on a phone. The WASM text index is a candidate fix |
| `OMA-UX-INPUT-1` | obligation | While the placeholder offers keyword search, the on-screen keyboard can type letters without the user changing keyboards | `inputmode` is `numeric` or `decimal` while the placeholder says "or keyword" | **`refuted`**. `inputmode="numeric"`, placeholder "Marker # or keyword...". *Owner choice (I4):* keep the text keyboard, or add a numeric/keyword toggle |

### 3.2 Home, navigation, state

| Alias | Polarity | Claim | Falsified if | Reading |
|---|---|---|---|---|
| `OMA-UX-HOME-1` | prohibition | With an empty query, Search is never blank: it shows featured markers, or a short intro with example queries. Pairs with `FEAT-1` | A first-time visitor sees only the search box and the tab bar | **`refuted`** (live screenshot) |
| `OMA-FUNC-NAV-1` | obligation | Back from a marker detail returns to the same query, the same results and the same scroll position. Answers I2 | After Back, the query box or the results differ from before | **`refuted`**. After Back the query is "" and there are 0 results |
| `OMA-FUNC-NAV-2` | possibility | `/marker/{N}` opens marker N's detail on a cold load. Browser Back from a detail stays in the app. Answers I3; binds `not_found_handling: "single-page-application"` | `/marker/95` returns 404 or a blank app, or Back leaves the site | **`refuted`**. `/marker/95` → 404, and `history.length` stays 1 after opening a detail |
| `OMA-UX-A11Y-2` | obligation | The settings drawer moves focus inside when it opens, closes on Escape, and returns focus to the gear | Escape leaves the drawer open, or focus stays behind it | **`refuted`**. Escape didn't close it, and focus stayed on the page |

### 3.3 Nearby and Map

| Alias | Polarity | Claim | Falsified if | Reading |
|---|---|---|---|---|
| `OMA-UX-NEAR-5` | obligation | When location is denied or unavailable, Nearby and Ahead explain it in plain words and offer a next step (how to enable it, or open the Map). Refines `NEAR-3` | The browser's raw error text is shown, or there is no action | **`refuted`**. "Location unavailable: User denied Geolocation", with nothing else |
| `OMA-UX-NEAR-6` | obligation | With a location but no marker within the search limit, Nearby says so | An empty list renders with no message | `no check`. The code has no empty-state message |
| `OMA-FUNC-MAP-3` | possibility | The Map can center on the user's location in one tap | There is no such control | **`refuted`**. There is no locate control |
| `OMA-UX-MAP-4` | obligation | Once seeded, map pins render offline. Answers half of I6 | Offline, pins are missing or appear as broken images | `no check`. Pin icons load from `unpkg.com`, and the service worker has no route for them, so this probably fails |

### 3.4 Ahead (the app's name)

Today Ahead works only behind `?engine=wasm`. The README presents it as a feature. Decide which is true (section 4, Q1).

| Alias | Polarity | Claim | Falsified if | Reading |
|---|---|---|---|---|
| `OMA-FUNC-AHEAD-1` | obligation | Driving in a straight line at highway speed, a marker inside the corridor cues once, between 0.9 and 1.0 mi before it | A marker in the corridor never cues, or cues twice on one pass | `passed` (live, flagged). On a simulated I-35W drive at 29 m/s, #1470 cued at 0.9 mi and only once |
| `OMA-UX-AHEAD-2` | prohibition | The cue area never holds more than the 2 most recent cues, and a cue is removed once its marker is behind the vehicle. Pairs with `AHEAD-1` | More than 2 cues are visible, or a cue stays after its marker is passed | **`refuted`**. After 2 simulated minutes, 6 stacked cues pushed the list off screen |
| `OMA-UX-AHEAD-3` | possibility | The user can turn on spoken cues, using the browser's speech synthesis | No audible cue can be enabled | **`refuted`**. Cues are text only; `speechSynthesis` is available but unused |
| `OMA-UX-AHEAD-4` | possibility | While Ahead is open and moving, the screen stays awake (Wake Lock API, where supported) | The screen sleeps during a drive with Ahead open on a supporting browser | `no check`. There is no wake-lock code |
| `OMA-UX-AHEAD-5` | obligation | A jump status ("Location jumped…") resolves within 5 s of steady fixes at any speed up to 90 m/s | The status persists for more than 5 s of consistent fixes under 90 m/s | `no check`. Live, the status held indefinitely at 116 m/s, which is above the limit and so correct. This AC pins the boundary |

### 3.5 Data freshness and settings

| Alias | Polarity | Claim | Falsified if | Reading |
|---|---|---|---|---|
| `OMA-FUNC-DATA-VER-1` | obligation | On launch with the network up, the app compares its stored dataset version with the deployed one and re-seeds when the deployed one is newer, keeping the old copy usable until the new seed completes. Answers I1 | After a deploy with new data, an existing install still shows old data after two launches online | **`refuted`** (code). There is a single `dataSeeded` flag and no version |
| `OMA-UX-DATA-2` | prohibition | Re-download Data never discards the local copy without a confirmation. Pairs with `DATA-VER-1` | One tap deletes the database | **`refuted`** (code). `SettingsDrawer.tsx:54-62` has no confirm, and `deleteDatabase` is not awaited while Dexie holds an open connection |
| `OMA-UX-ABOUT-1` | obligation | Settings shows the deployed release ID and the dataset's date and record count, taken from the build | The shown values differ from the deployed release or the data | **`refuted`** (code). "v1.0.0" and "17,000+" are hard-coded |

### 3.6 Edge, security, delivery

| Alias | Polarity | Claim | Falsified if | Reading |
|---|---|---|---|---|
| `OMA-TECH-EDGE-7` | prohibition | Pages load with no CSP violation in the console. The edge injects no script the policy blocks. Pairs with `EDGE-6` | Any CSP violation on a cold load of `/` | **`refuted`**. Cloudflare Web Analytics injects `static.cloudflareinsights.com/beacon.min.js` and `script-src` blocks it. Either turn Web Analytics off for the zone, or decide to allow it, which needs `script-src` and `connect-src` changes |
| `OMA-SEC-EDGE-8` | obligation | HTML responses carry `Strict-Transport-Security`, `Referrer-Policy: strict-origin-when-cross-origin` (or stricter), and `Permissions-Policy` limiting geolocation to `self` | Any of the three is missing | **`refuted`**. Only `CSP` and `X-Content-Type-Options` are set |
| `OMA-TECH-CI-1` | obligation | A push to `main` deploys only after Verify (unit, Rust and e2e) passes on that commit | `deploy.yml` can run on a commit whose Verify failed | **`refuted`** (code). Deploy has no `needs:` on Verify and runs no tests itself |
| `OMA-DATA-PIPE-3` | obligation | The published `markers.json` is reproducible from the repo: the pipeline plus inputs pinned by SHA-256 give a byte-identical file, and the pipeline's bounds equal `DATA-PIPE-2`'s | A rebuild differs, or `TEXAS_BOUNDS` ≠ the AC's box | **`refuted`** (code). The #10485 fix is not in `coordinate-corrections.ts`, and the bounds differ |

## 4. Owner decisions that block final wording

| # | Question | Blocks |
|---|---|---|
| Q1 | Does Ahead graduate from the flag to a default tab for launch, or does the README stop advertising it? | 3.4, README |
| Q2 | I3: deep links `/marker/N`? (Recommended: yes. It enables sharing, makes Back work, and only needs SPA fallback.) | `NAV-2`, `EDGE-3` scope |
| Q3 | I4: should the default keyboard be text, numeric, or a toggle? | `UX-INPUT-1` |
| Q4 | Learn More: ship research files for some marker set at launch, or hide the feature and retire `LEARN-*` / `FEAT-1` / `EDGE-5` for now? | `HOME-1` route |
| Q5 | I6: keep public OSM tiles? Traffic is low today, but the OSM tile policy forbids heavy use and offline prefetch. A provider with a key (MapTiler, Stadia, Protomaps self-hosted on R2) would be the alternative. Also switch to the single `tile.openstreetmap.org` host OSM now recommends | `MAP-4`, CSP |
| Q6 | Keep or drop Cloudflare Web Analytics? | `EDGE-7` |
| Q7 | I5: throttle Nearby by distance moved (for example, re-query every 50 m), or route Nearby through the WASM grid by default? | new `PERF` AC |

## 5. Spec drift to clean up (no behaviour change)

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
- It says "Both paths answer the same commands" and presents Ahead as a feature. The default path has no Ahead.

**Smaller items**
- `src/engine/__tests__/datasetPath.ts:5` calls `markers.json` gitignored. It's tracked.
- The Map filters 0,0 markers with `&&`; Nearby uses `||`. No data hits the difference today; unify them anyway.

## 6. Done when

- Every **refuted** row in sections 1–3 is fixed or retired with a written reason.
- Q1–Q7 are answered, and the matching rows are reworded or dropped.
- The section 2 regressions (`BUILD-1`, `A11Y-1`) pass.
- Section 5 edits are merged.
- Every new AC has a test tagged with its alias, written by someone other than the implementer where possible.

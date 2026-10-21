---
title: One Mile Ahead — launch audit and proposed acceptance criteria
status: draft
created: 2026-10-21
revised: 2026-10-21 (card answers Q1, Q3–Q6; Q7 open)
audited-commit: f02f48c (Release rel-20261021-c3bfbc20)
audited-host: https://onemileahead.specdlc.com
refines: specs/acceptance/one-mile-ahead-baseline.md
tldr: "First readings against the deployed hostname, plus the board's card answers. Ahead ships and leaves ?engine=wasm; the README keeps describing it. The search box keeps a numeric default and adds a toggle. Research files ship; LEARN-*, FEAT-1 and EDGE-5 stay, and Learn More is not hidden. Public OpenStreetMap stays until SPE-188, with no host change and no pin-icon move. Cloudflare Web Analytics stays and the beacon is allowed; no disclosure line. Nearby (Q7) is open. EDGE-4 is tightened and EDGE-6 is amended for the beacon host in the baseline. 29 new ACs: 24 refuted (live or in code), 1 passed, 4 with no check yet. Those readings are the 2026-10-21 evidence and are not re-taken here. Done when is split into launch blockers and post-launch work."
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

1. **Research files ship; Learn More stays (Q4).**
   - `EDGE-5`, `LEARN-1`–`LEARN-4` and `FEAT-1` stay in force. They are not retired. Learn More is not hidden.
   - The home screen stays the featured-markers route (`FEAT-1`). It is blank in production until the research files are in the repo and deployed. Product work is SPE-185.
   - `OMA-UX-HIDE-1` and the intro replacement in `OMA-UX-HOME-1` are not the owner decision.
2. `OMA-UX-INPUT-1`: the numeric keyboard stays the default (SPE-194), and a toggle switches it to a text keyboard. A digits-only query still does a number lookup (Q3). Product work is SPE-337.
3. `OMA-FUNC-LOOKUP-5`: "#95" and "marker 95" find #95.
4. `OMA-FUNC-SEARCH-3`: title matches rank above city- and county-only matches.
5. `OMA-TECH-CI-1`: deploy waits for Verify.
6. `OMA-TECH-BUILD-1`: `npm test` passes on a clean checkout in every environment we use. It passes in CI, but the differential test timed out in a slower sandbox (section 2). The owner listed it as a blocker on the earlier `refuted` reading; it may come off this list once the test has margin.
7. `OMA-TECH-EDGE-7`: the Web Analytics beacon loads with no CSP violation (Q6). Allow the beacon. No disclosure line. `OMA-UX-PRIV-1` is not an owner decision. The beacon allowance itself is SPE-338. This issue does not change CSP.
8. `OMA-UX-A11Y-1`: every control that opens a marker works from the keyboard.
9. `OMA-SEC-EDGE-8`: HSTS, Referrer-Policy and Permissions-Policy.
10. `OMA-DATA-PIPE-3`: a rebuild from the repo can't bring back #10485's bad coordinates.

Ahead ships (Q1). The Ahead tab leaves `?engine=wasm`. The README keeps describing Ahead. Product work is SPE-336. `AHEAD-2` does not gate the tab.

### Post-launch

Everything else, each to a `passed` reading or a written retirement:
- `SEARCH-4`
- `PERF-1` (on a real phone)
- `NAV-1`
- `NAV-2` (deep links, decided yes)
- `A11Y-2`
- `NEAR-5`, `NEAR-6`. `NEAR-7` is unmarked (Q7 is open)
- `MAP-3`. `MAP-4` and `MAP-5` do not move pin icons or change the tile host in this pass (Q5)
- `AHEAD-2`, `AHEAD-3`, `AHEAD-4`, `AHEAD-5` (quality work; none of these gates the Ahead tab)
- `DATA-VER-1`, `UX-DATA-2`
- `ABOUT-1`

## 1. Section 10 (Cloudflare), first readings against the deployed hostname

| Alias | Reading 2026-10-21 |
|---|---|
| `OMA-TECH-EDGE-1` | `passed` (config). `wrangler.jsonc` has no `main`, and responses carry `cf-cache-status`, which means they are asset responses. Watch: the comment in `wrangler.jsonc:5` plans a Worker script for the marker API (issue #2), and that would refute this AC. Decide first whether EDGE-1 is retired or the API goes on a separate hostname. |
| `OMA-TECH-EDGE-2` | `passed`. The build has 14 files. The largest is `data/markers.json` at 17,764,384 B, which is under 25 MiB. |
| `OMA-TECH-EDGE-3` | `passed`. `/`, `/sw.js`, `/manifest.webmanifest` and `/data/markers.json` return 200 from the root of the custom domain. |
| `OMA-TECH-EDGE-4` | `passed` under the tightened falsifier. The falsifier now names any of `zstd`, `br` or `gzip` (baseline, 2026-10-21). The browser offered all three and got `content-encoding: zstd`: 5,410,488 B on the wire for 17,764,384 B decoded. |
| `OMA-TECH-EDGE-5` | `refuted` live: `/data/research/manifest.json` and `/data/research/95.md` both return 404. Not retired (Q4). Research files ship (SPE-185). Learn More is not hidden. |
| `OMA-SEC-EDGE-6` | `passed` under both the original and the amended claim. The live `script-src` is `'self' 'wasm-unsafe-eval'`, and the engine compiles. The amended claim (Q6) also allows `https://static.cloudflareinsights.com`. `e2e/csp-headers.test.ts` must expect that host once `EDGE-7` is fixed. |

## 2. Baseline ACs re-read at f02f48c and live

| Alias | New reading | Note |
|---|---|---|
| `OMA-TECH-BUILD-1` | `passed` in CI; **`refuted`** in a slower environment | *Corrected 2026-10-21 after the first CI runs on #6 and #7.* On GitHub's `ubuntu-latest`, Verify's `npm ci && npm test && npm run build` passed in about 2 min 20 s. In the audit sandbox (2 vCPUs), `src/engine/__tests__/differential.test.ts:176` ("lookup: identical to searchByMarkerNumber") hit its 120 s limit twice. It now runs because the full 17,371-record `markers.json` is committed, so `skipIf(!available)` no longer skips it, and it uses fake-indexeddb. The margin depends on the machine. Fix: sample the dataset, or move the full-dataset run to its own job with a longer limit. |
| `OMA-UX-A11Y-1` | **`refuted`** (live) | Result cards are `<article>` with `tabIndex = -1` and no role. The map popup body is a click-only `div`. |
| `OMA-FUNC-LOOKUP-1` | `passed` (live) | "95" → #95 first. |
| `OMA-FUNC-LOOKUP-3` | `passed` (live) | "99999" → "No markers found". |
| `OMA-FUNC-NEAR-1` | `passed` (live) | At the Stockyards: 50 results, in distance order, each with distance and direction; first in about 0.46 s. |
| `OMA-FUNC-NEAR-3` | `passed` (live), but see `UX-NEAR-5` | On denial it shows the raw browser string "User denied Geolocation". |
| `OMA-FUNC-MAP-1` | `passed` (live, partial) | Clusters render over Texas and OSM tiles load. Popup-to-detail was not exercised live. |
| `OMA-FUNC-DETAIL-1`, `-2` | `passed` (live, #95) | Directions go to 29.426111, −98.486733. |
| `OMA-FUNC-LEARN-1`–`4`, `OMA-FUNC-FEAT-1` | `refuted` in production | No research is deployed. Not retired (Q4). Learn More stays; the research files ship (SPE-185). |
| `OMA-DATA-PIPE-2` | `passed` on the committed data, with a gap | The file has 17,371 records: 0 outside the AC's bounds, 1,468 at 0,0, and #10485 now at 0,0. **But** the repo can't reproduce it. `coordinate-corrections.ts` has no entry for #10485, and `texas-bounds.ts` is still the looser box. A rebuild could bring back the Chihuahua point. See `DATA-PIPE-3`. |
| Open intent I1–I6 | I1–I3 answered; I4, I5 and I6 follow the cards | Not all six were answered. I4 is a numeric default plus a toggle. I5 is open. I6 keeps public OpenStreetMap until SPE-188. The box is `inputMode="numeric"`, which matches that default. |

## 3. Proposed acceptance criteria

The "Reading" column is the live or code reading at 2026-10-21. **Tier** is `launch` or `post` (section 0).

### 3.1 Search and lookup

| Alias | Tier | Polarity | Claim | Falsified if | Reading |
|---|---|---|---|---|---|
| `OMA-FUNC-LOOKUP-5` | launch | possibility | A number written the way people write it on a sign or in a note ("#95", "No. 95", "marker 95") is treated as marker number 95 | For some existing N, the first result for "#N" or "marker N" is not marker N | **`refuted`**. "#95" gave #3935, #9965, … (dates in inscriptions). "marker 95" gave #184, #695, #696 |
| `OMA-FUNC-SEARCH-3` | launch | obligation | A marker whose title contains every query word ranks above markers that match only on city or county. Extends `SEARCH-2` | For some query, a city- or county-only match ranks above a title match | **`refuted`**. "alamo" puts five markers in Alamo (Hidalgo County) ahead of #95 Alamo Cenotaph, which comes 6th |
| `OMA-FUNC-SEARCH-4` | post | prohibition | A keyword query never returns a marker that has no word within edit distance 1 of some query word, in any searched field. Pairs with `SEARCH-1` | Some result shares no such word with the query | **`refuted`**. "alamoo" gave #12663 Malakoff, #15828 Salado and #3912 Palacios Cemetery, and no Alamo |
| `OMA-UX-PERF-1` | post | obligation | On a real mid-range phone, named in the reading, results for a typed query appear within 300 ms at p95, and typing never drops characters | p95 above 300 ms over a fixed set of 20 queries on that phone | `no check`. Stays `no check` until measured on a real phone. *Context only, not a reading:* desktop Chromium took 200–850 ms per query on the main thread |
| `OMA-UX-INPUT-1` | launch | obligation | The search box opens the numeric keyboard by default (SPE-194). A toggle switches it to a text keyboard and back. A query of digits only still runs the number lookup (`LOOKUP-1`–`3`) (Q3). Product work is SPE-337 | The default `inputmode` is not `numeric`; or there is no toggle between numeric and text; or a digits-only query does not return the number-lookup results | Pre-card reading, kept: **`refuted`**. `inputmode="numeric"` (`SearchInput.tsx:14`), and `SearchInput.test.tsx:26-28` asserts `numeric`, so the test changes with the fix |

### 3.2 Home, navigation, state

| Alias | Tier | Polarity | Claim | Falsified if | Reading |
|---|---|---|---|---|---|
| `OMA-UX-HOME-1` | — | — | Not adopted (Q4). Featured markers stay (`FEAT-1`). An intro with example queries does not replace them. The home screen is blank until the research files ship (SPE-185) | Featured markers are replaced by an intro, or Learn More is hidden because the research files are not deployed yet | Pre-card reading, kept: **`refuted`** (live screenshot) |
| `OMA-UX-HIDE-1` | — | — | Not an owner decision (Q4). Learn More is not hidden. `LEARN-*`, `FEAT-1` and `EDGE-5` are not retired. Research files ship (SPE-185) | This row is used to hide Learn More or to retire those ACs | Pre-card reading, kept: **`refuted`**. Live: every launch requests `/data/research/manifest.json`, opening #95 requests `/data/research/95.md`, and both return 404 |
| `OMA-FUNC-NAV-1` | post | obligation | Back from a marker detail returns to the same query, the same results and the same scroll position. Answers I2 | After Back, the query box or the results differ from before | **`refuted`**. After Back the query is "" and there are 0 results |
| `OMA-FUNC-NAV-2` | post | possibility | `/marker/{N}` opens marker N's detail on a cold load, and browser Back from a detail stays in the app. Decided yes (Q2); binds `not_found_handling: "single-page-application"` | `/marker/95` returns 404 or a blank app, or Back leaves the site | **`refuted`**. `/marker/95` → 404, and `history.length` stays 1 after opening a detail |
| `OMA-UX-A11Y-2` | post | obligation | The settings drawer moves focus inside when it opens, closes on Escape, and returns focus to the gear | Escape leaves the drawer open, or focus stays behind it | **`refuted`**. Escape didn't close it, and focus stayed on the page |

### 3.3 Nearby and Map

| Alias | Tier | Polarity | Claim | Falsified if | Reading |
|---|---|---|---|---|---|
| `OMA-UX-NEAR-5` | post | obligation | When location is denied or unavailable, Nearby and Ahead explain it in plain words and offer a next step (how to enable it, or open the Map). Refines `NEAR-3` | The browser's raw error text is shown, or there is no action | **`refuted`**. "Location unavailable: User denied Geolocation", with nothing else |
| `OMA-UX-NEAR-6` | post | obligation | With a location but no marker within the search limit, Nearby says so | An empty list renders with no message | `no check`. The code has no empty-state message |
| `OMA-UX-NEAR-7` | — | — | Unmarked. The owner has not decided how Nearby should limit its work (Q7). A 50 m re-query is not an answer. The board asked for a brief | This row is read as an owner decision, including a 50 m re-query | Pre-card reading, kept: **`refuted`** (code). `useNearbyMarkers.ts:73` runs `db.markers.toArray()` and a full sort on every change of lat or lng |
| `OMA-FUNC-MAP-3` | post | possibility | The Map can center on the user's location in one tap | There is no such control | **`refuted`**. There is no locate control |
| `OMA-UX-MAP-4` | — | — | No pin-icon move in this pass (Q5). Pin icons stay on `unpkg.com` until SPE-188. This row does not require serving them from the app origin | This pass moves pin icons off `unpkg.com`, or treats an `unpkg.com` icon request as a failure of the kept call | Pre-card reading, kept: **`refuted`** (code). Icons come from `unpkg.com` (`MapPage.tsx:15-17`), and the service worker has no route for them |
| `OMA-TECH-MAP-5` | — | — | Public OpenStreetMap stays until SPE-188 (Q5, the 2026-10-14 call). No host change in this pass. Tiles may keep using `{a,b,c}.tile.openstreetmap.org`. This row does not require the single `tile.openstreetmap.org` host | This pass switches the tile host, or drops public OpenStreetMap | Pre-card reading, kept: **`refuted`** (live). Tiles load from `https://c.tile.openstreetmap.org/...`; the attribution is present |

### 3.4 Ahead (the app's name)

Ahead works today only behind `?engine=wasm`.
- **Q1:** Ship Ahead. The Ahead tab leaves `?engine=wasm`. The README keeps describing Ahead. Product work is SPE-336. This does not wait on `AHEAD-2`, and the README does not stop advertising Ahead.
- `AHEAD-1` already passes behind the flag.

| Alias | Tier | Polarity | Claim | Falsified if | Reading |
|---|---|---|---|---|---|
| `OMA-FUNC-AHEAD-1` | — | obligation | Driving in a straight line at highway speed, a marker inside the corridor cues once, between 0.9 and 1.0 mi before it | A marker in the corridor never cues, or cues twice on one pass | `passed` (live, flagged). On a simulated I-35W drive at 29 m/s, #1470 cued at 0.9 mi and only once |
| `OMA-UX-AHEAD-2` | post | prohibition | The cue area never holds more than the 2 most recent cues, and a cue is removed once its marker is behind the vehicle. Pairs with `AHEAD-1`. Does not gate the Ahead tab (Q1) | More than 2 cues are visible, or a cue stays after its marker is passed | **`refuted`**. After 2 simulated minutes, 6 stacked cues pushed the list off screen |
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
| `OMA-UX-PRIV-1` | — | — | Not an owner decision (Q6). The card did not require a disclosure line. Do not add one. Keeping Cloudflare Web Analytics and allowing the beacon is `EDGE-7` and the baseline `EDGE-6` amendment. The beacon allowance is SPE-338 | A disclosure line is required by this AC | Pre-card reading, kept: **`refuted`**. There is no disclosure (`SettingsDrawer.tsx`). See the note under Q6 about Fondue |
| `OMA-SEC-EDGE-8` | launch | obligation | HTML responses carry `Strict-Transport-Security`, `Referrer-Policy: strict-origin-when-cross-origin` (or stricter), and a `Permissions-Policy` that limits geolocation to `self` | Any of the three is missing | **`refuted`**. Only `CSP` and `X-Content-Type-Options` are set |
| `OMA-TECH-CI-1` | launch | obligation | A push to `main` deploys only after Verify (unit, Rust and e2e) passes on that commit | `deploy.yml` can run on a commit whose Verify failed | **`refuted`** (code). Deploy has no `needs:` on Verify and runs no tests itself |
| `OMA-DATA-PIPE-3` | launch | obligation | The published `markers.json` is reproducible from the repo: the pipeline plus inputs pinned by SHA-256 give a byte-identical file, and the pipeline's bounds equal `DATA-PIPE-2`'s | A rebuild differs, or `TEXAS_BOUNDS` ≠ the AC's box | **`refuted`** (code). The #10485 fix is not in `coordinate-corrections.ts`, and the bounds differ |

## 4. Owner decisions (cards, 2026-10-21)

Q7 is open. The other rows are the board's card answers. Q2 was not part of this correction.

| # | Question | Answer | Effect |
|---|---|---|---|
| Q1 | Does Ahead graduate from the flag? | Ship it. The Ahead tab leaves `?engine=wasm`. The README keeps describing Ahead. It does not wait on `AHEAD-2` | Product work is SPE-336 |
| Q2 | I3: deep links? | Yes: `/marker/N` with SPA fallback | `NAV-2` stays (post-launch) |
| Q3 | I4: default keyboard? | Add a toggle. Numeric stays the default (SPE-194). A digits-only query still does a number lookup | `UX-INPUT-1` reworded (launch). Product work is SPE-337 |
| Q4 | Learn More at launch? | Ship the research files (SPE-185). Do not retire `LEARN-*`, `FEAT-1` or `EDGE-5`. Do not hide Learn More | No retirement in the baseline. `HIDE-1` is not the decision. Featured markers stay until the files ship |
| Q5 | I6: map tiles and icons? | Keep the 2026-10-14 call. Public OpenStreetMap stays until SPE-188. No host change, and no pin-icon move, in this pass | `MAP-4` and `MAP-5` do not require a new host or a pin move |
| Q6 | Cloudflare Web Analytics? | Keep it and allow the beacon. No disclosure line | `EDGE-6` keeps the beacon-host amendment. The beacon allowance is SPE-338. `PRIV-1` is not required. CSP is not changed in this issue |
| Q7 | I5: Nearby cost? | Open. Not decided. The board asked for a brief | `OMA-UX-NEAR-7` is unmarked as an owner decision. A 50 m re-query is not recorded as an answer |

**Note on Q6 and Fondue (2026-10-21).** On `fondue.specdlc.com` the Cloudflare beacon loads. There is no CSP header, and no disclosure line is visible on the page. Fondue's own `ac/FONDUE-SITE-4.md` claims the site "sends no analytics or visitor data", so that AC is refuted by its live site. Q6 keeps Cloudflare Web Analytics and allows the beacon. It does not add a disclosure line. That line was not on the card. `PRIV-1` is not an owner requirement.

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
- Q1 keeps the description of Ahead: the intro sentence (nearby, and the marker coming up on the road), the engine sentence (both paths answer the same commands, including ahead), and the "Nearby and ahead" bullet. The README does not stop advertising Ahead.

**Smaller items**
- `src/engine/__tests__/datasetPath.ts:5` calls `markers.json` gitignored. It's tracked.
- The Map filters 0,0 markers with `&&`; Nearby uses `||`. This is a code change, so it is **not** in the drift PR. No data hits the difference today; unify them in a code PR.

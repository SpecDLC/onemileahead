# Design: wasm-engine

## ID: wasm-engine

## Description
How the One Mile Ahead engine is built: a pure Rust core, a JSON-over-C-ABI WebAssembly shell, a
small TypeScript wrapper, and the proof that the port matches the existing TypeScript.

## Component/Module Design

```
crates/oma-core   pure Rust, no I/O
  geo.rs          haversine, bearing, formatDistance, formatBearing (JS-exact rounding)
  index.rs        Engine: markers sorted by id, grid, number index, text index
  nearby.rs       grid ring search with an exact termination bound
  ahead.rs        heading/speed estimation, corridor projection, cue state machine
  lookup.rs       port of searchByMarkerNumber (IndexedDB key order + numeric collation)
  search.rs       token index, field-weighted scoring
  research.rs     port of projectResearch
  command.rs      JSON command dispatch: (state, input) -> output
crates/oma-wasm   oma_alloc / oma_free / oma_call, panic -> JSON error
src/engine/       TS wrapper (instantiate, call, fallback)
prototypes/       ahead-demo.html (assembled by build.sh)
```

### Load options
`load` builds all three indexes by default. `lazy_text: true` defers the text index to the first
`search`; it is ~2/3 of native load time. The flagged app uses lazy (its search stays on Fuse).

### State model
Every command is `(state, input) -> (output, state')`. `load` replaces the index; `ahead` reads the
index and the cue state and returns a new cue state. The WASM shell holds the current state between
calls; the core functions take and return it explicitly, which is what the Rust tests exercise.

### Spatial grid (load / nearby / ahead)
- Cells are 0.015° latitude × 0.015° longitude (≈ 1.04 mi × 0.89 mi at 31°N). Key = (floor(lat/c), floor(lng/c)).
- Markers at exactly 0,0 never enter the grid (mirrors the `m.lat !== 0 || m.lng !== 0` filter).
- `nearby` searches rings k = 0, 1, 2 … around the query cell. After ring k, every unvisited marker
  is at least `min(R·k·c_lat, R·asin(cos φ · sin(k·c_lng)))` away (meridional distance and the exact
  distance to a meridian great circle). Search stops when it holds `limit` candidates whose worst
  distance is below that bound (or the bound exceeds `radius_mi`). A 1e-9 mi slack covers rounding.
  Past ring 64 (≈ 60 mi) it falls back to a full scan — still exact, just slower. Queries within 1°
  of the antimeridian or beyond 85° latitude use the scan (the grid doesn't wrap), and markers whose
  coordinates are outside ±90/±180 (one in the 2026 export) stay out of the grid and are checked on
  every query.
- Ties are broken by marker id, reproducing JS's stable sort over Dexie's primary-key order.

### Ahead (v1, straight-line projection)
0. **GPS jumps.** A fix implying > 90 m/s (≈ 200 mph) from the previous kept fix is dropped as a
   one-off outlier (wifi/cell fallback). If the next fix agrees with it, the jump was real and the
   track restarts there. While the newest fix is an unconfirmed jump the status is `gps_jump`:
   nothing is listed, cued or re-armed from it.
1. **Motion estimate.** Use the newest fix's `heading` and `speed` when present (`speed` in m/s, as
   the Geolocation API reports it). Otherwise estimate from a *baseline*: walk back from the newest
   fix to the first earlier fix that is ≥ 100 m away, ≥ 3 fixes back and ≤ 45 s older; it counts
   only if the path between is straight (net ≥ 0.7 × path length) and steady (every step moves
   forward along the net direction). Heading = bearing(baseline → newest), speed = distance/Δt. The
   estimate is accepted only if the baselines ending at the two previous fixes agree (heading within
   20°, speed within 2×); otherwise the vehicle is treated as stationary. A device heading with no
   speed (reported or estimable) gives `no_speed`, never a cue. Moving means ≥ 2.2 m/s (≈ 5 mph).
   *Why so strict:* stationary GPS error both jumps and wanders. With a 40 m single baseline,
   independent ±30 m jitter faked travel a few times per thousand fixes, and smoothly wandering
   error (σ 20–30 m, 20–60 s correlation) fired dozens of cues per 10,000 fixes. Three agreeing
   100 m baselines remove both in the tests (independent jitter to ±50 m with ≤ 1% "moving" flicker
   at ±50 m; correlated drift to σ 30 m, τ 60 s). Larger stationary error can still fool it; a
   device-reported (Doppler) speed, which most phones supply, is the real defence.
   *Device speed vs the track:* a device speed is used unless the track clearly contradicts it. A
   "moving" device speed (≥ 2.2 m/s) is overruled when the fastest chord to the newest fix from any
   fix 3–10 s back is under 1.1 m/s (`STILL_MPS`): frozen or repeated coordinates, e.g. a cached
   fix. A "stopped" device speed is overruled by an accepted moving estimate (three agreeing
   baselines), e.g. a device that reports 0 while driving.
2. **Projection.** Local tangent plane at the newest fix: x = R·Δλ·cos φ, y = R·Δφ. With heading h,
   along = x·sin h + y·cos h, cross = x·cos h − y·sin h (positive = right of travel).
3. **Corridor.** Candidates come from grid cells within `horizon_mi` (+ corridor) of the fix; keep
   0 < along ≤ horizon and |cross| ≤ corridor_ft. Order by along, then id. ETA = along / speed.
4. **Cues.** A marker cues when it is in the corridor, moving, and along ≤ 1.0 mi, and it is not in
   the `announced` set, and the track itself shows travel: some fix 3–10 s back is at least 1.1 m/s
   away by chord. So a lone fix with a device heading and speed lists markers but doesn't announce
   one (a cue is spoken once); at highway speed this delays a cue by about 3 s.
   When the newest fix has neither a device speed nor a device heading, only the track says we are
   moving, so a cue also needs the estimated speed ≥ 4.4 m/s (`UNCONFIRMED_CUE_MPS`, 2 × the
   moving floor): a slow steady 4 m/s GPS drift of a stopped phone lists nothing it can announce. Once announced it stays silent until every kept fix over the last 20 s
   (`REARM_CLEAR_MS`, counting the newest fix at or before that cutoff) is more than 2.0 mi
   (straight-line) from it, which re-arms it. A single plausible-speed bad fix, or a short run of
   agreeing ones that restarts the track, can't re-arm. Stops can't cue (not moving); jitter can't re-cue
   (announced); a U-turn doesn't re-cue markers just passed (still within 2 mi). By design, coming
   back along the same road after going more than 2 mi past a marker announces it again.

**Where straight-line projection fails** (the reasons v2 wants a route polyline):
- *Curves*: on a bend the tangent line leaves the road; markers on the outside of the curve drift out
  of the corridor and markers off the inside can enter it. Along-track distance under-reads true
  road distance, so ETA is early.
- *Interchanges and frontage roads*: heading during a cloverleaf or ramp points the corridor the wrong
  way for 10–30 s; markers on a parallel frontage road look "ahead" while the highway diverges.
- *Fork choice*: at a split (I-35E/I-35W) the engine cannot know which branch you'll take.
- *Low speed / city grids*: turns every few blocks make "ahead" short-lived; the corridor flickers.
A route polyline (from snapping or the planned route) would give true along-route distance, follow
curves, pick the branch, and make ETA meaningful; markers would be projected onto the polyline
rather than a ray.

### Lookup (exact port of searchByMarkerNumber)
1. Trim the query (JS whitespace set). Empty → [].
2. Take every marker whose number starts with it (Dexie's `startsWith` key range over the
   UTF-16-ordered `markerNumber` index).
3. Sort with the TS comparator: exact match first, then numeric collation, then primary key; then
   keep the first `limit`. Until #13 the TS cut to `limit` *before* sorting, in string order, and the
   port copied that; both now return the lowest-numbered matches (`OMA-FUNC-LOOKUP-2`).

### Search
Inverted index over lower-cased, accent-folded tokens of title/county/city/markerText. A query token
matches an index token exactly (1.0), as a prefix (0.8), or within edit distance 1 for tokens of
5+ chars (0.6). Score = Σ fieldWeight × match × fieldNorm, fieldNorm = 1/√(field token count) like
Fuse; all query tokens must match somewhere. Ties by id.

Known approximation: `localeCompare(…, {numeric: true})` is ICU collation. The port compares
digit runs by value and other characters case-insensitively — exact for all-digit marker numbers
(every number in the 2026-10-13 export), approximate otherwise.

### Research
Line-by-line port of `parseFrontmatter`, `parseLinksSection` and `projectResearch`, including the JS
`trim` whitespace set, the `lastIndexOf('##', …)` section boundary and the link regex semantics.
Both map only the three real headings. Until #13 the TS looked headings up in an object literal, so
`## Constructor` and `## __proto__` reached `Object.prototype`; it now uses a `Map`
(`OMA-FUNC-LEARN-4`), and a differential test checks those headings project identically.

### JSON numbers
serde_json's default float parser is not correctly rounded (it read `0.09999999999999999` as
`0.1`, flipping `formatDistance` from "528 ft" to "0.1 mi"). The workspace enables
`float_roundtrip`, so every coordinate crosses the boundary bit-exactly. JSON can't carry NaN or
±Infinity, so the formatters can't be asked about them (the TS returns "NaN mi"/`undefined`), and
values ≥ 1e21 print in full where JS switches to exponent form; neither occurs in practice.

### Panics
`panic=unwind` with WebAssembly exception handling (legacy encoding), so std is always rebuilt
with `-Zbuild-std=std,panic_unwind`; the prebuilt wasm32 std is `panic=abort` and would trap.
Browser support: Chrome 95+, Firefox 100+, Safari 15.2+, Node 17+.

## API Contracts
Request: `{"cmd": "<name>", ...input}`. Response: `{"ok": true, ...output}` or `{"ok": false, "error": "..."}`.

| cmd | input | output |
|-----|-------|--------|
| load | `markers: Marker[], lazy_text?` | `count, spatial, cells, tokens` (0 when lazy) |
| nearby | `lat, lng, limit?=50, radius_mi?` | `results: [{marker, distance, bearing}]` |
| ahead | `fixes, horizon_mi?=10, corridor_ft?=2000, cue_mi?=1` | `status` (ok, no_fixes, stationary, no_heading, no_speed, gps_jump), `heading, speed_mps, results: [{marker, along_mi, cross_ft, side, eta_s}], cues` (same item shape, fired this call) |
| reset_cues | — | — |
| lookup | `number, limit?=20` | `results: Marker[]` |
| search | `q, limit?=20` | `results: Marker[]` |
| research | `markdown` | `result: MarkerResearch \| null` |
| panic_test | — | always a panic (exercises the panic → JSON path; harmless) |
| geo | `fn, args` | `value` (haversine, bearing, formatDistance, formatBearing — for differential tests) |

## Data Flow
```
GPS fix ─► useAhead (TS) ─► engine.call({cmd:"ahead", fixes}) ─► WASM: grid → project → cue FSM ─► list + cues
Dexie markers ─(once)─► engine.call({cmd:"load"}) ─► grid / number / text indexes in WASM memory
```

## Dependencies
- requirements/wasm-engine
- serde + serde_json (only crates), Rust 1.97.0 pinned in `rust-toolchain.toml`

## Status: ACTIVE

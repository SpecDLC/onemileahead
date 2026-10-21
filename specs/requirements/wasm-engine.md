# Requirements: wasm-engine

## ID: wasm-engine

## Description
A Rust engine, compiled to WebAssembly, that tells a passenger which historical markers are
coming up **ahead** on the road — the thing the app's name promises and nothing currently does.
It also re-implements the existing hot paths (nearby, marker-number lookup, research projector)
so they can be proved equivalent to the TypeScript versions, and adds an indexed text search.

This is a **prototype** that de-risks the core ideas. It does not replace Dexie, Fuse.js or
Leaflet, and it ships only behind the `?engine=wasm` URL flag.

## User Stories
- **US-WE-01**: As a passenger, I want a list of markers coming up ahead of the car, ordered by how
  far down the road they are, so I know what to look out for.
- **US-WE-02**: As a passenger, I want a single cue when a marker is about one mile ahead, so I have
  time to look — and I don't want it repeated because GPS wobbles or we're stopped at a light.
- **US-WE-03**: As a developer, I want the engine's outputs proved equal to the current TypeScript
  functions on the same inputs, so switching paths can't silently change behaviour.
- **US-WE-04**: As a developer, I want hard numbers (size, load time, latency on desktop and
  throttled mobile CPU) to decide whether the engine earns a place in the app.

## Acceptance Criteria

### AC-WE-01: Workspace and ABI
- [x] `crates/oma-core` is pure Rust with no I/O.
- [x] `crates/oma-wasm` exports exactly `memory`, `oma_alloc(len) -> ptr`, `oma_free(ptr, len)` and
      `oma_call(ptr, len) -> ptr`; no wasm-bindgen; loads with plain `WebAssembly.instantiate`.
- [x] `oma_call` takes a UTF-8 JSON command and returns a pointer to `[u32 LE length][JSON bytes]`;
      the buffer is exactly `4 + length` bytes and is released with `oma_free(ptr, 4 + length)`.
- [x] A panic inside a command becomes `{"ok":false,"error":"panic: …"}`, never a trap; the engine
      keeps working afterwards.

### AC-WE-02: load
- [x] Accepts the `Marker[]` shape of `src/types/marker.ts`.
- [x] Builds a spatial grid index (cells ≈ 1 mi), a marker-number index and a text index.
- [x] Markers at exactly 0,0 are kept for lookup/search but excluded from every spatial query.

### AC-WE-03: nearby
- [x] `nearby {lat, lng, limit, radius_mi?}` returns `{marker, distance, bearing}` items.
- [x] With no radius, output is identical to `useNearbyMarkers` for the same markers and position:
      same markers in the same order, distances and bearings equal to 1e-9.
- [x] With a radius, output equals the TS output filtered to `distance <= radius_mi`.
- [x] Uses the grid; does not scan every marker on the common path.

### AC-WE-04: ahead
- [x] `ahead {fixes, horizon_mi, corridor_ft}` with fixes `{lat, lng, t, heading?, speed?}`.
- [x] Uses device heading/speed when present; otherwise estimates both from the recent fixes.
- [x] Returns markers inside a forward corridor (0 < along ≤ horizon, |cross| ≤ corridor), ordered
      by along-track distance, each with along-track miles, cross-track feet, side and ETA.
- [x] Emits a "one mile ahead" cue at most once per marker; GPS jitter, GPS jumps, stops and U-turns
      do not re-announce. A marker re-arms only once the vehicle has been more than 2 mi from it
      for 20 s of kept fixes (a jump that passes the speed check doesn't count), so
      returning along the same road later announces it again (by design).
- [x] When stationary or heading is unknown, returns no ahead list and no cues, with a status saying why.
- [x] v1 uses straight-line projection; its failure modes are documented in the design spec.

### AC-WE-05: lookup
- [x] `lookup {number, limit?}` returns exactly what `searchByMarkerNumber` returns, in order, for
      all-digit marker numbers (every number in the export); ICU collation is approximated otherwise.

### AC-WE-06: search
- [x] `search {q, limit}` over title, county, city, inscription with Fuse's field weights (3/2/2/1).
- [x] Top-10 overlap with Fuse is measured and reported for 20 fixed queries.

### AC-WE-07: research
- [x] `research {markdown}` returns exactly what `projectResearch` returns for every fixture.

### AC-WE-08: Proof
- [x] Differential vitest suite compares TS and WASM on haversine, bearing, formatDistance,
      formatBearing, lookup, nearby and the research projector; `npm test` runs it.
- [x] Rust tests drive `ahead` with synthetic traces: straight I-35 northbound, U-turn, jitter while
      stopped, missing heading, Texas boundary, 0,0 markers excluded.

### AC-WE-09: Demo
- [x] `prototypes/ahead-demo.html` is one self-contained file (WASM inlined as base64, < 16 MB).
      *2026-10-21:* the demo's template and fonts are not in this public repository, so `./build.sh`'s last step (`scripts/assemble-demo.mjs`) cannot run from a clean clone. The README says so.
- [x] Simulated drive along a real Texas highway at adjustable speed, a live "Up ahead" list, a cue
      banner at ~1 mi, and a toggle to compare with the old nearest-first list.
- [x] States which marker subset is embedded.

### AC-WE-10: App integration (flagged)
- [x] `src/engine/` wraps the module; `?engine=wasm` routes Nearby through it and adds an Ahead tab.
- [x] If the module fails to load, the app falls back to the TS path. Dexie, Fuse, Leaflet stay.
- [x] `npm run build` still succeeds.

### AC-WE-11: Measurement
- [x] WASM size, full-dataset load/index time, and `nearby`/`ahead` latency vs the TS full scan on
      desktop and with mobile CPU throttling, reported in the PR.

## Dependencies
- data-pipeline (marker data; see the status note below)
- learn-more (research projector being ported)

## Notes
- *2026-10-21:* an earlier note here referred to an `INDEX.md` that is not in the repository; removed. `requirements/data-pipeline.md` is now `Status: ACTIVE` and matches the code.
- Ahead ships only behind `?engine=wasm`. It becomes a default tab once `OMA-UX-AHEAD-2` passes (owner, Q1 in `acceptance/one-mile-ahead-launch-audit.md`).

## Status: ACTIVE

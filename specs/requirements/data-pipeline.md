# Requirements: Data Pipeline

## ID: data-pipeline

## Description
`scripts/prepare-data.ts` converts the THC sources (CSV + shapefile) into `public/data/markers.json`, the file the app downloads and stores in IndexedDB. The marker-level contract lives in `specs/acceptance/` (`OMA-DATA-PIPE-1`–`3`); this file describes the pipeline that has to meet it.

*Revised 2026-10-21 to match the code at f02f48c (spec-drift cleanup from the launch audit). No behaviour changed.*

## Data Sources
- **CSV** (THC Atlas data download): one file per export in `data/csv/`, named with its export date (`YYYY-MM-DD`). 23 columns, including the inscription (`MarkerText`) and UTM coordinates. The 2026-10 export that built the committed `markers.json` has 17,371 records.
- **Shapefile** (`data/HistoricalMarkers/`): points in **NAD83 / Texas State Mapping System (EPSG:3081), in metres**, not degrees. Joined to the CSV on `MarkerNum`.

Neither source is in this repository (see README). `public/data/markers.json` is committed.

## Acceptance Criteria

### AC-DP-01: CSV selection and parsing
- [x] Parse the THC CSV, handling quoted fields with newlines and commas (`scripts/csv-parser.ts`)
- [x] Pick the CSV whose file name carries the latest `YYYY-MM-DD` date; stop rather than guess if a CSV has no date or two share one (`selectLatestCsv`)

### AC-DP-02: Shapefile coordinates
- [x] Read each shapefile point and reproject it from EPSG:3081 to WGS84 latitude/longitude, rounded to 6 places (`scripts/texas-mapping.ts`)
- [x] Build a lookup keyed by `MarkerNum`

### AC-DP-03: Coordinate merge
- [x] Prefer the reprojected shapefile point when it falls inside `TEXAS_BOUNDS`
- [x] Otherwise use the CSV's UTM point converted to WGS84, when that falls inside `TEXAS_BOUNDS`
- [x] Otherwise set the marker to exactly 0,0 (no position)
- [x] Then apply the hand-checked corrections table (`scripts/coordinate-corrections.ts`), each entry naming its source
- [x] Stop the run if fewer than 85% of markers end up with coordinates (`assertCoordinateCoverage`)

### AC-DP-04: Schema transformation
- [x] Transform to the `Marker` interface: id, markerNumber, title, county, city, lat, lng, markerText, markerDate, subjectCodes[], isRTHL, size
- [x] Parse subject codes from the semicolon-delimited `Code` field
- [x] Parse the RTHL boolean from the `Rthl` field
- [x] Generate a sequential integer id

### AC-DP-05: Output
- [x] Write `public/data/markers.json` (plain JSON). The app fetches this file; Cloudflare compresses it on the wire (`OMA-TECH-EDGE-4`)
- Legacy outputs: the pipeline also writes `markers.json.gz` and `fuse-index.json`. The app never loads either, and `public/.assetsignore` keeps both out of the deploy. The Fuse index's options (weights 0.3/0.25/0.2/0.15/0.1, threshold 0.3, includes `markerNumber`) also differ from the runtime search (weights 3/2/2/1, threshold 0.4). Removing these outputs is a code change and is left to a code PR.

### AC-DP-06: Data validation
- [x] Every marker has a markerNumber and a title
- [x] Coordinates are inside `TEXAS_BOUNDS` or exactly 0,0
- Duplicate marker numbers: none in the current data; not checked by the pipeline

**Known gap.** `TEXAS_BOUNDS` (`scripts/texas-bounds.ts`: lat 25.5–36.8, lng −106.9 to −93.2) is looser than the box in `OMA-DATA-PIPE-2` (lat 25.8–36.5, lng −106.6 to −93.5). The committed data meets the stricter box, but only because #10485 was moved to 0,0 outside this repository. `OMA-DATA-PIPE-3` (launch blocker) requires the pipeline's bounds to equal the AC's and the published file to be reproducible from the repo.

### AC-DP-07: UTM to WGS84 conversion
- [x] Convert CSV UTM coordinates to latitude/longitude when the shapefile has no usable point (`scripts/utm-converter.ts`)
- [x] Any zone number is accepted. Texas spans zones 13–15, and the data includes zone-15 records; a few are mislabelled, which the corrections table fixes

## Dependencies
- THC CSV export in `data/csv/`
- THC shapefile in `data/HistoricalMarkers/`

## Status: ACTIVE

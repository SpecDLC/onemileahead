# Requirements: Data Pipeline

## ID: data-pipeline

## Description
Convert raw THC data sources (CSV + shapefile) into the compressed app-ready format with Fuse.js search index.

## Data Sources
- **CSV** (via THC Atlas API): 17,368 records, 23 columns, has MarkerText inscription
- **Shapefile**: 16,123 features, has lat/lng, 8 fields only

## Acceptance Criteria

### AC-DP-01: CSV parsing
- [ ] Parse THC CSV correctly handling quoted fields with newlines/commas
- [ ] Extract all 23 fields per record

### AC-DP-02: Shapefile coordinate extraction
- [ ] Read shapefile and extract lat/lng for each marker
- [ ] Create lookup map by MarkerNum or Atlas_Number

### AC-DP-03: Data merging
- [ ] Merge CSV metadata with shapefile coordinates
- [ ] Join on matching identifier (MarkerNum or Atlas_Number)
- [ ] Handle records present in CSV but missing from shapefile (use UTM→WGS84 conversion if available)

### AC-DP-04: Schema transformation
- [ ] Transform to Marker interface: id, markerNumber, title, county, city, lat, lng, markerText, markerDate, subjectCodes[], isRTHL, size
- [ ] Parse subject codes from semicolon-delimited Code field
- [ ] Parse RTHL boolean from Rthl field
- [ ] Generate sequential integer id

### AC-DP-05: Output compression
- [ ] Write markers as JSON, gzip compressed to public/data/markers.json.gz
- [ ] Compressed size under 5MB

### AC-DP-06: Fuse.js index generation
- [ ] Build Fuse.js index on title, markerText, county, city fields
- [ ] Serialize index to public/data/fuse-index.json
- [ ] Index loadable by Fuse.parseIndex() at runtime

### AC-DP-07: Data validation
- [ ] All markers have markerNumber
- [ ] All markers have title
- [ ] Coordinates within Texas bounds (lat 25.8-36.5, lng -106.6 to -93.5)
- [ ] No duplicate marker numbers (warn only — some legitimate duplicates may exist)

### AC-DP-08: UTM to WGS84 conversion
- [ ] Convert UTM coordinates from CSV to lat/lng when shapefile coordinates unavailable
- [ ] UTM Zone 13 and 14 supported (covers Texas)

## Dependencies
- THC CSV data downloaded
- THC shapefile downloaded

## Status: DRAFT

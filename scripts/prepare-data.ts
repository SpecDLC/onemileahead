/**
 * Data pipeline: CSV + Shapefile → markers.json (served), plus legacy markers.json.gz and
 * fuse-index.json, which the app never loads and public/.assetsignore keeps out of the deploy
 *
 * Usage (as module, exported functions tested individually):
 *   csvRowToMarker(row, id) — transform one CSV row to Marker
 *   mergeCoordinates(marker, shapefileLookup) — prefer shapefile coords, then UTM, inside Texas only
 *   assertCoordinateCoverage(markers, minShare) — stop if too few markers have coordinates
 *   selectLatestCsv(dir) — the CSV with the latest YYYY-MM-DD in its file name
 *
 * Usage (CLI):
 *   npx tsx scripts/prepare-data.ts
 */
import { readdirSync } from 'fs';
import { join } from 'path';
import type { Marker } from '../src/types/marker';
import { utmToLatLng } from './utm-converter';
import { texasMappingToLatLng, isInTexas } from './texas-mapping';
import { applyCorrections } from './coordinate-corrections';

// Share of markers that must end up with coordinates. The 2026-02-28 THC data
// gives 91%; a projection mix-up drops it far lower, so the run stops instead.
const MIN_COORDINATE_SHARE = 0.85;

/**
 * Transform a parsed CSV row into a Marker object.
 * UTM coordinates are converted to WGS84 lat/lng when present.
 */
export function csvRowToMarker(
  row: Record<string, string>,
  id: number,
): Marker {
  const utmZone = parseInt(row.Utm_Zone || '0', 10);
  const utmEast = parseFloat(row.Utm_East || '0');
  const utmNorth = parseFloat(row.Utm_North || '0');

  let lat = 0;
  let lng = 0;

  if (utmZone > 0 && utmEast > 0 && utmNorth > 0) {
    const converted = utmToLatLng(utmEast, utmNorth, utmZone, true);
    lat = Math.round(converted.lat * 1e6) / 1e6;
    lng = Math.round(converted.lng * 1e6) / 1e6;
  }

  const codes = (row.Code || '')
    .split(';')
    .map((c) => c.trim())
    .filter(Boolean);

  return {
    id,
    markerNumber: (row.MarkerNum || '').trim(),
    title: (row.Title || '').trim(),
    county: (row.County || '').trim(),
    city: (row.City || '').trim(),
    lat,
    lng,
    markerText: (row.MarkerText || '').trim(),
    markerDate: (row.Year || '').trim(),
    subjectCodes: codes,
    isRTHL: (row.Rthl || '').trim().toLowerCase() === 'true',
    size: (row.Size || '').trim(),
  };
}

/**
 * Merge shapefile lat/lng coordinates into a marker, preferring shapefile data.
 * Falls back to existing (UTM-converted) coordinates if no shapefile match.
 * A coordinate outside Texas counts as missing, so a bad source point becomes 0,0.
 */
export function mergeCoordinates(
  marker: Marker,
  shapefileLookup: Map<string, { lat: number; lng: number }>,
): Marker {
  const shapeCoords = shapefileLookup.get(marker.markerNumber);
  if (shapeCoords && isInTexas(shapeCoords.lat, shapeCoords.lng)) {
    return { ...marker, lat: shapeCoords.lat, lng: shapeCoords.lng };
  }
  if (isInTexas(marker.lat, marker.lng)) {
    return marker;
  }
  return { ...marker, lat: 0, lng: 0 };
}

/**
 * Throws if fewer than `minShare` of the markers have coordinates. This is how
 * a projection or source-format change shows up, so the run stops instead of
 * publishing a dataset whose map and Nearby are wrong.
 */
export function assertCoordinateCoverage(markers: Marker[], minShare: number): void {
  const withCoords = markers.filter((m) => m.lat !== 0 || m.lng !== 0).length;
  const share = markers.length > 0 ? withCoords / markers.length : 0;
  if (share < minShare) {
    throw new Error(
      `Only ${withCoords} of ${markers.length} markers (${Math.round(share * 100)}%) have coordinates; ` +
      `expected at least ${Math.round(minShare * 100)}%.`,
    );
  }
}

/**
 * Pick the THC CSV to build from: the one whose file name carries the latest YYYY-MM-DD date.
 * File times aren't used, because a git checkout resets them. Fails if there is no CSV, if a CSV
 * has no date (or an impossible one) in its name, or if two CSVs share a date, rather than guess.
 */
export function selectLatestCsv(dir: string): string {
  const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.csv'));
  if (files.length === 0) {
    throw new Error(`No CSV files found in ${dir}. Run /data-refresh first.`);
  }
  const byDate = new Map<string, string>();
  for (const f of files) {
    const match = f.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!match) {
      throw new Error(
        `CSV "${f}" in ${dir} has no YYYY-MM-DD date in its name. Rename it with its THC export date, ` +
          'for example historical_markers_2026-02-28.csv, or move it out of the folder.',
      );
    }
    const [date, y, m, d] = match;
    const parsed = new Date(Date.UTC(+y, +m - 1, +d));
    if (parsed.getUTCFullYear() !== +y || parsed.getUTCMonth() !== +m - 1 || parsed.getUTCDate() !== +d) {
      throw new Error(`CSV "${f}" in ${dir} has an impossible date, ${date}.`);
    }
    const other = byDate.get(date);
    if (other) {
      throw new Error(`CSVs "${other}" and "${f}" in ${dir} share the date ${date}; keep only one.`);
    }
    byDate.set(date, f);
  }
  const latest = [...byDate.keys()].sort().pop()!;
  return join(dir, byDate.get(latest)!);
}

// ---- CLI entry point ----
// Only runs when executed directly, not when imported in tests
if (typeof process !== 'undefined' && process.argv[1]?.includes('prepare-data')) {
  runPipeline().catch((err) => {
    console.error('Pipeline failed:', err);
    process.exit(1);
  });
}

async function runPipeline() {
  const { readFileSync, writeFileSync } = await import('fs');
  const { createGzip } = await import('zlib');
  const { pipeline } = await import('stream/promises');
  const { Readable } = await import('stream');
  const shapefile = await import('shapefile');
  const Fuse = (await import('fuse.js')).default;

  const ROOT = join(import.meta.dirname, '..');
  const CSV_DIR = join(ROOT, 'data', 'csv');
  const SHP_DIR = join(ROOT, 'data', 'HistoricalMarkers');
  const OUT_DIR = join(ROOT, 'public', 'data');

  console.log('=== One Mile Ahead — Data Pipeline ===\n');

  // Step 1: Read shapefile for coordinates
  console.log('Reading shapefile for coordinates...');
  const shapefileLookup = new Map<string, { lat: number; lng: number }>();
  const source = await shapefile.open(
    join(SHP_DIR, 'HistoricalMarkers.shp'),
    join(SHP_DIR, 'HistoricalMarkers.dbf'),
  );

  let shpCount = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = await source.read();
    if (result.done) break;
    const props = result.value.properties;
    const coords = result.value.geometry?.coordinates;
    const markerNum = String(props.MarkerNum || '').trim();
    if (markerNum && coords) {
      // Points are Texas State Mapping System metres (x, y), not lat/lng.
      shapefileLookup.set(
        markerNum,
        texasMappingToLatLng(coords[0] as number, coords[1] as number),
      );
      shpCount++;
    }
  }
  console.log(`  Shapefile: ${shpCount} markers with coordinates`);

  // Step 2: Parse CSV
  console.log('Parsing CSV...');
  const csvPath = selectLatestCsv(CSV_DIR);
  console.log(`  Using ${csvPath}`);
  const csvText = readFileSync(csvPath, 'utf8');
  const { parseCSVToObjects } = await import('./csv-parser');
  const csvRows = parseCSVToObjects(csvText);
  console.log(`  CSV: ${csvRows.length} records parsed`);

  // Step 3: Transform to Marker objects
  console.log('Transforming to app schema...');
  let markers: Marker[] = csvRows.map((row, i) => csvRowToMarker(row, i + 1));

  // Step 4: Merge shapefile coordinates
  console.log('Merging shapefile coordinates...');
  let shpMerged = 0;
  let utmOnly = 0;
  let noCoords = 0;
  const rejected: string[] = [];

  markers = markers.map((m) => {
    const merged = mergeCoordinates(m, shapefileLookup);
    const shp = shapefileLookup.get(m.markerNumber);
    if (shp && merged.lat === shp.lat && merged.lng === shp.lng) {
      shpMerged++;
    } else if (merged.lat !== 0 || merged.lng !== 0) {
      utmOnly++;
    } else {
      noCoords++;
    }
    if ((shp && merged.lat !== shp.lat) || (merged.lat === 0 && m.lat !== 0)) {
      rejected.push(m.markerNumber);
    }
    return merged;
  });

  markers = applyCorrections(markers);

  console.log(`  Shapefile coords: ${shpMerged}`);
  console.log(`  UTM-only coords: ${utmOnly}`);
  console.log(`  No coordinates: ${noCoords}`);
  if (rejected.length > 0) {
    console.log(
      `  Source coords outside Texas, ignored: ${rejected.length} (${rejected.slice(0, 20).join(', ')}${rejected.length > 20 ? ', …' : ''})`,
    );
  }
  assertCoordinateCoverage(markers, MIN_COORDINATE_SHARE);

  // Step 5: Write JSON (uncompressed + compressed)
  console.log('Writing marker data...');
  const jsonStr = JSON.stringify(markers);

  // Uncompressed — reliable fallback, HTTP-compressed by server
  const jsonPlainPath = join(OUT_DIR, 'markers.json');
  writeFileSync(jsonPlainPath, jsonStr);
  const { statSync } = await import('fs');
  const plainSize = statSync(jsonPlainPath).size;
  console.log(
    `  markers.json: ${(plainSize / 1024 / 1024).toFixed(2)} MB`,
  );

  // Gzipped — for offline cache efficiency
  const jsonGzPath = join(OUT_DIR, 'markers.json.gz');
  await pipeline(
    Readable.from([jsonStr]),
    createGzip({ level: 9 }),
    (await import('fs')).createWriteStream(jsonGzPath),
  );

  const compressedSize = statSync(jsonGzPath).size;
  console.log(
    `  markers.json.gz: ${(compressedSize / 1024 / 1024).toFixed(2)} MB`,
  );

  // Step 6: Build Fuse.js search index
  console.log('Building Fuse.js search index...');
  const fuseOptions = {
    keys: [
      { name: 'title', weight: 0.3 },
      { name: 'markerText', weight: 0.25 },
      { name: 'county', weight: 0.2 },
      { name: 'city', weight: 0.15 },
      { name: 'markerNumber', weight: 0.1 },
    ],
    threshold: 0.3,
    includeScore: true,
  };

  const fuseIndex = Fuse.createIndex(
    fuseOptions.keys.map((k) => k.name),
    markers,
  );
  const indexJson = JSON.stringify(fuseIndex.toJSON());
  writeFileSync(join(OUT_DIR, 'fuse-index.json'), indexJson);

  const indexSize = statSync(join(OUT_DIR, 'fuse-index.json')).size;
  console.log(
    `  fuse-index.json: ${(indexSize / 1024 / 1024).toFixed(2)} MB`,
  );

  // Summary
  console.log(`\n=== Pipeline Complete ===`);
  console.log(`Total markers: ${markers.length}`);
  console.log(`With coordinates: ${markers.filter((m) => m.lat !== 0).length}`);
  console.log(`With inscription: ${markers.filter((m) => m.markerText).length}`);
  console.log(`RTHL: ${markers.filter((m) => m.isRTHL).length}`);
}

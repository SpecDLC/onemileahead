/**
 * Build the committed I-35 corridor test fixture from the full marker set.
 *
 *   npx tsx scripts/build-corridor-fixture.ts public/data/markers.json
 *
 * Input: the app-ready marker array (markers.json produced by prepare-data, kept
 * out of git). Output: fixtures/i35-austin-waco.json — ~85 real markers (real THC
 * marker numbers and coordinates) near I-35 between Austin and Waco, a handful of
 * off-corridor markers, and a few records whose coordinates are 0,0 in the data.
 * Selection is deterministic so the fixture can be regenerated and diffed.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { Marker } from '../src/types/marker';
import { haversineDistance } from '../src/utils/distance';

const ROOT = join(import.meta.dirname, '..');
const route: [number, number][] = JSON.parse(
  readFileSync(join(ROOT, 'fixtures', 'i35-route.json'), 'utf8'),
).points;

/** Distance (mi) from a point to the route polyline and the along-route mile. */
function toRoute(lat: number, lng: number): { off: number; along: number } {
  let best = { off: Infinity, along: 0 };
  let acc = 0;
  for (let i = 0; i < route.length - 1; i++) {
    const [aLat, aLng] = route[i];
    const [bLat, bLng] = route[i + 1];
    const k = Math.cos((aLat * Math.PI) / 180);
    const bx = (bLng - aLng) * k, by = bLat - aLat;
    const px = (lng - aLng) * k, py = lat - aLat;
    const t = Math.max(0, Math.min(1, (px * bx + py * by) / (bx * bx + by * by)));
    const qLat = aLat + t * (bLat - aLat), qLng = aLng + t * (bLng - aLng);
    const seg = haversineDistance(aLat, aLng, bLat, bLng);
    const off = haversineDistance(lat, lng, qLat, qLng);
    if (off < best.off) best = { off, along: acc + t * seg };
    acc += seg;
  }
  return best;
}

const all: Marker[] = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const scored = all
  .filter((m) => m.lat !== 0 || m.lng !== 0)
  .map((m) => ({ m, ...toRoute(m.lat, m.lng) }));

// ~75 markers within 1.5 mi of the road, spread evenly by route mile.
const near = scored.filter((s) => s.off <= 1.5).sort((a, b) => a.along - b.along);
const step = near.length / 75;
const picked = new Map<number, Marker>();
for (let i = 0; i < 75 && Math.floor(i * step) < near.length; i++) {
  const s = near[Math.floor(i * step)];
  picked.set(s.m.id, s.m);
}
// 8 markers 3–8 mi off the road (should never appear in a narrow corridor).
scored
  .filter((s) => s.off >= 3 && s.off <= 8 && s.along > 5 && s.along < 95)
  .sort((a, b) => a.m.id - b.m.id)
  .filter((_, i) => i % 7 === 0)
  .slice(0, 8)
  .forEach((s) => picked.set(s.m.id, s.m));
// 3 records from these counties with no coordinates (lat/lng 0,0 in the data).
all
  .filter((m) => m.lat === 0 && m.lng === 0 && ['Travis', 'Williamson', 'Bell', 'McLennan'].includes(m.county))
  .slice(0, 3)
  .forEach((m) => picked.set(m.id, m));

const markers = [...picked.values()].sort((a, b) => a.id - b.id);
writeFileSync(
  join(ROOT, 'fixtures', 'i35-austin-waco.json'),
  JSON.stringify(
    {
      source: 'THC Atlas export 2026-10-13 (data/csv), UTM-converted coordinates via csvRowToMarker',
      route: 'fixtures/i35-route.json',
      markers,
    },
    null,
    1,
  ) + '\n',
);
console.log(`fixture: ${markers.length} markers (${near.length} candidates within 1.5 mi of route)`);

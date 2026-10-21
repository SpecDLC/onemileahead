/// <reference types="node" />
/**
 * Differential tests: the existing TypeScript functions and the WASM engine on the same inputs.
 * These are the main proof that the Rust port is right [REQ:wasm-engine AC-WE-08].
 *
 * Always runs on the committed I-35 fixture. Also runs on the full THC dataset when
 * the dataset exists locally (see datasetPath.ts: public/data/markers.json or $OMA_MARKERS). When it
 * doesn't, the full-dataset suite is reported as skipped rather than silently left out.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { OmaEngine } from '../omaEngine';
import { haversineDistance, bearing, formatDistance, formatBearing } from '../../utils/distance';
import { computeNearby } from '../../hooks/useNearbyMarkers';
import { searchByMarkerNumber } from '../../search/markerNumberSearch';
import { projectResearch } from '../../projectors/researchProjector';
import { generateResearchMarkdown } from '../../../scripts/skills/marker-researcher';
import { db } from '../../db/database';
import type { Marker } from '../../types/marker';
import type { MarkerResearch } from '../../types/research';
import { markersPath } from './datasetPath';

const ROOT = join(__dirname, '..', '..', '..');
const WASM = readFileSync(join(ROOT, 'src', 'engine', 'oma_engine.wasm'));
const FIXTURE: Marker[] = JSON.parse(readFileSync(join(ROOT, 'fixtures', 'i35-austin-waco.json'), 'utf8')).markers;
const FULL_PATH = markersPath(ROOT);
const HAS_FULL = existsSync(FULL_PATH);

const TOL = 1e-9;

/** Deterministic PRNG in [0, 1). */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function pairs(n: number, seed: number): [number, number, number, number][] {
  const r = rng(seed);
  const out: [number, number, number, number][] = [
    [30.2672, -97.7431, 30.2672, -97.7431], // same point
    [0, 0, 0, 180], // antipodal on the equator
    [90, 0, -90, 0], // pole to pole
    [89.9999, 10, 89.9999, -170], // across the pole
    [10, 179.9, 10, -179.9], // across the antimeridian
    [31.5493, -97.1467, 31.5493, -97.1467 + 1e-12], // tiny
    [25.8, -106.6, 36.5, -93.5], // Texas bounding box diagonal
  ];
  for (let i = 0; i < n; i++) {
    if (i % 3 === 0) {
      // Texas-scale pairs
      out.push([25.8 + r() * 10.7, -106.6 + r() * 13.1, 25.8 + r() * 10.7, -106.6 + r() * 13.1]);
    } else if (i % 3 === 1) {
      // short hops (the common case: within a few miles)
      const lat = 25.8 + r() * 10.7, lng = -106.6 + r() * 13.1;
      out.push([lat, lng, lat + (r() - 0.5) * 0.1, lng + (r() - 0.5) * 0.1]);
    } else {
      out.push([r() * 180 - 90, r() * 360 - 180, r() * 180 - 90, r() * 360 - 180]);
    }
  }
  return out;
}

async function seedDb(markers: Marker[]) {
  await db.delete();
  await db.open();
  await db.markers.bulkAdd(markers);
}

describe('TS ↔ WASM: geo functions', () => {
  let engine: OmaEngine;
  beforeAll(async () => {
    engine = await OmaEngine.fromBytes(WASM);
  });

  it('haversine and bearing agree to 1e-9 on 3,000 point pairs', () => {
    let exact = 0;
    const ps = pairs(3000, 1);
    for (const [a, b, c, d] of ps) {
      const h = haversineDistance(a, b, c, d);
      const hw = engine.geo('haversine', a, b, c, d);
      expect(Math.abs(h - hw), `haversine(${a},${b},${c},${d})`).toBeLessThanOrEqual(TOL);
      const br = bearing(a, b, c, d);
      const bw = engine.geo('bearing', a, b, c, d);
      // Bearings are circular: 359.9999999999 and 0 are the same direction.
      const diff = Math.abs(br - bw);
      expect(Math.min(diff, 360 - diff), `bearing(${a},${b},${c},${d})`).toBeLessThanOrEqual(TOL);
      if (h === hw && br === bw) exact++;
    }
    // Informational: how many were bit-identical (libm differences can cost an ulp).
    expect(exact).toBeGreaterThan(0);
  });

  it('formatDistance is string-identical, including rounding boundaries', () => {
    const inputs = [
      0, 0.0001, 0.05, 0.0999999, 0.09999999999999999, 0.1, 0.1000001, 0.15, 0.25, 0.35, 0.45, 0.75,
      1.05, 1.25, 2.35, 9.85, 9.94999, 9.95, 9.96, 9.99, 9.999999, 10, 10.4999, 10.5, 12.5, 99.5, 1234.5,
      -0.04, -1, 3.14159265,
      ...pairs(500, 2).map(([a, b, c, d]) => haversineDistance(a, b, c, d)),
    ];
    // every x.x5 between 0 and 10
    for (let i = 0; i < 100; i++) inputs.push(i / 10 + 0.05);
    for (const x of inputs) {
      expect(engine.geo('formatDistance', x), `formatDistance(${x})`).toBe(formatDistance(x));
    }
  });

  it('formatBearing is string-identical (undefined ↔ null outside the table)', () => {
    const inputs: number[] = [];
    for (let d = -45; d <= 405; d += 0.25) inputs.push(d);
    inputs.push(22.5, 22.499999999999996, 337.5, 337.49999999999994, 359.99999999, -22.5, -22.6);
    for (const d of inputs) {
      expect(engine.geo('formatBearing', d) ?? undefined, `formatBearing(${d})`).toBe(formatBearing(d));
    }
  });
});

const DATASETS: [string, boolean, () => Marker[]][] = [
  ['I-35 fixture', true, () => FIXTURE],
  [`full THC dataset (${FULL_PATH})`, HAS_FULL, () => JSON.parse(readFileSync(FULL_PATH, 'utf8'))],
];

describe.each(DATASETS)('TS ↔ WASM on the %s', (_name, available, getMarkers) => {
  let markers: Marker[];
  let engine: OmaEngine;

  beforeAll(async () => {
    if (!available) return;
    markers = getMarkers();
    engine = await OmaEngine.fromBytes(WASM);
    engine.load(markers);
    await seedDb(markers);
  }, 120_000);

  it.skipIf(!available)('nearby: same markers, same order, distance and bearing to 1e-9', async () => {
    // Dexie returns primary-key order; the TS hook relies on that for ties.
    const all = await db.markers.toArray();
    const r = rng(3);
    const queries: [number, number][] = [
      [30.2672, -97.7431], // Austin
      [31.5493, -97.1467], // Waco
      [0.0001, 0.0001], // near the 0,0 sentinel
      [36.5, -100.0], // Panhandle edge
      [40.71, -74.0], // far outside Texas
    ];
    const withCoords = markers.filter((m) => m.lat !== 0 || m.lng !== 0);
    for (let i = 0; i < 60; i++) {
      if (i % 2 === 0 && withCoords.length) {
        const m = withCoords[Math.floor(r() * withCoords.length)];
        queries.push([m.lat, m.lng]); // exactly on a marker: distance 0 ties
      } else {
        queries.push([25.8 + r() * 10.7, -106.6 + r() * 13.1]);
      }
    }
    for (const [lat, lng] of queries) {
      for (const limit of [1, 10, 50, 500]) {
        const ts = computeNearby(all, { lat, lng }, limit);
        const wasm = engine.nearby(lat, lng, limit);
        expect(wasm.map((x) => x.marker.id), `nearby(${lat},${lng},${limit}) order`).toEqual(ts.map((x) => x.marker.id));
        wasm.forEach((w, k) => {
          expect(Math.abs(w.distance - ts[k].distance)).toBeLessThanOrEqual(TOL);
          const d = Math.abs(w.bearing - ts[k].bearing);
          expect(Math.min(d, 360 - d)).toBeLessThanOrEqual(TOL);
          expect(w.marker).toEqual(ts[k].marker);
        });
      }
      // With a radius: the TS output filtered to that radius.
      const ts = computeNearby(all, { lat, lng }, 50).filter((x) => x.distance <= 5);
      expect(engine.nearby(lat, lng, 50, 5).map((x) => x.marker.id)).toEqual(ts.map((x) => x.marker.id));
    }
  }, 120_000);

  it.skipIf(!available)('lookup: identical to searchByMarkerNumber', async () => {
    const r = rng(4);
    const qs = new Set<string>(['', '  ', '1', '12', '123', '9', '99999', '0', 'abc', ' 95 ', '1 2']);
    for (let i = 0; i < 80; i++) {
      const m = markers[Math.floor(r() * markers.length)];
      qs.add(m.markerNumber);
      qs.add(m.markerNumber.slice(0, 1 + Math.floor(r() * m.markerNumber.length)));
    }
    for (const q of qs) {
      for (const limit of [20, 5, 1]) {
        const ts = await searchByMarkerNumber(q, limit);
        const wasm = engine.lookup(q, limit);
        expect(wasm, `lookup(${JSON.stringify(q)}, ${limit})`).toEqual(ts);
      }
    }
  }, 120_000);
});

describe('TS ↔ WASM: research projector', () => {
  let engine: OmaEngine;
  const dir = join(ROOT, 'fixtures', 'research');
  const files = readdirSync(dir).filter((f) => f.endsWith('.md')).sort();

  beforeAll(async () => {
    engine = await OmaEngine.fromBytes(WASM);
  });

  it.each(files)('%s projects identically', (f: string) => {
    const md = readFileSync(join(dir, f), 'utf8');
    expect(engine.research(md)).toEqual(projectResearch(md));
  });

  it('round-trips generateResearchMarkdown → research (AC-LM-10) for every projected fixture', () => {
    for (const f of files) {
      const projected = projectResearch(readFileSync(join(dir, f), 'utf8'));
      if (!projected) continue;
      const md = generateResearchMarkdown(projected);
      expect(engine.research(md), f).toEqual(projected);
      expect(projectResearch(md), f).toEqual(projected);
    }
  });

  it.each(['Constructor', '__proto__', 'toString', 'hasOwnProperty'])(
    'a "## %s" heading (an Object.prototype key) projects identically: no links [OMA-FUNC-LEARN-4]',
    (heading) => {
      const md = `---\nmarkerNumber: "1"\n---\n## ${heading}\n- [A](https://a.example)\n  d\n## Related\n- [B](https://b.example)\n  kept\n`;
      expect(engine.research(md)).toEqual(projectResearch(md));
      expect(engine.research(md)!.links.map((l) => l.title)).toEqual(['B']);
    },
  );

  it('panics inside the built module come back as JSON errors and the module keeps working', () => {
    for (let i = 0; i < 50; i++) {
      expect(() => engine.call({ cmd: 'panic_test' })).toThrow(/^panic: panic_test requested/);
    }
    expect(engine.geo('haversine', 30, -97, 31, -97)).toBeCloseTo(69.09, 1);
    expect(engine.research('---\nmarkerNumber: "5"\n---\n')).toEqual({ markerNumber: '5', generatedAt: '', links: [] });
  });

  it('round-trips synthetic research data', () => {
    const data: MarkerResearch = {
      markerNumber: '17371',
      generatedAt: '2026-10-13',
      links: [
        { title: 'One', url: 'https://example.com/1', source: 'grokipedia', description: 'First.' },
        { title: 'Two (2)', url: 'https://en.wikipedia.org/wiki/Two_(number)', source: 'wikipedia', description: 'Second, with parens.' },
        { title: 'Three', url: 'https://example.com/3', source: 'curated', description: 'Third — with an em dash.' },
      ],
    };
    const md = generateResearchMarkdown(data);
    expect(engine.research(md)).toEqual(data);
    expect(projectResearch(md)).toEqual(data);
  });
});

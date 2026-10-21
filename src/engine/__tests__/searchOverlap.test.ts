/// <reference types="node" />
/**
 * Engine `search` vs the app's Fuse.js SearchEngine: top-10 overlap on 20 fixed queries
 * [REQ:wasm-engine AC-WE-06]. The engine is not expected to reproduce Fuse's ranking; this
 * measures how far apart they are and writes the table to target/reports/search-overlap.json.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { OmaEngine } from '../omaEngine';
import { SearchEngine } from '../../search/searchEngine';
import type { Marker } from '../../types/marker';
import { markersPath } from './datasetPath';

const ROOT = join(__dirname, '..', '..', '..');
const FULL = markersPath(ROOT);

export const OVERLAP_QUERIES = [
  'alamo', 'cemetery', 'methodist church', 'baptist church', 'civil war',
  'confederate', 'courthouse', 'school', 'chisholm trail', 'railroad',
  'salado', 'waco', 'travis', 'temple', 'fort',
  'mission', 'cotton gin', 'german settlers', 'republic of texas', 'texas rangers',
];

describe('search: overlap with Fuse', () => {
  it('reports top-10 overlap on 20 fixed queries', async () => {
    const full = existsSync(FULL);
    const markers: Marker[] = full
      ? JSON.parse(readFileSync(FULL, 'utf8'))
      : JSON.parse(readFileSync(join(ROOT, 'fixtures', 'i35-austin-waco.json'), 'utf8')).markers;
    const engine = await OmaEngine.fromBytes(readFileSync(join(ROOT, 'src', 'engine', 'oma_engine.wasm')));
    engine.load(markers);
    const fuse = new SearchEngine(markers);

    const rows = OVERLAP_QUERIES.map((q) => {
      const f = fuse.search(q, 10).map((m) => m.id);
      const w = engine.search(q, 10).map((m) => m.id);
      const both = w.filter((id) => f.includes(id)).length;
      return { q, fuse: f.length, engine: w.length, overlap: both, top1: f[0] !== undefined && f[0] === w[0] };
    });
    const denom = rows.reduce((s, r) => s + Math.min(10, r.fuse), 0);
    const mean = denom ? rows.reduce((s, r) => s + r.overlap, 0) / denom : 0;
    const report = { dataset: full ? 'full' : 'fixture', markers: markers.length, meanOverlapAt10: mean, rows };
    mkdirSync(join(ROOT, 'target', 'reports'), { recursive: true });
    writeFileSync(join(ROOT, 'target', 'reports', 'search-overlap.json'), JSON.stringify(report, null, 2));
    console.table(rows);
    console.log(`mean top-10 overlap with Fuse (${report.dataset}): ${(mean * 100).toFixed(1)}%`);

    // Every query that Fuse answers, the engine answers too.
    for (const r of rows) {
      if (r.fuse > 0) expect(r.engine, r.q).toBeGreaterThan(0);
    }
  }, 120_000);
});

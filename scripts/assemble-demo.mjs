/**
 * Assemble prototypes/ahead-demo.html: one self-contained file with the engine WASM (base64),
 * the I-35 route, one corridor's markers and the Overpass font inlined.
 *
 *   node scripts/assemble-demo.mjs
 *
 * Markers come from the full dataset (public/data/markers.json, or the file named by OMA_MARKERS;
 * all markers within 8 mi of I-35 Austin–Waco) when it exists, otherwise from the committed fixture. The full dataset (~17 MB of JSON) doesn't fit
 * a 16 MB page, so the demo embeds this corridor and says so on the page. Note that the committed
 * demo was assembled with the full dataset present; a clean checkout without data/ re-assembles
 * a smaller demo from the 86-marker fixture.
 */
import { existsSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p));
const LIMIT_BYTES = 16 * 1024 * 1024;
const CORRIDOR_MI = 8;

const route = JSON.parse(read('fixtures/i35-route.json')).points;

function hav(a, b, c, d) {
  const r = Math.PI / 180, p = (c - a) * r, l = (d - b) * r;
  const s = Math.sin(p / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(l / 2) ** 2;
  return 2 * 3958.8 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
function offRoute(lat, lng) {
  let best = Infinity;
  for (let i = 0; i < route.length - 1; i++) {
    const [aLat, aLng] = route[i], [bLat, bLng] = route[i + 1];
    const k = Math.cos((aLat * Math.PI) / 180);
    const bx = (bLng - aLng) * k, by = bLat - aLat, px = (lng - aLng) * k, py = lat - aLat;
    const t = Math.max(0, Math.min(1, (px * bx + py * by) / (bx * bx + by * by)));
    best = Math.min(best, hav(lat, lng, aLat + t * (bLat - aLat), aLng + t * (bLng - aLng)));
  }
  return best;
}

let markers, note;
// Same rule as src/engine/__tests__/datasetPath.ts.
const full = process.env.OMA_MARKERS || join(ROOT, 'public', 'data', 'markers.json');
if (existsSync(full)) {
  const all = JSON.parse(readFileSync(full, 'utf8'));
  markers = all
    .filter((m) => (m.lat !== 0 || m.lng !== 0) && offRoute(m.lat, m.lng) <= CORRIDOR_MI)
    // Inscriptions aren't shown in the demo; keep a short excerpt for search/size realism.
    .map((m) => ({ ...m, markerText: m.markerText.slice(0, 160) }));
  note = `This page embeds the ${markers.length.toLocaleString('en-US')} THC markers within ${CORRIDOR_MI} miles of I-35 between Austin and Waco (out of ${all.length.toLocaleString('en-US')} statewide), so it stays well under 16 MB. Inscriptions are trimmed. The route line is hand-drawn and approximate.`;
} else {
  markers = JSON.parse(read('fixtures/i35-austin-waco.json')).markers;
  note = `This page embeds the ${markers.length} markers of the committed I-35 test fixture (the full THC dataset wasn't available when it was built). The route line is hand-drawn and approximate.`;
}

const data = { route, markers, note };
const wasm = read('src/engine/oma_engine.wasm').toString('base64');
const html = read('prototypes/ahead-demo.template.html')
  .toString('utf8')
  .replace('/*__WASM_BASE64__*/', wasm)
  .replace('/*__FONT_400__*/', read('prototypes/assets/overpass-latin-400-normal.woff2').toString('base64'))
  .replace('/*__FONT_700__*/', read('prototypes/assets/overpass-latin-700-normal.woff2').toString('base64'))
  // `<` escaped so marker text can never close the script element.
  .replace('/*__DATA__*/null', () => JSON.stringify(data).replace(/</g, '\\u003c'));

const out = join(ROOT, 'prototypes', 'ahead-demo.html');
writeFileSync(out, html);
const size = statSync(out).size;
console.log(`prototypes/ahead-demo.html: ${(size / 1024).toFixed(0)} KB, ${markers.length} markers`);
if (size > LIMIT_BYTES) {
  console.error('error: demo exceeds 16 MB');
  process.exit(1);
}

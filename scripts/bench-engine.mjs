/**
 * Engine vs today's TS Nearby path, in Chromium, at 1x / 4x / 6x CPU throttling (via CDP).
 *
 *   node scripts/bench-engine.mjs [path/to/markers.json] [--runs 3]
 *
 * Needs the full dataset (default public/data/markers.json, or $OMA_MARKERS; gitignored) and a Playwright Chromium; set
 * CHROME_PATH to use a different Chromium binary. The page (scripts/bench/engine-bench.html)
 * holds the TS logic of src/utils/distance.ts + computeNearby() copied verbatim, so nothing is
 * bundled. Each throttle rate runs RUNS times in a fresh page; the output is the median across
 * runs of each metric (each metric is itself a median/p95 over 60 nearby queries or ~480 ahead
 * calls along I-35).
 */
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const runsAt = args.indexOf('--runs');
const RUNS = runsAt >= 0 ? Number(args[runsAt + 1]) : 3;
const dataPath =
  args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--runs') ??
  process.env.OMA_MARKERS ??
  join(ROOT, 'public', 'data', 'markers.json');

const files = {
  '/bench.html': ['text/html', readFileSync(join(ROOT, 'scripts', 'bench', 'engine-bench.html'))],
  '/oma_engine.wasm': ['application/wasm', readFileSync(join(ROOT, 'src', 'engine', 'oma_engine.wasm'))],
  '/markers.json': ['application/json', readFileSync(dataPath)],
  '/i35-route.json': ['application/json', readFileSync(join(ROOT, 'fixtures', 'i35-route.json'))],
};
const server = createServer((req, res) => {
  const f = files[req.url];
  if (!f) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': f[0] }).end(f[1]);
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
function flat(o, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(o)) {
    if (v && typeof v === 'object') flat(v, `${prefix}${k}.`, out);
    else if (typeof v === 'number') out[prefix + k] = v;
  }
  return out;
}

const report = { browser: browser.version(), runs: RUNS, dataset: dataPath, rates: {} };
for (const rate of [1, 4, 6]) {
  const samples = [];
  for (let r = 0; r < RUNS; r++) {
    const page = await browser.newPage();
    const cdp = await page.context().newCDPSession(page);
    await page.goto(`${base}/bench.html`);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    samples.push(flat(await page.evaluate(() => window.run())));
    await page.close();
  }
  report.rates[`${rate}x`] = Object.fromEntries(
    Object.keys(samples[0]).map((k) => [k, median(samples.map((s) => s[k]))]),
  );
}
await browser.close();
server.close();
console.log(JSON.stringify(report, null, 1));

/**
 * `/?engine=wasm` works offline after one online visit (handoff §4.3). Needs `npm run build`;
 * needs no marker data, because it checks the shell and the engine module, not the marker list.
 *
 * Two things used to break it:
 * - Workbox's precache ignores only utm_* and fbclid by default, so `/?engine=wasm` never matched
 *   the precached index.html;
 * - the engine module (*.wasm) isn't in the precache manifest, so it was never stored.
 */
import { test, expect } from '@playwright/test';
import { serveDist, wasmAsset } from './helpers/serveDist';

let base: string;
let stop: () => void;

test.beforeAll(async ({}, testInfo) => {
  ({ base, stop } = await serveDist(4320 + testInfo.workerIndex));
});

test.afterAll(() => stop?.());

test('the flagged URL and the engine load offline after one online visit', async ({ page, context }) => {
  const wasm = wasmAsset();

  // Online: one visit to the flagged URL. The test doesn't fetch the engine itself: the app must
  // store it on load (warmEngineCache), without the Nearby or Ahead tab being opened.
  const engineRequests: string[] = [];
  page.on('request', (r) => {
    if (r.url().endsWith('.wasm')) engineRequests.push(r.url());
  });
  await page.goto(`${base}/?engine=wasm`);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
    }
  });
  await expect
    .poll(() => page.evaluate(async (u) => !!(await caches.match(u)), wasm), { timeout: 10_000 })
    .toBe(true);
  expect(engineRequests.length).toBeGreaterThan(0);

  // Offline: the flagged page and the engine both come from the service worker.
  await context.setOffline(true);
  const res = await page.reload();
  expect(res?.status()).toBe(200);
  await expect(page.locator('#root')).toBeAttached();

  const result = await page.evaluate(async (u) => {
    try {
      const bytes = await (await fetch(u)).arrayBuffer();
      const { instance } = await WebAssembly.instantiate(bytes, {});
      return typeof instance.exports.oma_call === 'function' ? 'compiled' : 'no exports';
    } catch (e) {
      return `failed: ${(e as Error).message}`;
    }
  }, wasm);
  expect(result).toBe('compiled');

  await context.setOffline(false);
});

test('without the flag, the engine is not downloaded', async ({ page }) => {
  const engineRequests: string[] = [];
  page.on('request', (r) => {
    if (r.url().endsWith('.wasm')) engineRequests.push(r.url());
  });
  await page.goto(`${base}/`);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(1000);
  expect(engineRequests).toEqual([]);
  expect(await page.evaluate(() => caches.has('engine-wasm'))).toBe(false);
});

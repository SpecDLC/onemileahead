/**
 * The production headers (public/_headers) against the production build, served the way
 * Cloudflare serves them. `vite preview` ignores _headers, so the other e2e tests can't catch a
 * policy that breaks the app. Needs `npm run build` first; needs no marker data.
 *
 * Checks OMA-SEC-EDGE-6 (scripts only from the app's own origin) and that the WASM engine
 * (#11, ?engine=wasm) can still compile under it.
 */
import { test, expect } from '@playwright/test';
import { serveDist, wasmAsset } from './helpers/serveDist';

let base: string;
let stop: () => void;

test.beforeAll(async ({}, testInfo) => {
  ({ base, stop } = await serveDist(4300 + testInfo.workerIndex));
});

test.afterAll(() => stop?.());

test.describe('Production headers [OMA-SEC-EDGE-6]', () => {
  test('HTML carries a CSP that allows only same-origin script, plus WASM compilation', async ({ request }) => {
    for (const path of ['/', '/index.html', '/?engine=wasm']) {
      const res = await request.get(base + path);
      expect(res.status(), path).toBe(200);
      const csp = res.headers()['content-security-policy'];
      expect(csp, `${path} has a CSP`).toBeTruthy();
      const scriptSrc = csp.match(/script-src([^;]*)/)![1].trim().split(/\s+/);
      expect(scriptSrc.sort()).toEqual(["'self'", "'wasm-unsafe-eval'"].sort());
      expect(res.headers()['x-content-type-options']).toBe('nosniff');
    }
  });

  test('a 404 carries the same CSP as the HTML it replaces', async ({ request }) => {
    for (const path of ['/no-such-page', '/assets/no-such-file.js', '/data/no-such.json']) {
      const res = await request.get(base + path);
      expect(res.status(), path).toBe(404);
      const csp = res.headers()['content-security-policy'];
      expect(csp, `${path} has a CSP`).toBeTruthy();
      const scriptSrc = csp.match(/script-src([^;]*)/)![1].trim().split(/\s+/);
      expect(scriptSrc.sort()).toEqual(["'self'", "'wasm-unsafe-eval'"].sort());
      expect(res.headers()['x-content-type-options']).toBe('nosniff');
    }
  });

  test('hashed assets are cached immutably, and the WASM is served as application/wasm', async ({ request }) => {
    const res = await request.get(base + wasmAsset());
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toBe('application/wasm');
    expect(res.headers()['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  test('under the policy the engine compiles, while inline script and eval stay blocked', async ({ page }) => {
    const violations: string[] = [];
    await page.exposeFunction('reportViolation', (d: string) => violations.push(d));
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (e) =>
        (window as unknown as { reportViolation: (d: string) => void }).reportViolation(e.violatedDirective),
      );
    });
    await page.goto(`${base}/?engine=wasm`);
    // The app shell itself loads without any violation (no marker data is needed for this).
    await page.waitForLoadState('networkidle');
    expect(violations).toEqual([]);

    const result = await page.evaluate(async (url) => {
      const out: Record<string, string | boolean> = {};
      try {
        const bytes = await (await fetch(url)).arrayBuffer();
        const { instance } = await WebAssembly.instantiate(bytes, {});
        out.wasm = typeof instance.exports.oma_call === 'function' ? 'compiled' : 'no exports';
      } catch (e) {
        out.wasm = `refused: ${(e as Error).message}`;
      }
      const s = document.createElement('script');
      s.textContent = 'window.__inlineRan = true';
      document.head.appendChild(s);
      out.inlineRan = (window as unknown as { __inlineRan?: boolean }).__inlineRan === true;
      try {
        new Function('return 1')();
        out.evalRan = true;
      } catch {
        out.evalRan = false;
      }
      return out;
    }, wasmAsset());

    expect(result).toEqual({ wasm: 'compiled', inlineRan: false, evalRan: false });
  });
});

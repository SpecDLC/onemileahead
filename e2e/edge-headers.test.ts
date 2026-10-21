/**
 * OMA-SEC-EDGE-8 on the production build, served the way Cloudflare serves public/_headers.
 * `vite preview` ignores _headers. Needs `npm run build` first; needs no marker data.
 *
 * The /* rule also covers the HTML 404s that e2e/csp-headers.test.ts already requests.
 */
import { test, expect } from '@playwright/test';
import { serveDist } from './helpers/serveDist';

let base: string;
let stop: () => void;

test.beforeAll(async ({}, testInfo) => {
  ({ base, stop } = await serveDist(4500 + testInfo.workerIndex));
});

test.afterAll(() => stop?.());

test.describe('Edge security headers [OMA-SEC-EDGE-8]', () => {
  test('HTML carries HSTS, Referrer-Policy, and Permissions-Policy', async ({ request }) => {
    for (const path of ['/', '/index.html']) {
      const res = await request.get(base + path);
      expect(res.status(), path).toBe(200);
      expect(res.headers()['content-type'], path).toContain('text/html');
      expect(res.headers()['strict-transport-security'], path).toBe('max-age=31536000');
      expect(res.headers()['referrer-policy'], path).toBe('strict-origin-when-cross-origin');
      expect(res.headers()['permissions-policy'], path).toBe('geolocation=(self)');
    }
  });
});

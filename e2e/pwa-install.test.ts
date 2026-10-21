import { test, expect } from '@playwright/test';

test.describe('PWA Installability', () => {
  test('serves a valid web manifest', async ({ page }) => {
    const response = await page.goto('/manifest.webmanifest');
    expect(response?.status()).toBe(200);

    const manifest = await response?.json();
    expect(manifest.name).toBe('One Mile Ahead');
    expect(manifest.short_name).toBe('OneMileAhead');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons).toBeDefined();
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
  });

  test('has PWA icon files', async ({ page }) => {
    const icon192 = await page.goto('/icons/icon-192.png');
    expect(icon192?.status()).toBe(200);
    expect(icon192?.headers()['content-type']).toContain('image/png');

    const icon512 = await page.goto('/icons/icon-512.png');
    expect(icon512?.status()).toBe(200);
  });

  test('registers a service worker', async ({ page }) => {
    await page.goto('/');
    // Wait for the app to load
    await page.waitForSelector('.app');

    // Check that service worker is registered
    const swRegistered = await page.evaluate(async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      return registrations.length > 0;
    });
    expect(swRegistered).toBe(true);
  });

  test('has correct meta tags for PWA', async ({ page }) => {
    await page.goto('/');

    const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content');
    expect(themeColor).toBe('#1a1a2e');

    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toContain('width=device-width');
  });
});

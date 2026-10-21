import { test, expect } from '@playwright/test';

test.describe('Map Interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to be ready
    await page.waitForSelector('.tab-bar', { timeout: 60000 });
  });

  test('switches to map tab', async ({ page }) => {
    await page.getByRole('button', { name: 'Map' }).click();

    // Map container should be visible
    await expect(page.locator('.map-page')).toBeVisible();

    // Leaflet map should render
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 10000 });
  });

  test('shows OSM tile attribution', async ({ page }) => {
    await page.getByRole('button', { name: 'Map' }).click();
    await page.waitForSelector('.leaflet-container', { timeout: 10000 });

    // Should have OpenStreetMap attribution
    const attribution = page.locator('.leaflet-control-attribution');
    await expect(attribution).toContainText('OpenStreetMap');
  });

  test('shows marker clusters on the map', async ({ page }) => {
    await page.getByRole('button', { name: 'Map' }).click();
    await page.waitForSelector('.leaflet-container', { timeout: 10000 });

    // Wait for cluster markers to appear
    const clusters = page.locator('.marker-cluster');
    await expect(clusters.first()).toBeVisible({ timeout: 10000 });
  });

  test('switches to nearby tab', async ({ page }) => {
    await page.getByRole('button', { name: 'Nearby' }).click();

    await expect(page.locator('.nearby-page')).toBeVisible();
    await expect(page.getByText('Nearby Markers')).toBeVisible();
  });

  test('tab bar stays visible across tab switches', async ({ page }) => {
    // Search tab
    await expect(page.locator('.tab-bar')).toBeVisible();

    // Map tab
    await page.getByRole('button', { name: 'Map' }).click();
    await expect(page.locator('.tab-bar')).toBeVisible();

    // Nearby tab
    await page.getByRole('button', { name: 'Nearby' }).click();
    await expect(page.locator('.tab-bar')).toBeVisible();

    // Back to search
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.locator('.tab-bar')).toBeVisible();
  });

  test('settings drawer opens and closes', async ({ page }) => {
    // Click gear icon
    await page.locator('.settings-gear').click();

    // Settings drawer should open
    await expect(page.locator('.settings-drawer')).toBeVisible();
    await expect(page.getByText('Settings')).toBeVisible();

    // Close it
    await page.locator('.settings-close').click();
    await expect(page.locator('.settings-drawer')).not.toBeVisible();
  });
});

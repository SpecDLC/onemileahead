import { test, expect } from '@playwright/test';

// Standing on Alamo Plaza, San Antonio. Needs the real dataset in public/data/.
test.use({
  geolocation: { latitude: 29.4259, longitude: -98.4861 },
  permissions: ['geolocation'],
});

test('Nearby at the Alamo lists the Alamo Cenotaph within a mile [AC:OMA-FUNC-NEAR-1]', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('input[type="search"]', { timeout: 60000 });
  await page.getByRole('button', { name: 'Nearby' }).click();

  const cards = page.locator('.marker-card');
  await expect(cards.first()).toBeVisible({ timeout: 15000 });

  // Distances read like "350 ft N" or "0.4 mi SE"; the nearest must be under a mile.
  const nearest = (await cards.first().locator('.marker-distance').textContent()) ?? '';
  expect(nearest).toMatch(/^(\d+ ft|0\.\d mi)\b/);

  const firstTen = await cards.locator('.marker-title').allTextContents();
  expect(firstTen.slice(0, 10)).toContain('Alamo Cenotaph');
});

import { test, expect } from '@playwright/test';

test.describe('Search Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for data to seed (first launch may take a moment)
    await page.waitForSelector('input[type="search"]', { timeout: 60000 });
  });

  test('shows search input on launch', async ({ page }) => {
    const input = page.locator('input[type="search"]');
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('placeholder', 'Marker # or keyword...');
  });

  test('searches by marker number and shows results', async ({ page }) => {
    const input = page.locator('input[type="search"]');
    await input.fill('95');

    // Wait for results to appear
    const firstResult = page.locator('.marker-card').first();
    await expect(firstResult).toBeVisible({ timeout: 5000 });

    // Should contain marker #95
    await expect(page.locator('.marker-number').first()).toContainText('95');
  });

  test('searches by keyword and shows results', async ({ page }) => {
    const input = page.locator('input[type="search"]');
    await input.fill('Alamo');

    // Wait for results
    const firstResult = page.locator('.marker-card').first();
    await expect(firstResult).toBeVisible({ timeout: 5000 });

    // Results should be relevant to "Alamo"
    const resultCount = await page.locator('.marker-card').count();
    expect(resultCount).toBeGreaterThan(0);
  });

  test('navigates to marker detail from search result', async ({ page }) => {
    const input = page.locator('input[type="search"]');
    await input.fill('95');

    // Wait for and click the first result
    const firstResult = page.locator('.marker-card').first();
    await expect(firstResult).toBeVisible({ timeout: 5000 });
    await firstResult.click();

    // Should show marker detail view
    await expect(page.locator('.marker-detail')).toBeVisible();
    await expect(page.locator('.marker-detail-title')).toBeVisible();
    await expect(page.locator('.marker-detail-text')).toBeVisible();
  });

  test('back button returns to search results', async ({ page }) => {
    const input = page.locator('input[type="search"]');
    await input.fill('95');

    const firstResult = page.locator('.marker-card').first();
    await expect(firstResult).toBeVisible({ timeout: 5000 });
    await firstResult.click();

    // Click back
    await page.locator('.back-button').click();

    // Should be back on search page
    await expect(page.locator('input[type="search"]')).toBeVisible();
  });

  test('clear button clears the search', async ({ page }) => {
    const input = page.locator('input[type="search"]');
    await input.fill('test query');

    // Click clear button
    const clear = page.locator('.search-clear');
    await expect(clear).toBeVisible();
    await clear.click();

    await expect(input).toHaveValue('');
  });

  test('shows Learn More section on researched marker detail', async ({ page }) => {
    const input = page.locator('input[type="search"]');
    await input.fill('95');

    // Wait for and click the Alamo Cenotaph result
    const firstResult = page.locator('.marker-card').first();
    await expect(firstResult).toBeVisible({ timeout: 5000 });
    await firstResult.click();

    // Should show marker detail
    await expect(page.locator('.marker-detail')).toBeVisible();

    // Should show Learn More section (marker 95 has research data)
    await expect(page.locator('.learn-more-section')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.learn-more-title')).toContainText('Learn More');

    // Should have links
    const links = page.locator('.learn-more-link');
    await expect(links.first()).toBeVisible();
  });
});

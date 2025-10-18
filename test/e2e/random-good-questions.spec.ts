import { test, expect } from '@playwright/test';

test.describe('Random Good Question Loading', () => {
  test('should fallback to AI generation when no good questions available', async ({ page }) => {
    // Mock empty database response
    await page.route('**/api/exercise/random-good-question**', (route) => {
      void route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'No good questions found' }),
      });
    });

    await page.goto('/en');

    // Should show generate button instead of immediate content
    await expect(page.locator('[data-testid="generate-button"]')).toBeVisible();

    // Should not have immediate content
    await expect(page.locator('[data-testid="reading-passage"]')).not.toBeVisible();
  });

  test('should handle database errors gracefully', async ({ page }) => {
    // Mock database error
    await page.route('**/api/exercise/random-good-question**', (route) => {
      void route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Database error' }),
      });
    });

    await page.goto('/en');

    // Should show generate button as fallback
    await expect(page.locator('[data-testid="generate-button"]')).toBeVisible();

    // Should not have immediate content
    await expect(page.locator('[data-testid="reading-passage"]')).not.toBeVisible();
  });

  test('should maintain performance with content loading', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/en');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check if content loads immediately or if we need to generate
    const hasContent = await page.locator('[data-testid="reading-passage"]').isVisible();

    if (!hasContent) {
      // Generate content if not already loaded
      await page.locator('[data-testid="generate-button"]').click();
      await page.waitForSelector('[data-testid="reading-passage"]', { timeout: 10000 });
    }

    const loadTime = Date.now() - startTime;

    // Should load reasonably quickly (under 8 seconds)
    expect(loadTime).toBeLessThan(8000);

    // Should have all interactive elements
    await expect(page.locator('[data-testid="answer-option-0"]')).toBeVisible();
    await expect(page.locator('[data-testid="answer-option-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="answer-option-2"]')).toBeVisible();
    await expect(page.locator('[data-testid="answer-option-3"]')).toBeVisible();
  });
});

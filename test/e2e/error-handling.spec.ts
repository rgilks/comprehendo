import { test, expect } from '@playwright/test';

test.describe('Error Handling and Edge Cases', () => {
  test('should handle network timeout gracefully', async ({ page }) => {
    // Mock slow API response
    await page.route('**/api/exercise', async (route) => {
      // Simulate slow response
      await new Promise((resolve) => setTimeout(resolve, 10000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Timeout' }),
      });
    });

    await page.goto('/en');

    const generateButton = page.locator('[data-testid="generate-button"]');
    await generateButton.click();

    // Wait for potential timeout handling
    await page.waitForTimeout(3000);

    // Page should remain functional
    await expect(page.getByRole('heading', { name: 'Comprehendo' })).toBeVisible();
    await expect(generateButton).toBeVisible();
  });

  test('should handle malformed API response', async ({ page }) => {
    // Mock malformed response
    await page.route('**/api/exercise', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: 'invalid json response',
      });
    });

    await page.goto('/en');

    const generateButton = page.locator('[data-testid="generate-button"]');
    await generateButton.click();

    await page.waitForTimeout(3000);

    // Page should handle the error gracefully
    await expect(page.getByRole('heading', { name: 'Comprehendo' })).toBeVisible();
  });

  test('should handle empty API response', async ({ page }) => {
    // Mock empty response
    await page.route('**/api/exercise', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    });

    await page.goto('/en');

    const generateButton = page.locator('[data-testid="generate-button"]');
    await generateButton.click();

    await page.waitForTimeout(3000);

    // Page should handle empty response
    await expect(page.getByRole('heading', { name: 'Comprehendo' })).toBeVisible();
  });

  test('should handle authentication errors', async ({ page }) => {
    // Mock auth error
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized' }),
      });
    });

    await page.goto('/en');

    // Page should still load without auth
    await expect(page.getByRole('heading', { name: 'Comprehendo' })).toBeVisible();
  });

  test('should handle invalid language codes', async ({ page }) => {
    await page.goto('/invalid-lang');

    // Should redirect to 404 or default language
    const currentUrl = page.url();
    const is404 = currentUrl.includes('404') || currentUrl.includes('not-found');
    const isRedirected = currentUrl.includes('/en') || currentUrl.includes('/es');

    expect(is404 || isRedirected).toBeTruthy();
  });

  test('should handle rapid button clicks', async ({ page }) => {
    await page.goto('/en');

    const generateButton = page.locator('[data-testid="generate-button"]');

    // Click multiple times rapidly - the button should handle this gracefully
    await generateButton.click();

    // Wait a bit for the button to potentially become disabled
    await page.waitForTimeout(100);

    // Try to click again - this should either work or be ignored if disabled
    await generateButton.click({ timeout: 1000 }).catch(() => {
      // Ignore if button is disabled/unclickable
    });

    await generateButton.click({ timeout: 1000 }).catch(() => {
      // Ignore if button is disabled/unclickable
    });

    // Page should remain stable
    await expect(page.getByRole('heading', { name: 'Comprehendo' })).toBeVisible();
    await expect(generateButton).toBeVisible();
  });

  test('should handle browser back/forward navigation', async ({ page }) => {
    await page.goto('/en');

    // Navigate to Spanish
    await page.goto('/es');
    await expect(page).toHaveURL('/es');

    // Go back
    await page.goBack();
    await expect(page).toHaveURL('/en');

    // Go forward
    await page.goForward();
    await expect(page).toHaveURL('/es');
  });

  test('should handle page refresh during content generation', async ({ page }) => {
    await page.goto('/en');

    const generateButton = page.locator('[data-testid="generate-button"]');
    await generateButton.click();

    // Refresh page while content is loading
    await page.reload();

    // Page should load normally after refresh
    await expect(page.getByRole('heading', { name: 'Comprehendo' })).toBeVisible();
    await expect(generateButton).toBeVisible();
  });
});

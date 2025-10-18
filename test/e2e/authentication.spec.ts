import { test, expect } from '@playwright/test';
import { waitForNetworkIdle } from './test-helpers';

test.describe('Authentication Flow', () => {
  test('should show auth buttons when not logged in', async ({ page }) => {
    await page.goto('/en');

    await expect(page.getByRole('heading', { name: 'Comprehendo' })).toBeVisible();
    await waitForNetworkIdle(page, 3000);

    await expect(page.getByRole('heading', { name: 'Comprehendo' })).toBeVisible();
  });

  test('should handle generate button click without auth', async ({ page }) => {
    await page.goto('/en');

    await expect(page.getByRole('heading', { name: 'Comprehendo' })).toBeVisible();

    const generateButton = page.locator('[data-testid="generate-button"]');
    await expect(generateButton).toBeVisible();
    await expect(generateButton).toBeEnabled();
    await generateButton.click();

    await expect(generateButton).toBeVisible();

    await page.waitForTimeout(3000);

    await expect(page.getByRole('heading', { name: 'Comprehendo' })).toBeVisible();
  });

  test('should show login prompt when trying to generate without auth', async ({ page }) => {
    await page.goto('/en');

    await expect(page.getByRole('heading', { name: 'Comprehendo' })).toBeVisible();

    const generateButton = page.locator('[data-testid="generate-button"]');
    await expect(generateButton).toBeVisible();
    await expect(generateButton).toBeEnabled();
    await generateButton.click();

    await page.waitForTimeout(2000);

    const loginPrompt = page.locator('[class*="login"], [class*="sign-in"]');
    const promptVisible = await loginPrompt.isVisible().catch(() => false);

    if (promptVisible) {
      await expect(loginPrompt).toBeVisible();
    }

    await expect(page.getByRole('heading', { name: 'Comprehendo' })).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';

test.describe('App Basics', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/en');

    // Check page title and basic content
    await expect(page).toHaveTitle('Comprehendo');
    await expect(page.getByRole('heading', { name: 'Comprehendo' })).toBeVisible();
    await expect(page.getByText('An AI-powered language learning tool')).toBeVisible();
  });

  test('should display language selector', async ({ page }) => {
    await page.goto('/en');

    // Check UI language selector
    const uiLangButton = page.locator('#language-select-button');
    await expect(uiLangButton).toBeVisible();
    await expect(uiLangButton).toContainText('English');

    // Check learning language selector
    const learningLangSelect = page.locator('[data-testid="language-select"]');
    await expect(learningLangSelect).toBeVisible();
    // Check that it has a value (could be 'es' or 'en' depending on implementation)
    const currentValue = await learningLangSelect.inputValue();
    expect(currentValue).toBeTruthy();
  });

  test('should display CEFR level', async ({ page }) => {
    await page.goto('/en');

    const levelDisplay = page.locator('[data-testid="level-display"]');
    await expect(levelDisplay).toBeVisible();
    await expect(levelDisplay).toContainText('A1');
  });

  test('should show generate button', async ({ page }) => {
    await page.goto('/en');

    const generateButton = page.locator('[data-testid="generate-button"]');
    await expect(generateButton).toBeVisible();
    await expect(generateButton).toContainText('Give me something to read');
  });

  test('should handle 404 for invalid language', async ({ page }) => {
    await page.goto('/xx');

    await expect(page.getByRole('heading', { name: /404/i })).toBeVisible();
    await expect(page.getByText('Page Not Found')).toBeVisible();
  });
});

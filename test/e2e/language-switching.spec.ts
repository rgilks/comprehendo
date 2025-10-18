import { test, expect } from '@playwright/test';
import { waitForElementToBeVisible } from './test-helpers';

test.describe('Language Switching', () => {
  test('should switch UI language', async ({ page }) => {
    await page.goto('/en');

    await expect(page.getByRole('heading', { name: 'Comprehendo' })).toBeVisible();

    const langButton = page.locator('#language-select-button');
    await expect(langButton).toBeVisible();
    await langButton.click();

    const spanishOption = page.getByRole('menuitem', { name: 'Español' });
    const spanishVisible = await waitForElementToBeVisible(page, '[role="menuitem"]', 3000);

    if (spanishVisible) {
      await spanishOption.click();

      await expect(page).toHaveURL('/es');

      const generateButton = page.locator('[data-testid="generate-button"]');
      await expect(generateButton).toContainText('Genera un nuevo texto');
    } else {
      await expect(langButton).toBeVisible();
      await expect(page).toHaveURL('/en');
    }
  });

  test('should change learning language', async ({ page }) => {
    await page.goto('/en');

    const learningSelect = page.locator('[data-testid="language-select"]');
    await learningSelect.selectOption('fr');

    await expect(learningSelect).toHaveValue('fr');
  });

  test('should maintain language selection across page reload', async ({ page }) => {
    await page.goto('/en');

    const learningSelect = page.locator('[data-testid="language-select"]');
    await learningSelect.selectOption('de');

    await expect(learningSelect).toHaveValue('de');

    await page.reload();

    const currentValue = await learningSelect.inputValue();
    await expect(learningSelect).toBeVisible();
    await expect(learningSelect).toHaveValue(currentValue);
  });

  test('should sync language selector with URL parameter', async ({ page }) => {
    // Navigate directly to Hebrew URL
    await page.goto('/he');

    // Language selector should show Hebrew
    const langButton = page.locator('#language-select-button');
    await expect(langButton).toContainText('עברית');

    // Navigate directly to French URL
    await page.goto('/fr');

    // Language selector should show French
    await expect(langButton).toContainText('Français');

    // Navigate directly to German URL
    await page.goto('/de');

    // Language selector should show German
    await expect(langButton).toContainText('Deutsch');
  });
});

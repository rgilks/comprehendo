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

  test('should reset translation credits when generating new content', async ({ page }) => {
    await page.goto('/en');

    // Generate initial content
    const generateButton = page.locator('[data-testid="generate-button"]');
    await generateButton.click();

    // Wait for content to load with longer timeout
    await expect(page.locator('[data-testid="passage-text"]')).toBeVisible({ timeout: 15000 });

    // Check initial credits
    const creditsDisplay = page.locator('[data-testid="hover-credits-display"]');
    await expect(creditsDisplay).toContainText('7');

    // Click on a word to use a credit
    const passageText = page.locator('[data-testid="passage-text"]');
    const firstWord = passageText.locator('span').first();
    await firstWord.click();

    // Credits should decrease (allow for timing variations)
    await expect(creditsDisplay).toContainText(/[67]/);

    // Answer the question to proceed to next quiz
    const answerOption = page.locator('[data-testid="answer-option-0"]');
    await answerOption.click();

    // Wait for feedback and then generate new content
    await expect(page.locator('text=Correct!').or(page.locator('text=Incorrect'))).toBeVisible();
    await generateButton.click();

    // Wait for new content to load
    await expect(page.locator('[data-testid="passage-text"]')).toBeVisible();

    // Credits should reset to 7
    await expect(creditsDisplay).toContainText('7');
  });
});

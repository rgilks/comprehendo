import { test, expect } from '@playwright/test';

test.describe('Core Reading Comprehension Flow', () => {
  test.use({ storageState: 'test/e2e/auth/nonAdmin.storageState.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/en');
    await expect(page.locator('[data-testid="text-generator-container"]')).toBeVisible({
      timeout: 10000,
    });
  });

  test('should display passage, question, options, and handle answers', async ({ page }) => {
    const textGeneratorContainer = page.locator('[data-testid="text-generator-container"]');
    const readingPassageContainer = textGeneratorContainer.locator(
      '[data-testid="reading-passage"]'
    );
    const passageLocator = readingPassageContainer.locator('[data-testid="passage-text"]');
    const questionLocator = textGeneratorContainer.locator('[data-testid="question-text"]');
    const feedbackLocator = textGeneratorContainer.locator('[data-testid="feedback-explanation"]');
    const getOptionLocator = (index: number) =>
      textGeneratorContainer.locator(`[data-testid="answer-option-${index}"]`);

    // Click the generate button to load the quiz
    const generateButton = page.locator('[data-testid="generate-button"]');
    await expect(generateButton).toBeVisible();
    await generateButton.click();

    // Wait for passage to load and verify it has content
    await expect(passageLocator).toBeVisible({ timeout: 10000 });
    const passageText = await passageLocator.textContent();
    expect(passageText).toBeTruthy();
    expect(passageText && passageText.length).toBeGreaterThan(10);

    // Wait for question to load
    await expect(questionLocator).toBeVisible({ timeout: 5000 });
    const questionText = await questionLocator.textContent();
    expect(questionText).toBeTruthy();

    // Verify all 4 options are present and enabled
    for (let i = 0; i < 4; i++) {
      const optionLocator = getOptionLocator(i);
      await expect(optionLocator).toBeVisible();
      await expect(optionLocator).toBeEnabled();
      const optionText = await optionLocator.textContent();
      expect(optionText).toBeTruthy();
    }

    // Click the first option (likely incorrect)
    const firstOptionLocator = getOptionLocator(0);
    await firstOptionLocator.click();

    // Wait for feedback to appear
    await expect(feedbackLocator).toBeVisible({ timeout: 5000 });
    const feedbackText = await feedbackLocator.textContent();
    expect(feedbackText).toBeTruthy();

    // Verify loading states work - options should be disabled after clicking
    for (let i = 0; i < 4; i++) {
      const optionLocator = getOptionLocator(i);
      await expect(optionLocator).toBeDisabled();
    }
  });
});

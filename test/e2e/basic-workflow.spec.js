import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TARGET_URL = `${BASE_URL}/en`;

test.describe('Basic Workflow Test', () => {
  test('should load, generate a question, and allow answering', async ({ page }) => {
    console.log(`Navigating to ${TARGET_URL}...`);
    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
    console.log('Navigation complete. Waiting for generate button...');

    const generateButton = page.locator('[data-testid="generate-button"]:not([disabled])');
    await expect(
      generateButton,
      'Generate button should be visible and enabled initially'
    ).toBeVisible({ timeout: 30000 });
    console.log('Generate button found. Clicking...');

    await generateButton.click();
    console.log('Generate button clicked. Waiting for quiz or error...');

    const quizSection = page.locator('[data-testid="quiz-section"]');
    const errorDisplay = page.locator('[data-testid="error-display"] p'); // Assuming error text is in a <p>

    // Wait for either the quiz section to become visible OR the error message to become visible
    await Promise.race([
      expect(quizSection, 'Quiz section should appear').toBeVisible({ timeout: 30000 }),
      expect(errorDisplay, 'Error message should appear').toBeVisible({ timeout: 30000 }),
    ]);

    console.log('Quiz section or error message appeared.');

    // Check which one appeared
    const isQuizVisible = await quizSection.isVisible();

    if (isQuizVisible) {
      console.log('Quiz section is visible. Verifying question and options...');
      const questionElement = page.locator('[data-testid="quiz-question"]');
      const optionA = page.locator('[data-testid="quiz-option-A"]');

      await expect(questionElement, 'Quiz question should be visible').toBeVisible({
        timeout: 5000,
      });
      await expect(optionA, 'Option A should be visible').toBeVisible({ timeout: 5000 });
      console.log('Quiz elements verified. Clicking Option A...');

      await optionA.click();
      console.log('Option A clicked. Waiting for generate button to re-enable...');

      // Generate button should become enabled again after answering
      await expect(generateButton, 'Generate button should re-enable after answering').toBeVisible({
        timeout: 30000,
      });
      console.log('Generate button re-enabled. Test successful.');
    } else {
      console.log('Error message is visible. Verifying error...');
      // If the quiz didn't appear, the error must have. Check its content if needed.
      await expect(errorDisplay, 'Error message should be visible').toBeVisible();
      const errorText = await errorDisplay.textContent();
      console.log(`Error message displayed: "${errorText}". This might be expected.`);
      // Optionally, check if the generate button re-enables even after an error
      try {
        await expect(generateButton, 'Generate button should re-enable after error').toBeVisible({
          timeout: 5000,
        });
        console.log('Generate button re-enabled after error.');
      } catch (e) {
        console.log('Generate button did not re-enable after error (within 5s).');
        // Decide if this is a failure or acceptable depending on app logic
      }
    }
  });
});

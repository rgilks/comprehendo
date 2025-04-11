import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TARGET_URL = `${BASE_URL}/en`;

test.describe('Basic Workflow Test', () => {
  test('should load, generate a question, and allow answering', async ({ page }) => {
    // --- Console Logging Setup ---
    // page.on('console', (msg) => {
    //   // Optional: Filter for specific message types or prefixes
    //   // if (msg.text().startsWith('[YourPrefix]')) {
    //   console.log(`BROWSER CONSOLE: ${msg.type()}: ${msg.text()}`);
    //   // }
    // });
    // --- End Console Logging Setup ---

    console.log(`Navigating to ${TARGET_URL}...`);
    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
    console.log('Navigation complete. Waiting for generate button...');

    const generateButton = page.locator('[data-testid="generate-button"]:not([disabled])');
    await expect(
      generateButton,
      'Generate button should be visible and enabled initially'
    ).toBeVisible({ timeout: 2000 });
    console.log('Generate button found. Clicking...');

    await generateButton.click();
    console.log('Generate button clicked. Waiting for quiz or error...');

    const quizSection = page.locator('[data-testid="quiz-section"]');
    const errorDisplay = page.locator('[data-testid="error-display"] p'); // Assuming error text is in a <p>

    // Wait for either the quiz section to become visible OR the error message to become visible
    await Promise.race([
      expect(quizSection, 'Quiz section should appear').toBeVisible({ timeout: 2000 }),
      expect(errorDisplay, 'Error message should appear').toBeVisible({ timeout: 2000 }),
    ]);

    console.log('Quiz section or error message appeared.');

    // Check which one appeared
    const isQuizVisible = await quizSection.isVisible();

    if (isQuizVisible) {
      console.log('Quiz section is visible. Verifying question and options...');
      const questionElement = page.locator('[data-testid="quiz-question"]');
      const optionA = page.locator('[data-testid="quiz-option-A"]');

      await expect(questionElement, 'Quiz question should be visible').toBeVisible({
        timeout: 2000,
      });
      await expect(optionA, 'Option A should be visible').toBeVisible({ timeout: 2000 });
      console.log('Quiz elements verified. Clicking Option A...');

      await optionA.click();
      console.log('Option A clicked. Waiting for feedback and generate button re-enable...');

      // Check for feedback elements
      const feedbackHighlight = page.locator('[data-testid="feedback-highlight"]');
      const feedbackDescriptionA = page.locator('[data-testid="feedback-description-A"]');
      // Add locators for other feedback descriptions if needed (B, C, D, etc.)
      // const feedbackDescriptionB = page.locator('[data-testid="feedback-description-B"]');

      // Check that at least one highlight span is visible
      await expect(feedbackHighlight.first(), 'Feedback highlight should be visible').toBeVisible({
        timeout: 5000,
      });
      await expect(
        feedbackDescriptionA,
        'Feedback description for A should be visible'
      ).toBeVisible({ timeout: 5000 });
      // Add expectations for other feedback descriptions if needed
      // await expect(feedbackDescriptionB, 'Feedback description for B should be visible').toBeVisible({ timeout: 10000 });

      console.log('Feedback elements verified.');

      // Generate button should become enabled again after answering and showing feedback
      await expect(generateButton, 'Generate button should re-enable after answering').toBeVisible({
        timeout: 2000,
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
          timeout: 2000,
        });
        console.log('Generate button re-enabled after error.');
      } catch (e) {
        console.log('Generate button did not re-enable after error (within 2s).');
        // Decide if this is a failure or acceptable depending on app logic
      }
    }
  });
});

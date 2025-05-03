import { test, expect } from '@playwright/test';

const mockApiResponse = {
  passage: 'This is a mock passage about cats. Cats are curious animals.',
  question: 'What are cats?',
  options: ['Dogs', 'Curious animals', 'Birds', 'Fish'],
  correctAnswerIndex: 1,
  explanation: {
    correct: 'The passage explicitly states that cats are curious animals.',
    incorrect: [
      'The passage is about cats, not dogs.',
      "While cats might interact with birds, the passage doesn't define them as such.",
      'The passage does not mention fish.',
    ],
  },
  relevantText: 'Cats are curious animals.',
};

test.describe('Core Reading Comprehension Flow', () => {
  test.use({ storageState: 'test/e2e/auth/nonAdmin.storageState.json' });

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/exercise', async (route) => {
      const typedMockData = JSON.parse(JSON.stringify(mockApiResponse)) as typeof mockApiResponse;
      await route.fulfill({ json: typedMockData });
    });
    await page.goto('/en', { waitUntil: 'networkidle' });
    await expect(page.locator('[data-testid="text-generator-container"]')).toBeVisible({
      timeout: 10000,
    });
  });

  test.skip('should display passage, question, options, and handle answers', async ({ page }) => {
    const readingPassageContainer = page.locator('[data-testid="reading-passage"]');
    const passageLocator = readingPassageContainer.locator('[data-testid="passage-text"]');
    await expect(passageLocator).toHaveText(mockApiResponse.passage, {
      timeout: 5000,
      useInnerText: true,
    });

    const questionLocator = page.locator('[data-testid="question-text"]');
    await expect(questionLocator).toContainText(mockApiResponse.question);

    for (let i = 0; i < mockApiResponse.options.length; i++) {
      const optionLocator = page.locator(`[data-testid="answer-option-${i}"]`);
      const optionText = mockApiResponse.options[i];
      await expect(optionLocator).toContainText(optionText);
      await expect(optionLocator).toBeEnabled();
    }

    const incorrectOptionLocator = page.locator('[data-testid="answer-option-0"]');
    await incorrectOptionLocator.click();

    const feedbackLocator = page.locator('[data-testid="feedback-explanation"]');
    await expect(feedbackLocator).toBeVisible();
    const incorrectExplanation = mockApiResponse.explanation.incorrect[0];
    await expect(feedbackLocator).toContainText(incorrectExplanation);
    await expect(page.locator('[data-testid="relevant-text"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="next-exercise-button"]')).not.toBeVisible();

    // await expect(incorrectOptionLocator).toBeDisabled();
    // await expect(page.locator('[data-testid="answer-option-1"]')).toBeDisabled();

    const correctOptionLocator = page.locator('[data-testid="answer-option-1"]');
    await correctOptionLocator.click();

    await expect(feedbackLocator).toBeVisible();
    await expect(feedbackLocator).toContainText(mockApiResponse.explanation.correct);
    const relevantTextLocator = page.locator('[data-testid="relevant-text"]');
    await expect(relevantTextLocator).toBeVisible();
    await expect(relevantTextLocator).toContainText(mockApiResponse.relevantText);

    const nextButtonLocator = page.locator('[data-testid="next-exercise-button"]');
    await expect(nextButtonLocator).toBeVisible();
    await expect(nextButtonLocator).toBeEnabled();
  });
});

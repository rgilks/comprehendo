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
    const relevantTextLocator = textGeneratorContainer.locator('[data-testid="relevant-text"]');
    const nextButtonLocator = textGeneratorContainer.locator(
      '[data-testid="next-exercise-button"]'
    );
    const getOptionLocator = (index: number) =>
      textGeneratorContainer.locator(`[data-testid="answer-option-${index}"]`);

    await expect(passageLocator).toHaveText(mockApiResponse.passage, {
      timeout: 5000,
      useInnerText: true,
    });
    await expect(questionLocator).toContainText(mockApiResponse.question);

    for (let i = 0; i < mockApiResponse.options.length; i++) {
      const optionLocator = getOptionLocator(i);
      const optionText = mockApiResponse.options[i];
      await expect(optionLocator).toContainText(optionText);
      await expect(optionLocator).toBeEnabled();
    }

    const incorrectIndex = mockApiResponse.options.findIndex(
      (_, i) => i !== mockApiResponse.correctAnswerIndex
    );
    const incorrectOptionLocator = getOptionLocator(incorrectIndex);
    await incorrectOptionLocator.click();

    await expect(feedbackLocator).toBeVisible();
    const incorrectExplanation = mockApiResponse.explanation.incorrect[incorrectIndex];
    await expect(feedbackLocator).toContainText(incorrectExplanation);
    await expect(relevantTextLocator).not.toBeVisible();
    await expect(nextButtonLocator).not.toBeVisible();

    const correctOptionLocator = getOptionLocator(mockApiResponse.correctAnswerIndex);
    await correctOptionLocator.click();

    await expect(feedbackLocator).toBeVisible();
    await expect(feedbackLocator).toContainText(mockApiResponse.explanation.correct);
    await expect(relevantTextLocator).toBeVisible();
    await expect(relevantTextLocator).toContainText(mockApiResponse.relevantText);
    await expect(nextButtonLocator).toBeVisible();
    await expect(nextButtonLocator).toBeEnabled();
  });
});

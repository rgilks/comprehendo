import { test, expect } from '@playwright/test';
import type { InitialExercisePairResult } from '@/lib/domain/schemas';

const mockSingleExerciseData = {
  paragraph: 'This is a mock passage about cats. Cats are curious animals.',
  question: 'What are cats?',
  options: { A: 'Dogs', B: 'Curious animals', C: 'Birds', D: 'Fish' },
  correctAnswer: 'B',
  explanation: {
    correct: 'The passage explicitly states that cats are curious animals.',
    incorrectByOptionKey: {
      A: 'The passage is about cats, not dogs.',
      C: "While cats might interact with birds, the passage doesn't define them as such.",
      D: 'The passage does not mention fish.',
    },
  },
  relevantText: 'Cats are curious animals.',
  topic: 'Animals',
  language: 'en',
};

test.skip('Core Reading Comprehension Flow', () => {
  test.use({ storageState: 'test/e2e/auth/nonAdmin.storageState.json' });

  test.beforeEach(async ({ page }) => {
    await page.route('**/en', async (route) => {
      const request = route.request();
      if (request.method() === 'POST' && request.headers()['next-action']) {
        const quizResult1 = {
          quizData: {
            paragraph: mockSingleExerciseData.paragraph,
            question: mockSingleExerciseData.question,
            options: mockSingleExerciseData.options,
            topic: mockSingleExerciseData.topic,
            language: mockSingleExerciseData.language,
          },
          quizId: 123,
          error: null,
          cached: false,
        };
        const quizResult2 = {
          quizData: {
            paragraph: 'This is the second mock passage for the pair.',
            question: 'What is this second passage about?',
            options: { A: 'SecondA', B: 'SecondB', C: 'SecondC', D: 'SecondD' },
            topic: 'General Knowledge',
            language: mockSingleExerciseData.language,
          },
          quizId: 124,
          error: null,
          cached: false,
        };
        const responseForServerAction: InitialExercisePairResult = {
          quizzes: [quizResult1, quizResult2],
          error: null,
        };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(responseForServerAction),
        });
        return;
      }
      await route.continue();
    });

    await page.goto('/en');
    await expect(page.locator('[data-testid="text-generator-container"]')).toBeVisible({
      timeout: 15000, // Adjusted timeout
    });
  });

  test('should display passage, question, options, and handle answers', async ({ page }) => {
    const textGeneratorContainer = page.locator('[data-testid="text-generator-container"]');
    const readingPassageRootLocator = textGeneratorContainer.locator(
      '[data-testid="reading-passage"]'
    );
    const passageLocator = readingPassageRootLocator.locator('[data-testid="passage-text"]');
    const questionLocator = textGeneratorContainer.locator('[data-testid="question-text"]');
    const feedbackLocator = textGeneratorContainer.locator('[data-testid="feedback-explanation"]');
    const relevantTextLocator = textGeneratorContainer.locator('[data-testid="relevant-text"]');
    const nextButtonLocator = textGeneratorContainer.locator(
      '[data-testid="next-exercise-button"]'
    );

    await expect(
      readingPassageRootLocator,
      'Reading passage root container should be visible'
    ).toBeVisible({ timeout: 10000 });

    await expect(passageLocator).toHaveText(mockSingleExerciseData.paragraph, {
      timeout: 5000,
      useInnerText: true,
    });
    await expect(questionLocator).toContainText(mockSingleExerciseData.question);

    const optionEntries = Object.entries(mockSingleExerciseData.options);
    for (let i = 0; i < optionEntries.length; i++) {
      const [, optionText] = optionEntries[i];
      const optionLocator = textGeneratorContainer.locator(`[data-testid="answer-option-${i}"]`);
      await expect(optionLocator).toContainText(optionText);
      await expect(optionLocator).toBeEnabled();
    }

    let incorrectOptionKey: string = '';
    let incorrectOptionIndex: number = -1;
    for (let i = 0; i < optionEntries.length; i++) {
      if (optionEntries[i][0] !== mockSingleExerciseData.correctAnswer) {
        incorrectOptionKey = optionEntries[i][0];
        incorrectOptionIndex = i;
        break;
      }
    }

    if (incorrectOptionIndex === -1) throw new Error('Could not find an incorrect option to test.');

    const incorrectOptionLocator = textGeneratorContainer.locator(
      `[data-testid="answer-option-${incorrectOptionIndex}"]`
    );
    await incorrectOptionLocator.click();

    await expect(feedbackLocator).toBeVisible();
    const expectedIncorrectExplanation =
      mockSingleExerciseData.explanation.incorrectByOptionKey[
        incorrectOptionKey as keyof typeof mockSingleExerciseData.explanation.incorrectByOptionKey
      ];
    await expect(feedbackLocator).toContainText(expectedIncorrectExplanation);
    await expect(relevantTextLocator).not.toBeVisible();
    await expect(nextButtonLocator).not.toBeVisible();

    const correctOptionIndex = optionEntries.findIndex(
      ([key]) => key === mockSingleExerciseData.correctAnswer
    );
    if (correctOptionIndex === -1) throw new Error('Could not find the correct option to test.');
    const correctOptionLocator = textGeneratorContainer.locator(
      `[data-testid="answer-option-${correctOptionIndex}"]`
    );
    await correctOptionLocator.click();

    await expect(feedbackLocator).toBeVisible();
    await expect(feedbackLocator).toContainText(mockSingleExerciseData.explanation.correct);
    await expect(relevantTextLocator).toBeVisible();
    await expect(relevantTextLocator).toContainText(mockSingleExerciseData.relevantText);
    await expect(nextButtonLocator).toBeVisible();
    await expect(nextButtonLocator).toBeEnabled();
  });
});

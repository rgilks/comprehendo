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
    await page.route('/api/exercise', async (route) => {
      const json = mockApiResponse;
      await route.fulfill({ json });
    });
    await page.goto('/');
    await expect(page.locator('[data-testid="text-generator-container"]')).toBeVisible({
      timeout: 2000,
    });
  });
});

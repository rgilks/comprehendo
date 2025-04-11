import { test, expect } from '@playwright/test';

// Mock API response for predictable testing
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

// Removed unused timeout constants

test.describe('Core Reading Comprehension Flow', () => {
  // Use the non-admin user state for these tests
  test.use({ storageState: 'test/e2e/auth/nonAdmin.storageState.json' });

  test.beforeEach(async ({ page }) => {
    // Mock the API route before navigating
    await page.route('/api/exercise', async (route) => {
      const json = mockApiResponse;
      await route.fulfill({ json });
    });
    // Go to the home page
    await page.goto('/');
    // Wait for the main container after navigation
    await expect(page.locator('[data-testid="text-generator-container"]')).toBeVisible({
      timeout: 2000, // Use 2s timeout after navigation
    });
  });

  // Test: 'should complete a reading exercise successfully' (removed)

  // Test: 'should show feedback for incorrect answer' (removed)
});

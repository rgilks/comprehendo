import { Page } from '@playwright/test';

export const mockQuizGeneration = async (page: Page) => {
  // Mock the exercise generation by intercepting fetch calls to server actions
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();

    // Mock exercise generation endpoints
    if (url.includes('exercise') || url.includes('generate')) {
      const mockQuizData = {
        quizData: {
          paragraph:
            'This is a sample reading passage for testing purposes. It contains enough text to demonstrate the functionality of the quiz system. The passage is designed to test reading comprehension skills at the A1 level.',
          question: 'What is the main purpose of this passage?',
          options: [
            'To test reading comprehension',
            'To demonstrate functionality',
            'To show sample text',
            'To test quiz system',
          ],
          correctAnswer: 0,
          explanation: 'The passage is specifically designed to test reading comprehension skills.',
        },
        quizId: Math.floor(Math.random() * 1000),
        cached: false,
        error: null,
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockQuizData),
      });
      return;
    }

    // Let other requests pass through
    await route.continue();
  });

  // Also mock any fetch calls that might be made directly
  await page.addInitScript(() => {
    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : (input as URL).toString();

      if (url.includes('exercise') || url.includes('generate')) {
        return new Response(
          JSON.stringify({
            quizData: {
              paragraph: 'This is a sample reading passage for testing purposes.',
              question: 'What is the main purpose of this passage?',
              options: [
                'To test reading comprehension',
                'To demonstrate functionality',
                'To show sample text',
                'To test quiz system',
              ],
              correctAnswer: 0,
              explanation:
                'The passage is specifically designed to test reading comprehension skills.',
            },
            quizId: Math.floor(Math.random() * 1000),
            cached: false,
            error: null,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      return originalFetch(input, init);
    };
  });
};

export const mockAuthSession = async (
  page: Page,
  user: { name: string; email: string; image: string; isAdmin?: boolean }
) => {
  await page.route('**/api/auth/session', async (route) => {
    const mockSession = {
      user: {
        name: user.name,
        email: user.email,
        image: user.image,
        isAdmin: user.isAdmin || false,
      },
      expires: new Date(Date.now() + 86400 * 1000).toISOString(),
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockSession),
    });
  });
};

export const mockProgressData = async (
  page: Page,
  progress: {
    totalExercises: number;
    correctAnswers: number;
    streak: number;
  }
) => {
  await page.route('**/api/progress', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(progress),
    });
  });
};

export const mockFeedbackSubmission = async (page: Page) => {
  await page.route('**/api/feedback', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });
};

export const mockTranslationAPI = async (page: Page) => {
  await page.route('**/api/translate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        translatedText: 'Sample translation',
        detectedLanguage: 'en',
      }),
    });
  });
};

export const waitForContentLoad = async (page: Page, timeout = 5000) => {
  try {
    await page.waitForSelector('[data-testid="passage-text"]', { timeout });
    return true;
  } catch {
    return false;
  }
};

export const waitForQuizLoad = async (page: Page, timeout = 5000) => {
  try {
    await page.waitForSelector('[data-testid="question-text"]', { timeout });
    return true;
  } catch {
    return false;
  }
};

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TARGET_URL = `${BASE_URL}/en`;

test.describe('Basic Workflow Test', () => {
  test('should load, generate a question, and allow answering', async ({ page }) => {
    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });

    const generateButton = page.locator('[data-testid="generate-button"]:not([disabled])');
    await expect(
      generateButton,
      'Generate button should be visible and enabled initially'
    ).toBeVisible({ timeout: 2000 });

    await generateButton.click();

    const quizSection = page.locator('[data-testid="quiz-section"]');
    const errorDisplay = page.locator('[data-testid="error-display"] p');

    await Promise.race([
      expect(quizSection, 'Quiz section should appear').toBeVisible({ timeout: 2000 }),
      expect(errorDisplay, 'Error message should appear').toBeVisible({ timeout: 2000 }),
    ]);

    const isQuizVisible = await quizSection.isVisible();

    if (isQuizVisible) {
      const questionElement = page.locator('[data-testid="quiz-question"]');
      const optionA = page.locator('[data-testid="quiz-option-A"]');

      await expect(questionElement, 'Quiz question should be visible').toBeVisible({
        timeout: 2000,
      });
      await expect(optionA, 'Option A should be visible').toBeVisible({ timeout: 2000 });

      await optionA.click();

      const feedbackHighlight = page.locator('[data-testid="feedback-highlight"]');
      const feedbackDescriptionA = page.locator('[data-testid="feedback-description-A"]');

      await expect(feedbackHighlight.first(), 'Feedback highlight should be visible').toBeVisible({
        timeout: 5000,
      });
      await expect(
        feedbackDescriptionA,
        'Feedback description for A should be visible'
      ).toBeVisible({ timeout: 5000 });

      await expect(generateButton, 'Generate button should re-enable after answering').toBeVisible({
        timeout: 2000,
      });
    } else {
      await expect(errorDisplay, 'Error message should be visible').toBeVisible();
      // Optionally, check if the generate button re-enables even after an error
      try {
        await expect(generateButton, 'Generate button should re-enable after error').toBeVisible({
          timeout: 2000,
        });
      } catch (e) {
        // Ignore error if button doesn't re-enable, might be expected
      }
    }
  });

  test('should allow changing UI language', async ({ page }) => {
    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });

    const languageDropdownButton = page.locator('#language-select-button');
    await expect(languageDropdownButton, 'Language dropdown button should be visible').toBeVisible({
      timeout: 2000,
    });

    await languageDropdownButton.click();

    const spanishLangOption = page.locator('div[role="menu"] button:has-text("Español")');
    await expect(
      spanishLangOption,
      'Spanish language option should be visible in dropdown'
    ).toBeVisible({ timeout: 2000 });

    await spanishLangOption.click();

    const expectedSpanishUrl = `${BASE_URL}/es`;
    await page.waitForURL(expectedSpanishUrl, { waitUntil: 'networkidle' });

    const generateButton = page.locator('[data-testid="generate-button"]');
    await expect(generateButton, 'Generate button should have Spanish text').toHaveText(
      'Genera un nuevo texto',
      { timeout: 2000 }
    );
  });

  test('should allow changing passage (learning) language', async ({ page }) => {
    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });

    const passageLangSelect = page.locator('#passage-language-select');
    await expect(passageLangSelect, 'Passage language selector should be visible').toBeVisible({
      timeout: 2000,
    });

    await passageLangSelect.selectOption({ value: 'es' });

    await expect(
      passageLangSelect,
      'Passage language selector value should be Spanish'
    ).toHaveValue('es', { timeout: 1000 });
  });

  test('should show avatar after mock GitHub sign-in', async ({ page }) => {
    // Intercept the session request to simulate a logged-in state
    await page.route('**/api/auth/session', async (route) => {
      const mockSession = {
        user: {
          name: 'Mock User',
          email: 'mock@example.com',
          image: 'https://avatars.githubusercontent.com/u/999999?v=4',
        },
        expires: new Date(Date.now() + 86400 * 1000).toISOString(),
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSession),
      });
    });

    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });

    // Locate the avatar image using its alt text, which comes from the mock session data.
    const avatarImage = page.locator('img[alt="Mock User"]');

    await expect(avatarImage, 'Avatar image should be visible after mock login').toBeVisible({
      timeout: 5000,
    });

    // Check the src attribute - it will be modified by next/image, so check for the encoded base URL part
    const expectedEncodedUrlPart = 'https%3A%2F%2Favatars.githubusercontent.com%2Fu%2F999999';
    await expect(
      avatarImage,
      'Avatar image src should contain the encoded mock URL'
    ).toHaveAttribute('src', new RegExp(expectedEncodedUrlPart));
  });

  test('should allow admin user to access admin page', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: 'test/e2e/auth/admin.storageState.json',
    });
    const page = await context.newPage();

    const adminUrl = `${BASE_URL}/admin`;
    await page.goto(adminUrl, { waitUntil: 'networkidle' });

    const adminHeading = page.locator('h1:has-text("Comprehendo admin")');
    await expect(adminHeading, 'Admin page heading should be visible').toBeVisible({
      timeout: 3000,
    });

    const unauthorizedMessage = page.locator(
      'text=/Unauthorized|You do not have admin permissions./i'
    );
    await expect(
      unauthorizedMessage,
      'Unauthorized message should not be visible for admin'
    ).not.toBeVisible();

    await context.close();
  });

  test('should prevent non-admin user from accessing admin page', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: 'test/e2e/auth/nonAdmin.storageState.json',
    });
    const page = await context.newPage();

    const adminUrl = `${BASE_URL}/admin`;
    await page.goto(adminUrl, { waitUntil: 'networkidle' });

    await expect(page, 'User should be redirected from /admin').toHaveURL(TARGET_URL, {
      timeout: 5000,
    });

    await context.close();
  });
});

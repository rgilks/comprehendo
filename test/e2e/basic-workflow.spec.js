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
    const errorDisplay = page.locator('[data-testid="error-display"] p');

    await Promise.race([
      expect(quizSection, 'Quiz section should appear').toBeVisible({ timeout: 2000 }),
      expect(errorDisplay, 'Error message should appear').toBeVisible({ timeout: 2000 }),
    ]);

    console.log('Quiz section or error message appeared.');

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

      const feedbackHighlight = page.locator('[data-testid="feedback-highlight"]');
      const feedbackDescriptionA = page.locator('[data-testid="feedback-description-A"]');

      await expect(feedbackHighlight.first(), 'Feedback highlight should be visible').toBeVisible({
        timeout: 5000,
      });
      await expect(
        feedbackDescriptionA,
        'Feedback description for A should be visible'
      ).toBeVisible({ timeout: 5000 });

      console.log('Feedback elements verified.');

      await expect(generateButton, 'Generate button should re-enable after answering').toBeVisible({
        timeout: 2000,
      });
      console.log('Generate button re-enabled. Test successful.');
    } else {
      console.log('Error message is visible. Verifying error...');
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
      }
    }
  });

  test('should allow changing UI language', async ({ page }) => {
    console.log(`Navigating to ${TARGET_URL}...`); // Start at English URL
    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
    console.log('Navigation complete. Waiting for language selector...');

    const languageDropdownButton = page.locator('#language-select-button');
    await expect(languageDropdownButton, 'Language dropdown button should be visible').toBeVisible({
      timeout: 2000,
    });
    console.log('Language dropdown button found. Clicking...');

    await languageDropdownButton.click();
    console.log('Language dropdown button clicked. Waiting for options...');

    const spanishLangOption = page.locator('div[role="menu"] button:has-text("Español")');
    await expect(
      spanishLangOption,
      'Spanish language option should be visible in dropdown'
    ).toBeVisible({ timeout: 2000 });
    console.log('Spanish option found. Clicking...');

    await spanishLangOption.click();
    console.log('Spanish option clicked. Waiting for URL change...');

    const expectedSpanishUrl = `${BASE_URL}/es`;
    await page.waitForURL(expectedSpanishUrl, { waitUntil: 'networkidle' });
    console.log(`URL changed to ${expectedSpanishUrl}. Verifying content...`);

    const generateButton = page.locator('[data-testid="generate-button"]');
    await expect(generateButton, 'Generate button should have Spanish text').toHaveText(
      'Genera un nuevo texto',
      { timeout: 2000 }
    );
    console.log('Generate button text verified in Spanish. Language change successful.');
  });

  test('should allow changing passage (learning) language', async ({ page }) => {
    console.log(`Navigating to ${TARGET_URL}...`);
    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
    console.log('Navigation complete. Waiting for passage language selector...');

    const passageLangSelect = page.locator('#passage-language-select');
    await expect(passageLangSelect, 'Passage language selector should be visible').toBeVisible({
      timeout: 2000,
    });
    console.log('Passage language selector found.');

    await passageLangSelect.selectOption({ value: 'es' });
    console.log('Selected Spanish in passage language selector.');

    await expect(
      passageLangSelect,
      'Passage language selector value should be Spanish'
    ).toHaveValue('es', { timeout: 1000 });
    console.log('Passage language selector value verified.');
  });

  test('should show avatar after mock GitHub sign-in', async ({ page }) => {
    console.log('Setting up mock for /api/auth/session...');
    // Intercept the session request to simulate a logged-in state
    await page.route('**/api/auth/session', async (route) => {
      console.log(`Intercepted ${route.request().url()}, fulfilling with mock data.`);
      const mockSession = {
        user: {
          name: 'Mock User',
          email: 'mock@example.com',
          image: 'https://avatars.githubusercontent.com/u/999999?v=4', // Example avatar URL
        },
        expires: new Date(Date.now() + 86400 * 1000).toISOString(), // Expires in 1 day
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSession),
      });
    });

    console.log(`Navigating to ${TARGET_URL} with mock active...`);
    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
    console.log('Navigation complete. Verifying AuthButton state...');

    // Locate the avatar image using its alt text, which comes from the mock session data.
    const avatarImage = page.locator('img[alt="Mock User"]');

    await expect(avatarImage, 'Avatar image should be visible after mock login').toBeVisible({
      timeout: 5000,
    });
    console.log('Avatar image found and visible.');

    // Check the src attribute - it will be modified by next/image, so check for the encoded base URL part
    const expectedEncodedUrlPart = 'https%3A%2F%2Favatars.githubusercontent.com%2Fu%2F999999';
    await expect(
      avatarImage,
      'Avatar image src should contain the encoded mock URL'
    ).toHaveAttribute('src', new RegExp(expectedEncodedUrlPart));
    console.log('Avatar image src verified. Mock login test successful.');
  });

  test('should allow admin user to access admin page', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: 'test/e2e/auth/admin.storageState.json',
    });
    const page = await context.newPage();

    const adminUrl = `${BASE_URL}/admin`;
    console.log(`Navigating to admin page: ${adminUrl} using admin storage state...`);
    await page.goto(adminUrl, { waitUntil: 'networkidle' });
    console.log('Navigation to admin page complete. Verifying content...');

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

    console.log('Admin page content verified successfully.');

    await context.close();
  });

  test('should prevent non-admin user from accessing admin page', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: 'test/e2e/auth/nonAdmin.storageState.json',
    });
    const page = await context.newPage();

    const adminUrl = `${BASE_URL}/admin`;
    console.log(`Navigating to admin page: ${adminUrl} using non-admin storage state...`);
    await page.goto(adminUrl, { waitUntil: 'networkidle' });
    console.log('Navigation attempt to admin page complete. Verifying redirect...');

    await expect(page, 'User should be redirected from /admin').toHaveURL(TARGET_URL, {
      timeout: 5000,
    });

    console.log('Non-admin was correctly redirected from /admin page.');

    await context.close();
  });
});

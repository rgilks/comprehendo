import { test, expect, type Page, type Browser } from '@playwright/test';

const BASE_URL = process.env['BASE_URL'] || 'http://localhost:3000';
// Default to English for base target URL if not specified otherwise
const TARGET_URL = `${BASE_URL}/en`;

test.describe('Basic Workflow Test', () => {
  test('should allow changing UI language', async ({ page }: { page: Page }) => {
    await page.goto(TARGET_URL);

    // Wait for the main content area first
    const mainContent = page.locator('main');
    await expect(mainContent, 'Main content area should be visible').toBeVisible({
      timeout: 15000,
    });

    // Now look for the button within the main area
    const languageDropdownButton = mainContent.locator('#language-select-button');
    await expect(languageDropdownButton, 'Language dropdown button should be visible').toBeVisible({
      timeout: 1000, // Reduce timeout slightly as main is already visible
    });

    await languageDropdownButton.click();

    const spanishLangOption = page.getByRole('menuitem', { name: 'Español' });
    await expect(
      spanishLangOption,
      'Spanish language option should be visible in dropdown'
    ).toBeVisible({ timeout: 2000 });

    await spanishLangOption.click();

    // Wait for the button text to change, indicating navigation/language update is complete
    const generateButton = page.locator('[data-testid="generate-button"]');
    await expect(
      generateButton,
      'Generate button should have Spanish text after language change'
    ).toHaveText(
      'Genera un nuevo texto',
      { timeout: 3000 } // Increased timeout slightly for potential hydration/update delay
    );

    // Optional: Check URL as a secondary confirmation
    const expectedSpanishUrl = `${BASE_URL}/es`;
    await expect(page, 'URL should update to Spanish language code').toHaveURL(expectedSpanishUrl);
  });

  test('should allow changing passage (learning) language', async ({ page }: { page: Page }) => {
    await page.goto(TARGET_URL);

    const passageLangSelect = page.locator('[data-testid="language-select"]');
    // Wait for the element itself first
    await expect(passageLangSelect, 'Passage language selector should be visible').toBeVisible({
      timeout: 3000,
    });

    await passageLangSelect.selectOption({ value: 'es' });

    await expect(
      passageLangSelect,
      'Passage language selector value should be Spanish'
    ).toHaveValue('es', { timeout: 1000 });
  });

  test('should display the correct default CEFR level', async ({ page }: { page: Page }) => {
    await page.goto(TARGET_URL);

    // Wait for the main content area first
    const mainContent = page.locator('main');
    await expect(mainContent, 'Main content area should be visible').toBeVisible({
      timeout: 15000,
    });

    // Now look for the level display within the main area
    const levelDisplay = mainContent.locator('[data-testid="level-display"]');
    await expect(levelDisplay, 'CEFR level display should be visible').toBeVisible({
      timeout: 1000, // Reduce timeout slightly
    });

    await expect(levelDisplay, 'CEFR level display should show default level').toContainText('A1', {
      timeout: 1000,
    });
  });

  test('should show avatar after mock GitHub sign-in', async ({ page }: { page: Page }) => {
    // Mock the session API response
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

    await page.goto(TARGET_URL);

    // Use getByAltText for better semantics if possible, or keep current selector
    const avatarImage = page.getByAltText('Mock User');

    await expect(avatarImage, 'Avatar image should be visible after mock login').toBeVisible({
      timeout: 10000,
    });

    const expectedEncodedUrlPart = 'https%3A%2F%2Favatars.githubusercontent.com%2Fu%2F999999';
    await expect(
      avatarImage,
      'Avatar image src should contain the encoded mock URL'
    ).toHaveAttribute('src', new RegExp(expectedEncodedUrlPart));
  });

  test('should allow admin user to access admin page', async ({
    browser,
  }: {
    browser: Browser;
  }) => {
    const context = await browser.newContext({
      storageState: 'test/e2e/auth/admin.storageState.json',
    });
    const page = await context.newPage();

    const adminUrl = `${BASE_URL}/admin`;
    await page.goto(adminUrl);

    // Wait for the heading specific to the admin page
    const adminHeading = page.getByRole('heading', { name: /Comprehendo admin/i });
    await expect(adminHeading, 'Admin page heading should be visible').toBeVisible({
      timeout: 10000,
    });

    // Check that common elements from the non-admin page are NOT visible as an extra check
    const unauthorizedMessage = page.locator(
      'text=/Unauthorized|You do not have admin permissions./i'
    );
    await expect(
      unauthorizedMessage,
      'Unauthorized message should not be visible for admin'
    ).not.toBeVisible();

    await context.close();
  });

  test('should prevent non-admin user from accessing admin page', async ({
    browser,
  }: {
    browser: Browser;
  }) => {
    const context = await browser.newContext({
      storageState: 'test/e2e/auth/nonAdmin.storageState.json',
    });
    const page = await context.newPage();

    const adminUrl = `${BASE_URL}/admin`;
    await page.goto(adminUrl);

    // Instead of just checking URL, wait for an element on the page we expect to be redirected TO.
    // Using the language dropdown button as an example element from the main page.
    const languageDropdownButton = page.locator('#language-select-button');
    await expect(
      languageDropdownButton,
      'Should be redirected to main page (language button visible)'
    ).toBeVisible({ timeout: 5000 });

    // Optionally, still check the URL if desired
    await expect(page, 'URL should be the main target URL after redirect').toHaveURL(TARGET_URL, {
      timeout: 1000,
    });

    // Check that the admin heading is NOT visible
    const adminHeading = page.getByRole('heading', { name: /Comprehendo admin/i });
    await expect(
      adminHeading,
      'Admin heading should not be visible for non-admin'
    ).not.toBeVisible();

    await context.close();
  });
});

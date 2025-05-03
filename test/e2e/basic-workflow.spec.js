import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TARGET_URL = `${BASE_URL}/en`;

test.describe('Basic Workflow Test', () => {
  test('should allow changing UI language', async ({ page }) => {
    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });

    const languageDropdownButton = page.locator('#language-select-button');
    await expect(languageDropdownButton, 'Language dropdown button should be visible').toBeVisible({
      timeout: 5000,
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

    const passageLangSelect = page.locator('[data-testid="language-select"]');
    await expect(passageLangSelect, 'Passage language selector should be visible').toBeVisible({
      timeout: 2000,
    });

    await passageLangSelect.selectOption({ value: 'es' });

    await expect(
      passageLangSelect,
      'Passage language selector value should be Spanish'
    ).toHaveValue('es', { timeout: 1000 });
  });

  test('should display the correct default CEFR level', async ({ page }) => {
    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });

    const levelDisplay = page.locator('[data-testid="level-display"]');
    await expect(levelDisplay, 'CEFR level display should be visible').toBeVisible({
      timeout: 3000,
    });

    await expect(levelDisplay, 'CEFR level display should show default level').toContainText('A1', {
      timeout: 1000,
    });
  });

  test('should show avatar after mock GitHub sign-in', async ({ page }) => {
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

    const avatarImage = page.locator('img[alt="Mock User"]');

    await expect(avatarImage, 'Avatar image should be visible after mock login').toBeVisible({
      timeout: 5000,
    });

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

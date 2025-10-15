import { test, expect, type Page, type Browser } from '@playwright/test';

const BASE_URL = process.env['BASE_URL'] || 'http://localhost:3000';
const TARGET_URL = `${BASE_URL}/en`;

test.describe('Basic Workflow Test', () => {
  test('should allow changing UI language', async ({ page }: { page: Page }) => {
    await page.goto(TARGET_URL);
    await page.waitForLoadState('domcontentloaded');

    const mainContent = page.locator('main');
    await expect(mainContent, 'Main content area should be visible').toBeVisible();

    const languageDropdownButton = mainContent.locator('#language-select-button');
    await expect(
      languageDropdownButton,
      'Language dropdown button should be visible'
    ).toBeVisible();

    await languageDropdownButton.click();

    const spanishLangOption = page.getByRole('menuitem', { name: 'Español' });
    await expect(
      spanishLangOption,
      'Spanish language option should be visible in dropdown'
    ).toBeVisible();

    await spanishLangOption.click();

    const generateButton = page.locator('[data-testid="generate-button"]');
    await expect(
      generateButton,
      'Generate button should have Spanish text after language change'
    ).toHaveText('Genera un nuevo texto');

    const expectedSpanishUrl = `${BASE_URL}/es`;
    await expect(page, 'URL should update to Spanish language code').toHaveURL(expectedSpanishUrl);
  });

  test('should allow changing passage (learning) language', async ({ page }: { page: Page }) => {
    await page.goto(TARGET_URL);
    await page.waitForLoadState('domcontentloaded');

    const passageLangSelect = page.locator('[data-testid="language-select"]');
    await expect(passageLangSelect, 'Passage language selector should be visible').toBeVisible();

    await passageLangSelect.selectOption({ value: 'es' });

    await expect(
      passageLangSelect,
      'Passage language selector value should be Spanish'
    ).toHaveValue('es');
  });

  test('should display the correct default CEFR level', async ({ page }: { page: Page }) => {
    await page.goto(TARGET_URL);
    await page.waitForLoadState('domcontentloaded');

    const mainContent = page.locator('main');
    await expect(mainContent, 'Main content area should be visible').toBeVisible();

    const levelDisplay = mainContent.locator('[data-testid="level-display"]');
    await expect(levelDisplay, 'CEFR level display should be visible').toBeVisible();

    await expect(levelDisplay, 'CEFR level display should show default level').toContainText('A1');
  });

  test('should show avatar after mock GitHub sign-in', async ({ page }: { page: Page }) => {
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

    const avatarImage = page.getByAltText('Mock User');

    await expect(avatarImage, 'Avatar image should be visible after mock login').toBeVisible();

    const expectedEncodedUrlPart = 'https%3A%2F%2Favatars.githubusercontent.com%2Fu%2F999999';
    await expect(
      avatarImage,
      'Avatar image src should contain the encoded mock URL'
    ).toHaveAttribute('src', new RegExp(expectedEncodedUrlPart));
  });

  test.skip('should allow admin user to access admin page', async ({
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

    const adminHeading = page.getByRole('heading', { name: /Comprehendo Admin/i });
    await expect(adminHeading, 'Admin page heading should be visible').toBeVisible({
      timeout: 15000,
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

    const languageDropdownButton = page.locator('#language-select-button');
    await expect(
      languageDropdownButton,
      'Should be redirected to main page (language button visible)'
    ).toBeVisible();

    await expect(page, 'URL should be the main target URL after redirect').toHaveURL(TARGET_URL);

    const adminHeading = page.getByRole('heading', { name: /Comprehendo Admin/i });
    await expect(
      adminHeading,
      'Admin heading should not be visible for non-admin'
    ).not.toBeVisible();

    await context.close();
  });

  test('should display static home page content correctly', async ({ page }: { page: Page }) => {
    await page.goto(TARGET_URL);

    await expect(page.getByRole('heading', { name: /Comprehendo/i, level: 1 })).toBeVisible();

    const metaDescription = page.locator('meta[name="description"]');
    await expect(metaDescription).toHaveAttribute(
      'content',
      'An AI-powered language learning tool'
    );

    const expectedSubtitle =
      'An AI-powered language learning tool to improve your reading comprehension';
    await expect(page.getByText(expectedSubtitle)).toBeVisible();

    await expect(page.locator('[data-testid="text-generator-container"]')).toBeVisible();

    const expectedPoweredBy = 'Powered by Google Gemini';
    await expect(page.getByText(new RegExp(expectedPoweredBy, 'i'))).toBeVisible();

    const expectedGitHubText = 'GitHub';
    const githubLink = page.getByRole('link', { name: new RegExp(expectedGitHubText, 'i') });
    await expect(githubLink).toBeVisible();
    await expect(githubLink).toHaveAttribute('href', 'https://github.com/rgilks/comprehendo');

    const kofiLink = page.getByRole('link', { name: /Buy Me a Coffee at ko-fi.com/i });
    await expect(kofiLink).toBeVisible();
    await expect(kofiLink).toHaveAttribute('href', 'https://ko-fi.com/N4N31DPNUS');
    const kofiImage = page.getByAltText('Buy Me a Coffee at ko-fi.com');
    await expect(kofiImage).toBeVisible();
    await expect(kofiImage).toHaveAttribute(
      'src',
      /https%3A%2F%2Fstorage\.ko-fi\.com%2Fcdn%2Fkofi2\.png%3Fv%3D6/
    );
  });

  test('should display 404 page for invalid language route', async ({ page }: { page: Page }) => {
    await page.goto(`${BASE_URL}/xx`);

    await expect(page.getByRole('heading', { name: /404 - Page Not Found/i })).toBeVisible();
    await expect(
      page.getByText('Oops! The page you are looking for does not exist.')
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /Go back to Home/i })).toBeVisible();
  });
});

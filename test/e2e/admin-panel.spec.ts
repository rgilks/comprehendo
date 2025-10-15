import { test, expect, type Page } from '@playwright/test';

test.describe.skip('Admin Panel Basic Navigation', () => {
  test.use({ storageState: 'test/e2e/auth/admin.storageState.json' });

  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');

    // Check if we're redirected or if admin content loads
    const currentUrl = page.url();
    if (currentUrl.includes('/admin')) {
      // We're on admin page, wait for the heading
      await expect(page.locator('h1')).toContainText(/Comprehendo Admin/i, { timeout: 10000 });
    } else {
      // We were redirected, this is expected for non-admin users
      throw new Error('Admin page redirected - user may not have admin permissions');
    }
  });

  const checkTableLoads = async (page: Page, tableName: string, expectedHeader: string) => {
    await page.getByRole('button', { name: new RegExp(tableName, 'i') }).click();

    const tableLocator = page.locator('table');
    await expect(tableLocator, `${tableName} table should be visible`).toBeVisible();

    const headerRegex = new RegExp(`^${expectedHeader}$`, 'i');
    const headerLocator = tableLocator.locator('thead th').filter({ hasText: headerRegex });
    await expect(
      headerLocator,
      `Header '${expectedHeader}' should be visible in ${tableName} table`
    ).toBeVisible();

    const firstRowLocator = tableLocator.locator('tbody tr').first();
    await expect(
      firstRowLocator,
      `First row of ${tableName} table should be visible`
    ).toBeVisible();
  };

  test('should display the users table with email header', async ({ page }) => {
    await checkTableLoads(page, 'users', 'email');
  });

  test('should display the quiz table with Language header', async ({ page }) => {
    await checkTableLoads(page, 'quiz', 'Language');
  });
});

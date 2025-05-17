import { test, expect, type Page } from '@playwright/test';

test.describe('Admin Panel Basic Navigation', () => {
  test.use({ storageState: 'test/e2e/auth/admin.storageState.json' });

  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/admin');
    await expect(page.locator('h1')).toContainText(/Comprehendo admin/i, { timeout: 10000 });
  });

  const checkTableLoads = async (page: Page, tableName: string, expectedHeader: string) => {
    await page.getByRole('button', { name: new RegExp(tableName, 'i') }).click();

    // Locate the table element itself first
    const tableLocator = page.locator('table');
    await expect(tableLocator, `${tableName} table should be visible`).toBeVisible({
      timeout: 5000,
    });

    // Locate header and row relative to the found table
    const headerRegex = new RegExp(`^${expectedHeader}$`, 'i');
    const headerLocator = tableLocator.locator('thead th').filter({ hasText: headerRegex });
    await expect(
      headerLocator,
      `Header containing '${expectedHeader}' should be visible in ${tableName} table`
    ).toBeVisible({ timeout: 3000 });

    const firstRowLocator = tableLocator.locator('tbody tr').first();
    await expect(firstRowLocator, `First row of ${tableName} table should be visible`).toBeVisible({
      timeout: 3000,
    });
  };

  test('should display the users table with email header', async ({ page }) => {
    await checkTableLoads(page, 'users', 'email');
  });

  test('should display the quiz table with Language header', async ({ page }) => {
    await checkTableLoads(page, 'quiz', 'Language');
  });
});

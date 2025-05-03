import { test, expect, type Page } from '@playwright/test';

test.describe('Admin Panel Basic Navigation', () => {
  test.use({ storageState: 'test/e2e/auth/admin.storageState.json' });

  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/admin');
    await expect(page.locator('h1')).toContainText(/Comprehendo admin/i, { timeout: 2000 });
  });

  async function checkTableLoads(page: Page, tableName: string, expectedHeader: string) {
    await page.getByRole('button', { name: new RegExp(tableName, 'i') }).click();

    const firstRowLocator = page.locator('table tbody tr').first();
    await expect(firstRowLocator, `First row of ${tableName} table should be visible`).toBeVisible({
      timeout: 3000,
    });

    const headerRegex = new RegExp(`^${expectedHeader}$`, 'i');
    const headerLocator = page.locator('table thead th').filter({ hasText: headerRegex });
    await expect(
      headerLocator,
      `Header '${expectedHeader}' should be visible in ${tableName} table`
    ).toBeVisible({ timeout: 1000 });
  }

  test('should display the users table with Email header', async ({ page }) => {
    await checkTableLoads(page, 'users', 'Email');
  });

  test('should display the quiz table with Language header', async ({ page }) => {
    await checkTableLoads(page, 'quiz', 'Language');
  });
});

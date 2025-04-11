import { test, expect, type Page } from '@playwright/test';

// Removed unused timeout constants

test.describe('Admin Panel Basic Navigation', () => {
  // Use the admin user state for these tests
  test.use({ storageState: 'test/e2e/auth/admin.storageState.json' });

  test.beforeEach(async ({ page }: { page: Page }) => {
    // Navigate to the admin page before each test in this suite
    await page.goto('/admin');
    // Wait for H1 after navigation
    await expect(page.locator('h1')).toContainText(/Comprehendo admin/i, { timeout: 2000 });
  });

  async function checkTableLoads(page: Page, tableName: string) {
    // Helper function to click link and check for table data
    await page.getByRole('button', { name: new RegExp(tableName, 'i') }).click();

    // Wait for the first table data row using a broader selector
    const firstRowLocator = page.locator('table tbody tr').first();
    // Use 3s timeout for data loading
    await expect(firstRowLocator).toBeVisible({ timeout: 3000 });
  }

  test('should display the users table', async ({ page }) => {
    await checkTableLoads(page, 'users');
  });

  test('should display the generated_content table', async ({ page }) => {
    await checkTableLoads(page, 'generated_content');
  });

  test('should display the usage_stats table', async ({ page }) => {
    await checkTableLoads(page, 'usage_stats');
  });
});

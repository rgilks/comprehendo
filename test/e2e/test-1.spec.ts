import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('http://localhost:3000/en');
  await expect(page.getByRole('heading', { name: 'Comprehendo' })).toBeVisible();
  await expect(page.getByText('An AI-powered language')).toBeVisible();
  await expect(page.getByTestId('text-generator-container')).toMatchAriaSnapshot(`
    - text: Learning Level
    - combobox "Learning":
      - option "English"
      - option "Filipino"
      - option "French"
      - option "German"
      - option "Greek"
      - option "Hebrew"
      - option "Hindi"
      - option "Italian"
      - option "Polish"
      - option "Portuguese"
      - option "Russian"
      - option "Spanish" [selected]
      - option "Thai"
    - text: A1 - Beginner
    `);
  await expect(page.getByTestId('text-generator-container')).toMatchAriaSnapshot(`
    - paragraph: Sign in to track your progress and see your learning history!
    - button "Google":
      - img
    - button "Github":
      - img
    - button "Discord":
      - img
    - button "Dismiss"
    `);
  await expect(page.getByRole('main')).toMatchAriaSnapshot(`
    - text: "Language:"
    - button "Language:"
    - button "Sign in with Google":
      - img
    - button "Sign in with GitHub":
      - img
    - button "Sign in with Discord":
      - img
    `);
  await page.getByTestId('generate-button').click();
  await page.getByTestId('answer-option-0').click();
  await expect(page.getByTestId('feedback-explanation')).toMatchAriaSnapshot(`
    - heading "Explanation" [level=4]`);
  await page.getByTestId('generate-button').click();
});

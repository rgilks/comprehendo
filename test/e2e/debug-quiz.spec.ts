import { test, expect } from '@playwright/test';

test.describe('Quiz Flow Debug', () => {
  test('debug quiz generation and console logs', async ({ page }) => {
    // Listen to console logs
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      if (msg.text().includes('[Quiz]')) {
        consoleLogs.push(msg.text());
      }
    });

    await page.goto('/en');

    // Load first quiz
    const generateButton = page.locator('[data-testid="generate-button"]');
    await generateButton.click();

    const passageLocator = page.locator('[data-testid="passage-text"]');
    await expect(passageLocator).toBeVisible({ timeout: 30000 });

    const firstPassage = await passageLocator.textContent();
    console.log('First quiz:', firstPassage);

    // Answer and get next quiz
    const firstOption = page.locator('[data-testid="answer-option-0"]');
    await firstOption.click();

    const feedbackLocator = page.locator('[data-testid="feedback-explanation"]');
    await expect(feedbackLocator).toBeVisible({ timeout: 15000 });

    await generateButton.click();
    await expect(passageLocator).toBeVisible({ timeout: 30000 });

    const secondPassage = await passageLocator.textContent();
    console.log('Second quiz:', secondPassage);

    // Print console logs
    console.log('\n=== Console Logs ===');
    consoleLogs.forEach((log) => {
      console.log(log);
    });

    // Check if they're different
    if (firstPassage === secondPassage) {
      console.log('❌ SAME QUIZ DETECTED!');
    } else {
      console.log('✅ Different quizzes loaded');
    }
  });
});

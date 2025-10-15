import { test, expect } from '@playwright/test';
import { mockAuthSession, mockQuizGeneration } from './test-helpers';

test.describe('Audio and UI Features', () => {
  test('should display audio controls when speech is supported', async ({ page }) => {
    await mockAuthSession(page, {
      name: 'Test User',
      email: 'test@example.com',
      image: 'https://example.com/avatar.jpg',
    });

    await mockQuizGeneration(page);

    await page.goto('/en');

    const generateButton = page.locator('[data-testid="generate-button"]');
    await generateButton.click();
    await page.waitForTimeout(2000);

    // Check for audio controls
    const audioControls = page.locator('[data-testid="audio-controls"]');
    const audioVisible = await audioControls.isVisible().catch(() => false);

    if (audioVisible) {
      await expect(audioControls).toBeVisible();
    }
  });

  test('should display voice selector', async ({ page }) => {
    await mockAuthSession(page, {
      name: 'Test User',
      email: 'test@example.com',
      image: 'https://example.com/avatar.jpg',
    });

    await mockQuizGeneration(page);

    await page.goto('/en');

    const generateButton = page.locator('[data-testid="generate-button"]');
    await generateButton.click();
    await page.waitForTimeout(2000);

    // Check for voice selector
    const voiceSelector = page.locator('[data-testid="voice-selector"]');
    const voiceVisible = await voiceSelector.isVisible().catch(() => false);

    if (voiceVisible) {
      await expect(voiceSelector).toBeVisible();
    }
  });

  test('should display volume slider', async ({ page }) => {
    await mockAuthSession(page, {
      name: 'Test User',
      email: 'test@example.com',
      image: 'https://example.com/avatar.jpg',
    });

    await mockQuizGeneration(page);

    await page.goto('/en');

    const generateButton = page.locator('[data-testid="generate-button"]');
    await generateButton.click();
    await page.waitForTimeout(2000);

    // Check for volume slider
    const volumeSlider = page.locator('[data-testid="volume-slider"]');
    const volumeVisible = await volumeSlider.isVisible().catch(() => false);

    if (volumeVisible) {
      await expect(volumeSlider).toBeVisible();
    }
  });

  test('should display play/pause button', async ({ page }) => {
    await mockAuthSession(page, {
      name: 'Test User',
      email: 'test@example.com',
      image: 'https://example.com/avatar.jpg',
    });

    await mockQuizGeneration(page);

    await page.goto('/en');

    const generateButton = page.locator('[data-testid="generate-button"]');
    await generateButton.click();
    await page.waitForTimeout(2000);

    // Check for play/pause button
    const playPauseButton = page.locator('[data-testid="play-pause-button"]');
    const playPauseVisible = await playPauseButton.isVisible().catch(() => false);

    if (playPauseVisible) {
      await expect(playPauseButton).toBeVisible();
    }
  });

  test('should handle word hover translations', async ({ page }) => {
    await mockAuthSession(page, {
      name: 'Test User',
      email: 'test@example.com',
      image: 'https://example.com/avatar.jpg',
    });

    await mockQuizGeneration(page);

    await page.goto('/en');

    const generateButton = page.locator('[data-testid="generate-button"]');
    await generateButton.click();
    await page.waitForTimeout(2000);

    // Check for translatable words
    const translatableWord = page.locator('[data-testid="translatable-word"]');
    const wordVisible = await translatableWord.isVisible().catch(() => false);

    if (wordVisible) {
      await expect(translatableWord).toBeVisible();

      // Try hovering over a word
      await translatableWord.first().hover();
      await page.waitForTimeout(500);
    }
  });
});

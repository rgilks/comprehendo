const { chromium } = require('playwright');
const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SCREENSHOT_DIR = path.join(process.cwd(), 'screenshots');

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\nGracefully shutting down...');
  process.exit(0);
});

async function runTest(page, testIndex) {
  const startTime = performance.now();
  const log = (message) =>
    console.log(`[${new Date().toISOString()}] [Test ${testIndex + 1}] ${message}`);

  try {
    // Initial navigation is now handled outside the loop in main

    // For the first test, we need to wait for initial hydration
    if (testIndex === 0) {
      log('Waiting for initial hydration (generate button)...');
      await page.waitForFunction(
        () => {
          return document.querySelector('[data-testid="generate-button"]') !== null;
        },
        { timeout: 30000 }
      );
      log('Initial page ready.');
      log('Taking initial load screenshot...');
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'initial-load.png') });
      log('Initial load screenshot saved.');
    } else {
      // For subsequent tests, the generate button should already be ready from the previous cycle
      log('Ready for next cycle.');
    }

    // --- Generation Step ---
    log('Clicking generate button...');
    const generateButton = await page.waitForSelector(
      '[data-testid="generate-button"]:not([disabled])',
      { timeout: 30000 }
    );
    await generateButton.click();
    log('Generate button clicked.');

    // --- Wait for Question and Options ---
    log('Waiting for question and options...');
    await page.waitForSelector('[data-testid="quiz-section"]', { timeout: 30000 });
    await page.waitForSelector('[data-testid="quiz-question"]', { timeout: 30000 });
    await page.waitForSelector('[data-testid="quiz-option-A"]', { timeout: 30000 });
    log('Question and options loaded.');

    // --- Answer Question (Select Option A) ---
    log('Clicking option A...');
    await page.click('[data-testid="quiz-option-A"]', { timeout: 5000, force: true });
    log('Option A clicked.');

    // --- Wait for Answer Processing (Generate button becomes enabled again) ---
    log('Waiting for answer processing (generate button enabled)...');
    await page.waitForSelector('[data-testid="generate-button"]:not([disabled])', {
      timeout: 30000,
    });
    log('Answer processed and ready for next generation click.');

    // NOTE: Clicking the generate button for the *next* cycle happens at the START of the next runTest iteration.

    const endTime = performance.now();
    const duration = endTime - startTime;
    // Add a specific log for the cycle duration excluding potential setup/wait time
    log(`Interaction cycle duration: ${duration.toFixed(0)}ms`);
    return duration;
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] [Test ${testIndex + 1}] Test failed:`,
      error.message
    );
    if (page) {
      const failurePath = path.join(
        SCREENSHOT_DIR,
        `test-failure-${testIndex + 1}-${Date.now()}.png`
      );
      log(`Saving failure screenshot to: ${failurePath}`);
      await page.screenshot({ path: failurePath });
    }
    return -1;
  } finally {
    // Do not close browser/context here, it's handled in main
  }
}

async function main() {
  const totalTests = 10; // Set number of tests to 10
  const results = [];
  let globalBrowser = null;
  let context = null;
  let page = null;

  try {
    console.log('Starting load tests...');

    // Ensure screenshots directory exists
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      console.log(
        `[${new Date().toISOString()}] [Main] Creating screenshot directory: ${SCREENSHOT_DIR}`
      );
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }

    console.log(`[${new Date().toISOString()}] [Main] Launching global browser...`);
    globalBrowser = await chromium.launch({ headless: true });
    context = await globalBrowser.newContext();
    page = await context.newPage();
    console.log(`[${new Date().toISOString()}] [Main] Global browser launched.`);

    // Perform initial navigation once before the loop
    console.log(
      `[${new Date().toISOString()}] [Main] Performing initial navigation to ${BASE_URL}/en...`
    );
    await page.goto(`${BASE_URL}/en`, { waitUntil: 'networkidle' });
    console.log(`[${new Date().toISOString()}] [Main] Initial navigation complete.`);

    for (let i = 0; i < totalTests; i++) {
      console.log(`\n=== Running test cycle ${i + 1}/${totalTests} ===`);
      const duration = await runTest(page, i);
      // Store only valid durations
      if (duration !== -1) {
        results.push(duration);
        console.log(`✅ Test cycle ${i + 1} completed in ${duration.toFixed(0)}ms`);
      } else {
        console.log('❌ Test cycle failed');
        // Optional: break the loop on failure?
        // break;
      }
    }

    console.log('\n=== All test cycles completed ===');
    const successfulCycles = results.length;
    if (successfulCycles > 0) {
      const avgDuration = results.reduce((sum, d) => sum + d, 0) / successfulCycles;
      console.log(`📈 Average duration for successful cycles: ${avgDuration.toFixed(0)}ms`);
    }
    const failedCycles = totalTests - successfulCycles;
    console.log(
      `Total cycles run: ${totalTests}, Successful: ${successfulCycles}, Failed: ${failedCycles}`
    );
  } catch (error) {
    console.error('Fatal error during test execution:', error);
  } finally {
    if (globalBrowser) {
      console.log(`[${new Date().toISOString()}] [Main] Closing global browser...`);
      await globalBrowser.close();
      console.log(`[${new Date().toISOString()}] [Main] Global browser closed.`);
    }
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('Unhandled error in main:', error);
  process.exit(1);
});

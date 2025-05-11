import { chromium } from 'playwright';
import { performance } from 'perf_hooks';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SCREENSHOT_DIR = path.join(process.cwd(), 'screenshots');
const NUM_CONCURRENT_USERS = parseInt(process.env.NUM_CONCURRENT_USERS || '3', 10);
const TOTAL_CYCLES = parseInt(process.env.TOTAL_CYCLES || '20', 10);

// Validate environment variable inputs
if (isNaN(NUM_CONCURRENT_USERS) || NUM_CONCURRENT_USERS <= 0) {
  console.error('Error: NUM_CONCURRENT_USERS must be a positive integer.');
  process.exit(1);
}
if (isNaN(TOTAL_CYCLES) || TOTAL_CYCLES <= 0) {
  console.error('Error: TOTAL_CYCLES must be a positive integer.');
  process.exit(1);
}

process.on('SIGINT', () => {
  console.log('\nGracefully shutting down...');
  process.exit(0);
});

// Constants for runTest
const GENERATE_BUTTON_SELECTOR = '[data-testid="generate-button"]:not([disabled])';
const QUIZ_SECTION_SELECTOR = '[data-testid="quiz-section"]';
const ERROR_DISPLAY_SELECTOR = '[data-testid="error-display"] p';
const QUIZ_QUESTION_SELECTOR = '[data-testid="quiz-question"]';
const QUIZ_OPTION_A_SELECTOR = '[data-testid="quiz-option-A"]';
const DEFAULT_WAIT_TIMEOUT = 30000; // 30 seconds
const SHORT_WAIT_TIMEOUT = 5000; // 5 seconds
const INTERACTION_TIMEOUT = 1000; // 1 second

const log = (prefix, message) =>
  console.log(`[${new Date().toISOString()}] [${prefix}] ${message}`);

const saveScreenshot = async (page, filePath) => {
  if (page) await page.screenshot({ path: filePath });
};

const runTest = async (page, cycleIndex, userId) => {
  const startTime = performance.now();
  const prefix = `User ${userId + 1} Cycle ${cycleIndex + 1}`;
  try {
    log(prefix, 'Ready for interaction.');
    log(prefix, 'Clicking generate button...');
    const generateButton = await page.waitForSelector(GENERATE_BUTTON_SELECTOR, {
      timeout: DEFAULT_WAIT_TIMEOUT,
    });
    await generateButton.click();
    log(prefix, 'Generate button clicked.');
    log(prefix, 'Waiting for quiz section OR error message...');
    const result = await Promise.race([
      page
        .waitForSelector(QUIZ_SECTION_SELECTOR, { timeout: DEFAULT_WAIT_TIMEOUT })
        .then(() => 'quiz'),
      page
        .waitForSelector(ERROR_DISPLAY_SELECTOR, { timeout: DEFAULT_WAIT_TIMEOUT })
        .then(() => 'error'),
    ]);
    if (result === 'quiz') {
      log(prefix, 'Quiz section loaded.');
      const questionElement = await page.waitForSelector(QUIZ_QUESTION_SELECTOR, {
        timeout: INTERACTION_TIMEOUT,
      });
      await page.waitForSelector(QUIZ_OPTION_A_SELECTOR, { timeout: INTERACTION_TIMEOUT });
      const actualQuestionText = await questionElement.textContent();
      log(prefix, `Quiz question loaded: "${actualQuestionText?.substring(0, 50)}..."`);
      log(prefix, 'Clicking option A...');
      await page.click(QUIZ_OPTION_A_SELECTOR, { timeout: SHORT_WAIT_TIMEOUT, force: true });
      log(prefix, 'Option A clicked.');
      log(prefix, 'Waiting for answer processing (generate button enabled)...');
      await page.waitForSelector(GENERATE_BUTTON_SELECTOR, { timeout: DEFAULT_WAIT_TIMEOUT });
      log(prefix, 'Answer processed and ready for next generation click.');
    } else {
      const errorElement = await page.$(ERROR_DISPLAY_SELECTOR);
      const errorText = errorElement ? await errorElement.textContent() : 'Unknown error';
      log(
        prefix,
        `Error message detected: "${errorText}". This is expected for anonymous cache misses.`
      );
      log(prefix, 'Waiting for generate button to potentially re-enable after error...');
      try {
        await page.waitForSelector(GENERATE_BUTTON_SELECTOR, { timeout: SHORT_WAIT_TIMEOUT });
        log(prefix, 'Generate button re-enabled after error.');
      } catch {
        log(prefix, 'Generate button did not re-enable after error within timeout.');
      }
    }
    const duration = performance.now() - startTime;
    log(prefix, `Interaction cycle duration: ${duration.toFixed(0)}ms`);
    return duration;
  } catch (error) {
    log(prefix, `Test failed: ${error.message}`);
    const failurePath = path.join(
      SCREENSHOT_DIR,
      `test-failure-user-${userId + 1}-cycle-${cycleIndex + 1}-${Date.now()}.png`
    );
    log(prefix, `Saving failure screenshot to: ${failurePath}`);
    await saveScreenshot(page, failurePath);
    return -1;
  }
};

const runUserSession = async (globalBrowser, userId, cyclesPerUser) => {
  let context = null;
  let page = null;
  const userResults = [];
  const prefix = `User ${userId + 1} Session`;
  try {
    log(prefix, 'Creating browser context...');
    context = await globalBrowser.newContext();
    page = await context.newPage();
    log(prefix, 'Context and page created.');
    log(prefix, `Performing initial navigation to ${BASE_URL}/en...`);
    await page.goto(`${BASE_URL}/en`, { waitUntil: 'networkidle' });
    await page.waitForSelector(GENERATE_BUTTON_SELECTOR, { timeout: DEFAULT_WAIT_TIMEOUT });
    log(prefix, 'Initial navigation and hydration complete.');
    if (userId === 0) {
      log(prefix, 'Taking initial load screenshot...');
      await saveScreenshot(page, path.join(SCREENSHOT_DIR, 'initial-load.png'));
      log(prefix, 'Initial load screenshot saved.');
    }
    log(prefix, `Starting ${cyclesPerUser} test cycles...`);
    for (let i = 0; i < cyclesPerUser; i++) {
      const duration = await runTest(page, i, userId);
      userResults.push(duration);
      if (duration === -1) log(prefix, `Cycle ${i + 1} failed. Continuing if possible...`);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    log(prefix, `Finished ${cyclesPerUser} test cycles.`);
  } catch (sessionError) {
    log(prefix, `FATAL ERROR: ${sessionError.message}`);
    const remainingCycles = cyclesPerUser - userResults.length;
    for (let k = 0; k < remainingCycles; k++) userResults.push(-1);
  } finally {
    if (context) {
      log(prefix, 'Closing browser context...');
      await context.close();
      log(prefix, 'Browser context closed.');
    }
  }
  return userResults;
};

const aggregateResults = (allResults, settledResults, numConcurrentUsers) => {
  let sessionFailures = 0;
  settledResults.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      allResults.push(...result.value);
    } else {
      console.error(`[Main] User ${index + 1} session failed catastrophically:`, result.reason);
      sessionFailures++;
    }
  });
  const successfulCycles = allResults.filter((d) => d !== -1);
  const totalCyclesAttempted = allResults.length;
  const failedCycles = totalCyclesAttempted - successfulCycles.length;
  console.log(`Concurrent Users: ${numConcurrentUsers}`);
  console.log(`Total cycles attempted (in completed sessions): ${totalCyclesAttempted}`);
  console.log(`  Successful cycles: ${successfulCycles.length}`);
  console.log(`  Failed cycles (errors during runTest): ${failedCycles}`);
  console.log(`  Failed user sessions (catastrophic errors): ${sessionFailures}`);
  if (successfulCycles.length > 0) {
    let sumExcludingFirst = 0;
    let countExcludingFirst = 0;
    settledResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        const userRuns = result.value.filter((d) => d !== -1);
        if (userRuns.length > 1) {
          sumExcludingFirst += userRuns.slice(1).reduce((sum, d) => sum + d, 0);
          countExcludingFirst += userRuns.length - 1;
        }
      }
    });
    if (countExcludingFirst > 0) {
      const avgDurationExcludingFirst = sumExcludingFirst / countExcludingFirst;
      console.log(
        `⏱️ Average duration excluding first cycle of each user: ${avgDurationExcludingFirst.toFixed(0)}ms`
      );
    } else {
      const overallAvg = successfulCycles.reduce((sum, d) => sum + d, 0) / successfulCycles.length;
      console.log(`📈 Overall average duration (incl. first cycles): ${overallAvg.toFixed(0)}ms`);
    }
  } else {
    console.log('No successful cycles to calculate average duration.');
  }
  return failedCycles > 0 || sessionFailures > 0;
};

const main = async () => {
  const numConcurrentUsers = NUM_CONCURRENT_USERS;
  const totalCycles = TOTAL_CYCLES;

  if (totalCycles < numConcurrentUsers) {
    console.error('Error: totalCycles must be >= numConcurrentUsers');
    process.exit(1);
  }
  const cyclesPerUser = Math.ceil(totalCycles / numConcurrentUsers);
  console.log(
    `Simulating ${numConcurrentUsers} concurrent users, approx ${cyclesPerUser} cycles each (total ${totalCycles}).`
  );

  const allResults = [];
  let globalBrowser = null;

  try {
    console.log('Starting load tests...');

    if (!fs.existsSync(SCREENSHOT_DIR)) {
      console.log(
        `[${new Date().toISOString()}] [Main] Creating screenshot directory: ${SCREENSHOT_DIR}`
      );
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }

    console.log(`[${new Date().toISOString()}] [Main] Launching global browser...`);
    globalBrowser = await chromium.launch({ headless: true });
    console.log(`[${new Date().toISOString()}] [Main] Global browser launched.`);

    const userTasks = Array.from({ length: numConcurrentUsers }, (_, i) =>
      runUserSession(globalBrowser, i, cyclesPerUser)
    );

    console.log(
      `[${new Date().toISOString()}] [Main] Starting ${numConcurrentUsers} concurrent user sessions...`
    );
    const settledResults = await Promise.allSettled(userTasks);
    console.log(`[${new Date().toISOString()}] [Main] All user sessions finished.`);

    console.log('\n=== Aggregated Results ===');
    const anyFailures = aggregateResults(allResults, settledResults, numConcurrentUsers);
    process.exit(anyFailures ? 1 : 0);
  } catch (error) {
    console.error('[Main] Fatal error during test execution:', error);
    process.exit(1);
  } finally {
    if (globalBrowser) {
      console.log(`[${new Date().toISOString()}] [Main] Closing global browser...`);
      await globalBrowser.close();
      console.log(`[${new Date().toISOString()}] [Main] Global browser closed.`);
    }
  }
};

main().catch((error) => {
  console.error('Unhandled error in main:', error);
  process.exit(1);
});

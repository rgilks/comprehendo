import { chromium } from 'playwright';
import { performance } from 'perf_hooks';
import fs from 'fs';
import path from 'path';
import { check, group, sleep } from 'k6';
import http from 'k6/http';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SCREENSHOT_DIR = path.join(process.cwd(), 'screenshots');

process.on('SIGINT', async () => {
  console.log('\nGracefully shutting down...');
  process.exit(0);
});

async function runTest(page, cycleIndex, userId) {
  const startTime = performance.now();
  const log = (message) =>
    console.log(
      `[${new Date().toISOString()}] [User ${userId + 1} Cycle ${cycleIndex + 1}] ${message}`
    );

  try {
    log('Ready for interaction.');

    log('Clicking generate button...');
    const generateButton = await page.waitForSelector(
      '[data-testid="generate-button"]:not([disabled])',
      { timeout: 30000 }
    );
    await generateButton.click();
    log('Generate button clicked.');

    log('Waiting for quiz section OR error message...');
    const quizSelector = '[data-testid="quiz-section"]';
    const errorSelector = '[data-testid="error-display"] p';

    try {
      const result = await Promise.race([
        page.waitForSelector(quizSelector, { timeout: 30000 }).then(() => 'quiz'),
        page.waitForSelector(errorSelector, { timeout: 30000 }).then(() => 'error'),
      ]);

      if (result === 'quiz') {
        log('Quiz section loaded.');
        const questionElement = await page.waitForSelector('[data-testid="quiz-question"]', {
          timeout: 1000,
        });
        await page.waitForSelector('[data-testid="quiz-option-A"]', { timeout: 1000 });

        const actualQuestionText = await questionElement.textContent();
        log(`Quiz question loaded: "${actualQuestionText?.substring(0, 50)}..."`);

        log('Clicking option A...');
        await page.click('[data-testid="quiz-option-A"]', { timeout: 5000, force: true });
        log('Option A clicked.');

        log('Waiting for answer processing (generate button enabled)...');
        await page.waitForSelector('[data-testid="generate-button"]:not([disabled])', {
          timeout: 30000,
        });
        log('Answer processed and ready for next generation click.');
      } else if (result === 'error') {
        const errorElement = await page.$(errorSelector);
        const errorText = errorElement ? await errorElement.textContent() : 'Unknown error';
        log(`Error message detected: "${errorText}". This is expected for anonymous cache misses.`);
        log('Waiting for generate button to potentially re-enable after error...');
        try {
          await page.waitForSelector('[data-testid="generate-button"]:not([disabled])', {
            timeout: 5000,
          });
          log('Generate button re-enabled after error.');
        } catch /* (enableError) */ {
          log('Generate button did not re-enable after error within timeout.');
        }
      } else {
        throw new Error('Unexpected result from Promise.race');
      }
    } catch (waitError) {
      log(`Error waiting for quiz or error: ${waitError.message}`);
      throw waitError;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    log(`Interaction cycle duration: ${duration.toFixed(0)}ms`);
    return duration;
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] [User ${userId + 1} Cycle ${cycleIndex + 1}] Test failed:`,
      error.message
    );
    if (page) {
      const failurePath = path.join(
        SCREENSHOT_DIR,
        `test-failure-user-${userId + 1}-cycle-${cycleIndex + 1}-${Date.now()}.png`
      );
      log(`Saving failure screenshot to: ${failurePath}`);
      await page.screenshot({ path: failurePath });
    }
    return -1;
  } finally {
  }
}

async function main() {
  const numConcurrentUsers = 3;
  const totalCycles = 20;

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

    const userTasks = [];

    const runUserSession = async (userId) => {
      let context = null;
      let page = null;
      const userResults = [];
      const sessionLog = (message) =>
        console.log(`[${new Date().toISOString()}] [User ${userId + 1} Session] ${message}`);

      try {
        sessionLog('Creating browser context...');
        context = await globalBrowser.newContext();
        page = await context.newPage();
        sessionLog('Context and page created.');

        sessionLog(`Performing initial navigation to ${BASE_URL}/en...`);
        await page.goto(`${BASE_URL}/en`, { waitUntil: 'networkidle' });
        await page.waitForSelector('[data-testid="generate-button"]:not([disabled])', {
          timeout: 30000,
        });
        sessionLog('Initial navigation and hydration complete.');

        if (userId === 0) {
          sessionLog('Taking initial load screenshot...');
          await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'initial-load.png') });
          sessionLog('Initial load screenshot saved.');
        }

        sessionLog(`Starting ${cyclesPerUser} test cycles...`);
        for (let i = 0; i < cyclesPerUser; i++) {
          const duration = await runTest(page, i, userId);
          userResults.push(duration);
          if (duration === -1) {
            sessionLog(`Cycle ${i + 1} failed. Continuing if possible...`);
          }
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
        sessionLog(`Finished ${cyclesPerUser} test cycles.`);
      } catch (sessionError) {
        sessionLog(`FATAL ERROR: ${sessionError.message}`);
        const remainingCycles = cyclesPerUser - userResults.length;
        for (let k = 0; k < remainingCycles; k++) userResults.push(-1);
      } finally {
        if (context) {
          sessionLog('Closing browser context...');
          await context.close();
          sessionLog('Browser context closed.');
        }
      }
      return userResults;
    };

    console.log(
      `[${new Date().toISOString()}] [Main] Creating ${numConcurrentUsers} user session tasks...`
    );
    for (let i = 0; i < numConcurrentUsers; i++) {
      userTasks.push(runUserSession(i));
    }

    console.log(
      `[${new Date().toISOString()}] [Main] Starting ${numConcurrentUsers} concurrent user sessions...`
    );
    const settledResults = await Promise.allSettled(userTasks);
    console.log(`[${new Date().toISOString()}] [Main] All user sessions finished.`);

    let sessionFailures = 0;
    settledResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allResults.push(...result.value);
      } else {
        console.error(`[Main] User ${index + 1} session failed catastrophically:`, result.reason);
        sessionFailures++;
      }
    });

    console.log('\n=== Aggregated Results ===');
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
      } else if (successfulCycles.length > 0) {
        const overallAvg =
          successfulCycles.reduce((sum, d) => sum + d, 0) / successfulCycles.length;
        console.log(`📈 Overall average duration (incl. first cycles): ${overallAvg.toFixed(0)}ms`);
      }
    } else {
      console.log('No successful cycles to calculate average duration.');
    }

    const anyFailures = failedCycles > 0 || sessionFailures > 0;
    process.exit(anyFailures ? 1 : 0);
  } catch (error) {
    console.error('[Main] Fatal error during test execution:', error);
  } finally {
    if (globalBrowser) {
      console.log(`[${new Date().toISOString()}] [Main] Closing global browser...`);
      await globalBrowser.close();
      console.log(`[${new Date().toISOString()}] [Main] Global browser closed.`);
    }
  }
}

main().catch((error) => {
  console.error('Unhandled error in main:', error);
  process.exit(1);
});

group('Load Landing Page', () => {
  const res = http.get(__ENV.BASE_URL || 'http://localhost:3000/');
  check(res, { 'status is 200': (r) => r.status === 200 });
});

sleep(1);

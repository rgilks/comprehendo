const { chromium } = require('playwright');
const { performance } = require('perf_hooks');

const BASE_URL = process.env.BASE_URL || 'https://comprehendo.fly.dev';

let browser = null;

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\nGracefully shutting down...');
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});

async function runTest() {
  try {
    console.log('Launching browser...');
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      console.log('Navigating to page...');
      const startTime = performance.now();
      await page.goto(`${BASE_URL}/en`);

      console.log('Waiting for page to load...');
      await page.waitForLoadState('networkidle');
      console.log('Page loaded successfully');

      // Wait for client-side hydration and the generate button
      console.log('Waiting for generate button...');
      await page.waitForFunction(
        () => {
          return document.querySelector('[data-testid="generate-button"]') !== null;
        },
        { timeout: 30000 }
      );
      console.log('Generate button found');

      // Take a screenshot to debug
      await page.screenshot({ path: 'initial-load.png' });
      console.log('Took initial screenshot');

      console.log('Looking for generate button...');
      const button = await page.waitForSelector('[data-testid="generate-button"]', {
        timeout: 30000,
      });
      if (!button) {
        throw new Error('Could not find generate button');
      }
      console.log('Found generate button, clicking...');
      await button.click();
      console.log('Button clicked');

      console.log('Waiting for content generation...');
      // Wait for the content container to appear
      const contentContainer = await page.waitForSelector('[data-testid="generated-content"]', {
        timeout: 30000,
      });
      if (!contentContainer) {
        throw new Error('Could not find generated content');
      }
      console.log('Found generated content');

      // Wait for the passage text to be visible
      const passageText = await page.waitForSelector('[data-testid="reading-passage"]', {
        timeout: 30000,
      });
      if (!passageText) {
        throw new Error('Could not find reading passage');
      }
      console.log('Found reading passage');

      // Wait for the question to appear
      const question = await page.waitForSelector('[data-testid="quiz-question"]', {
        timeout: 30000,
      });
      if (!question) {
        throw new Error('Could not find quiz question');
      }
      console.log('Found quiz question');

      const endTime = performance.now();
      const duration = endTime - startTime;

      console.log(`Test completed in ${duration}ms`);
      return duration;
    } catch (error) {
      console.error('Test failed:', error.message);
      // Take a screenshot on failure
      await page.screenshot({ path: `test-failure-${Date.now()}.png` });
      return -1;
    } finally {
      await context.close();
    }
  } catch (error) {
    console.error('Browser launch failed:', error.message);
    return -1;
  }
}

async function main() {
  try {
    console.log('Starting load tests...');

    for (let i = 0; i < 4; i++) {
      console.log(`\n=== Running test ${i + 1}/4 ===`);
      const duration = await runTest();
      if (duration === -1) {
        console.log('❌ Test failed');
      } else {
        console.log(`✅ Test ${i + 1} completed in ${duration}ms`);
      }
      // Add a small delay between tests
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log('\n=== All tests completed ===');
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

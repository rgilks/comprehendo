# E2E Tests

This directory contains end-to-end tests for the Comprehendo application using Playwright.

## Test Structure

The tests are organized into focused, simple test suites:

- **`app-basics.spec.ts`** - Basic app functionality (page load, UI elements)
- **`language-switching.spec.ts`** - Language switching functionality
- **`authentication.spec.ts`** - Authentication flow and handling
- **`reading-flow.spec.ts`** - Core reading comprehension functionality
- **`admin-panel.spec.ts`** - Admin panel access and functionality
- **`user-journey.spec.ts`** - Complete end-to-end user journey

## Running Tests

```bash
# Run all tests
npm run test:e2e

# Run specific test file
npx playwright test app-basics

# Run tests in headed mode (see browser)
npx playwright test --headed

# Run tests with debug mode
npx playwright test --debug
```

## Test Philosophy

These tests are designed to be:

1. **Simple** - Each test focuses on one specific functionality
2. **Reliable** - Tests use robust selectors and handle edge cases
3. **Fast** - Tests run quickly and don't have unnecessary waits
4. **Maintainable** - Clear test names and structure make them easy to update

## Mocking Strategy

Tests use Playwright's route mocking to:

- Mock authentication responses
- Mock API responses for consistent test data
- Handle missing environment variables gracefully
- Test error scenarios

## Environment Setup

Tests work with or without authentication environment variables:

- If auth env vars are missing, tests verify graceful degradation
- If auth env vars are present, tests verify full functionality
- Tests mock API responses to ensure consistent behavior

## Debugging

If tests fail:

1. Check the HTML report: `npx playwright show-report`
2. Run with `--headed` to see the browser
3. Use `--debug` to step through tests
4. Check console logs for errors

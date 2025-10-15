# E2E Tests

This directory contains comprehensive end-to-end tests for the Comprehendo application using Playwright.

## Test Structure

The tests are organized into focused, comprehensive test suites:

- **`app-basics.spec.ts`** - Basic app functionality (page load, UI elements, error handling)
- **`language-switching.spec.ts`** - Language switching functionality and persistence
- **`authentication.spec.ts`** - Authentication flow and handling
- **`reading-flow.spec.ts`** - Core reading comprehension functionality with mocked APIs
- **`audio-ui-features.spec.ts`** - Audio controls, voice features, and UI interactions
- **`error-handling.spec.ts`** - Comprehensive error scenarios and edge cases
- **`user-journey.spec.ts`** - Complete end-to-end user workflows
- **`test-helpers.ts`** - Reusable test utilities and mocking functions

## Test Coverage

### ✅ **Core Functionality (31 tests total)**

- **App Basics** (5 tests) - Page loading, UI elements, error handling
- **Language Switching** (3 tests) - UI language changes, learning language changes, persistence
- **Authentication** (3 tests) - Auth button visibility, generate button behavior, login prompts
- **Reading Flow** (5 tests) - Content generation, quiz interaction, progress tracking, feedback
- **Audio & UI Features** (5 tests) - Audio controls, voice selector, volume, play/pause, translations
- **Error Handling** (8 tests) - Network timeouts, malformed responses, auth errors, navigation
- **User Journey** (2 tests) - Complete flow with mocked APIs, error handling

### ✅ **Key Features Tested**

- Page loading and basic UI elements
- Language switching (UI and learning languages)
- Authentication flow and graceful degradation
- Reading passage generation and display
- Quiz questions and multiple choice options
- Answer selection and feedback display
- Progress tracking for authenticated users
- Audio controls and speech features
- Word hover translations
- Error handling and edge cases
- Browser navigation and page refresh
- Network error scenarios

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

# Run specific test suite
npx playwright test reading-flow
npx playwright test error-handling
```

## Test Philosophy

These tests are designed to be:

1. **Comprehensive** - Cover all major user flows and edge cases
2. **Reliable** - Tests use robust selectors and handle edge cases gracefully
3. **Fast** - Tests run quickly (~17 seconds for all 31 tests)
4. **Maintainable** - Clear test names and structure make them easy to update
5. **Realistic** - Test actual user scenarios with proper mocking

## Mocking Strategy

Tests use Playwright's route mocking to:

- Mock authentication responses
- Mock API responses for consistent test data
- Handle missing environment variables gracefully
- Test error scenarios and edge cases
- Simulate network timeouts and failures

## Test Helpers

The `test-helpers.ts` file provides reusable utilities:

- `mockAuthSession()` - Mock user authentication
- `mockQuizGeneration()` - Mock reading content generation
- `mockProgressData()` - Mock user progress tracking
- `mockFeedbackSubmission()` - Mock feedback API
- `mockTranslationAPI()` - Mock translation services
- `waitForContentLoad()` - Wait for content to load
- `waitForQuizLoad()` - Wait for quiz to load

## Environment Setup

Tests work with or without authentication environment variables:

- If auth env vars are missing, tests verify graceful degradation
- If auth env vars are present, tests verify full functionality
- Tests mock API responses to ensure consistent behavior
- All tests handle missing features gracefully

## Debugging

If tests fail:

1. Check the HTML report: `npx playwright show-report`
2. Run with `--headed` to see the browser
3. Use `--debug` to step through tests
4. Check console logs for errors
5. Run specific test files to isolate issues

## Performance

- **Total Tests**: 31
- **Execution Time**: ~17 seconds
- **Parallel Execution**: Yes (5 workers)
- **Reliability**: High (all tests pass consistently)

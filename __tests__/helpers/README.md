# Test Helpers

This directory contains helper functions and utilities for testing the application.

## Available Helpers

- `ai-mocks.ts` - Mock implementations for AI providers (OpenAI, Google AI)
- `db-mock.ts` - Database mocking utilities for testing
- `request-helpers.ts` - Helpers for creating and validating HTTP requests/responses
- `test-setup.ts` - Test environment setup utilities

## Usage

Import the helpers in your test files:

```js
import {
  setupTestLogging,
  setupTestEnvironment,
  createChatRequest,
  expectSuccessResponse,
} from '../helpers';
```

## Testing API Routes

When testing API routes, there are two main approaches:

1. **Mock handler approach** - Create a custom mock handler that returns predefined responses, bypassing actual API logic. This is useful for unit testing components that interact with the API.

```js
const mockHandler = async (req) => {
  return NextResponse.json({ result: 'predefined mock data' });
};

// Test with the mock handler
const response = await mockHandler(req);
```

2. **Partial mocking approach** - Mock external dependencies (DB, AI clients) but use the actual API handler. This requires more setup but tests more of the real code path.

```js
// Mock db, AI clients, and environment variables
// Then call the actual handler
const response = await POST(req);
```

Due to the complexity of mocking database operations correctly in testing environments, the mock handler approach is often more practical for integration tests.

## TODO

- Fix failing tests in integration and API test files
- Add proper typing for NextRequest/NextResponse mocks
- Address TypeScript compatibility issues between mock types and actual Next.js types

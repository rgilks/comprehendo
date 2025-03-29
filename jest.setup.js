// Import Jest DOM extensions
import "@testing-library/jest-dom";

// Import shims for openai
import "openai/shims/node";

// Setup global objects for Next.js if not already defined
if (typeof Request === "undefined") {
  global.Request = class Request {};
  global.Response = class Response {
    constructor(body, init) {
      this.body = body;
      this.init = init;
      this.headers = init?.headers || {};
      this.status = init?.status || 200;
    }

    json() {
      return Promise.resolve(JSON.parse(this.body));
    }
  };
  global.Headers = class Headers {};
  global.FormData = class FormData {};
}

// Mock Next.js router
jest.mock("next/router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    pathname: "/",
    query: {},
  }),
}));

// Mock Next/Navigation
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

// Add global fetch mock if needed
global.fetch = jest.fn();

// Silence console errors and warnings in tests
global.console = {
  ...console,
  // Uncomment these to suppress console messages in test output
  // error: jest.fn(),
  // warn: jest.fn(),
  // log: jest.fn(),
};

// Create proper mocks for NextRequest and NextResponse
const actualNextServer = jest.requireActual("next/server");

jest.mock("next/server", () => {
  class NextRequest {
    constructor(url, init = {}) {
      this.url = url;
      this.method = init.method || "GET";
      this._headers = new Map();

      // Add headers
      if (init.headers) {
        Object.entries(init.headers).forEach(([key, value]) => {
          this._headers.set(key, value);
        });
      }

      // Add body
      if (init.body) {
        this.body = init.body;
      }
    }

    // Header methods
    get headers() {
      return {
        get: (name) => this._headers.get(name),
        has: (name) => this._headers.has(name),
      };
    }

    // Mock json method to parse the body
    async json() {
      return typeof this.body === "string" ? JSON.parse(this.body) : this.body;
    }
  }

  // Create a response that actually has a working json method
  function createResponse(body, status = 200) {
    const stringifiedBody =
      typeof body === "string" ? body : JSON.stringify(body);

    return {
      status,
      headers: { "Content-Type": "application/json" },
      json: async () => body,
      _body: stringifiedBody, // For debugging
    };
  }

  return {
    NextRequest,
    NextResponse: {
      json: (body, init) => {
        return createResponse(body, init?.status || 200);
      },
      redirect: jest.fn(() => createResponse({}, 302)),
      rewrite: jest.fn(() => createResponse({}, 200)),
      next: jest.fn(() => createResponse({}, 200)),
    },
  };
});

// Add any global test setup

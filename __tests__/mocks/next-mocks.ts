import { ReadonlyHeaders } from "next/dist/server/web/spec-extension/adapters/headers";
import { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";

// NextResponse mock
export class MockNextResponse {
  headers: Headers;
  cookies: any;
  status: number;
  statusText: string;
  body: any;
  private responseInit: ResponseInit;

  constructor(body: any = {}, init: ResponseInit = {}) {
    this.headers = new Headers(init.headers);
    this.cookies = {};
    this.status = init.status || 200;
    this.statusText = init.statusText || "";
    this.body = body;
    this.responseInit = init;
  }

  json(data: any) {
    return new MockNextResponse(data, this.responseInit);
  }

  // Clone method for testing
  clone() {
    return new MockNextResponse(this.body, {
      status: this.status,
      statusText: this.statusText,
      headers: this.headers,
    });
  }

  static json(data: any, init: ResponseInit = {}) {
    return new MockNextResponse(data, init);
  }
}

// Custom Headers class that properly implements get()
class MockHeaders {
  private headers: Record<string, string>;

  constructor(init?: HeadersInit) {
    this.headers = {};

    if (init) {
      if (init instanceof Headers) {
        // Copy from existing Headers object
        init.forEach((value, key) => {
          this.headers[key.toLowerCase()] = value;
        });
      } else if (Array.isArray(init)) {
        // Initialize from array of key-value pairs
        init.forEach(([key, value]) => {
          this.headers[key.toLowerCase()] = value;
        });
      } else {
        // Initialize from record
        Object.entries(init).forEach(([key, value]) => {
          this.headers[key.toLowerCase()] = value;
        });
      }
    }
  }

  get(name: string): string | null {
    return this.headers[name.toLowerCase()] || null;
  }

  set(name: string, value: string): void {
    this.headers[name.toLowerCase()] = value;
  }

  has(name: string): boolean {
    return name.toLowerCase() in this.headers;
  }

  delete(name: string): void {
    delete this.headers[name.toLowerCase()];
  }

  forEach(callback: (value: string, key: string) => void): void {
    Object.entries(this.headers).forEach(([key, value]) => {
      callback(value, key);
    });
  }
}

// NextRequest mock
export class MockNextRequest {
  method: string;
  url: string;
  headers: MockHeaders;
  cookies: ReadonlyRequestCookies;
  private bodyContent: any;

  constructor(input: string | Request | URL, init?: RequestInit) {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    this.url = url;
    this.method = init?.method || "GET";
    this.headers = new MockHeaders(init?.headers);
    this.cookies = {} as ReadonlyRequestCookies;
    this.bodyContent = init?.body || null;
  }

  json() {
    return Promise.resolve(
      this.bodyContent ? JSON.parse(this.bodyContent.toString()) : {}
    );
  }

  nextUrl = {
    searchParams: new URLSearchParams(),
    pathname: "/",
    href: this.url,
  };
}

// Export mocks for jest
export const NextResponse = MockNextResponse;
export const NextRequest = MockNextRequest;

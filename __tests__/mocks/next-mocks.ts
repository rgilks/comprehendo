import { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';

// NextResponse mock
export class MockNextResponse {
  headers: MockHeaders;
  cookies: any;
  status: number;
  statusText: string;
  body: any;
  ok: boolean;
  redirected: boolean = false;
  type: ResponseType = 'basic';
  url: string = 'http://localhost';
  bodyUsed: boolean = false;
  private responseInit: ResponseInit;
  private responseData: any;

  constructor(body: any = {}, init: ResponseInit = {}) {
    this.headers = new MockHeaders(init.headers);
    this.cookies = {};
    this.status = init.status || 200;
    this.statusText = init.statusText || '';
    this.body = body;
    this.responseInit = init;
    this.responseData = body;
    this.ok = this.status >= 200 && this.status < 300;
  }

  json(data: any) {
    return new MockNextResponse(data, this.responseInit);
  }

  // Promise-based methods required by Response interface
  async json(): Promise<any> {
    return Promise.resolve(this.responseData);
  }

  async text(): Promise<string> {
    return Promise.resolve(
      typeof this.responseData === 'string' ? this.responseData : JSON.stringify(this.responseData)
    );
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    return Promise.resolve(new ArrayBuffer(0));
  }

  async blob(): Promise<Blob> {
    return Promise.resolve(new Blob([]));
  }

  async formData(): Promise<FormData> {
    return Promise.resolve(new FormData());
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

  // Method to access bytes (required by Response interface)
  bytes(): Iterable<number> {
    return [];
  }
}

// Custom Headers class that properly implements get()
class MockHeaders implements Headers {
  private headers: Record<string, string>;

  constructor(init?: HeadersInit) {
    this.headers = {};

    if (init) {
      if (init instanceof Headers || init instanceof MockHeaders) {
        // Copy from existing Headers object
        if (init instanceof Headers) {
          init.forEach((value, key) => {
            this.headers[key.toLowerCase()] = value;
          });
        } else {
          init.forEach((value, key) => {
            this.headers[key.toLowerCase()] = value;
          });
        }
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

  forEach(callback: (value: string, key: string, parent: Headers) => void, thisArg?: any): void {
    Object.entries(this.headers).forEach(([key, value]) => {
      callback(value, key, this as unknown as Headers);
    });
  }

  // Additional methods required by Headers interface
  append(name: string, value: string): void {
    const existing = this.get(name);
    if (existing) {
      this.set(name, `${existing}, ${value}`);
    } else {
      this.set(name, value);
    }
  }

  // Required by Headers interface
  entries(): IterableIterator<[string, string]> {
    return Object.entries(this.headers)[Symbol.iterator]();
  }

  // Required by Headers interface
  keys(): IterableIterator<string> {
    return Object.keys(this.headers)[Symbol.iterator]();
  }

  // Required by Headers interface
  values(): IterableIterator<string> {
    return Object.values(this.headers)[Symbol.iterator]();
  }

  // Required by Headers interface
  [Symbol.iterator](): IterableIterator<[string, string]> {
    return this.entries();
  }

  // Required by Headers interface
  getSetCookie(): string[] {
    const cookies = this.get('set-cookie');
    return cookies ? [cookies] : [];
  }
}

// Define a RequestInit-like interface for our mock
interface MockRequestInit extends RequestInit {
  body?: any;
  headers?: HeadersInit;
}

// Create a mock Request class for testing
export class MockRequest implements Request {
  readonly method: string;
  readonly url: string;
  readonly headers: MockHeaders;
  readonly referrer: string = '';
  readonly referrerPolicy: ReferrerPolicy = '';
  readonly mode: RequestMode = 'cors';
  readonly credentials: RequestCredentials = 'same-origin';
  readonly redirect: RequestRedirect = 'follow';
  readonly integrity: string = '';
  readonly cache: RequestCache = 'default';
  readonly bodyUsed: boolean = false;
  readonly destination: RequestDestination = '';
  readonly signal: AbortSignal = { aborted: false } as AbortSignal;
  readonly keepalive: boolean = false;
  readonly body: ReadableStream | null = null;
  readonly duplex: 'half' = 'half';
  readonly isHistoryNavigation: boolean = false;
  readonly isReloadNavigation: boolean = false;
  private bodyContent: any;

  constructor(input: string | URL, init?: MockRequestInit) {
    this.url = typeof input === 'string' ? input : input.href;
    this.method = init?.method || 'GET';
    this.headers = new MockHeaders(init?.headers);
    this.bodyContent = init?.body || null;
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    return new ArrayBuffer(0);
  }

  async blob(): Promise<Blob> {
    return new Blob([]);
  }

  async formData(): Promise<FormData> {
    return new FormData();
  }

  async json(): Promise<any> {
    if (!this.bodyContent) {
      return {};
    }

    if (typeof this.bodyContent === 'string') {
      return JSON.parse(this.bodyContent);
    } else {
      return this.bodyContent;
    }
  }

  async text(): Promise<string> {
    if (!this.bodyContent) {
      return '';
    }

    if (typeof this.bodyContent === 'string') {
      return this.bodyContent;
    } else {
      return JSON.stringify(this.bodyContent);
    }
  }

  clone(): Request {
    return new MockRequest(this.url, {
      method: this.method,
      headers: this.headers,
      body: this.bodyContent,
    });
  }

  // Additional methods required by the Request interface
  bytes(): Iterable<number> {
    return [];
  }
}

// NextRequest mock that extends our Request implementation
export class MockNextRequest extends MockRequest {
  readonly cookies: ReadonlyRequestCookies;
  readonly nextUrl: {
    searchParams: URLSearchParams;
    pathname: string;
    href: string;
  };
  // Adding IP-related headers for the API route
  readonly ip: string;

  constructor(input: string | URL | Request, init?: MockRequestInit) {
    super(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, init);
    this.cookies = {} as ReadonlyRequestCookies;
    this.nextUrl = {
      searchParams: new URLSearchParams(),
      pathname: '/',
      href: this.url,
    };
    this.ip = '127.0.0.1';

    // Ensure headers has the necessary IP headers for rate limiting
    this.headers.set('x-forwarded-for', this.ip);
    this.headers.set('x-real-ip', this.ip);
  }
}

// Export mocks for jest
export const NextResponse = MockNextResponse;
export const NextRequest = MockNextRequest;

import type { NextConfig } from 'next';

declare module '@opennextjs/cloudflare' {
  interface RequestContext {
    env?: Record<string, unknown>;
    cf?: Record<string, unknown>;
  }

  export function getRequestContext(): RequestContext;
  export const withCloudflare: <T extends NextConfig>(config: T) => T;
}

declare module '@opennextjs/cloudflare/context' {
  interface RequestContext {
    env?: Record<string, unknown>;
    cf?: Record<string, unknown>;
  }

  export function getRequestContext(): RequestContext;
}

declare module '@opennextjs/cloudflare/runtime' {
  interface RequestContext {
    env?: Record<string, unknown>;
    cf?: Record<string, unknown>;
  }

  export function getRequestContext(): RequestContext;
}

declare module '@opennextjs/cloudflare/next-config' {
  export const withCloudflare: <T extends NextConfig>(config: T) => T;
}

declare module '@cloudflare/next-on-pages' {
  interface RequestContext {
    env?: Record<string, unknown>;
  }

  export function getRequestContext(): RequestContext;
}

declare module '@cloudflare/next-on-pages/next-config' {
  export function withCloudflare<T extends NextConfig>(config: T): T;
}

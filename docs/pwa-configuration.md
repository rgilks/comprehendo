# PWA Configuration with Serwist

This document outlines the Progressive Web App (PWA) configuration for Comprehendo, utilizing the `@serwist/next` library.

## Overview

Serwist is a collection of JavaScript libraries for progressive web apps, forked from Workbox. We use `@serwist/next` to integrate PWA capabilities into our Next.js application.

## Key Configuration Files

1.  **`next.config.js`**: This file wraps the Next.js configuration with Serwist to enable PWA features.

    - It uses `withSerwistInit` from `@serwist/next`.
    - Key options configured:
      - `swSrc`: Path to the service worker source file (`app/sw.ts`).
      - `swDest`: Output path for the compiled service worker (`public/sw.js`).
      - `register`: Enables automatic registration of the service worker.
      - `exclude`: Specifies files to exclude from precaching (e.g., `/app-build-manifest.json$/`).

2.  **`app/sw.ts`**: This is the source file for our custom service worker.

    - It imports `defaultCache` from `@serwist/next/worker` for runtime caching strategies.
    - It declares `WorkerGlobalScope` with `__SW_MANIFEST` for precache manifest injection.
    - **Event Listeners**:
      - `message`: Listens for messages from the client, specifically for a `SKIP_WAITING` message type to activate a new service worker immediately.
      - `push`: Handles incoming push notifications, displaying a notification with a title and body (data can be passed in the push payload).
    - **Exported Configuration**:
      - `cacheOnNavigation`: Enables caching of navigation requests.
      - `precacheEntries`: Uses `self.__SW_MANIFEST` to precache assets determined by Serwist during the build.
      - `skipWaiting`: Instructs the service worker to activate new versions immediately.
      - `clientsClaim`: Allows an activated service worker to take control of clients (pages) immediately.
      - `runtimeCaching`: Uses `defaultCache` provided by Serwist for common caching strategies for assets like images, scripts, and styles.

3.  **`tsconfig.json`**: Updated to support service worker development.
    - `compilerOptions.lib`: Includes `"webworker"` to provide global types for Service Worker APIs (e.g., `ServiceWorkerGlobalScope`, `PushEvent`, `ExtendableMessageEvent`).
    - `compilerOptions.types`: Includes `"@serwist/next/typings"` for Serwist-specific type support (e.g., `window.serwist`).

## Implementation Details

- The service worker (`app/sw.ts`) handles basic PWA functionalities like precaching, runtime caching, and message/push event handling.
- The `register: true` option in `next.config.js` ensures that Serwist automatically generates the necessary code to register the service worker in the client-side application.
- The application relies on the browser or device's native UI to prompt the user for PWA installation. No custom installation UI is implemented.
- Customizations to caching strategies, push notification handling, or other advanced PWA features can be further developed within `app/sw.ts`.

Refer to the [Serwist documentation](https://serwist.pages.dev/) for more in-depth information on its capabilities and configuration options.

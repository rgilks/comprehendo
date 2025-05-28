import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';

interface ExpectedPushData {
  title?: string;
  body?: string;
}

interface SkipWaitingMessage {
  type: 'SKIP_WAITING';
}

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const messageData = event.data as SkipWaitingMessage | undefined;
  if (messageData) {
    void self.skipWaiting();
  }
});

self.addEventListener('push', (event: PushEvent) => {
  let data: ExpectedPushData | null = null;
  try {
    if (event.data) {
      data = event.data.json() as ExpectedPushData;
    }
  } catch (e) {
    console.error('Error parsing push data', e);
  }

  const title = data?.title || 'Web Push Notification';
  const options: NotificationOptions = {
    body: data?.body || 'This is a web push notification!',
    icon: '/icons/icon-192x192.png',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

export default {
  cacheOnNavigation: true,
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: defaultCache,
};

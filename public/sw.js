if (!self.define) {
  let e,
    s = {};
  const a = (a, n) => (
    (a = new URL(a + '.js', n).href),
    s[a] ||
      new Promise((s) => {
        if ('document' in self) {
          const e = document.createElement('script');
          (e.src = a), (e.onload = s), document.head.appendChild(e);
        } else (e = a), importScripts(a), s();
      }).then(() => {
        let e = s[a];
        if (!e) throw new Error(`Module ${a} didn’t register its module`);
        return e;
      })
  );
  self.define = (n, t) => {
    const i = e || ('document' in self ? document.currentScript.src : '') || location.href;
    if (s[i]) return;
    let c = {};
    const r = (e) => a(e, i),
      d = { module: { uri: i }, exports: c, require: r };
    s[i] = Promise.all(n.map((e) => d[e] || r(e))).then((e) => (t(...e), c));
  };
}
define(['./workbox-4754cb34'], function (e) {
  'use strict';
  importScripts(),
    self.skipWaiting(),
    e.clientsClaim(),
    e.precacheAndRoute(
      [
        { url: '/_next/app-build-manifest.json', revision: 'f2f9dee17dd314458459499f64c4aaa8' },
        {
          url: '/_next/static/_bdUk512GSTTjcY8f-rds/_buildManifest.js',
          revision: '377b75f3a052c71e56bb21cfe71563d3',
        },
        {
          url: '/_next/static/_bdUk512GSTTjcY8f-rds/_ssgManifest.js',
          revision: 'b6652df95db52feb4daf4eca35380933',
        },
        { url: '/_next/static/chunks/108-15e6f0228b6e492c.js', revision: '_bdUk512GSTTjcY8f-rds' },
        { url: '/_next/static/chunks/166.5e8ecac6e26990d7.js', revision: '5e8ecac6e26990d7' },
        { url: '/_next/static/chunks/259-55708214a1771208.js', revision: '_bdUk512GSTTjcY8f-rds' },
        {
          url: '/_next/static/chunks/4bd1b696-704dc55da575ac8d.js',
          revision: '_bdUk512GSTTjcY8f-rds',
        },
        { url: '/_next/static/chunks/684-dd692206fb1b2990.js', revision: '_bdUk512GSTTjcY8f-rds' },
        {
          url: '/_next/static/chunks/app/_not-found/page-5bfe245ad955586d.js',
          revision: '_bdUk512GSTTjcY8f-rds',
        },
        {
          url: '/_next/static/chunks/app/api/auth/%5B...nextauth%5D/route-49d81cd25398b5ae.js',
          revision: '_bdUk512GSTTjcY8f-rds',
        },
        {
          url: '/_next/static/chunks/app/api/chat/route-458256a5b31649a1.js',
          revision: '_bdUk512GSTTjcY8f-rds',
        },
        {
          url: '/_next/static/chunks/app/api/image/route-b9b061fa380edc4b.js',
          revision: '_bdUk512GSTTjcY8f-rds',
        },
        {
          url: '/_next/static/chunks/app/layout-10172d24d88ad283.js',
          revision: '_bdUk512GSTTjcY8f-rds',
        },
        {
          url: '/_next/static/chunks/app/page-10d9af7354604a5a.js',
          revision: '_bdUk512GSTTjcY8f-rds',
        },
        {
          url: '/_next/static/chunks/framework-859199dea06580b0.js',
          revision: '_bdUk512GSTTjcY8f-rds',
        },
        {
          url: '/_next/static/chunks/main-app-527e7d3207182e9b.js',
          revision: '_bdUk512GSTTjcY8f-rds',
        },
        { url: '/_next/static/chunks/main-dee39ddffafb3c86.js', revision: '_bdUk512GSTTjcY8f-rds' },
        {
          url: '/_next/static/chunks/pages/_app-da15c11dea942c36.js',
          revision: '_bdUk512GSTTjcY8f-rds',
        },
        {
          url: '/_next/static/chunks/pages/_error-cc3f077a18ea1793.js',
          revision: '_bdUk512GSTTjcY8f-rds',
        },
        {
          url: '/_next/static/chunks/polyfills-42372ed130431b0a.js',
          revision: '846118c33b2c0e922d7b3a7676f81f6f',
        },
        {
          url: '/_next/static/chunks/webpack-18f02712ebfa1d50.js',
          revision: '_bdUk512GSTTjcY8f-rds',
        },
        { url: '/_next/static/css/f88340d4924a30ee.css', revision: 'f88340d4924a30ee' },
        {
          url: '/_next/static/media/0484562807a97172-s.p.woff2',
          revision: 'b550bca8934bd86812d1f5e28c9cc1de',
        },
        {
          url: '/_next/static/media/8888a3826f4a3af4-s.p.woff2',
          revision: '792477d09826b11d1e5a611162c9797a',
        },
        {
          url: '/_next/static/media/a1386beebedccca4-s.woff2',
          revision: 'd3aa06d13d3cf9c0558927051f3cb948',
        },
        {
          url: '/_next/static/media/b957ea75a84b6ea7-s.p.woff2',
          revision: '0bd523f6049956faaf43c254a719d06a',
        },
        {
          url: '/_next/static/media/c3bc380753a8436c-s.woff2',
          revision: '5a1b7c983a9dc0a87a2ff138e07ae822',
        },
        {
          url: '/_next/static/media/eafabf029ad39a43-s.p.woff2',
          revision: '43751174b6b810eb169101a20d8c26f8',
        },
        {
          url: '/_next/static/media/f10b8e9d91f3edcb-s.woff2',
          revision: '63af7d5e18e585fad8d0220e5d551da1',
        },
        {
          url: '/_next/static/media/fe0777f1195381cb-s.woff2',
          revision: 'f2a04185547c36abfa589651236a9849',
        },
        { url: '/favicon.ico', revision: '8d7b42c9e500c4bb978a8355f74f8318' },
        { url: '/icons/icon-192x192.png', revision: 'ef99dc91d0fa3077c67ba87a87b14087' },
        { url: '/icons/icon-512x512.png', revision: 'eb3477b6f685c422a9c0b73379c8c078' },
        { url: '/manifest.json', revision: '82230c17f47a8b43e4b4c77751599eaa' },
        { url: '/screenshot.png', revision: '6e6e4f894d5b55568ee0c42c3df6cb76' },
      ],
      { ignoreURLParametersMatching: [] }
    ),
    e.cleanupOutdatedCaches(),
    e.registerRoute(
      '/',
      new e.NetworkFirst({
        cacheName: 'start-url',
        plugins: [
          {
            cacheWillUpdate: async ({ request: e, response: s, event: a, state: n }) =>
              s && 'opaqueredirect' === s.type
                ? new Response(s.body, { status: 200, statusText: 'OK', headers: s.headers })
                : s,
          },
        ],
      }),
      'GET'
    ),
    e.registerRoute(
      /^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,
      new e.CacheFirst({
        cacheName: 'google-fonts-webfonts',
        plugins: [new e.ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 31536e3 })],
      }),
      'GET'
    ),
    e.registerRoute(
      /^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,
      new e.StaleWhileRevalidate({
        cacheName: 'google-fonts-stylesheets',
        plugins: [new e.ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 604800 })],
      }),
      'GET'
    ),
    e.registerRoute(
      /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
      new e.StaleWhileRevalidate({
        cacheName: 'static-font-assets',
        plugins: [new e.ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 604800 })],
      }),
      'GET'
    ),
    e.registerRoute(
      /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
      new e.StaleWhileRevalidate({
        cacheName: 'static-image-assets',
        plugins: [new e.ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 86400 })],
      }),
      'GET'
    ),
    e.registerRoute(
      /\/_next\/image\?url=.+$/i,
      new e.StaleWhileRevalidate({
        cacheName: 'next-image',
        plugins: [new e.ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 86400 })],
      }),
      'GET'
    ),
    e.registerRoute(
      /\.(?:mp3|wav|ogg)$/i,
      new e.CacheFirst({
        cacheName: 'static-audio-assets',
        plugins: [
          new e.RangeRequestsPlugin(),
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET'
    ),
    e.registerRoute(
      /\.(?:mp4)$/i,
      new e.CacheFirst({
        cacheName: 'static-video-assets',
        plugins: [
          new e.RangeRequestsPlugin(),
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      'GET'
    ),
    e.registerRoute(
      /\.(?:js)$/i,
      new e.StaleWhileRevalidate({
        cacheName: 'static-js-assets',
        plugins: [new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 })],
      }),
      'GET'
    ),
    e.registerRoute(
      /\.(?:css|less)$/i,
      new e.StaleWhileRevalidate({
        cacheName: 'static-style-assets',
        plugins: [new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 })],
      }),
      'GET'
    ),
    e.registerRoute(
      /\/_next\/data\/.+\/.+\.json$/i,
      new e.StaleWhileRevalidate({
        cacheName: 'next-data',
        plugins: [new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 })],
      }),
      'GET'
    ),
    e.registerRoute(
      /\.(?:json|xml|csv)$/i,
      new e.NetworkFirst({
        cacheName: 'static-data-assets',
        plugins: [new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 })],
      }),
      'GET'
    ),
    e.registerRoute(
      ({ url: e }) => {
        if (!(self.origin === e.origin)) return !1;
        const s = e.pathname;
        return !s.startsWith('/api/auth/') && !!s.startsWith('/api/');
      },
      new e.NetworkFirst({
        cacheName: 'apis',
        networkTimeoutSeconds: 10,
        plugins: [new e.ExpirationPlugin({ maxEntries: 16, maxAgeSeconds: 86400 })],
      }),
      'GET'
    ),
    e.registerRoute(
      ({ url: e }) => {
        if (!(self.origin === e.origin)) return !1;
        return !e.pathname.startsWith('/api/');
      },
      new e.NetworkFirst({
        cacheName: 'others',
        networkTimeoutSeconds: 10,
        plugins: [new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 })],
      }),
      'GET'
    ),
    e.registerRoute(
      ({ url: e }) => !(self.origin === e.origin),
      new e.NetworkFirst({
        cacheName: 'cross-origin',
        networkTimeoutSeconds: 10,
        plugins: [new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 3600 })],
      }),
      'GET'
    );
});

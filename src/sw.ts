import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { clientsClaim } from 'workbox-core';

declare let self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
// `engine` is ignored as well as Workbox's defaults, so /?engine=wasm (the WASM engine prototype,
// #11) is served from the precached index.html when offline.
precacheAndRoute(self.__WB_MANIFEST, {
  ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^engine$/],
});

// The engine module (~370 KB) isn't precached. Every visit stores it on load (warmEngineCache in
// src/engine/index.ts) so the plain URL can load it, including offline. Its name is
// content-hashed, so a cached copy never goes stale; keep the last two builds. Keep the names in sync.
registerRoute(
  ({ url }) => url.origin === self.location.origin && /^\/assets\/.+\.wasm$/.test(url.pathname),
  new CacheFirst({
    cacheName: 'engine-wasm',
    plugins: [new ExpirationPlugin({ maxEntries: 2 })],
  }),
);

// Cache research Markdown files for offline "Learn More"
registerRoute(
  ({ url }) => url.pathname.startsWith('/data/research/'),
  new StaleWhileRevalidate({
    cacheName: 'marker-research',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 500,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  }),
);

// Cache OpenStreetMap tiles that the user views
registerRoute(
  ({ url }) => url.hostname.includes('tile.openstreetmap.org'),
  new StaleWhileRevalidate({
    cacheName: 'map-tiles',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 500,
        maxAgeSeconds: 7 * 24 * 60 * 60,
      }),
    ],
  }),
);

/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { StaleWhileRevalidate, NetworkFirst, CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// registerType: "autoUpdate" — activate the new SW as soon as it installs and
// take control of open tabs so users get fixes on their next navigation
// without a "new version" prompt.
self.addEventListener("install", () => {
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

type SupabaseRouteCallback = (params: { url: URL }) => boolean;
const matchSupabase = (pathPattern: RegExp): SupabaseRouteCallback =>
  ({ url }) => url.host.endsWith(".supabase.co") && pathPattern.test(url.pathname);

// Order matters: more specific patterns first.
// Anything not listed here is NetworkOnly by default — auth, realtime,
// pending_*, scrape_logs, venue_owners all stay uncached.
registerRoute(
  matchSupabase(/^\/rest\/v1\/events_archive/),
  new StaleWhileRevalidate({
    cacheName: "supabase-events-archive",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxAgeSeconds: 24 * 60 * 60, maxEntries: 50 }),
    ],
  }),
);

registerRoute(
  matchSupabase(/^\/rest\/v1\/events(\?|$|\/)/),
  new StaleWhileRevalidate({
    cacheName: "supabase-events",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxAgeSeconds: 5 * 60, maxEntries: 50 }),
    ],
  }),
);

registerRoute(
  matchSupabase(/^\/rest\/v1\/venues/),
  new StaleWhileRevalidate({
    cacheName: "supabase-venues",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxAgeSeconds: 30 * 60, maxEntries: 20 }),
    ],
  }),
);

registerRoute(
  matchSupabase(/^\/rest\/v1\/categories/),
  new StaleWhileRevalidate({
    cacheName: "supabase-categories",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxAgeSeconds: 24 * 60 * 60, maxEntries: 5 }),
    ],
  }),
);

registerRoute(
  matchSupabase(/^\/rest\/v1\/profiles/),
  new NetworkFirst({
    cacheName: "supabase-profiles",
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxAgeSeconds: 5 * 60, maxEntries: 20 }),
    ],
  }),
);

registerRoute(
  matchSupabase(/^\/rest\/v1\/user_interests/),
  new NetworkFirst({
    cacheName: "supabase-user-interests",
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxAgeSeconds: 5 * 60, maxEntries: 50 }),
    ],
  }),
);

registerRoute(
  matchSupabase(/^\/storage\/v1\/object\/public\//),
  new CacheFirst({
    cacheName: "supabase-storage",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxAgeSeconds: 7 * 24 * 60 * 60, maxEntries: 100 }),
    ],
  }),
);

// OpenFreeMap raster/vector tiles + style JSON. CacheFirst because tiles are
// effectively immutable for our 30-day window and we'd rather show slightly
// stale street labels than a slow Map page.
registerRoute(
  ({ url }) => url.host === "tiles.openfreemap.org",
  new CacheFirst({
    cacheName: "openfreemap-tiles",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxAgeSeconds: 30 * 24 * 60 * 60, maxEntries: 300 }),
    ],
  }),
);

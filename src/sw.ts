/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { StaleWhileRevalidate, NetworkFirst, CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

self.skipWaiting();
self.addEventListener("activate", () => {
  void self.clients.claim();
});

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Bridge SW console logs to all controlled pages so we can see them in the
// page DevTools console, not just the SW's own (separate) console.
async function broadcast(msg: string) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  for (const client of clients) client.postMessage({ type: "sw-log", msg });
  // eslint-disable-next-line no-console
  console.log(msg);
}

// Visibility into what the SW actually sees so we can finally diagnose why
// runtime caching wasn't populating. Logs are scoped to supabase.co URLs so
// we don't drown in noise from the app shell.
self.addEventListener("fetch", (event) => {
  const u = event.request.url;
  if (u.includes("supabase.co")) {
    void broadcast(`[sw-fetch] ${event.request.method} ${u.slice(0, 110)}`);
  }
});

const debugPlugin = {
  cacheWillUpdate: async ({ request, response }: { request: Request; response: Response }) => {
    const u = request.url.slice(0, 90);
    void broadcast(`[sw-cacheWillUpdate] ${response.status} ${response.type} vary=${response.headers.get("vary") ?? "—"} ${u}`);
    return response;
  },
  cacheDidUpdate: async ({ cacheName, request }: { cacheName: string; request: Request }) => {
    void broadcast(`[sw-cacheDidUpdate] ${cacheName} ← ${request.url.slice(0, 90)}`);
  },
  fetchDidFail: async ({ request, error }: { request: Request; error: Error }) => {
    void broadcast(`[sw-fetchDidFail] ${request.url.slice(0, 90)} — ${error.message}`);
  },
};

type SupabaseRouteCallback = (params: { url: URL }) => boolean;
const matchSupabase = (pathPattern: RegExp): SupabaseRouteCallback =>
  ({ url }) => url.host.endsWith(".supabase.co") && pathPattern.test(url.pathname);

// Order matters: more specific patterns first.
registerRoute(
  matchSupabase(/^\/rest\/v1\/events_archive/),
  new StaleWhileRevalidate({
    cacheName: "supabase-events-archive",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxAgeSeconds: 24 * 60 * 60, maxEntries: 50 }),
      debugPlugin,
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
      debugPlugin,
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
      debugPlugin,
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
      debugPlugin,
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
      debugPlugin,
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
      debugPlugin,
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
      debugPlugin,
    ],
  }),
);

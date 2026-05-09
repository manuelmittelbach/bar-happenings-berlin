import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.svg", "apple-touch-icon-180x180.png"],
      manifest: {
        name: "Inside·Bars",
        short_name: "Inside·Bars",
        description: "Discover bar events in Berlin",
        theme_color: "#0F0F0F",
        background_color: "#FFFFFF",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        // Order matters: more specific patterns first.
        // Anything not listed here is NetworkOnly by default — auth, realtime,
        // pending_*, scrape_logs, venue_owners all stay uncached.
        runtimeCaching: [
          {
            urlPattern: /\/rest\/v1\/events_archive/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "supabase-events-archive",
              expiration: { maxAgeSeconds: 24 * 60 * 60, maxEntries: 50 },
            },
          },
          {
            urlPattern: /\/rest\/v1\/events(\?|$)/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "supabase-events",
              expiration: { maxAgeSeconds: 5 * 60, maxEntries: 50 },
            },
          },
          {
            urlPattern: /\/rest\/v1\/venues/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "supabase-venues",
              expiration: { maxAgeSeconds: 30 * 60, maxEntries: 20 },
            },
          },
          {
            urlPattern: /\/rest\/v1\/categories/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "supabase-categories",
              expiration: { maxAgeSeconds: 24 * 60 * 60, maxEntries: 5 },
            },
          },
          {
            urlPattern: /\/rest\/v1\/profiles/,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-profiles",
              networkTimeoutSeconds: 5,
              expiration: { maxAgeSeconds: 5 * 60, maxEntries: 20 },
            },
          },
          {
            urlPattern: /\/rest\/v1\/user_interests/,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-user-interests",
              networkTimeoutSeconds: 5,
              expiration: { maxAgeSeconds: 5 * 60, maxEntries: 50 },
            },
          },
          {
            urlPattern: /\/storage\/v1\/object\/public\//,
            handler: "CacheFirst",
            options: {
              cacheName: "supabase-storage",
              expiration: { maxAgeSeconds: 7 * 24 * 60 * 60, maxEntries: 100 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));

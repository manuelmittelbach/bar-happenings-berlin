import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.insidebars.berlin',
  appName: 'Inside Bars',
  webDir: 'dist',
  backgroundColor: '#f8f5ef',
  plugins: {
    StatusBar: {
      backgroundColor: '#f8f5ef',
      style: 'LIGHT',
      overlaysWebView: false,
    },
    // Route window.fetch through Capacitor's native HTTP client — bypasses
    // the Android WebView's strict CORS handling that breaks cross-origin
    // requests (e.g. MapLibre tiles from tiles.openfreemap.org).
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;

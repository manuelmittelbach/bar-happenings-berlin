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
  },
};

export default config;

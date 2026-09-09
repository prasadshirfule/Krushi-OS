import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.krushios.app',
  appName: 'Krushi OS',
  webDir: 'public',
  // The Android app loads the production Vercel deployment via WebView.
  // This is NOT a static export — Krushi OS is a full SSR Next.js application.
  server: {
    url: 'https://krushios.vercel.app',
    cleartext: false,
  },
  android: {
    // Allow mixed content only if needed for local blob URLs (e.g. jspdf)
    allowMixedContent: false,
    // Append the Capacitor user-agent so the server can detect Android app if needed
    appendUserAgent: 'KrushiOS-Android',
    // Override the back button to navigate back in WebView history
    backgroundColor: '#09090b', // zinc-950 — matches dark theme background
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#09090b',
      showSpinner: true,
      spinnerColor: '#22c55e',
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#09090b',
    },
  },
};

export default config;

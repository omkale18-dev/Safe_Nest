import type { CapacitorConfig } from '@capacitor/cli';

// Enable optional live-reload when CAP_SERVER_URL is provided (e.g., http://192.168.x.x:3000)
const serverUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'com.safenest.app',
  appName: 'SafeNest',
  webDir: 'dist',
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          cleartext: true
        }
      }
    : {}),
  plugins: {
    Geolocation: {
      // Enable background location updates on iOS
      backgroundMode: true,
      // Required for iOS 11+
      NSLocationWhenInUseUsageDescription: 'SafeNest needs location access to monitor and track senior location for safety.',
      NSLocationAlwaysAndWhenInUseUsageDescription: 'SafeNest needs always-on location access to provide continuous safety monitoring even when the app is closed.',
      NSLocationAlwaysUsageDescription: 'SafeNest needs continuous location access for background monitoring.',
    }
  }
};

// Export the canonical Capacitor config so `npx cap copy` can create capacitor.config.json
export default config;

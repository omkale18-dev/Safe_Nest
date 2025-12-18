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
    : {})
};

export default config;

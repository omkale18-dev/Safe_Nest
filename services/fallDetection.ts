import { Capacitor } from '@capacitor/core';

// Minimal plugin interface
interface FallDetectionPlugin {
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

const plugin: FallDetectionPlugin | null = Capacitor.isNativePlatform()
  ? ((window as any).Capacitor?.Plugins?.FallDetection as FallDetectionPlugin)
  : null;

// Simple lockout to prevent repeated fall spam
const LOCKOUT_MS = 60_000;
let lastFallDetectedAt = 0;

export const startFallDetection = async () => {
  if (!plugin) {
    console.warn('[FallDetection] Plugin not available - may need to run on real device');
    return;
  }
  try {
    await plugin.start();
    console.log('[FallDetection] ✓ Started successfully');
  } catch (e) {
    console.error('[FallDetection] start failed', e);
  }
};

export const stopFallDetection = async () => {
  if (!plugin) return;
  try {
    await plugin.stop();
    console.log('[FallDetection] ✓ Stopped');
  } catch (e) {
    console.error('[FallDetection] stop failed', e);
  }
};

export const subscribeFallDetected = (handler: () => void) => {
  if (!Capacitor.isNativePlatform()) {
    console.warn('[FallDetection] Event listener not available on web');
    return () => {};
  }
  const listener = () => {
    const now = Date.now();
    if (now - lastFallDetectedAt < LOCKOUT_MS) {
      console.log('[FallDetection] Ignoring fall - lockout active');
      return;
    }
    lastFallDetectedAt = now;
    console.log('[FallDetection] 🚨 FALL DETECTED EVENT RECEIVED');
    handler();
  };
  window.addEventListener('fallDetected', listener);
  console.log('[FallDetection] ✓ Listening for fall events');
  return () => window.removeEventListener('fallDetected', listener);
};

export const isFallDetectionAvailable = (): boolean => {
  return plugin !== null;
};

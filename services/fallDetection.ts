import { Capacitor } from '@capacitor/core';

// Minimal plugin interface
interface FallDetectionPlugin {
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

const plugin: FallDetectionPlugin | null = Capacitor.isNativePlatform()
  ? ((window as any).Capacitor?.Plugins?.FallDetection as FallDetectionPlugin)
  : null;

export const startFallDetection = async () => {
  if (!plugin) return;
  try {
    await plugin.start();
  } catch (e) {
    console.error('[FallDetection] start failed', e);
  }
};

export const stopFallDetection = async () => {
  if (!plugin) return;
  try {
    await plugin.stop();
  } catch (e) {
    console.error('[FallDetection] stop failed', e);
  }
};

export const subscribeFallDetected = (handler: () => void) => {
  if (!Capacitor.isNativePlatform()) return () => {};
  const listener = () => handler();
  window.addEventListener('fallDetected', listener);
  return () => window.removeEventListener('fallDetected', listener);
};

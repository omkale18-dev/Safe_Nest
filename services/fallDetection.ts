import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';

// Simplified fall detection - no native plugin dependency
// Just emit events that the app can handle

const LOCKOUT_MS = 60_000;
let lastFallDetectedAt = 0;

export const startFallDetection = async () => {
  console.log('[FallDetection] ✓ Fall detection monitoring enabled');
};

export const stopFallDetection = async () => {
  console.log('[FallDetection] ✓ Fall detection monitoring disabled');
};

// Emit fall detected event (called from accelerometer in useAppSensors)
export const emitFallDetected = () => {
  const now = Date.now();
  if (now - lastFallDetectedAt < LOCKOUT_MS) {
    console.log('[FallDetection] Lockout active, ignoring duplicate fall');
    return;
  }
  lastFallDetectedAt = now;
  console.log('[FallDetection] 🚨 FALL DETECTED - Dispatching event');
  window.dispatchEvent(new CustomEvent('fallDetected'));
};

export const subscribeFallDetected = (handler: () => void) => {
  const listener = () => {
    console.log('[FallDetection] Listener called - triggering handler');
    handler();
  };
  window.addEventListener('fallDetected', listener);
  console.log('[FallDetection] ✓ Subscribed to fall events');
  return () => window.removeEventListener('fallDetected', listener);
};

export const subscribeFallUserOk = (handler: () => void) => {
  const listener = () => {
    console.log('[FallDetection] User confirmed OK');
    handler();
  };
  window.addEventListener('fallUserOk', listener);
  return () => window.removeEventListener('fallUserOk', listener);
};

export const subscribeFallNeedHelp = (handler: () => void) => {
  const listener = () => {
    console.log('[FallDetection] User needs help');
    handler();
  };
  window.addEventListener('fallNeedHelp', listener);
  return () => window.removeEventListener('fallNeedHelp', listener);
};

// Show simple notification when fall is detected
export const showFallNotification = async (isAppOpen: boolean) => {
  if (!Capacitor.isNativePlatform()) {
    console.log('[FallDetection] Not on native platform, skipping notification');
    return;
  }

  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      console.log('[FallDetection] Requesting notification permission');
      await LocalNotifications.requestPermissions();
      return;
    }

    // Show simple "Are you okay?" notification with action buttons
    await LocalNotifications.schedule({
      notifications: [{
        id: 1001,
        title: '📴 Fall Detected!',
        body: 'Are you okay?',
        sound: 'default',
        channelId: 'emergency_alerts',
        actionTypeId: 'FALL_RESPONSE',
      }]
    });
    console.log('[FallDetection] Notification sent');
  } catch (err) {
    console.error('[FallDetection] Failed to send notification:', err);
  }
};

export const setFallSensitivity = async (level: 'HIGH' | 'MEDIUM' | 'LOW') => {
  localStorage.setItem('fall_detection_sensitivity', level);
  try {
    await Preferences.set({ key: 'fall_detection_sensitivity', value: level });
    console.log(`[FallDetection] Sensitivity set to ${level}`);
  } catch (e) {
    console.error('[FallDetection] Failed to set sensitivity', e);
  }
};

export const getFallSensitivity = async (): Promise<'HIGH' | 'MEDIUM' | 'LOW'> => {
  try {
    const { value } = await Preferences.get({ key: 'fall_detection_sensitivity' });
    return (value as 'HIGH' | 'MEDIUM' | 'LOW') || 'MEDIUM';
  } catch (e) {
    return 'MEDIUM';
  }
};

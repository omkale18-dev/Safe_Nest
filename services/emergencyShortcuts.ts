import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

/**
 * Emergency Shortcuts Service
 * Handles volume button detection and persistent lock screen SOS button
 */

let volumeButtonPresses: number[] = [];
let onSOSTriggerCallback: (() => void) | null = null;
const VOLUME_PRESS_WINDOW = 2000; // 2 seconds window for 3 presses
const REQUIRED_PRESSES = 3;
const LOCK_SCREEN_NOTIFICATION_ID = 99999;

/**
 * Initialize volume button shortcut detection
 * 3 rapid volume button presses = SOS trigger
 */
export const initVolumeButtonShortcut = (onSOSTrigger: () => void) => {
  onSOSTriggerCallback = onSOSTrigger;
  
  if (!Capacitor.isNativePlatform()) {
    console.log('[VolumeShortcut] Not on native platform, skipping volume button detection');
    return;
  }

  // Register keyboard event listener for volume buttons
  // Note: This works on Android with proper permissions
  document.addEventListener('volumedown', handleVolumePress);
  document.addEventListener('volumeup', handleVolumePress);
  
  console.log('[VolumeShortcut] Volume button shortcut initialized');
};

const handleVolumePress = () => {
  const now = Date.now();
  
  // Add current press
  volumeButtonPresses.push(now);
  
  // Remove old presses outside the time window
  volumeButtonPresses = volumeButtonPresses.filter(
    time => now - time < VOLUME_PRESS_WINDOW
  );
  
  console.log('[VolumeShortcut] Button presses in window:', volumeButtonPresses.length);
  
  // Check if we have enough presses in the time window
  if (volumeButtonPresses.length >= REQUIRED_PRESSES) {
    console.log('[VolumeShortcut] SOS TRIGGERED via volume buttons!');
    volumeButtonPresses = []; // Reset
    
    // Vibrate to confirm trigger
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100, 50, 100]);
    }
    
    // Trigger SOS
    if (onSOSTriggerCallback) {
      onSOSTriggerCallback();
    }
  }
};

/**
 * Show persistent lock screen SOS notification
 * This notification stays visible on lock screen with a tap-to-SOS action
 */
export const showLockScreenSOSButton = async () => {
  if (!Capacitor.isNativePlatform()) {
    console.log('[LockScreenSOS] Not on native platform, skipping');
    return;
  }

  try {
    // Request notification permissions first
    const permissionStatus = await LocalNotifications.checkPermissions();
    if (permissionStatus.display !== 'granted') {
      await LocalNotifications.requestPermissions();
    }

    // Create persistent notification channel for lock screen button
    if (Capacitor.getPlatform() === 'android') {
      await LocalNotifications.createChannel({
        id: 'lock_screen_sos',
        name: 'Lock Screen SOS Button',
        description: 'Persistent emergency button accessible from lock screen',
        importance: 5, // Max importance
        visibility: 1, // Show on lock screen
        sound: undefined, // No sound for persistent notification
        vibration: false,
        lights: false
      });
    }

    // Schedule persistent notification - only once with unique ID
    await LocalNotifications.schedule({
      notifications: [{
        id: LOCK_SCREEN_NOTIFICATION_ID,
        title: '🆘 Emergency SOS',
        body: 'Tap here to trigger emergency alert',
        ongoing: true, // Makes it persistent (can't be swiped away)
        autoCancel: false,
        channelId: 'lock_screen_sos',
        smallIcon: 'ic_stat_name',
        actionTypeId: 'LOCK_SCREEN_SOS',
        extra: {
          type: 'lock_screen_sos_button',
          persistent: true
        }
      }]
    });

    console.log('[LockScreenSOS] Persistent SOS notification created');
  } catch (error) {
    console.error('[LockScreenSOS] Failed to create notification:', error);
  }
};

/**
 * Hide the lock screen SOS button
 */
export const hideLockScreenSOSButton = async () => {
  if (!Capacitor.isNativePlatform()) return;
  
  try {
    await LocalNotifications.cancel({
      notifications: [{ id: LOCK_SCREEN_NOTIFICATION_ID }]
    });
    console.log('[LockScreenSOS] SOS notification removed');
  } catch (error) {
    console.error('[LockScreenSOS] Failed to remove notification:', error);
  }
};

/**
 * Register action handler for lock screen SOS button tap
 * Prevent continuous recreation of notification
 */
export const registerLockScreenSOSHandler = (onSOSTrigger: () => void) => {
  if (!Capacitor.isNativePlatform()) return;

  LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
    console.log('[LockScreenSOS] Notification action:', notification);
    
    if (notification.notification.id === LOCK_SCREEN_NOTIFICATION_ID) {
      console.log('[LockScreenSOS] SOS TRIGGERED from lock screen!');
      
      // Vibrate confirmation
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]);
      }
      
      // Trigger SOS - do NOT recreate notification to avoid loop
      onSOSTrigger();
    }
  });
  
  console.log('[LockScreenSOS] Action handler registered');
};

/**
 * Cleanup all emergency shortcuts
 */
export const cleanupEmergencyShortcuts = async () => {
  document.removeEventListener('volumedown', handleVolumePress);
  document.removeEventListener('volumeup', handleVolumePress);
  await hideLockScreenSOSButton();
  onSOSTriggerCallback = null;
  volumeButtonPresses = [];
  console.log('[EmergencyShortcuts] Cleaned up');
};

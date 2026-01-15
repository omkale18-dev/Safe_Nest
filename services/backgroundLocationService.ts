import { Geolocation, PermissionStatus } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { LocationData } from '../types';

class BackgroundLocationService {
  private watchId: string | number | null = null;
  private locationCallback: ((location: LocationData) => void) | null = null;
  private isActive = false;

  /**
   * Start background location tracking
   * Requires location permissions to be already granted
   */
  async startBackgroundTracking(
    onLocationUpdate: (location: LocationData) => void,
    enableHighAccuracy = true
  ): Promise<boolean> {
    try {
      if (this.isActive) {
        console.warn('[BackgroundLocation] Tracking already active');
        return true;
      }

      // Request permissions first
      const hasPermission = await this.checkAndRequestPermissions();
      if (!hasPermission) {
        console.error('[BackgroundLocation] Location permissions denied');
        return false;
      }

      this.locationCallback = onLocationUpdate;

      if (Capacitor.isNativePlatform()) {
        // Native: Use Geolocation watchPosition which works in background on some platforms
        this.watchId = await Geolocation.watchPosition(
          {
            enableHighAccuracy: enableHighAccuracy,
            timeout: 10000,
            maximumAge: 1000, // Update max every 1 second
          },
          (position, err) => {
            if (err) {
              console.warn('[BackgroundLocation] Error:', err);
              return;
            }

            if (position) {
              const loc: LocationData = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                address: 'Background location',
                updatedAt: new Date(),
              };
              this.locationCallback?.(loc);
            }
          }
        );

        this.isActive = true;
        console.log('[BackgroundLocation] Native tracking started:', this.watchId);
        return true;
      } else {
        // Web: Use navigator.geolocation
        this.watchId = navigator.geolocation.watchPosition(
          (position) => {
            const loc: LocationData = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              address: 'Browser location',
              updatedAt: new Date(),
            };
            this.locationCallback?.(loc);
          },
          (error) => {
            console.warn('[BackgroundLocation] Geolocation error:', error);
          },
          {
            enableHighAccuracy: enableHighAccuracy,
            timeout: 10000,
            maximumAge: 1000,
          }
        );

        this.isActive = true;
        console.log('[BackgroundLocation] Web tracking started:', this.watchId);
        return true;
      }
    } catch (error) {
      console.error('[BackgroundLocation] Failed to start tracking:', error);
      return false;
    }
  }

  /**
   * Stop background location tracking
   */
  async stopBackgroundTracking(): Promise<void> {
    try {
      if (!this.isActive) return;

      if (Capacitor.isNativePlatform() && this.watchId && typeof this.watchId === 'string') {
        await Geolocation.clearWatch({ id: this.watchId });
        console.log('[BackgroundLocation] Native tracking stopped');
      } else if (this.watchId && typeof this.watchId === 'number') {
        navigator.geolocation.clearWatch(this.watchId as number);
        console.log('[BackgroundLocation] Web tracking stopped');
      }

      this.watchId = null;
      this.isActive = false;
      this.locationCallback = null;
    } catch (error) {
      console.error('[BackgroundLocation] Failed to stop tracking:', error);
    }
  }

  /**
   * Check and request location permissions
   */
  private async checkAndRequestPermissions(): Promise<boolean> {
    try {
      if (Capacitor.isNativePlatform()) {
        const status: PermissionStatus = await Geolocation.requestPermissions();
        const hasPermission = status.location === 'granted' || status.coarseLocation === 'granted';
        
        if (!hasPermission) {
          console.warn('[BackgroundLocation] Permissions not granted:', status);
        }
        
        return hasPermission;
      } else {
        // Browser: Permission is prompted on first call
        return true;
      }
    } catch (error) {
      console.error('[BackgroundLocation] Permission check failed:', error);
      return false;
    }
  }

  /**
   * Get current tracking status
   */
  isTracking(): boolean {
    return this.isActive;
  }

  /**
   * Get current watch ID (for debugging)
   */
  getWatchId(): string | number | null {
    return this.watchId;
  }
}

// Export singleton instance
export const backgroundLocationService = new BackgroundLocationService();

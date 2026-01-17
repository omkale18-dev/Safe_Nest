import { Capacitor, registerPlugin } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { LocalNotifications } from '@capacitor/local-notifications';
import { db } from './firebase';
import { ref, push, set, onValue } from 'firebase/database';
import { Geofence, GeofenceEvent } from '../types';

const STORAGE_KEY = 'safenest_geofences';
const NOTIFICATION_ID_BASE = 60000;

// Native Geofence Plugin Interface
interface NativeGeofencePlugin {
  addGeofences(options: { geofences: Array<{ id: string; latitude: number; longitude: number; radius: number; label: string }> }): Promise<{ success: boolean }>;
  removeGeofences(options: { ids?: string[] }): Promise<{ success: boolean }>;
  checkPermissions(): Promise<{ fineLocation: boolean; backgroundLocation: boolean }>;
}

// Register the native plugin
const NativeGeofence = Capacitor.isNativePlatform() 
  ? registerPlugin<NativeGeofencePlugin>('NativeGeofence')
  : null;

/**
 * Geofence Service
 * 
 * Monitors senior's location and alerts caregiver when:
 * - Senior leaves home (exit alert)
 * - Senior enters restricted area (entry alert)
 * 
 * Uses native Android GeofencingClient for background-safe monitoring.
 * Useful for seniors with dementia or who need location monitoring.
 */
class GeofenceService {
  private geofences: Geofence[] = [];
  private watchId: string | null = null;
  private lastPosition: { lat: number; lng: number } | null = null;
  private householdId: string | null = null;
  private onEventCallback: ((event: GeofenceEvent) => void) | null = null;
  private insideGeofences: Set<string> = new Set(); // Track which geofences senior is inside
  private nativeGeofencesRegistered = false;

  constructor() {
    this.loadGeofences();
    this.setupNativeEventListener();
  }

  private setupNativeEventListener(): void {
    // Listen for native geofence transition events
    if (Capacitor.isNativePlatform()) {
      window.addEventListener('geofenceTransition', (event: any) => {
        try {
          const data = typeof event.detail === 'string' ? JSON.parse(event.detail) : event.detail;
          console.log('[Geofence] Native transition event:', data);
          
          const geofence = this.geofences.find(g => g.id === data.fenceId);
          if (geofence && this.onEventCallback) {
            this.onEventCallback({
              type: data.type as 'enter' | 'exit',
              geofence,
              timestamp: new Date(),
              location: this.lastPosition || { lat: geofence.latitude, lng: geofence.longitude },
            });
          }
        } catch (e) {
          console.error('[Geofence] Failed to parse native event:', e);
        }
      });
      console.log('[Geofence] Native event listener registered');
    }
  }

  private loadGeofences(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.geofences = JSON.parse(stored);
        console.log('[Geofence] Loaded', this.geofences.length, 'geofences');
      }
    } catch (e) {
      console.error('[Geofence] Failed to load:', e);
    }
  }

  private saveGeofences(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.geofences));
    } catch (e) {
      console.error('[Geofence] Failed to save:', e);
    }
  }

  /**
   * Initialize with household ID for Firebase sync
   */
  init(householdId: string): void {
    this.householdId = householdId;
    this.syncFromFirebase();
  }

  /**
   * Sync geofences from Firebase
   */
  private syncFromFirebase(): void {
    if (!this.householdId) return;

    const geofenceRef = ref(db, `households/${this.householdId}/geofences`);
    onValue(geofenceRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        this.geofences = Object.values(data).map((g: any) => ({
          ...g,
          createdAt: new Date(g.createdAt),
        }));
        this.saveGeofences();
        console.log('[Geofence] Synced from Firebase:', this.geofences.length);
        
        // Register with native plugin when synced
        this.registerNativeGeofences();
      }
    });
  }

  /**
   * Register geofences with native Android plugin for background monitoring
   */
  private async registerNativeGeofences(): Promise<void> {
    if (!NativeGeofence || this.geofences.length === 0) return;
    
    try {
      // Check permissions first
      const perms = await NativeGeofence.checkPermissions();
      if (!perms.fineLocation || !perms.backgroundLocation) {
        console.warn('[Geofence] Missing location permissions for native geofencing');
        return;
      }
      
      // Format geofences for native plugin
      const nativeGeofences = this.geofences.map(g => ({
        id: g.id,
        latitude: g.latitude,
        longitude: g.longitude,
        radius: g.radius,
        label: g.name,
      }));
      
      await NativeGeofence.addGeofences({ geofences: nativeGeofences });
      this.nativeGeofencesRegistered = true;
      console.log('[Geofence] ✓ Registered', nativeGeofences.length, 'geofences with native plugin (background-safe)');
    } catch (e) {
      console.error('[Geofence] Failed to register native geofences:', e);
    }
  }

  /**
   * Add a new geofence
   */
  async addGeofence(geofence: Omit<Geofence, 'id' | 'createdAt'>): Promise<Geofence> {
    const newGeofence: Geofence = {
      ...geofence,
      id: Date.now().toString(),
      createdAt: new Date(),
    };

    this.geofences.push(newGeofence);
    this.saveGeofences();

    // Sync to Firebase
    if (this.householdId) {
      await set(ref(db, `households/${this.householdId}/geofences/${newGeofence.id}`), {
        ...newGeofence,
        createdAt: newGeofence.createdAt.toISOString(),
      });
    }
    
    // Register with native plugin
    await this.registerNativeGeofences();

    console.log('[Geofence] Added:', newGeofence.name);
    return newGeofence;
  }

  /**
   * Remove a geofence
   */
  async removeGeofence(id: string): Promise<void> {
    this.geofences = this.geofences.filter(g => g.id !== id);
    this.saveGeofences();
    this.insideGeofences.delete(id);

    if (this.householdId) {
      await set(ref(db, `households/${this.householdId}/geofences/${id}`), null);
    }
    
    // Remove from native plugin
    if (NativeGeofence) {
      try {
        await NativeGeofence.removeGeofences({ ids: [id] });
        console.log('[Geofence] Removed from native plugin:', id);
      } catch (e) {
        console.error('[Geofence] Failed to remove from native:', e);
      }
    }
  }

  /**
   * Update a geofence
   */
  async updateGeofence(id: string, updates: Partial<Geofence>): Promise<void> {
    const index = this.geofences.findIndex(g => g.id === id);
    if (index !== -1) {
      this.geofences[index] = { ...this.geofences[index], ...updates };
      this.saveGeofences();

      if (this.householdId) {
        await set(ref(db, `households/${this.householdId}/geofences/${id}`), {
          ...this.geofences[index],
          createdAt: this.geofences[index].createdAt.toISOString(),
        });
      }
      
      // Re-register all geofences with native plugin (update by re-adding)
      await this.registerNativeGeofences();
    }
  }

  /**
   * Get all geofences
   */
  getGeofences(): Geofence[] {
    return [...this.geofences];
  }

  /**
   * Get home geofence
   */
  getHomeGeofence(): Geofence | null {
    return this.geofences.find(g => g.type === 'home') || null;
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  /**
   * Check if a point is inside a geofence
   */
  private isInsideGeofence(lat: number, lng: number, geofence: Geofence): boolean {
    const distance = this.calculateDistance(lat, lng, geofence.latitude, geofence.longitude);
    return distance <= geofence.radius;
  }

  /**
   * Start monitoring location
   */
  async startMonitoring(): Promise<void> {
    // Only run on native platforms (Android/iOS)
    if (!Capacitor.isNativePlatform()) {
      console.log('[Geofence] Skipping monitoring - not on native platform');
      return;
    }

    if (this.watchId) return; // Already monitoring

    try {
      // Request permissions
      const permission = await Geolocation.requestPermissions();
      if (permission.location !== 'granted') {
        console.warn('[Geofence] Location permission denied');
        return;
      }

      // Get initial position
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
      });
      this.lastPosition = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      // Initialize inside/outside state for all geofences
      for (const geofence of this.geofences.filter(g => g.enabled)) {
        if (this.isInsideGeofence(this.lastPosition.lat, this.lastPosition.lng, geofence)) {
          this.insideGeofences.add(geofence.id);
        }
      }

      // Start watching
      this.watchId = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000,
        },
        (position, err) => {
          if (err) {
            console.error('[Geofence] Watch error:', err);
            return;
          }
          if (position) {
            this.checkGeofences(position.coords.latitude, position.coords.longitude);
          }
        }
      );

      console.log('[Geofence] Started monitoring');
    } catch (error) {
      console.error('[Geofence] Failed to start monitoring:', error);
    }
  }

  /**
   * Stop monitoring
   */
  async stopMonitoring(): Promise<void> {
    if (this.watchId) {
      await Geolocation.clearWatch({ id: this.watchId });
      this.watchId = null;
      console.log('[Geofence] Stopped monitoring');
    }
  }

  /**
   * Check geofences against current position
   */
  private checkGeofences(lat: number, lng: number): void {
    this.lastPosition = { lat, lng };

    for (const geofence of this.geofences.filter(g => g.enabled)) {
      const isInside = this.isInsideGeofence(lat, lng, geofence);
      const wasInside = this.insideGeofences.has(geofence.id);

      if (wasInside && !isInside && geofence.alertOnExit) {
        // Exited geofence
        this.insideGeofences.delete(geofence.id);
        this.triggerEvent(geofence, 'EXIT', lat, lng);
      } else if (!wasInside && isInside) {
        // Entered geofence
        this.insideGeofences.add(geofence.id);
        if (geofence.alertOnEntry) {
          this.triggerEvent(geofence, 'ENTRY', lat, lng);
        }
      }
    }
  }

  /**
   * Trigger geofence event
   */
  private async triggerEvent(geofence: Geofence, eventType: 'EXIT' | 'ENTRY', lat: number, lng: number): Promise<void> {
    const event: GeofenceEvent = {
      id: Date.now().toString(),
      geofenceId: geofence.id,
      geofenceName: geofence.name,
      eventType,
      timestamp: new Date(),
      location: { latitude: lat, longitude: lng },
      notifiedCaregivers: [],
    };

    console.log('[Geofence] Event:', eventType, geofence.name);

    // Save event to Firebase
    if (this.householdId) {
      await set(ref(db, `households/${this.householdId}/geofenceEvents/${event.id}`), {
        ...event,
        timestamp: event.timestamp.toISOString(),
      });
    }

    // Show local notification
    await this.showNotification(geofence, eventType);

    // Call callback
    if (this.onEventCallback) {
      this.onEventCallback(event);
    }
  }

  /**
   * Show notification for geofence event
   */
  private async showNotification(geofence: Geofence, eventType: 'EXIT' | 'ENTRY'): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    try {
      const isExit = eventType === 'EXIT';
      await LocalNotifications.schedule({
        notifications: [{
          id: NOTIFICATION_ID_BASE + parseInt(geofence.id.slice(-4)),
          title: isExit ? `🚨 Left ${geofence.name}` : `📍 Entered ${geofence.name}`,
          body: isExit 
            ? `Senior has left the ${geofence.name} area. Caregiver has been notified.`
            : `Senior has entered ${geofence.name}.`,
          schedule: { at: new Date(Date.now() + 500) },
          sound: isExit ? 'alert.wav' : 'notification.wav',
          smallIcon: 'ic_launcher',
          channelId: isExit ? 'critical_alerts' : 'location_updates',
        }]
      });
    } catch (error) {
      console.error('[Geofence] Failed to show notification:', error);
    }
  }

  /**
   * Set callback for geofence events
   */
  onEvent(callback: (event: GeofenceEvent) => void): void {
    this.onEventCallback = callback;
  }

  /**
   * Quick setup: Add home geofence at current location
   */
  async setupHomeGeofence(radius: number = 100): Promise<Geofence | null> {
    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
      });

      return await this.addGeofence({
        name: 'Home',
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        radius,
        type: 'home',
        alertOnExit: true,
        alertOnEntry: false,
        enabled: true,
      });
    } catch (error) {
      console.error('[Geofence] Failed to setup home:', error);
      return null;
    }
  }

  /**
   * Check if senior is currently at home
   */
  isAtHome(): boolean {
    const home = this.getHomeGeofence();
    if (!home || !this.lastPosition) return true; // Assume home if unknown

    return this.isInsideGeofence(
      this.lastPosition.lat,
      this.lastPosition.lng,
      home
    );
  }

  /**
   * Get distance from home
   */
  getDistanceFromHome(): number | null {
    const home = this.getHomeGeofence();
    if (!home || !this.lastPosition) return null;

    return this.calculateDistance(
      this.lastPosition.lat,
      this.lastPosition.lng,
      home.latitude,
      home.longitude
    );
  }
}

// Export singleton
export const geofenceService = new GeofenceService();

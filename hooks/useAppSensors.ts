import { useState, useEffect, useRef, useCallback } from 'react';
import { LocationData } from '../types';
import { Capacitor } from '@capacitor/core';
import { Geolocation, PermissionStatus as GeoPermissionStatus, Position as CapPosition } from '@capacitor/geolocation';
import { emitFallDetected } from '../services/fallDetection';

interface SensorConfig {
  isMonitoring: boolean; // Global master switch
  fallDetectionEnabled: boolean;
  locationEnabled: boolean;
  onFallDetected: () => void;
  onSOSTriggered: () => void;
}

export const useAppSensors = ({ 
  isMonitoring, 
  fallDetectionEnabled, 
  locationEnabled,
  onFallDetected, 
  onSOSTriggered 
}: SensorConfig) => {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [batteryLevel, setBatteryLevel] = useState<number>(100);
  const [isSupported, setIsSupported] = useState(false);
  
  // Refs to avoid stale closures in event listeners
  const locationRef = useRef<LocationData | null>(null);
  const volumePressCount = useRef(0);
  const lastVolumePressTime = useRef(0);
  
  // Rate limiting for Address API
  const lastAddressFetchTime = useRef<number>(0);
  const lastCoords = useRef<{lat: number, lng: number} | null>(null);

  // Sync ref with state
  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  // --- NEW: Helper to Request Permissions (Crucial for iOS 13+) ---
  const requestMotionPermission = async (): Promise<boolean> => {
    if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      try {
        const permissionState = await (DeviceMotionEvent as any).requestPermission();
        return permissionState === 'granted';
      } catch (e) {
        console.error("Motion permission request failed", e);
        return false;
      }
    }
    // For non-iOS 13+ devices, permission is usually auto-granted or managed by browser settings
    return true;
  };

  const requestLocationPermission = async (): Promise<boolean> => {
    try {
      if (Capacitor.isNativePlatform()) {
        const status: GeoPermissionStatus = await Geolocation.requestPermissions();
        return status.location === 'granted' || status.coarseLocation === 'granted';
      } else {
        // Browser: Permission is prompted by navigator.geolocation on first call
        return true;
      }
    } catch (e) {
      console.warn('Location permission request failed', e);
      return false;
    }
  };

  // Function to fetch Real Address from OpenStreetMap (Nominatim)
  const fetchRealAddress = async (lat: number, lng: number): Promise<string | null> => {
    try {
      // Skip geocoding on localhost to avoid CORS errors
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (isLocalhost) {
        return `${lat.toFixed(4)}, ${lng.toFixed(4)}`; // Just show coordinates in dev
      }
      
      // Rate Limit: Only fetch if 3 seconds passed (Nominatim requires 1 req/sec max)
      const now = Date.now();
      if (now - lastAddressFetchTime.current < 3000) {
        return null; // Return null to indicate "keep previous address"
      }
      
      lastAddressFetchTime.current = now;

      // Always use direct URL - no localhost proxy needed
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
      
      const response = await fetch(url, {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'SafeNestApp/1.0' // Required by Nominatim usage policy
        }
      });

      if (!response.ok) {
        console.warn(`Geocoding HTTP error: ${response.status}`);
        return null;
      }

      const data = await response.json();
      
      if (data.address) {
        const { amenity, shop, building, office, leisure, road, house_number, city, town, village, suburb, neighbourhood } = data.address;
        
        // Prioritize specific place names (Store, Mall, Building)
        const specificName = amenity || shop || building || office || leisure;
        const street = road ? `${house_number ? house_number + ' ' : ''}${road}` : '';
        const area = neighbourhood || suburb || village || town || city;

        // Construct the most relevant readable string
        if (specificName && street) return `${specificName}, ${street}`;
        if (specificName && area) return `${specificName}, ${area}`;
        if (specificName) return specificName;
        if (street && area) return `${street}, ${area}`;
        if (street) return street;
        
        // Fallback to display name parts if structured data is messy
        return data.display_name.split(',').slice(0, 2).join(',');
      }
      
      return null;
    } catch (error) {
      console.warn("Address lookup failed", error);
      return null;
    }
  };

  useEffect(() => {
    // --- Battery Status API ---
    const getBatteryStatus = async () => {
      try {
        if ('getBattery' in navigator) {
          const battery = await (navigator as any).getBattery();
          const updateBattery = () => {
            setBatteryLevel(Math.floor(battery.level * 100));
          };
          updateBattery();
          battery.addEventListener('levelchange', updateBattery);
          return () => {
            battery.removeEventListener('levelchange', updateBattery);
          };
        }
      } catch (e) {
        console.warn('Battery API not supported');
      }
    };
    getBatteryStatus();
  }, []);

  useEffect(() => {
    if (!isMonitoring || !locationEnabled) {
        if (!locationEnabled && locationRef.current?.address !== 'Location Sharing Off') {
             setLocation(prev => prev ? { ...prev, address: 'Location Sharing Off' } : null);
        }
        return;
    }

    // --- 1. Geolocation Tracking ---
    if (Capacitor.isNativePlatform()) {
      setIsSupported(true);

      let watchId: string | null = null;

      (async () => {
        const granted = await requestLocationPermission();
        if (!granted) {
          setLocation(prev => prev ? { ...prev, address: 'Location Access Denied' } : {
            lat: 0,
            lng: 0,
            address: 'Location Access Denied',
            updatedAt: new Date()
          });
          return;
        }

        watchId = await Geolocation.watchPosition({ enableHighAccuracy: true }, async (pos: CapPosition | null, err) => {
          if (err || !pos) {
            setLocation((prev) => ({
              lat: prev?.lat ?? 0,
              lng: prev?.lng ?? 0,
              address: 'GPS Signal Weak',
              updatedAt: new Date()
            }));
            return;
          }

          const { latitude, longitude } = pos.coords;
          let currentAddress = locationRef.current?.address || 'Locating...';
          if (currentAddress === 'Location Sharing Off' || currentAddress === 'Loading location...') currentAddress = 'Locating...';

          const dist = lastCoords.current ? Math.sqrt(
            Math.pow(latitude - lastCoords.current.lat, 2) +
            Math.pow(longitude - lastCoords.current.lng, 2)
          ) : 100;

          const isPlaceholder = currentAddress === 'Locating...' || currentAddress === 'Initializing GPS...' || currentAddress === 'GPS Signal Weak' || currentAddress === 'Loading location...';
          if (dist > 0.0002 || isPlaceholder) {
            const fetchedAddress = await fetchRealAddress(latitude, longitude);
            if (fetchedAddress) {
              currentAddress = fetchedAddress;
              lastCoords.current = { lat: latitude, lng: longitude };
            }
          }

          setLocation({
            lat: latitude,
            lng: longitude,
            address: currentAddress,
            updatedAt: new Date()
          });
        });
      })();

      return () => {
        if (watchId) Geolocation.clearWatch({ id: watchId });
      };

    } else if ('geolocation' in navigator) {
      setIsSupported(true);
      
      const success = async (position: GeolocationPosition) => {
        const { latitude, longitude } = position.coords;
        
        // Use ref to get the latest address without stale closure
        let currentAddress = locationRef.current?.address || "Locating...";
        if (currentAddress === 'Location Sharing Off' || currentAddress === 'Loading location...') currentAddress = "Locating...";

        // Distance check (approx 20 meters)
        const dist = lastCoords.current ? Math.sqrt(
            Math.pow(latitude - lastCoords.current.lat, 2) + 
            Math.pow(longitude - lastCoords.current.lng, 2)
        ) : 100;

        // Fetch if moved significantly OR if we don't have a real address yet
        const isPlaceholder = currentAddress === "Locating..." || currentAddress === "Initializing GPS..." || currentAddress === "GPS Signal Weak" || currentAddress === "Loading location...";
        
        if (dist > 0.0002 || isPlaceholder) {
            const fetchedAddress = await fetchRealAddress(latitude, longitude);
            
            // Only update address if we got a valid string back
            if (fetchedAddress) {
                currentAddress = fetchedAddress;
                lastCoords.current = { lat: latitude, lng: longitude };
            }
        }

        setLocation({
            lat: latitude,
            lng: longitude,
            address: currentAddress,
            updatedAt: new Date(),
          });
      };

      const error = (err: GeolocationPositionError) => {
          console.warn(`Geolocation Warning (${err.code}): ${err.message}`);
          // Don't overwrite existing good location with error unless it's critical
          setLocation((prev) => {
             const fallbackAddr = err.code === 1 ? 'Location Access Denied' : 'GPS Signal Weak';
             // If we already have a location, keep it but maybe show a toast (omitted for simplicity), 
             // or just update timestamp. Only show error if we have NO location.
             if (prev && prev.address !== 'Initializing GPS...' && prev.address !== 'Locating...') {
                 return { ...prev, updatedAt: new Date() }; 
             }
             return {
                lat: 37.7749,
                lng: -122.4194,
                address: fallbackAddr,
                updatedAt: new Date(),
             };
          });
      };

      const geoId = navigator.geolocation.watchPosition(
        success,
        error,
        { 
          enableHighAccuracy: true, 
          timeout: 20000, 
          maximumAge: 10000 
        }
      );
      return () => navigator.geolocation.clearWatch(geoId);
    } else {
        console.warn("Geolocation not supported");
    }
  }, [isMonitoring, locationEnabled]);

  // Memoize callbacks to prevent effect re-runs
  const memoizedOnFallDetected = useCallback(onFallDetected, []);
  const memoizedOnSOSTriggered = useCallback(onSOSTriggered, []);

  useEffect(() => {
    if (!isMonitoring || !fallDetectionEnabled) {
      console.log('[useAppSensors] Not monitoring fall detection');
      return;
    }

    console.log('[useAppSensors] Starting fall detection monitoring');

    // --- 2. Real Fall Detection (Accelerometer) ---
    // Detect actual falls: sudden high acceleration spike (impact)
    const IMPACT_THRESHOLD = 25; // High acceleration = impact
    const COOLDOWN_MS = 3000; // 3 second cooldown
    let lastFallTime = 0;
    let lastAccel = 0;
    let consecutiveHighAccel = 0;

    const handleMotion = (event: DeviceMotionEvent) => {
      if (!fallDetectionEnabled) return;

      const { x, y, z } = event.accelerationIncludingGravity || { x: 0, y: 0, z: 0 };
      if (x === null || x === undefined || y === null || y === undefined || z === null || z === undefined) return;

      const currentTime = Date.now();
      const totalAcceleration = Math.sqrt(x * x + y * y + z * z);
      
      // Log only when acceleration is high (potential fall)
      if (totalAcceleration > 20) {
        console.log('[Fall] High Accel:', totalAcceleration.toFixed(1));
      }
      
      // Count consecutive high acceleration readings (sign of impact/fall, not shaking)
      if (totalAcceleration > IMPACT_THRESHOLD) {
        consecutiveHighAccel++;
      } else {
        consecutiveHighAccel = 0;
      }
      
      // Real fall: need at least 2 consecutive high acceleration readings
      // This filters out single shakes but catches real impacts
      if (consecutiveHighAccel >= 2 && (currentTime - lastFallTime) > COOLDOWN_MS) {
        console.log('[Fall] ✅ REAL FALL DETECTED - Accel:', totalAcceleration.toFixed(1));
        lastFallTime = currentTime;
        consecutiveHighAccel = 0; // Reset counter
        emitFallDetected();
        memoizedOnFallDetected();
        
        if (typeof navigator.vibrate === 'function') {
          navigator.vibrate([200, 100, 200]); 
        }
      }
      lastAccel = totalAcceleration;
    };

    // --- 3. Hardware SOS (Volume Button) ---
    const handleKeyDown = (event: KeyboardEvent) => {
      if (['AudioVolumeUp', 'AudioVolumeDown', ' '].includes(event.key)) {
        const now = Date.now();
        if (now - lastVolumePressTime.current < 500) {
          volumePressCount.current += 1;
        } else {
          volumePressCount.current = 1;
        }
        lastVolumePressTime.current = now;

        if (volumePressCount.current >= 3) {
          if (typeof navigator.vibrate === 'function') {
             navigator.vibrate(200); 
          }
          memoizedOnSOSTriggered();
          volumePressCount.current = 0;
        }
      }
    };

    // Request motion permission first (important for iOS 13+)
    const requestPermission = async () => {
      if (typeof DeviceMotionEvent !== 'undefined' && typeof (DeviceMotionEvent as any).requestPermission === 'function') {
        try {
          const permission = await (DeviceMotionEvent as any).requestPermission();
          if (permission !== 'granted') {
            console.log('[useAppSensors] Motion permission denied');
            return;
          }
        } catch (e) {
          console.error('[useAppSensors] Permission request failed:', e);
          return;
        }
      }
      
      // Permission granted or not needed, attach listeners
      if (typeof DeviceMotionEvent !== 'undefined' && window.DeviceMotionEvent) {
        console.log('[useAppSensors] ✓ Attaching devicemotion listener');
        window.addEventListener('devicemotion', handleMotion, true);
      } else {
        console.warn('[useAppSensors] DeviceMotionEvent not supported');
      }
      window.addEventListener('keydown', handleKeyDown);
    };

    // Call async function immediately, return cleanup function
    requestPermission();

    // Return cleanup that removes listeners
    return () => {
      console.log('[useAppSensors] Cleaning up fall detection');
      window.removeEventListener('devicemotion', handleMotion as any, true);
      window.removeEventListener('keydown', handleKeyDown as any);
    };

  }, [isMonitoring, fallDetectionEnabled, memoizedOnFallDetected, memoizedOnSOSTriggered]);

  // Return the permission requester to be used in UI
  return { location, isSupported, batteryLevel, requestMotionPermission, requestLocationPermission };
};
import { useState, useEffect, useRef } from 'react';
import { LocationData } from '../types';
import { Capacitor } from '@capacitor/core';
import { Geolocation, PermissionStatus as GeoPermissionStatus, Position as CapPosition } from '@capacitor/geolocation';

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
      // Rate Limit: Only fetch if 1.5 seconds passed
      const now = Date.now();
      if (now - lastAddressFetchTime.current < 1500) {
        return null; // Return null to indicate "keep previous address"
      }
      
      lastAddressFetchTime.current = now;

      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'SafeNest-App/1.0',
            'Accept-Language': 'en'
          }
        }
      );

      if (!response.ok) throw new Error('Geocoding failed');

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
          if (currentAddress === 'Location Sharing Off') currentAddress = 'Locating...';

          const dist = lastCoords.current ? Math.sqrt(
            Math.pow(latitude - lastCoords.current.lat, 2) +
            Math.pow(longitude - lastCoords.current.lng, 2)
          ) : 100;

          const isPlaceholder = currentAddress === 'Locating...' || currentAddress === 'Initializing GPS...' || currentAddress === 'GPS Signal Weak';
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
        if (currentAddress === 'Location Sharing Off') currentAddress = "Locating...";

        // Distance check (approx 20 meters)
        const dist = lastCoords.current ? Math.sqrt(
            Math.pow(latitude - lastCoords.current.lat, 2) + 
            Math.pow(longitude - lastCoords.current.lng, 2)
        ) : 100;

        // Fetch if moved significantly OR if we don't have a real address yet
        const isPlaceholder = currentAddress === "Locating..." || currentAddress === "Initializing GPS..." || currentAddress === "GPS Signal Weak";
        
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

  useEffect(() => {
    if (!isMonitoring) return;

    // --- 2. Fall Detection (Accelerometer) ---
    // Threshold set to ~4G (Gravity is ~9.8). 
    // Jumping/Falling typically creates spikes > 40 m/s^2 upon impact.
    const IMPACT_THRESHOLD = 40; 
    const COOLDOWN_MS = 5000;
    let lastTime = 0;
    let lastAlertTime = 0;

    const handleMotion = (event: DeviceMotionEvent) => {
      if (!fallDetectionEnabled) return;

      const { x, y, z } = event.accelerationIncludingGravity || { x: 0, y: 0, z: 0 };
      if (!x || !y || !z) return;

      const currentTime = Date.now();
      if ((currentTime - lastTime) < 100) return; 
      lastTime = currentTime;

      const totalAcceleration = Math.sqrt(x * x + y * y + z * z);

      if (totalAcceleration > IMPACT_THRESHOLD) {
        // Enforce cooldown to prevent repeated alerts
        if (currentTime - lastAlertTime < COOLDOWN_MS) {
          return;
        }
        lastAlertTime = currentTime;
        console.log("Fall Impact Detected:", totalAcceleration);
        if (typeof navigator.vibrate === 'function') {
            navigator.vibrate([500, 200, 500, 200, 500]); 
        }
        onFallDetected();
      }
    };

    // --- 3. Hardware SOS (Volume Button Proxy) ---
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
          onSOSTriggered();
          volumePressCount.current = 0;
        }
      }
    };

    if (window.DeviceMotionEvent) {
      window.addEventListener('devicemotion', handleMotion);
    }
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('devicemotion', handleMotion);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMonitoring, fallDetectionEnabled, onFallDetected, onSOSTriggered]);

  // Return the permission requester to be used in UI
  return { location, isSupported, batteryLevel, requestMotionPermission, requestLocationPermission };
};
import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Phone, Navigation, Battery, Heart, Layers, Plus, CheckCircle, XCircle, Clock, LogOut, Map as MapIcon, Pill, Activity, Bell, Home, Settings, MapPin, Calendar, Droplets, Shield, Gauge, Smartphone, AlertCircle } from 'lucide-react';
import { SeniorStatus, ActivityItem, Reminder, HouseholdMember, UserRole, Medicine, MedicineLog, VitalReading, DoctorAppointment, Geofence, WaterSettings } from '../types';
import { BottomNav } from '../components/BottomNav';
import { MedicineManager } from './MedicineManager';
import { ComplianceAnalytics } from './ComplianceAnalytics';
import { CaregiverVitalsView } from './CaregiverVitalsView';
import { ManualVitalsEntry } from './ManualVitalsEntry';
import { DoctorAppointmentsView } from './DoctorAppointmentsView';
import { GeofenceView } from './GeofenceView';
import { ref, set, onValue } from 'firebase/database';
import { db } from '../services/firebase';

declare var L: any;

interface CaregiverDashboardProps {
  onBack: () => void;
  seniorStatus: SeniorStatus;
  isFitConnected?: boolean;
  stopAlert?: () => void;
  reminders: Reminder[];
  onAddReminder: (reminder: Reminder) => void;
  senior?: HouseholdMember;
  onSignOut?: () => void;
  onJoinAnotherHousehold?: () => void;
  householdId?: string;
  householdIds?: string[];
  onSwitchHousehold?: (householdId: string) => void;
  seniors?: { [householdId: string]: HouseholdMember };
  medicines?: Medicine[];
  medicineLogs?: MedicineLog[];
  onAddMedicine?: (medicine: Medicine) => void;
  onUpdateMedicine?: (medicine: Medicine) => void;
  onDeleteMedicine?: (medicineId: string) => void;
  vitalReadings?: VitalReading[];
  onAddVital?: (vital: Omit<VitalReading, 'id' | 'timestamp'>) => void;
  // Doctor Appointments
  doctorAppointments?: DoctorAppointment[];
  onAddAppointment?: (apt: DoctorAppointment) => void;
  onUpdateAppointment?: (apt: DoctorAppointment) => void;
  onDeleteAppointment?: (aptId: string) => void;
  // Water Settings (for senior)
  waterSettings?: WaterSettings;
  onUpdateWaterSettings?: (settings: WaterSettings) => void;
}

export const CaregiverDashboard: React.FC<CaregiverDashboardProps> = ({ 
    onBack, 
    seniorStatus, 
    isFitConnected = false,
    stopAlert,
    reminders,
    onAddReminder,
    senior,
    onSignOut,
    onJoinAnotherHousehold,
    householdId,
    householdIds = [],
    onSwitchHousehold,
    seniors = {},
    medicines = [],
    medicineLogs = [],
    onAddMedicine,
    onUpdateMedicine,
    onDeleteMedicine,
    vitalReadings = [],
    onAddVital,
    doctorAppointments = [],
    onAddAppointment,
    onUpdateAppointment,
    onDeleteAppointment,
    waterSettings,
    onUpdateWaterSettings
}) => {
  useEffect(() => {
    console.log('[CaregiverDashboard] onSignOut:', typeof onSignOut);
  }, [onSignOut]);

  const [activeTab, setActiveTab] = useState<'home' | 'map' | 'medicine' | 'vitals' | 'compliance' | 'settings' | 'appointments' | 'safezone'>('home');
  const [mapType, setMapType] = useState<'street' | 'satellite'>('street');
  const [selectedSeniorId, setSelectedSeniorId] = useState<string | null>(null);
  const [isResettingDevice, setIsResettingDevice] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState<{deviceName: string; loginTime: string; lastActive: string; phone: string} | null>(null);

  // Listen to connected device info from Firebase
  useEffect(() => {
    if (!householdId) return;
    
    const deviceRef = ref(db, `households/${householdId}/connectedDevice`);
    
    const unsub = onValue(deviceRef, (snapshot: any) => {
      if (snapshot.exists()) {
        setConnectedDevice(snapshot.val());
      } else {
        setConnectedDevice(null);
      }
    });
    
    return () => unsub();
  }, [householdId]);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const caregiverMarkerRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);

  const [caregiverLocation, setCaregiverLocation] = useState<{lat:number,lng:number}|null>(null);
  const caregiverWatchIdRef = useRef<number | null>(null);

  const isEmergency = seniorStatus.status !== 'Normal';

  const locationLabel = (() => {
    const loc = seniorStatus.location;
    if (!loc) return 'Locating...';
    const addr = loc.address || '';
    const placeholders = ['Locating...', 'Initializing GPS...', 'GPS Signal Weak'];
    if (!addr || placeholders.includes(addr)) {
      return 'Locating...';
    }
    return addr;
  })();

  // Helper to get latest vital reading
  const getLatestVital = (type: VitalReading['type']) => {
    const filtered = vitalReadings
      .filter(v => v.type === type)
      .sort((a, b) => {
        const dateA = a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp);
        const dateB = b.timestamp instanceof Date ? b.timestamp : new Date(b.timestamp);
        return dateB.getTime() - dateA.getTime();
      });
    return filtered[0];
  };

  // Get latest vitals for dashboard display
  const latestHR = getLatestVital('heartRate');
  const latestSpO2 = getLatestVital('spo2');
  const latestBP = getLatestVital('bloodPressure');
  const latestBG = getLatestVital('bloodSugar');

  const handleCallSenior = () => {
    if (stopAlert) stopAlert();
    if (!senior) return;
    window.open(`tel:${senior.phone.replace(/\D/g,'')}`, '_self');
  };

  // Reset/disconnect senior's device - allows them to login from a different device
  const handleResetDeviceAccess = async () => {
    if (!householdId) return;
    
    const confirmed = window.confirm(
      `Reset ${senior?.name || 'senior'}'s device access?\n\nThey will be able to log in from a different device.`
    );
    if (!confirmed) return;
    
    setIsResettingDevice(true);
    try {
      await set(ref(db, `households/${householdId}/connectedDevice`), null);
      alert('✅ Device access reset. Senior can now login from another device.');
      console.log('[CaregiverDashboard] Device access reset for household:', householdId);
    } catch (e) {
      console.error('[CaregiverDashboard] Failed to reset device access:', e);
      alert('❌ Failed to reset device access. Please try again.');
    } finally {
      setIsResettingDevice(false);
    }
  };

  // Open Google Maps directions (origin = caregiver location if available)
  const openInMaps = () => {
    if (!seniorStatus?.location) return;
    const destLat = seniorStatus.location.lat;
    const destLng = seniorStatus.location.lng;
    const destination = `${destLat},${destLng}`;
    const base = 'https://www.google.com/maps/dir/?api=1';
    let url = `${base}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
    if (caregiverLocation) {
      const origin = `${caregiverLocation.lat},${caregiverLocation.lng}`;
      url += `&origin=${encodeURIComponent(origin)}`;
    }
    // Open in new tab/window - on mobile this should open the Google Maps app
    window.open(url, '_blank');
  };

  // --- MAP INIT LOGIC (Existing) ---
  useEffect(() => {
    if (activeTab !== 'map') return;
    if (!mapContainerRef.current || typeof L === 'undefined') return;
    
    // Clear existing map instance and its DOM
    if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
    }
    
    // Clear the container
    if (mapContainerRef.current) {
        mapContainerRef.current.innerHTML = '';
    }
    
    // Initialize map with delay to ensure proper rendering
    const timer = setTimeout(() => {
        if (!mapContainerRef.current) return;
        
        try {
            // Validate senior location
            if (!seniorStatus?.location || typeof seniorStatus.location.lat !== 'number' || typeof seniorStatus.location.lng !== 'number') {
              console.warn('[MAP] No valid senior location, skipping map init');
              return;
            }

            console.log('[MAP] Initializing map...', {
                lat: seniorStatus.location.lat,
                lng: seniorStatus.location.lng,
                containerSize: mapContainerRef.current.getBoundingClientRect()
            });
            
            const map = L.map(mapContainerRef.current, { 
                zoomControl: false, 
                attributionControl: false 
            }).setView([seniorStatus.location.lat, seniorStatus.location.lng], 16);
            
            // Add street layer by default
            const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
                maxZoom: 19,
                attribution: ''
            }).addTo(map);
            
            // Create satellite layer (don't add yet)
            const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { 
                maxZoom: 19,
                attribution: ''
            });
            
            // Store layers
            (map as any).layers = { street: streetLayer, satellite: satelliteLayer };
            
            // Add senior marker
            const marker = L.marker([seniorStatus.location.lat, seniorStatus.location.lng], {title: 'Senior Location'}).addTo(map);
            markerRef.current = marker;

            // If we have caregiver location already, add caregiver marker
            if (caregiverLocation) {
              caregiverMarkerRef.current = L.marker([caregiverLocation.lat, caregiverLocation.lng], {title: 'You'}).addTo(map);
            }

            // Add empty route layer (GeoJSON) to draw route later
            routeLayerRef.current = L.geoJSON(null, { style: { color: '#2563eb', weight: 4, opacity: 0.9 } }).addTo(map);

            mapInstanceRef.current = map;
            
            // Trigger resize
            setTimeout(() => {
                map.invalidateSize();
            }, 100);
            
            console.log('[MAP] Map initialized successfully');
        } catch (error) {
            console.error('[MAP] Error initializing map:', error);
        }
    }, 100);
    
    // Cleanup
    return () => {
        clearTimeout(timer);
        if (mapInstanceRef.current) {
            mapInstanceRef.current.remove();
            mapInstanceRef.current = null;
            markerRef.current = null;
        }
    };
  }, [activeTab, seniorStatus.location.lat, seniorStatus.location.lng]);

  // Handle map type switching
  useEffect(() => {
    if (mapInstanceRef.current && (mapInstanceRef.current as any).layers) {
      const { street, satellite } = (mapInstanceRef.current as any).layers;
      if (mapType === 'street') {
        if (mapInstanceRef.current.hasLayer(satellite)) {
          mapInstanceRef.current.removeLayer(satellite);
        }
        if (!mapInstanceRef.current.hasLayer(street)) {
          mapInstanceRef.current.addLayer(street);
        }
      } else {
        if (mapInstanceRef.current.hasLayer(street)) {
          mapInstanceRef.current.removeLayer(street);
        }
        if (!mapInstanceRef.current.hasLayer(satellite)) {
          mapInstanceRef.current.addLayer(satellite);
        }
      }
    }
  }, [mapType]);

  // Watch caregiver location (browser geolocation) while map tab active
  useEffect(() => {
    if (activeTab !== 'map' || typeof navigator === 'undefined' || !('geolocation' in navigator)) return;

    // Start watching caregiver position
    const watchId = navigator.geolocation.watchPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      setCaregiverLocation({ lat: latitude, lng: longitude });
    }, (err) => {
      console.warn('[MAP] Caregiver geolocation error:', err.message);
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 });

    caregiverWatchIdRef.current = watchId;

    return () => {
      if (caregiverWatchIdRef.current !== null) navigator.geolocation.clearWatch(caregiverWatchIdRef.current as number);
      caregiverWatchIdRef.current = null;
    };
  }, [activeTab]);

  const displayHouseholdIds = (householdIds && householdIds.length > 0)
    ? householdIds
    : (householdId ? [householdId] : []);

  // Get all available seniors
  const allSeniors = Object.values(seniors || {});
  
  // Update markers and route whenever caregiver or senior locations change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Update senior marker
    if (markerRef.current) {
      markerRef.current.setLatLng([seniorStatus.location.lat, seniorStatus.location.lng]);
    } else {
      markerRef.current = L.marker([seniorStatus.location.lat, seniorStatus.location.lng], { title: 'Senior' }).addTo(map);
    }

    // Update caregiver marker
    if (caregiverLocation) {
      if (caregiverMarkerRef.current) {
        if (typeof caregiverMarkerRef.current.setLatLng === 'function') caregiverMarkerRef.current.setLatLng([caregiverLocation.lat, caregiverLocation.lng]);
        else caregiverMarkerRef.current = L.circleMarker([caregiverLocation.lat, caregiverLocation.lng], { radius:6, color:'#f97316', fillColor:'#fb923c', weight:2 }).addTo(map);
      } else {
        caregiverMarkerRef.current = L.circleMarker([caregiverLocation.lat, caregiverLocation.lng], { radius:6, color:'#f97316', fillColor:'#fb923c', weight:2 }).addTo(map);
      }
    }

    // If both locations available, fetch route from OSRM and draw it
    if (caregiverLocation && seniorStatus.location) {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${caregiverLocation.lng},${caregiverLocation.lat};${seniorStatus.location.lng},${seniorStatus.location.lat}?overview=full&geometries=geojson`;
      fetch(osrmUrl)
        .then(res => res.json())
        .then(data => {
          if (data && data.routes && data.routes[0] && data.routes[0].geometry) {
            const geo = data.routes[0].geometry;
            if (routeLayerRef.current) {
              routeLayerRef.current.clearLayers();
              routeLayerRef.current.addData(geo);
            } else {
              routeLayerRef.current = L.geoJSON(geo, { style: { color: '#2563eb', weight: 4, opacity: 0.9 } }).addTo(map);
            }
            // Fit bounds to show both points and route
            try {
              const bounds = L.geoJSON(geo).getBounds();
              map.fitBounds(bounds.pad ? bounds.pad(0.2) : bounds, { maxZoom: 16 });
            } catch (e) {
              console.warn('[MAP] Could not fit bounds to route:', e);
            }
          }
        })
        .catch(err => console.warn('[MAP] Route fetch failed:', err));
    }

  }, [caregiverLocation, seniorStatus.location]);

  // Show senior selection screen if multiple seniors and none selected
  if (allSeniors.length > 1 && !selectedSeniorId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Select Senior</h2>
            <p className="text-gray-600">Choose which senior you want to monitor</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {allSeniors.map((sen: HouseholdMember) => (
              <button
                key={sen.id}
                onClick={() => {
                  setSelectedSeniorId(sen.id);
                  if (onSwitchHousehold) {
                    // Find the household ID for this senior
                    const householdIdForSenior = Object.entries(seniors || {}).find(([_, s]) => (s as HouseholdMember).id === sen.id)?.[0];
                    if (householdIdForSenior) {
                      onSwitchHousehold(householdIdForSenior);
                    }
                  }
                }}
                className="p-6 bg-white rounded-2xl shadow-md hover:shadow-lg transition-all hover:scale-105 text-left border-2 border-transparent hover:border-blue-500"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    {sen.avatar ? (
                      <img src={sen.avatar} alt={sen.name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <span className="text-2xl font-bold text-blue-600">{sen.name?.[0]?.toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-lg font-bold text-gray-900">{sen.name}</p>
                    <p className="text-sm text-gray-500">{sen.phone}</p>
                  </div>
                  <div className="text-2xl">→</div>
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={() => onJoinAnotherHousehold?.()}
            className="w-full mt-6 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors"
          >
            + Add Another Senior
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white relative pb-6 w-full pt-[max(env(safe-area-inset-top),16px)]">
      
      {/* Header */}
            <div className={`shadow-sm px-4 py-4 flex items-center justify-between z-[50] bg-white flex-shrink-0`}>
            {/* Back Button / Senior Name */}
            <div className="flex-1 flex items-center gap-3">
              {allSeniors.length > 1 && (
                <button
                  onClick={() => setSelectedSeniorId(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Select different senior"
                >
                  <ArrowLeft size={20} className="text-gray-600" />
                </button>
              )}
              <div>
                <p className="text-sm font-bold text-gray-500 uppercase">Monitoring</p>
                <p className="text-lg font-bold text-gray-900">{senior?.name || 'Senior'}</p>
              </div>
            </div>
                <div className="flex items-center gap-2">
                        {onSignOut && (
                            <button 
                                onClick={onSignOut}
                                className="flex items-center gap-1 text-xs font-bold text-red-600 px-3 py-2 rounded-full bg-red-50 hover:bg-red-100 border border-red-100 shadow-sm transition-colors"
                            >
                                <LogOut size={16} />
                                Sign Out
                            </button>
                        )}
                </div>
      </div>

      {activeTab === 'home' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gradient-to-br from-blue-50/30 via-white to-purple-50/30">
            {/* Welcome Header */}
            <div className="mb-2">
              <h1 className="text-3xl font-bold text-gray-900 mb-1">Dashboard</h1>
              <p className="text-gray-600">Monitoring {senior?.name || 'Senior'}</p>
            </div>

            {/* Connected Device Info (with Quick Actions) */}
            {connectedDevice ? (
              <div className="bg-gradient-to-br from-green-50 to-white border-2 border-green-200 rounded-2xl p-5 space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Smartphone size={20} className="text-green-600" />
                    <h3 className="font-bold text-green-900">Device Connected</h3>
                    <span className="inline-block w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></span>
                  </div>
                  <p className="text-sm text-green-800 font-semibold">
                    Last active: {connectedDevice.lastActive ? new Date(connectedDevice.lastActive).toLocaleTimeString() : '—'}
                  </p>
                </div>
                
                {/* Quick Actions Grid - Below Device Card */}
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-green-200">
                  {senior && (
                    <button 
                      onClick={handleCallSenior}
                      className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-all flex items-center justify-center gap-2 shadow-md text-sm"
                    >
                      <Phone size={16} />
                      Call
                    </button>
                  )}
                  <button 
                    onClick={() => setActiveTab('medicine')}
                    className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-purple-700 transition-all flex items-center justify-center gap-2 shadow-md text-sm"
                  >
                    <Pill size={16} />
                    Medicines
                  </button>
                  <button 
                    onClick={() => setActiveTab('appointments')}
                    className="p-3 bg-gradient-to-br from-teal-500 to-teal-600 text-white rounded-lg font-semibold hover:from-teal-600 hover:to-teal-700 transition-all flex items-center justify-center gap-2 shadow-md text-sm"
                  >
                    <Calendar size={16} />
                    Appointments
                  </button>
                  <button 
                    onClick={() => setActiveTab('safezone')}
                    className="p-3 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg font-semibold hover:from-green-600 hover:to-green-700 transition-all flex items-center justify-center gap-2 shadow-md text-sm"
                  >
                    <Shield size={16} />
                    Safe Zone
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-5">
                <div className="flex items-center gap-3 text-gray-600">
                  <Smartphone size={20} className="text-gray-400" />
                  <p className="font-semibold text-gray-700">No Device Connected</p>
                </div>
              </div>
            )}

            {/* Emergency Status Banner */}
            {isEmergency && (
              <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-2xl p-6 shadow-lg animate-pulse">
                <div className="flex items-center justify-between text-white">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide opacity-90">Emergency Alert</p>
                    <p className="text-2xl font-bold mt-1">{seniorStatus.status}</p>
                    <p className="text-sm opacity-90 mt-2">{seniorStatus.location?.address || 'Location tracking...'}</p>
                  </div>
                  <Phone size={48} className="opacity-80" />
                </div>
                {senior && (
                  <button 
                    onClick={handleCallSenior}
                    className="w-full bg-white text-red-600 font-bold py-3 px-4 rounded-xl mt-4 hover:bg-gray-100 transition-colors shadow-md"
                  >
                    Call {senior.name.split(' ')[0]} Now
                  </button>
                )}
              </div>
            )}

            {/* Quick Stats Grid */}
            {senior && householdId && (
              <div className="grid grid-cols-2 gap-4">
                {/* Heart Rate Card */}
                <div className="bg-gradient-to-br from-red-50 to-white rounded-2xl p-5 shadow-sm border border-red-100">
                  <div className="flex items-center justify-between mb-3">
                    <Heart size={24} className="text-red-500" />
                    <span className={`w-2 h-2 rounded-full ${
                      latestHR && (latestHR.value as number) > 100 ? 'bg-red-500 animate-pulse' : 
                      latestHR && (latestHR.value as number) < 60 ? 'bg-yellow-500 animate-pulse' : 
                      'bg-green-500'
                    }`}></span>
                  </div>
                  <p className="text-sm font-semibold text-gray-600 mb-1">Heart Rate</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {latestHR ? Math.round(latestHR.value as number) : '--'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">bpm</p>
                </div>

                {/* Oxygen Level Card */}
                <div className="bg-gradient-to-br from-blue-50 to-white rounded-2xl p-5 shadow-sm border border-blue-100">
                  <div className="flex items-center justify-between mb-3">
                    <Activity size={24} className="text-blue-500" />
                    <span className={`w-2 h-2 rounded-full ${
                      latestSpO2 && (latestSpO2.value as number) < 95 ? 'bg-red-500 animate-pulse' : 
                      latestSpO2 && (latestSpO2.value as number) < 97 ? 'bg-yellow-500 animate-pulse' : 
                      'bg-green-500'
                    }`}></span>
                  </div>
                  <p className="text-sm font-semibold text-gray-600 mb-1">Oxygen</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {latestSpO2 ? Math.round(latestSpO2.value as number) : '--'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">SpO₂ %</p>
                </div>

                {/* Blood Pressure Card */}
                <div className="bg-gradient-to-br from-orange-50 to-white rounded-2xl p-5 shadow-sm border border-orange-100">
                  <div className="flex items-center justify-between mb-3">
                    <Gauge size={24} className="text-orange-500" />
                    <span className={`w-2 h-2 rounded-full ${
                      latestBP && (latestBP.value as {systolic: number}).systolic > 140 ? 'bg-red-500 animate-pulse' : 
                      latestBP && (latestBP.value as {systolic: number}).systolic > 130 ? 'bg-yellow-500 animate-pulse' : 
                      'bg-green-500'
                    }`}></span>
                  </div>
                  <p className="text-sm font-semibold text-gray-600 mb-1">Blood Pressure</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {latestBP 
                      ? `${(latestBP.value as {systolic: number; diastolic: number}).systolic}/${(latestBP.value as {systolic: number; diastolic: number}).diastolic}` 
                      : '--/--'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">mmHg</p>
                </div>

                {/* Blood Sugar Card */}
                <div className="bg-gradient-to-br from-pink-50 to-white rounded-2xl p-5 shadow-sm border border-pink-100">
                  <div className="flex items-center justify-between mb-3">
                    <Droplets size={24} className="text-pink-500" />
                    <span className={`w-2 h-2 rounded-full ${
                      latestBG && (latestBG.value as number) > 180 ? 'bg-red-500 animate-pulse' : 
                      latestBG && (latestBG.value as number) < 70 ? 'bg-red-500 animate-pulse' : 
                      latestBG && (latestBG.value as number) > 140 ? 'bg-yellow-500 animate-pulse' : 
                      'bg-green-500'
                    }`}></span>
                  </div>
                  <p className="text-sm font-semibold text-gray-600 mb-1">Blood Sugar</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {latestBG ? Math.round(latestBG.value as number) : '--'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">mg/dL</p>
                </div>

                {/* Status Card */}
                <div className={`bg-gradient-to-br ${isEmergency ? 'from-red-50 to-white border-red-100' : 'from-emerald-50 to-white border-emerald-100'} rounded-2xl p-5 shadow-sm border col-span-2`}>
                  <div className="flex items-center justify-between mb-3">
                    <CheckCircle size={24} className={isEmergency ? 'text-red-500' : 'text-emerald-500'} />
                    <span className={`w-2 h-2 rounded-full ${isEmergency ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                  </div>
                  <p className="text-sm font-semibold text-gray-600 mb-1">Status</p>
                  <p className={`text-xl font-bold ${isEmergency ? 'text-red-600' : 'text-emerald-600'}`}>
                    {seniorStatus?.status || 'Unknown'}
                  </p>
                </div>
              </div>
            )}

            {/* Location Card */}
            {senior && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-blue-50 rounded-xl">
                    <MapPin size={28} className="text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-600 mb-1">Current Location</p>
                    <p className="text-lg font-bold text-gray-900 mb-2">{seniorStatus?.location?.address || 'Updating location...'}</p>
                    <p className="text-xs text-gray-500">Last updated: {seniorStatus?.lastUpdate ? new Date(seniorStatus.lastUpdate).toLocaleTimeString() : 'N/A'}</p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('map')}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    View Map
                  </button>
                </div>
              </div>
            )}

            {/* Upcoming Medications */}
            {(reminders.length > 0 || medicines.length > 0) && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <Pill size={20} className="text-purple-600" />
                    Today's Medications
                  </h3>
                  <button 
                    onClick={() => setActiveTab('medicine')}
                    className="text-sm text-blue-600 font-semibold hover:text-blue-700"
                  >
                    View All
                  </button>
                </div>
                <div className="space-y-3">
                  {/* Show medicine reminders with real-time status from logs */}
                  {medicines.slice(0, 4).map((medicine) => {
                    const today = new Date().toDateString();
                    return medicine.times.map((time, timeIndex) => {
                      // Check if this medicine dose was taken/skipped/snoozed today
                      const log = medicineLogs.find(
                        (l) => {
                          const logDate = l.date instanceof Date ? l.date : new Date(l.date);
                          return l.medicineId === medicine.id && 
                                 logDate.toDateString() === today && 
                                 l.scheduledTime === time;
                        }
                      );
                      const status = log?.status || 'PENDING';
                      
                      // Check if overdue (past scheduled time and still pending)
                      const now = new Date();
                      const [hours, mins] = time.split(':').map(Number);
                      const scheduledTime = new Date();
                      scheduledTime.setHours(hours, mins, 0, 0);
                      const isPastTime = now > scheduledTime;
                      const isOverdue = status === 'PENDING' && isPastTime;
                      
                      return (
                        <div key={`${medicine.id}-${time}`} className={`flex items-center gap-4 p-4 rounded-xl border ${
                          status === 'MISSED' || isOverdue 
                            ? 'bg-gradient-to-r from-red-50 to-transparent border-red-100' 
                            : status === 'SNOOZED' 
                              ? 'bg-gradient-to-r from-purple-50 to-transparent border-purple-200'
                              : 'bg-gradient-to-r from-purple-50 to-transparent border-purple-100'
                        }`}>
                          <div className={`flex-shrink-0 w-16 h-16 rounded-xl flex flex-col items-center justify-center ${
                            status === 'MISSED' || isOverdue ? 'bg-red-100' : 'bg-purple-100'
                          }`}>
                            <p className={`text-lg font-bold ${status === 'MISSED' || isOverdue ? 'text-red-600' : 'text-purple-600'}`}>{time.split(':')[0]}</p>
                            <p className={`text-xs ${status === 'MISSED' || isOverdue ? 'text-red-600' : 'text-purple-600'}`}>{time.split(':')[1]}</p>
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-gray-900">{medicine.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{medicine.dosage}</p>
                            {medicine.isCritical && (
                              <span className="inline-block mt-1 px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-full">Critical</span>
                            )}
                          </div>
                          <div>
                            {status === 'TAKEN' && (
                              <div className="flex flex-col items-center gap-1">
                                <CheckCircle size={24} className="text-green-500" />
                                <span className="text-[10px] font-bold text-green-600">Taken</span>
                                {log?.actualTime && <span className="text-[9px] text-gray-500">{log.actualTime}</span>}
                              </div>
                            )}
                            {status === 'SKIPPED' && (
                              <div className="flex flex-col items-center gap-1">
                                <XCircle size={24} className="text-orange-500" />
                                <span className="text-[10px] font-bold text-orange-600">Skipped</span>
                              </div>
                            )}
                            {status === 'MISSED' && (
                              <div className="flex flex-col items-center gap-1">
                                <XCircle size={24} className="text-red-500" />
                                <span className="text-[10px] font-bold text-red-600">Missed</span>
                              </div>
                            )}
                            {status === 'SNOOZED' && (
                              <div className="flex flex-col items-center gap-1">
                                <Bell size={24} className="text-purple-500 animate-pulse" />
                                <span className="text-[10px] font-bold text-purple-600">Snoozed</span>
                                {log?.snoozedUntil && <span className="text-[9px] text-gray-500">{log.snoozedUntil}</span>}
                              </div>
                            )}
                            {status === 'PENDING' && !isOverdue && (
                              <div className="flex flex-col items-center gap-1">
                                <Clock size={24} className="text-gray-400" />
                                <span className="text-[10px] font-bold text-gray-500">Pending</span>
                              </div>
                            )}
                            {isOverdue && (
                              <div className="flex flex-col items-center gap-1">
                                <Clock size={24} className="text-red-500 animate-pulse" />
                                <span className="text-[10px] font-bold text-red-600">Overdue!</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    });
                  }).flat().slice(0, 4)}
                  
                  {/* Fallback to old reminders if no medicines */}
                  {medicines.length === 0 && reminders.slice(0, 4).map((reminder) => (
                    <div key={reminder.id} className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-transparent rounded-xl border border-purple-100">
                      <div className="flex-shrink-0 w-16 h-16 bg-purple-100 rounded-xl flex flex-col items-center justify-center">
                        <p className="text-lg font-bold text-purple-600">{reminder.time.split(':')[0]}</p>
                        <p className="text-xs text-purple-600">{reminder.time.split(':')[1]}</p>
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-gray-900">{reminder.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{reminder.instructions}</p>
                      </div>
                      <div>
                        {reminder.status === 'COMPLETED' && (
                          <div className="flex flex-col items-center gap-1">
                            <CheckCircle size={24} className="text-green-500" />
                            <span className="text-[10px] font-bold text-green-600">Taken</span>
                          </div>
                        )}
                        {reminder.status === 'PENDING' && (
                          <div className="flex flex-col items-center gap-1">
                            <Clock size={24} className="text-gray-400" />
                            <span className="text-[10px] font-bold text-gray-500">Pending</span>
                          </div>
                        )}
                        {reminder.status === 'SNOOZED' && (
                          <div className="flex flex-col items-center gap-1">
                            <Bell size={24} className="text-orange-500" />
                            <span className="text-[10px] font-bold text-orange-600">Snoozed</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Senior Info Card */}
            {senior && householdId && (
              <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 shadow-sm border border-gray-200">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    {senior.avatar ? (
                      <img src={senior.avatar} alt={senior.name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <span className="text-2xl font-bold text-blue-600">{senior.name?.[0]?.toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-600 mb-1">Monitoring</p>
                    <p className="text-xl font-bold text-gray-900">{senior.name}</p>
                    <p className="text-sm text-gray-500 mt-1">{senior.phone}</p>
                    <p className="text-xs text-gray-400 font-mono mt-1">Code: {householdId}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
      )}

      {/* CONTENT: MAP VIEW */}
      {activeTab === 'map' && (
          <div className="flex-1 relative overflow-hidden bg-white w-full">
            <div ref={mapContainerRef} className="absolute inset-0 w-full h-full outline-none z-0" />
            
            {/* Map Type Toggle Buttons */}
            <div className="absolute top-4 right-4 z-20 flex gap-2 items-center">
              <button 
                onClick={() => setMapType('street')}
                className={`p-2 rounded-full shadow-md transition-colors ${mapType === 'street' ? 'bg-blue-500 text-white' : 'bg-white/90 backdrop-blur-sm text-gray-700 hover:bg-white'}`}
                title="Territorial Map"
              >
                <MapIcon size={20} />
              </button>

              <button 
                onClick={() => setMapType('satellite')}
                className={`p-2 rounded-full shadow-md transition-colors ${mapType === 'satellite' ? 'bg-blue-500 text-white' : 'bg-white/90 backdrop-blur-sm text-gray-700 hover:bg-white'}`}
                title="Satellite Map"
              >
                <Layers size={20} />
              </button>

              {/* Center controls */}
              <button
                onClick={() => {
                  if (mapInstanceRef.current && seniorStatus?.location) {
                    mapInstanceRef.current.setView([seniorStatus.location.lat, seniorStatus.location.lng], 16);
                  }
                }}
                className="p-2 rounded-full shadow-md transition-colors bg-white/90 backdrop-blur-sm hover:bg-white text-gray-700"
                title="Center on senior"
              >
                <MapPin size={18} />
              </button>

              <button
                onClick={() => {
                  if (mapInstanceRef.current && caregiverLocation) {
                    mapInstanceRef.current.setView([caregiverLocation.lat, caregiverLocation.lng], 16);
                  }
                }}
                className="p-2 rounded-full shadow-md transition-colors bg-white/90 backdrop-blur-sm hover:bg-white text-gray-700"
                title="Center on me"
              >
                <Navigation size={18} />
              </button>

              <button
                onClick={openInMaps}
                className="p-2 rounded-full shadow-md transition-colors bg-white/90 backdrop-blur-sm hover:bg-white text-gray-700"
                title="Open in Google Maps"
              >
                <Navigation size={18} />
              </button>
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-[0_-5px_20px_rgba(0,0,0,0.1)] p-6 z-10">
                <div className="flex justify-between items-center gap-6">
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-2 ${isEmergency ? 'bg-red-100 text-red-700' : 'bg-green-50 text-green-700'} w-fit`}>
                            <div className={`w-2 h-2 rounded-full ${isEmergency ? 'bg-red-600 animate-pulse' : 'bg-green-500'}`}></div>
                            {isEmergency ? seniorStatus.status : 'Safe at Home'}
                        </div>
                        <h2 className="text-lg font-bold text-gray-900 line-clamp-2 break-words">{locationLabel}</h2>
                    </div>
                    <div className="flex flex-col items-end justify-center gap-2 flex-shrink-0">
                        <div className="flex items-center gap-1.5 text-gray-600 text-sm font-medium whitespace-nowrap"><Battery size={16} /> {seniorStatus.batteryLevel}%</div>
                        <div className="flex items-center gap-1.5 text-gray-600 text-sm font-medium whitespace-nowrap"><Heart size={16} /> {isFitConnected ? (seniorStatus.heartRate ? seniorStatus.heartRate + ' bpm' : '--') : 'Not loaded or connected'}</div>
                    </div>
                </div>
            </div>
          </div>
      )}

      {/* CONTENT: MEDICINE MANAGER */}
      {activeTab === 'medicine' && (
          <div className="flex-1 overflow-y-auto">
            {onAddMedicine && onUpdateMedicine && onDeleteMedicine && (
              <MedicineManager 
                medicines={medicines}
                onAddMedicine={onAddMedicine}
                onUpdateMedicine={onUpdateMedicine}
                onDeleteMedicine={onDeleteMedicine}
              />
            )}
          </div>
      )}

      {/* CONTENT: VITALS VIEW */}
      {activeTab === 'vitals' && (
          <CaregiverVitalsView 
            vitalReadings={vitalReadings || []}
            onAddVital={onAddVital || (() => {})}
          />
      )}

      {/* CONTENT: COMPLIANCE ANALYTICS */}
      {activeTab === 'compliance' && (
          <ComplianceAnalytics 
            medicines={medicines}
            medicineLogs={medicineLogs}
            vitalReadings={vitalReadings || []}
          />
      )}

      {/* CONTENT: DOCTOR APPOINTMENTS */}
      {activeTab === 'appointments' && (
          <DoctorAppointmentsView 
            appointments={doctorAppointments}
            onAddAppointment={onAddAppointment || (() => {})}
            onUpdateAppointment={onUpdateAppointment || (() => {})}
            onDeleteAppointment={onDeleteAppointment || (() => {})}
            onBack={() => setActiveTab('home')}
          />
      )}

      {/* CONTENT: SAFE ZONE / GEOFENCE */}
      {activeTab === 'safezone' && householdId && (
          <GeofenceView 
            householdId={householdId}
            onBack={() => setActiveTab('home')}
          />
      )}

      {/* CONTENT: SETTINGS VIEW */}
      {activeTab === 'settings' && (
          <div className="flex-1 p-6 overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Settings</h2>
            
            <div className="space-y-4">
              {/* Monitored Seniors with Household Codes */}
              {householdIds.length > 0 && (
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                  <h3 className="font-bold text-gray-900 mb-3">Monitored Seniors</h3>
                  <div className="space-y-2">
                    {householdIds.map(hId => (
                      <button
                        key={hId}
                        onClick={() => onSwitchHousehold?.(hId)}
                        className={`w-full p-3 rounded-lg text-left transition-colors ${
                          hId === householdId
                            ? 'bg-blue-100 border-2 border-blue-400'
                            : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <p className="font-semibold text-gray-900">{(seniors[hId] as HouseholdMember)?.name || 'Unknown Senior'}</p>
                        <p className="text-xs text-gray-500 font-mono mt-1">Code: {hId}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Join Another Household */}
              {onJoinAnotherHousehold && (
                <button 
                  onClick={onJoinAnotherHousehold}
                  className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between hover:bg-blue-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <Plus size={20} className="text-blue-600" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-gray-900">Join Another Household</p>
                      <p className="text-xs text-gray-500">Monitor multiple seniors</p>
                    </div>
                  </div>
                  <Heart size={20} className="text-gray-400" />
                </button>
              )}
              
              {/* Sign Out */}
              <div className="pt-4">
                {onSignOut && (
                  <button 
                    onClick={onSignOut}
                    className="w-full flex items-center justify-center gap-2 text-red-600 font-bold px-4 py-3 rounded-xl bg-red-50 hover:bg-red-100 border border-red-100 transition-colors"
                  >
                    <LogOut size={20} />
                    Sign Out
                  </button>
                )}
              </div>
            </div>
          </div>
      )}

      {/* Bottom Navigation */}
      <BottomNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          customItems={[
            { id: 'home', icon: Home, label: 'Home' },
            { id: 'map', icon: MapIcon, label: 'Location' },
            { id: 'medicine', icon: Pill, label: 'Medicines' },
            { id: 'vitals', icon: Heart, label: 'Vitals' },
            { id: 'compliance', icon: Activity, label: 'Compliance' },
            { id: 'settings', icon: Settings, label: 'Settings' }
          ]}
        />

    </div>
  );
};
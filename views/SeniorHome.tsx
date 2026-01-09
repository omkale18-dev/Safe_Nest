import React, { useEffect, useRef, useState } from 'react';
import { Heart, Activity, MapPin, Zap, LogOut, Mic, Pill, AlertCircle, Plus, Thermometer, Gauge, Check, Clock } from 'lucide-react';
import { SeniorStatus, UserProfile, Medicine, MedicineLog, VitalReading } from '../types';
import { ManualVitalsEntry } from './ManualVitalsEntry';
import { useLanguage } from '../i18n/LanguageContext';

declare var L: any;

interface SeniorHomeProps {
  status: SeniorStatus;
  isFitConnected?: boolean;
  userProfile: UserProfile;
  onSignOut?: () => void;
  householdId?: string;
  onSOSClick: () => void;
  onFallSimulation: () => void;
  onEditProfile: () => void;
  onToggleFallDetection: (enabled: boolean) => void;
  onToggleLocation: (enabled: boolean) => void;
  onToggleVoiceEmergency?: (enabled: boolean) => void;
  isVoiceEmergencyEnabled?: boolean;
  medicines?: Medicine[];
  medicineLogs?: MedicineLog[];
  onMarkTaken?: (medicineId: string, scheduledTime: string) => void;
  onSkipMedicine?: (medicineId: string, scheduledTime: string) => void;
  vitalReadings?: VitalReading[];
  onAddVital?: (vital: Omit<VitalReading, 'id' | 'timestamp'>) => void;
}

export const SeniorHome: React.FC<SeniorHomeProps> = ({ 
  status, 
  isFitConnected = false,
  userProfile, 
  onSignOut,
  householdId,
  onSOSClick, 
  onFallSimulation, 
  onEditProfile,
  onToggleFallDetection,
  onToggleLocation,
  onToggleVoiceEmergency,
  isVoiceEmergencyEnabled = false,
  medicines = [],
  medicineLogs = [],
  onMarkTaken,
  onSkipMedicine,
  vitalReadings = [],
  onAddVital
}) => {
  const { t } = useLanguage();
  const [showVitalsEntry, setShowVitalsEntry] = useState(false);
  const [nextVitalsAvailable, setNextVitalsAvailable] = useState<Date | null>(null);
  const [isVitalsLocked, setIsVitalsLocked] = useState(false);
  
  // Get latest vital reading of a specific type
  const getLatestVital = (type: 'bloodPressure' | 'temperature' | 'weight' | 'heartRate') => {
    const filtered = vitalReadings
      .filter(v => v.type === type && v.source === 'manual')
      .sort((a, b) => {
        const dateA = a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp);
        const dateB = b.timestamp instanceof Date ? b.timestamp : new Date(b.timestamp);
        return dateB.getTime() - dateA.getTime();
      });
    return filtered[0];
  };

  const latestBP = getLatestVital('bloodPressure');
  const latestTemp = getLatestVital('temperature');
  const latestWeight = getLatestVital('weight');
  const latestHR = getLatestVital('heartRate');

  const formatTimestamp = (timestamp: Date | string) => {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} mins ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const checkVitalsLockStatus = () => {
    if (!householdId) return;
    
    // Use household-specific key for senior-specific cooldown
    const lastEntryKey = `vitalsLastCompletedEntry_${householdId}`;
    const lastEntryStr = localStorage.getItem(lastEntryKey);
    
    if (lastEntryStr) {
      const lastEntry = new Date(lastEntryStr);
      const nextDate = new Date(lastEntry.getTime() + 7 * 24 * 60 * 60 * 1000);
      const now = new Date();
      
      if (now < nextDate) {
        setNextVitalsAvailable(nextDate);
        setIsVitalsLocked(true);
      } else {
        // Clear all lock-related data when 7 days have passed
        localStorage.removeItem(lastEntryKey);
        localStorage.removeItem(`vitalEntryTracker_${householdId}`);
        setNextVitalsAvailable(null);
        setIsVitalsLocked(false);
      }
    }
  };

  const checkAllFourVitalsEntered = () => {
    const tracker = localStorage.getItem('vitalEntryTracker');
    
    if (!tracker) return false;
    
    try {
      const enteredVitals = JSON.parse(tracker);
      const hasAllFour = 
        enteredVitals.bloodPressure && 
        enteredVitals.temperature && 
        enteredVitals.weight && 
        enteredVitals.heartRate;
      
      return hasAllFour;
    } catch {
      return false;
    }
  };

  const scheduleVitalsNotification = (availableDate: Date) => {
    const now = new Date();
    const timeUntilAvailable = availableDate.getTime() - now.getTime();
    
    if (timeUntilAvailable > 0 && 'Notification' in window && Notification.permission === 'granted') {
      setTimeout(() => {
        new Notification('Vitals Entry Available', {
          body: 'You can now enter your vital readings again!',
          tag: 'vitals-available',
          icon: '❤️'
        });
      }, timeUntilAvailable);
    }
  };

  const handleSaveVital = (vital: Omit<VitalReading, 'id' | 'timestamp'>) => {
    if (onAddVital && householdId) {
      onAddVital(vital);
      
      // Store entry in localStorage for tracking (household-specific)
      const today = new Date().toDateString();
      const storedKey = `vitals_entered_${householdId}_${today}`;
      const storedEntered = JSON.parse(localStorage.getItem(storedKey) || '[]') as string[];
      if (!storedEntered.includes(vital.type)) {
        storedEntered.push(vital.type);
      }
      localStorage.setItem(storedKey, JSON.stringify(storedEntered));
      
      // Check if all 4 vitals are now entered today
      if (storedEntered.length === 4) {
        // All 4 entered, now lock for 7 days
        const now = new Date();
        const nextAvailable = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        
        localStorage.setItem(`vitalsLastCompletedEntry_${householdId}`, now.toISOString());
        
        setNextVitalsAvailable(nextAvailable);
        setIsVitalsLocked(true);
        
        scheduleVitalsNotification(nextAvailable);
      }
    }
    setShowVitalsEntry(false);
  };
  
  useEffect(() => {
    console.log('[SeniorHome] onSignOut:', typeof onSignOut);
  }, [onSignOut]);

  // Check vitals lock status on mount and when vitalReadings or householdId change
  useEffect(() => {
    checkVitalsLockStatus();
  }, [vitalReadings, householdId]);

  // Check vitals lock status periodically (every minute)
  useEffect(() => {
    const interval = setInterval(() => {
      checkVitalsLockStatus();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const miniMarkerRef = useRef<any>(null);

  // Initialize Mini Map with robust guards and updates
  useEffect(() => {
    // If location sharing disabled -> destroy map
    if (!status.isLocationSharingEnabled) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        miniMarkerRef.current = null;
      }
      return;
    }

    // Require valid coords before initializing
    if (!status.location || typeof status.location.lat !== 'number' || typeof status.location.lng !== 'number') {
      console.warn('[SeniorHome] Waiting for valid location to initialize mini map');
      return;
    }

    // Wait until container has a size
    if (!mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      // retry shortly
      const retry = setTimeout(() => {
        if (mapRef.current) {
          // trigger effect by doing nothing (status.location will likely update and re-run effect)
          // but also attempt initialization directly if possible
          if (!mapInstanceRef.current && status.location && typeof status.location.lat === 'number') {
            initMiniMap();
          }
        }
      }, 200);
      return () => clearTimeout(retry);
    }

    const initMiniMap = () => {
      if (mapInstanceRef.current) return;

      try {
        const map = L.map(mapRef.current, {
            zoomControl: false,
            attributionControl: false,
            dragging: false,
            touchZoom: false,
            scrollWheelZoom: false,
            doubleClickZoom: false,
            boxZoom: false,
            keyboard: false
        }).setView([status.location.lat, status.location.lng], 15);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
        }).addTo(map);

        miniMarkerRef.current = L.circleMarker([status.location.lat, status.location.lng], {
            radius: 8,
            fillColor: "#3B82F6",
            color: "#fff",
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(map);

        mapInstanceRef.current = map;
      } catch (e) {
        console.error('[SeniorHome] Mini map init failed:', e);
      }
    };

    // If not yet initialized, init it
    if (!mapInstanceRef.current) {
      initMiniMap();
      return;
    }

    // If map exists, update center and marker
    try {
      mapInstanceRef.current.setView([status.location.lat, status.location.lng], 15);
      if (miniMarkerRef.current) {
        miniMarkerRef.current.setLatLng([status.location.lat, status.location.lng]);
      }
    } catch (e) {
      console.error('[SeniorHome] Error updating mini map position:', e);
    }

  }, [status.location, status.isLocationSharingEnabled]);

  return (
    <div className="pb-24 pt-4 px-4 space-y-6 animate-fade-in">
      {/* Header - Clickable for Profile Edit */}
      <div 
        className="flex justify-between items-center cursor-pointer active:opacity-70 transition-opacity"
        onClick={onEditProfile}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
             <img src={userProfile.avatar} alt="Profile" className="w-12 h-12 rounded-full border-2 border-white shadow-sm object-cover" />
             <div className="absolute bottom-0 right-0 w-3 h-3 bg-white rounded-full flex items-center justify-center">
                 <svg className="w-2 h-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
             </div>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{t.hello}, {userProfile.name.split(' ')[0]}</h1>
            <p className="text-xs font-medium text-gray-500">{t.editProfile}</p>
          </div>
        </div>
        {onSignOut && (
          <button 
            onClick={(e) => { e.stopPropagation(); onSignOut(); }}
            className="flex items-center gap-1 text-xs font-bold text-red-600 px-3 py-2 rounded-full bg-red-50 hover:bg-red-100 border border-red-100 shadow-sm transition-colors"
          >
            <LogOut size={16} />
            <span className="font-semibold">{t.signOut}</span>
          </button>
        )}
      </div>

      {householdId && (
        <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 shadow-sm w-fit">
          {t.householdCode}: <span className="font-extrabold tracking-wide">{householdId}</span>
        </div>
      )}

      {/* SOS Button */}
      <div className="flex justify-center py-6">
        <button
          onClick={onSOSClick}
          className="relative group w-64 h-64 rounded-full flex flex-col items-center justify-center transition-transform active:scale-95"
        >
          {/* Pulsing rings */}
          <div className="absolute inset-0 bg-red-500 rounded-full opacity-10 animate-ping-slow"></div>
          <div className="absolute inset-4 bg-red-500 rounded-full opacity-20"></div>
          
          {/* Main Button */}
          <div className="absolute inset-8 bg-gradient-to-br from-red-500 to-red-600 rounded-full shadow-xl flex flex-col items-center justify-center border-4 border-red-400">
            <span className="text-5xl font-extrabold text-white tracking-widest mb-1">{t.sos}</span>
            <span className="text-lg font-bold text-white/90">{t.help}</span>
          </div>
        </button>
      </div>

      <div className="text-center">
           <p className="text-xs font-normal text-gray-500">{t.caregiverNotified}</p>
        <div className="mt-2 text-[10px] text-gray-400">
             <button onClick={onFallSimulation} className="underline hover:text-gray-600 font-semibold">{t.simulateFall}</button>
        </div>
      </div>

      {/* Vitals */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity size={20} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">{t.myVitals}</h2>
          </div>
          {onAddVital && (
            <button
              onClick={() => setShowVitalsEntry(true)}
              disabled={isVitalsLocked}
              className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${
                isVitalsLocked
                  ? 'text-gray-400 bg-gray-50 border-gray-200 cursor-not-allowed opacity-60'
                  : 'text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-200'
              }`}
              title={isVitalsLocked ? 'Vitals locked. Next entry available in 7 days.' : 'Add vital reading'}
            >
              <Plus size={14} />
              <span>Add</span>
            </button>
          )}
        </div>
        {isVitalsLocked && nextVitalsAvailable && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-start gap-3">
            <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">Next Entry Available</p>
              <p className="text-xs text-amber-700 mt-1">
                {nextVitalsAvailable.toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
              <p className="text-xs text-amber-600 mt-1">You can re-enter vitals on this date</p>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
        </div>

        {/* Manual Vital Readings */}
        <div className="mt-4 space-y-4">
          {/* Blood Pressure Card */}
          {latestBP && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center">
                    <Gauge className="text-orange-500" size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">Blood Pressure</h3>
                    <p className="text-gray-500 text-xs">{formatTimestamp(latestBP.timestamp)}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                  (latestBP.value as { systolic: number }).systolic > 140 
                    ? 'bg-red-100 text-red-700' 
                    : 'bg-green-100 text-green-700'
                }`}>
                  {(latestBP.value as { systolic: number }).systolic > 140 ? 'Elevated' : 'Normal'}
                </span>
              </div>
              <div className="flex items-end gap-1">
                <span className="text-4xl font-bold text-gray-900">
                  {`${(latestBP.value as { systolic: number; diastolic: number }).systolic}/${(latestBP.value as { systolic: number; diastolic: number }).diastolic}`}
                </span>
                <span className="text-gray-500 font-semibold mb-1">mmHg</span>
              </div>
              {latestBP.notes && <p className="text-xs text-gray-600 mt-2">{latestBP.notes}</p>}
            </div>
          )}

          {/* Heart Rate Card */}
          {latestHR && (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center">
                    <Heart className="text-red-500" size={20} fill="currentColor" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">Heart Rate (Manual)</h3>
                    <p className="text-gray-500 text-xs">{formatTimestamp(latestHR.timestamp)}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                  (latestHR.value as number) < 60 || (latestHR.value as number) > 100
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-green-100 text-green-700'
                }`}>
                  {(latestHR.value as number) < 60 || (latestHR.value as number) > 100 ? 'Abnormal' : 'Normal'}
                </span>
              </div>
              <div className="flex items-end gap-1">
                <span className="text-4xl font-bold text-gray-900">{Math.round(latestHR.value as number)}</span>
                <span className="text-gray-500 font-semibold mb-1">bpm</span>
              </div>
              {latestHR.notes && <p className="text-xs text-gray-600 mt-2">{latestHR.notes}</p>}
            </div>
          )}
        </div>
      </div>

      {/* Safety Status Card */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 bg-blue-600 rounded-sm flex items-center justify-center">
            <div className="w-2 h-2 bg-white rounded-full"></div>
          </div>
          <h2 className="text-lg font-semibold text-gray-900">{t.safetyStatus}</h2>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
          
          {/* Fall Detection Toggle */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                 <Zap className="text-green-600" size={20} fill="currentColor" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{t.fallDetection}</h3>
                <p className="text-xs font-normal text-gray-500">{t.accelerometer} {status.isFallDetectionEnabled ? t.active : t.off}</p>
              </div>
            </div>
            <button 
                onClick={() => onToggleFallDetection(!status.isFallDetectionEnabled)}
                className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${status.isFallDetectionEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
            >
                <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${status.isFallDetectionEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
            </button>
          </div>
          
          {/* Voice Emergency Toggle */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Mic className="text-purple-600" size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Voice Emergency</h3>
                <p className="text-xs font-normal text-gray-500">Detects shouts/loud sounds - {isVoiceEmergencyEnabled ? t.active : t.off}</p>
              </div>
            </div>
            <button 
                onClick={() => onToggleVoiceEmergency?.(!isVoiceEmergencyEnabled)}
                className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${isVoiceEmergencyEnabled ? 'bg-purple-500' : 'bg-gray-300'}`}
            >
                <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${isVoiceEmergencyEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
            </button>
          </div>
          
          {/* Location Toggle */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                 <MapPin size={20} className="text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{t.location}</h3>
                <p className="text-xs font-normal text-gray-500">{t.sharing} {status.isLocationSharingEnabled ? t.on : t.off}</p>
              </div>
            </div>
            <button 
                onClick={() => onToggleLocation(!status.isLocationSharingEnabled)}
                className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${status.isLocationSharingEnabled ? 'bg-blue-500' : 'bg-gray-300'}`}
            >
                <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${status.isLocationSharingEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
            </button>
          </div>

          {/* Live Mini Map */}
          <div className="bg-gray-100 h-40 w-full relative">
              {status.isLocationSharingEnabled ? (
                  <>
                    <div ref={mapRef} className="w-full h-full z-0" />
                    <div className="absolute bottom-2 left-2 right-2 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-sm flex items-center gap-2 z-[10]">
                        <MapPin size={14} className="text-blue-600" />
                        <span className="text-xs font-semibold text-gray-800 truncate">
                            {status.location.address || t.locating}
                        </span>
                    </div>
                  </>
              ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gray-200 text-gray-400">
                      <MapPin size={32} className="mb-2 opacity-50" />
                      <span className="text-sm font-semibold">{t.locationSharingPaused}</span>
                  </div>
              )}
          </div>
        </div>
      </div>

      {/* Today's Medicine Section */}
      {medicines.length > 0 && (() => {
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
        
        const todaysMeds: Array<{
          medicine: Medicine;
          time: string;
          status: 'TAKEN' | 'PENDING';
        }> = [];

        medicines.forEach((medicine) => {
          // Check if medicine is active today
          const startDate = new Date(medicine.startDate);
          const startMidnight = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
          
          if (todayStart < startMidnight) return; // Not started yet
          
          // Check if medicine is ongoing or has no end date
          const isActive = medicine.isOngoing === true || !medicine.endDate;
          
          if (!isActive && medicine.endDate) {
            const endDate = new Date(medicine.endDate);
            const endMidnight = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime();
            if (todayStart > endMidnight) return; // Already ended
          }

          // Check each scheduled time
          medicine.times.forEach((time) => {
            const log = medicineLogs?.find((l) => {
              const logDate = l.date instanceof Date ? l.date : new Date(l.date);
              const logMidnight = new Date(logDate.getFullYear(), logDate.getMonth(), logDate.getDate()).getTime();
              const normalizeTime = (t: string) => {
                const parts = t.split(':').map(s => parseInt(s, 10));
                if (parts.length < 2) return t.trim();
                return `${parts[0].toString().padStart(2,'0')}:${parts[1].toString().padStart(2,'0')}`;
              };
              return (
                l.medicineId === medicine.id &&
                logMidnight === todayStart &&
                normalizeTime(l.scheduledTime || '') === normalizeTime(time) &&
                l.status === 'TAKEN'
              );
            });

            todaysMeds.push({
              medicine,
              time,
              status: log ? 'TAKEN' : 'PENDING'
            });
          });
        });

        const pendingMedicines = todaysMeds.filter(m => m.status === 'PENDING');
        const completedMedicines = todaysMeds.filter(m => m.status === 'TAKEN');

        return (
          <div className="mt-6 space-y-6">
            {/* Upcoming Medicines Today */}
            <div>
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Upcoming Today</h2>
              <div className="space-y-3">
                {pendingMedicines.length === 0 && (
                  <p className="text-gray-400 text-sm italic">No upcoming medications for today.</p>
                )}
                {pendingMedicines.map((item, idx) => (
                  <div key={`${item.medicine.id}-${item.time}-${idx}`} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-sm">
                        {item.time}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">{item.medicine.name}</h3>
                        <p className="text-xs text-gray-500">{item.medicine.dosage}</p>
                        {item.medicine.instructions && (
                          <p className="text-xs text-gray-400 mt-1">{item.medicine.instructions}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Completed Medicines Today */}
            <div>
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Completed Today</h2>
              <div className="space-y-3 opacity-60">
                {completedMedicines.length === 0 && (
                  <p className="text-gray-400 text-sm italic">No medicines taken yet today.</p>
                )}
                {completedMedicines.map((item, idx) => (
                  <div key={`completed-${item.medicine.id}-${item.time}-${idx}`} className="bg-gray-100 p-4 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                        <Check size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-600 line-through">{item.medicine.name}</h3>
                        <p className="text-xs text-gray-400">{item.medicine.dosage} • Taken at {item.time}</p>
                        {item.medicine.instructions && (
                          <p className="text-xs text-gray-400 mt-1">{item.medicine.instructions}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Manual Vitals Entry Modal */}
      {showVitalsEntry && onAddVital && (
        <ManualVitalsEntry
          onSave={handleSaveVital}
          onClose={() => setShowVitalsEntry(false)}
          enteredBy="senior"
        />
      )}
    </div>
  );
};
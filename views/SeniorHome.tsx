import React, { useEffect, useRef, useState } from 'react';
import { Heart, Activity, MapPin, Zap, LogOut, Mic, Pill, AlertCircle, Droplets } from 'lucide-react';
import { SeniorStatus, UserProfile, Medicine, MedicineLog, DoctorAppointment } from '../types';
import { MedicineReminders } from './MedicineReminders';
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
  onSnoozeMedicine?: (medicineId: string, scheduledTime: string, snoozeUntil: string) => void;
  // Water tracker
  onOpenWaterTracker?: () => void;
  // Upcoming appointments (read-only)
  upcomingAppointments?: DoctorAppointment[];
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
  onSnoozeMedicine,
  onOpenWaterTracker,
  upcomingAppointments = []
}) => {
  const { t } = useLanguage();
  
  useEffect(() => {
    console.log('[SeniorHome] onSignOut:', typeof onSignOut);
  }, [onSignOut]);

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
        <div className="flex items-center gap-2 mb-3">
          <Activity size={20} className="text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">{t.myVitals}</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {/* Heart Rate Card */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start mb-2">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                <Heart size={20} className="text-red-500" fill="currentColor" />
              </div>
              {isFitConnected && status.heartRate && (
                <span className="text-[10px] font-semibold text-green-600 uppercase bg-green-50 px-2 py-0.5 rounded-full">{t.normal}</span>
              )}
            </div>
            <div>
              {isFitConnected ? (
                <>
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-bold text-gray-900">{status.heartRate ?? '--'}</span>
                    <span className="text-sm font-medium text-gray-500 mb-1">{t.bpm}</span>
                  </div>
                  <p className="text-xs font-medium text-gray-400 mt-1">Heart Rate</p>
                </>
              ) : (
                <div className="text-center py-2">
                  <div className="text-2xl font-bold text-gray-300 mb-1">--</div>
                  <p className="text-[10px] font-semibold text-gray-400">Connect smartwatch</p>
                </div>
              )}
            </div>
          </div>
          
          {/* SpO2 Card */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start mb-2">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                <div className="text-blue-500 font-bold text-lg">O₂</div>
              </div>
              {isFitConnected && status.spo2 && (
                <span className="text-[10px] font-semibold text-green-600 uppercase bg-green-50 px-2 py-0.5 rounded-full">{t.good}</span>
              )}
            </div>
            <div>
              {isFitConnected ? (
                <>
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-bold text-gray-900">{status.spo2 ?? '--'}</span>
                    <span className="text-sm font-medium text-gray-500 mb-1">%</span>
                  </div>
                  <p className="text-xs font-medium text-gray-400 mt-1">Blood Oxygen</p>
                </>
              ) : (
                <div className="text-center py-2">
                  <div className="text-2xl font-bold text-gray-300 mb-1">--</div>
                  <p className="text-[10px] font-semibold text-gray-400">Connect smartwatch</p>
                </div>
              )}
            </div>
          </div>
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

      {/* Upcoming Appointments (Read-only for Senior) */}
      {upcomingAppointments.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">📅 {t.upcomingAppointments}</h2>
          <div className="space-y-2">
            {upcomingAppointments.slice(0, 3).map((apt) => {
              const aptDate = apt.date instanceof Date ? apt.date : new Date(apt.date);
              const isToday = aptDate.toDateString() === new Date().toDateString();
              const isTomorrow = aptDate.toDateString() === new Date(Date.now() + 86400000).toDateString();
              
              return (
                <div key={apt.id} className={`bg-white rounded-xl p-4 shadow-sm border ${isToday ? 'border-red-200 bg-red-50' : 'border-gray-100'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-gray-900">{apt.doctorName}</p>
                      <p className="text-sm text-gray-500">{apt.specialty}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${isToday ? 'text-red-600' : 'text-blue-600'}`}>
                        {isToday ? t.today : isTomorrow ? t.tomorrow : aptDate.toLocaleDateString()}
                      </p>
                      <p className="text-sm text-gray-600">{apt.time}</p>
                    </div>
                  </div>
                  {apt.address && (
                    <p className="text-xs text-gray-400 mt-2">📍 {apt.address}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Water Intake Quick Log */}
      {onOpenWaterTracker && (
        <div className="mt-6">
          <button
            onClick={onOpenWaterTracker}
            className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl p-4 shadow-lg flex items-center justify-between active:scale-98 transition-transform"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <Droplets size={24} className="text-white" />
              </div>
              <div className="text-left">
                <p className="text-white font-bold text-lg">{t.logWaterIntake}</p>
                <p className="text-white/80 text-sm">{t.stayHydrated}</p>
              </div>
            </div>
            <div className="text-white/90 text-2xl">💧</div>
          </button>
        </div>
      )}

      {/* Medicine Reminder Card - Direct Actions */}
      {medicines.length > 0 && (
        <div className="mt-6">
          <MedicineReminders
            medicines={medicines}
            medicineLogs={medicineLogs || []}
            onMarkTaken={onMarkTaken || (() => {})}
            onSkip={onSkipMedicine || (() => {})}
            onSnooze={onSnoozeMedicine}
          />
        </div>
      )}
    </div>
  );
};
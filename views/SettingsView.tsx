import React, { useState, useEffect, useRef } from 'react';
import { Bell, Shield, Navigation, Mic, Activity, LogOut, ChevronRight, Volume2, Globe } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { UserRole } from '../types';

interface SettingsViewProps {
    onSignOut?: () => void;
    onJoinAnotherHousehold?: () => void;
    userRole?: string;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onSignOut, onJoinAnotherHousehold, userRole }) => {
    const { language, setLanguage, t } = useLanguage();
  
  // Load persisted settings from localStorage
  const [fallSensitivity, setFallSensitivity] = useState(() => 
    localStorage.getItem('fall_detection_sensitivity') || 'LOW'
  );
  const [notifications, setNotifications] = useState(() => 
    localStorage.getItem('safenest_notifications') !== 'false'
  );
  const [voiceEmergency, setVoiceEmergency] = useState(() => {
    const stored = localStorage.getItem('safenest_voice_emergency');
    return stored !== 'false'; // Enabled by default
  });
  const [sirenVolume, setSirenVolume] = useState(() => 
    localStorage.getItem('safenest_siren_volume') !== 'false'
  );
  const [autoSOSTimer, setAutoSOSTimer] = useState(() => 
    parseInt(localStorage.getItem('safenest_auto_sos_timer') || '15')
  );

  // Persist fall sensitivity when changed
  const handleSensitivityChange = async (level: string) => {
    const upperLevel = level.toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH';
    setFallSensitivity(upperLevel);
    // Import and call the service function to properly save to both localStorage and Preferences
    try {
      const { setFallSensitivity: saveFallSensitivity } = await import('../services/fallDetection');
      await saveFallSensitivity(upperLevel);
    } catch (e) {
      console.error('Failed to set fall sensitivity:', e);
      localStorage.setItem('fall_detection_sensitivity', upperLevel);
    }
  };

  // Persist notifications when changed
  const handleNotificationsChange = () => {
    const newValue = !notifications;
    setNotifications(newValue);
    localStorage.setItem('safenest_notifications', String(newValue));
  };

  // Persist voice emergency when changed
  const handleVoiceEmergencyChange = () => {
    const newValue = !voiceEmergency;
    setVoiceEmergency(newValue);
    localStorage.setItem('safenest_voice_emergency', String(newValue));
  };

  // Persist siren volume when changed
  const handleSirenVolumeChange = () => {
    const newValue = !sirenVolume;
    setSirenVolume(newValue);
    localStorage.setItem('safenest_siren_volume', String(newValue));
  };

  const handleSOSTimerChange = (seconds: number) => {
    setAutoSOSTimer(seconds);
    localStorage.setItem('safenest_auto_sos_timer', String(seconds));
  };

  const requestBatteryExemption = async () => {
    // Battery optimization settings are only available on Android
  };

    // Language selection limited to English, Hindi, Marathi
  
  const getSensitivityDescription = (level: string) => {
    switch(level.toUpperCase()) {
      case 'LOW':
        return '📊 Only major falls & loud shouts detected. Best for active seniors.';
      case 'HIGH':
        return '⚠️ Very sensitive. Detects minor falls & quieter sounds.';
      case 'MEDIUM':
      default:
        return '✓ Balanced sensitivity. Recommended for most seniors.';
    }
  };

  return (
    <div className="pb-24 pt-6 px-4 space-y-6 animate-fade-in bg-gray-50 min-h-full">
      <h1 className="text-2xl font-bold text-gray-900">{t.settings}</h1>

      <div className="space-y-6">
        
        {/* Detection Settings */}
        <section>
             <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">{t.safetyDetection}</h2>
             <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-purple-100 p-2 rounded-lg text-purple-600">
                            <Mic size={20} />
                        </div>
                        <div>
                            <p className="font-semibold text-gray-900">{t.voiceEmergency}</p>
                            <p className="text-xs text-gray-500">{t.detectShouts}</p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer active:scale-95 transition-transform">
                        <input 
                            type="checkbox" 
                            checked={voiceEmergency}
                            onChange={handleVoiceEmergencyChange}
                            className="sr-only peer" 
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all duration-300 peer-checked:bg-purple-600 peer-checked:shadow-lg peer-checked:shadow-purple-200"></div>
                    </label>
                </div>


                 <div className="p-4">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="bg-green-100 p-2 rounded-lg text-green-600">
                            <Shield size={20} />
                        </div>
                        <div className="flex-1">
                            <p className="font-semibold text-gray-900">{t.autoSOSTimer}</p>
                            <p className="text-xs text-gray-500">{t.delayBefore102}</p>
                        </div>
                        <span className="text-lg font-bold text-green-600">{autoSOSTimer}s</span>
                    </div>
                    <div className="flex gap-2">
                        {[10, 15, 20, 30].map((seconds) => (
                            <button
                                key={seconds}
                                onClick={() => handleSOSTimerChange(seconds)}
                                className={`flex-1 py-2 px-3 rounded-lg font-semibold text-sm transition-all ${
                                    autoSOSTimer === seconds
                                        ? 'bg-green-500 text-white shadow-lg'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                {seconds}s
                            </button>
                        ))}
                    </div>
                </div>
             </div>
        </section>

        {/* Alerts & Notifications */}
        <section>
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">{t.alerts}</h2>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                 <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-orange-100 p-2 rounded-lg text-orange-600">
                            <Volume2 size={20} />
                        </div>
                        <div>
                            <p className="font-semibold text-gray-900">{t.sirenVolume}</p>
                            <p className="text-xs text-gray-500">{t.maxVolume}</p>
                        </div>
                    </div>
                    <div 
                        className={`w-12 h-6 rounded-full relative cursor-pointer transition-all duration-300 ease-in-out ${sirenVolume ? 'bg-green-500 shadow-lg shadow-green-200' : 'bg-gray-300'} active:scale-95`}
                        onClick={handleSirenVolumeChange}
                    >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-300 ${sirenVolume ? 'right-1' : 'left-1'}`}></div>
                    </div>
                </div>
                 <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-purple-100 p-2 rounded-lg text-purple-600">
                            <Bell size={20} />
                        </div>
                        <div>
                            <p className="font-semibold text-gray-900">{t.notifications}</p>
                            <p className="text-xs text-gray-500">{t.alertsForCaregivers}</p>
                        </div>
                    </div>
                    <div 
                        className={`w-12 h-6 rounded-full relative cursor-pointer transition-all duration-300 ease-in-out ${notifications ? 'bg-green-500 shadow-lg shadow-green-200' : 'bg-gray-300'} active:scale-95`}
                        onClick={handleNotificationsChange}
                    >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-300 ${notifications ? 'right-1' : 'left-1'}`}></div>
                    </div>
                </div>
                
            </div>
        </section>

                {/* Language Preferences */}
                <section>
                        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">{t.language}</h2>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden p-4">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                                    <Globe size={20} />
                                </div>
                                <p className="font-semibold text-gray-900">{t.selectLanguage}</p>
                
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    onClick={() => setLanguage('en' as any)}
                                    className={`py-2 px-3 rounded-lg text-sm font-semibold border ${language === 'en' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-700 border-gray-200'}`}
                                >
                                    English
                                </button>
                                <button
                                    onClick={() => setLanguage('hi' as any)}
                                    className={`py-2 px-3 rounded-lg text-sm font-semibold border ${language === 'hi' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-700 border-gray-200'}`}
                                >
                                    हिन्दी
                                </button>
                                <button
                                    onClick={() => setLanguage('mr' as any)}
                                    className={`py-2 px-3 rounded-lg text-sm font-semibold border ${language === 'mr' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-700 border-gray-200'}`}
                                >
                                    मराठी
                                </button>
                            </div>
                        </div>
                </section>

         {/* Account */}
         <section>
             <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">{t.account}</h2>
             <div className="space-y-3">
               {userRole === UserRole.CAREGIVER && onJoinAnotherHousehold && (
                 <button 
                   onClick={onJoinAnotherHousehold}
                   className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between hover:bg-blue-50 transition-colors"
                 >
                   <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                       <Shield size={20} className="text-blue-600" />
                     </div>
                     <div className="text-left">
                       <p className="font-semibold text-gray-900">Join Another Household</p>
                       <p className="text-xs text-gray-500">Monitor multiple seniors</p>
                     </div>
                   </div>
                   <ChevronRight size={20} className="text-gray-400" />
                 </button>
               )}
               

               <button 
                 onClick={() => {
                   console.log('[SettingsView] Clicked, onSignOut=', onSignOut);
                   if (onSignOut) onSignOut();
                 }}
                 className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center gap-3 text-red-600 font-bold hover:bg-red-50 transition-colors"
               >
                   <LogOut size={20} />
                   {t.signOut}
               </button>
             </div>
         </section>

         <div className="text-center pt-4 pb-8">
             <p className="text-xs text-gray-400">{t.appName} {t.version} 1.0.4</p>
         </div>

      </div>
    </div>
  );
};
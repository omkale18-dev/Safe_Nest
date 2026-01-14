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
    localStorage.getItem('safenest_fall_sensitivity') || 'Medium'
  );
  const [notifications, setNotifications] = useState(() => 
    localStorage.getItem('safenest_notifications') !== 'false'
  );
  const [voiceEmergency, setVoiceEmergency] = useState(() => 
    localStorage.getItem('safenest_voice_emergency') !== 'false'
  );
  const [sirenVolume, setSirenVolume] = useState(() => 
    localStorage.getItem('safenest_siren_volume') !== 'false'
  );
  const [voiceTestActive, setVoiceTestActive] = useState(false);
  const [voiceTestDb, setVoiceTestDb] = useState<number | null>(null);
  const [voiceTestError, setVoiceTestError] = useState<string | null>(null);
  const testIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Persist fall sensitivity when changed
  const handleSensitivityChange = (level: string) => {
    setFallSensitivity(level);
    localStorage.setItem('safenest_fall_sensitivity', level);
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

  const stopVoiceTest = () => {
    if (testIntervalRef.current) {
      clearInterval(testIntervalRef.current);
      testIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setVoiceTestActive(false);
  };

  const startVoiceTest = async () => {
    if (voiceTestActive) {
      stopVoiceTest();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceTestError('Microphone not available in this environment');
      return;
    }

    setVoiceTestError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;

      const microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);

      streamRef.current = stream;
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      setVoiceTestActive(true);

      testIntervalRef.current = setInterval(() => {
        if (!analyserRef.current) return;
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) sum += dataArray[i] * dataArray[i];
        const rms = Math.sqrt(sum / bufferLength);
        const volume = Math.round(rms);
        const db = volume > 0 ? 20 * Math.log10(volume / 255) + 60 : 0;
        setVoiceTestDb(Number.isFinite(db) ? Math.round(db * 10) / 10 : 0);
      }, 200);
    } catch (e: any) {
      setVoiceTestError(e?.message || 'Microphone permission denied');
      stopVoiceTest();
    }
  };

  useEffect(() => {
    return () => {
      stopVoiceTest();
    };
  }, []);

  const requestBatteryExemption = async () => {
    // Battery optimization settings are only available on Android
  };

    // Language selection limited to English, Hindi, Marathi
  
  const getSensitivityDescription = (level: string) => {
    switch(level) {
      case 'Low':
        return '📊 Only major falls & loud shouts detected. Best for active seniors.';
      case 'High':
        return '⚠️ Very sensitive. Detects minor falls & quieter sounds.';
      case 'Medium':
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
                <div className="p-4 border-b border-gray-100">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                            <Activity size={20} />
                        </div>
                        <div className="flex-1">
                            <p className="font-semibold text-gray-900">{t.fallSensitivity}</p>
                            <p className="text-xs text-gray-500">{t.adjustDetection}</p>
                        </div>
                    </div>
                    
                    {/* Sensitivity Options with descriptions */}
                    <div className="space-y-2 mt-3">
                        {['Low', 'Medium', 'High'].map((level) => (
                            <label key={level} className="flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all" style={{borderColor: fallSensitivity === level ? '#3b82f6' : '#e5e7eb', backgroundColor: fallSensitivity === level ? '#eff6ff' : '#fff'}}>
                                <input 
                                    type="radio" 
                                    name="sensitivity" 
                                    value={level}
                                    checked={fallSensitivity === level}
                                    onChange={(e) => handleSensitivityChange(e.target.value)}
                                    className="w-4 h-4 cursor-pointer"
                                />
                                <div className="ml-3 flex-1">
                                    <p className="font-semibold text-gray-900">{level}</p>
                                    <p className="text-xs text-gray-600">{getSensitivityDescription(level)}</p>
                                </div>
                            </label>
                        ))}
                    </div>
                    
                    {/* Info box */}
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                        <strong>💡 How it works:</strong> SafeNest uses accelerometer + gyroscope + pressure sensors to detect falls accurately. Adjust based on your activity level.
                    </div>
                </div>

                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-purple-100 p-2 rounded-lg text-purple-600">
                            <Mic size={20} />
                        </div>
                        <div>
                            <p className="font-semibold text-gray-900">Voice Emergency</p>
                            <p className="text-xs text-gray-500">Detect shouts/loud sounds after fall</p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={voiceEmergency}
                            onChange={handleVoiceEmergencyChange}
                            className="sr-only peer" 
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                </div>

                {/* Voice emergency tester */}
                <div className="p-4 border-t border-gray-100 bg-purple-50/50">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-semibold text-gray-900">Test Voice Sensitivity</p>
                      <p className="text-xs text-gray-600">Clap or shout to see live dB level vs threshold</p>
                    </div>
                    <button
                      onClick={startVoiceTest}
                      className={`px-3 py-2 rounded-lg text-sm font-semibold ${voiceTestActive ? 'bg-red-100 text-red-700' : 'bg-purple-600 text-white'}`}
                    >
                      {voiceTestActive ? 'Stop Test' : 'Start Test'}
                    </button>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-gray-700">
                        <span>Live dB</span>
                        <span className="font-bold">{voiceTestDb !== null ? `${voiceTestDb} dB` : '--'}</span>
                      </div>
                      <div className="mt-2 h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${voiceTestDb !== null && voiceTestDb >= (fallSensitivity === 'High' ? 40 : fallSensitivity === 'Low' ? 65 : 50) ? 'bg-red-500' : 'bg-purple-500'}`}
                          style={{ width: `${Math.min(100, Math.max(0, (voiceTestDb || 0)))}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">Threshold: {fallSensitivity === 'High' ? 40 : fallSensitivity === 'Low' ? 65 : 50} dB</p>
                    </div>
                    <div className={`px-3 py-2 rounded-lg text-xs font-bold ${voiceTestDb !== null && voiceTestDb >= (fallSensitivity === 'High' ? 40 : fallSensitivity === 'Low' ? 65 : 50) ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                      {voiceTestDb !== null && voiceTestDb >= (fallSensitivity === 'High' ? 40 : fallSensitivity === 'Low' ? 65 : 50) ? 'Threshold Crossed' : 'Listening'}
                    </div>
                  </div>
                  {voiceTestError && <p className="text-xs text-red-600 mt-2">{voiceTestError}</p>}
                </div>

                 <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-green-100 p-2 rounded-lg text-green-600">
                            <Shield size={20} />
                        </div>
                        <div>
                            <p className="font-semibold text-gray-900">{t.autoSOSTimer}</p>
                            <p className="text-xs text-gray-500">{t.delayBefore102}</p>
                        </div>
                    </div>
                     <span className="text-sm font-bold text-gray-600">10s</span>
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
                        className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${sirenVolume ? 'bg-green-500' : 'bg-gray-300'}`}
                        onClick={handleSirenVolumeChange}
                    >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${sirenVolume ? 'right-1' : 'left-1'}`}></div>
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
                        className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${notifications ? 'bg-green-500' : 'bg-gray-300'}`}
                        onClick={handleNotificationsChange}
                    >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${notifications ? 'right-1' : 'left-1'}`}></div>
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
               
               {/* Reset Onboarding Button (for testing) */}
               <button 
                 onClick={() => {
                   if (confirm('Reset onboarding? This will clear your profile and show the welcome screens again.')) {
                     localStorage.removeItem('safenest_onboarding_complete');
                     localStorage.removeItem('safenest_user_profile');
                     localStorage.removeItem('safenest_household_id');
                     window.location.reload();
                   }
                 }}
                 className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between hover:bg-purple-50 transition-colors"
               >
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                     <Activity size={20} className="text-purple-600" />
                   </div>
                   <div className="text-left">
                     <p className="font-semibold text-gray-900">Reset Onboarding</p>
                     <p className="text-xs text-gray-500">View welcome screens again</p>
                   </div>
                 </div>
                 <ChevronRight size={20} className="text-gray-400" />
               </button>
               
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
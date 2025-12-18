import React, { useEffect } from 'react';
import { Settings, HelpCircle, Volume2, Smartphone, MapPin, X, ChevronRight } from 'lucide-react';
import { CircularTimer } from '../components/CircularTimer';
import { UserProfile, UserRole } from '../types';
import { useLanguage } from '../i18n/LanguageContext';

interface SOSCountdownProps {
    onCancel: () => void;
    onConfirm: () => void;
    caregivers?: UserProfile[];
}

export const SOSCountdown: React.FC<SOSCountdownProps> = ({ onCancel, onConfirm, caregivers = [] }) => {
    const { t } = useLanguage();
  
  // Auditory Alert Effect (Siren)
  useEffect(() => {
    let interval: any;
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
            const ctx = new AudioContext();
            
            const playSiren = () => {
                if (ctx.state === 'suspended') {
                    ctx.resume();
                }
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                // Siren effect: Ramp frequency up and down
                const now = ctx.currentTime;
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(600, now);
                osc.frequency.linearRampToValueAtTime(1200, now + 0.3);
                osc.frequency.linearRampToValueAtTime(600, now + 0.6);
                
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.linearRampToValueAtTime(0.1, now + 0.6);
                
                osc.start(now);
                osc.stop(now + 0.6);
            };

            // Play immediately and loop
            playSiren();
            interval = setInterval(playSiren, 800);
        }
    } catch (e) {
        console.error("Audio playback failed", e);
    }

    // Vibrate device
    if (typeof navigator.vibrate === 'function') {
        const vibrationInterval = setInterval(() => {
             navigator.vibrate([200, 100, 200]);
        }, 1000);
        return () => {
             clearInterval(interval);
             clearInterval(vibrationInterval);
             navigator.vibrate(0);
        };
    }

    return () => {
        if (interval) clearInterval(interval);
    };
  }, []);

  return (
    <div className="h-full bg-white flex flex-col pt-6 pb-8 px-6 animate-fade-in relative">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
            <button className="p-2 -ml-2 rounded-full hover:bg-gray-100">
                <Settings className="text-gray-900" size={24} />
            </button>
            <h1 className="text-xl font-bold text-gray-900">{t.emergencyAlert}</h1>
            <button className="p-2 -mr-2 rounded-full hover:bg-gray-100">
                <HelpCircle className="text-gray-900" size={24} />
            </button>
        </div>

        <div className="flex-1 flex flex-col items-center">
            <h2 className="text-3xl font-black text-gray-900 mb-8 mt-4">{t.sendingAlert}</h2>

            {/* Timer Container */}
            <div className="relative mb-6">
                 <CircularTimer 
                    seconds={5} 
                    onComplete={onConfirm} 
                    isActive={true}
                    color="text-red-500"
                    label={t.seconds}
                 />
            </div>
            
            <button 
                onClick={onConfirm} 
                className="flex items-center gap-2 text-red-500 font-bold text-lg mb-10 hover:scale-105 transition-transform bg-red-50 px-6 py-2 rounded-full border border-red-100"
            >
                {t.sendAlertNow}
                <ChevronRight size={24} />
            </button>

            {/* Sound/Vibe status */}
            <div className="flex items-center gap-2 mb-6">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="font-bold text-gray-900 text-sm">{t.alarmSounding}</span>
            </div>

            <div className="flex gap-3 mb-8 w-full justify-center">
                <button className="flex items-center gap-2 bg-gray-100 px-6 py-3 rounded-full font-bold text-gray-700 shadow-sm active:bg-gray-200">
                    <Volume2 size={20} /> LOUD
                </button>
                 <button className="flex items-center gap-2 bg-gray-100 px-6 py-3 rounded-full font-bold text-gray-700 shadow-sm active:bg-gray-200">
                    <Smartphone size={20} /> {t.on}
                </button>
            </div>

            {/* Notifying details removed */}
        </div>

        {/* Footer Action */}
        <div className="mt-auto">
             <button 
                onClick={onCancel}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-200 transition-all active:scale-95"
            >
                <div className="bg-white rounded-full p-0.5">
                    <X size={16} className="text-blue-600" strokeWidth={3} />
                </div>
                {t.iAmSafe}
            </button>
            <p className="text-center text-xs text-gray-400 mt-4 pb-2">{t.cancelFalseAlarm}</p>
        </div>
    </div>
  );
};
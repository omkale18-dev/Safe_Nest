import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { CircularTimer } from '../components/CircularTimer';

interface FallCountdownProps {
  onCancel: () => void;
  onConfirm: () => void;
}

export const FallCountdown: React.FC<FallCountdownProps> = ({ onCancel, onConfirm }) => {
  
  // Auditory Alert Effect
  useEffect(() => {
    let interval: any;
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
            const ctx = new AudioContext();
            
            const playBeep = () => {
                if (ctx.state === 'suspended') {
                    ctx.resume();
                }
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, ctx.currentTime); // High pitch alert
                osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.1);
                
                gain.gain.setValueAtTime(0.3, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
                
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.1);
            };

            // Play immediately
            playBeep();
            // Loop every second
            interval = setInterval(playBeep, 1000);
        }
    } catch (e) {
        console.error("Audio playback failed", e);
    }

    return () => {
        if (interval) clearInterval(interval);
    };
  }, []);

  return (
    <div className="h-full flex flex-col items-center justify-between p-6 animate-pulse-fast bg-white">
      <div className="flex-1 w-full flex flex-col items-center justify-center space-y-8">
        
        {/* Warning Icon */}
        <div className="w-32 h-32 rounded-full bg-red-100 flex items-center justify-center mb-4">
           <div className="w-24 h-24 rounded-full bg-red-200 flex items-center justify-center">
             <AlertTriangle size={48} className="text-red-600" />
           </div>
        </div>

        <div className="text-center">
          <h1 className="text-3xl font-black text-gray-900 mb-2">Fall Detected!</h1>
          <p className="text-xl text-gray-600 font-medium">Are you okay?</p>
        </div>

        <CircularTimer 
          seconds={10} 
          onComplete={onConfirm} 
          isActive={true} 
          color="text-red-500" 
        />
        
        {/* Removed emergency contact details */}
      </div>

      <div className="w-full space-y-3 mb-8">
        <button
          onClick={onCancel}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold py-4 rounded-xl shadow-lg shadow-blue-200 transition-colors"
        >
          I'm Okay
        </button>
        <button
          onClick={onConfirm}
          className="w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-lg font-bold py-4 rounded-xl transition-colors"
        >
          SOS <span className="font-normal text-sm ml-1">Call 102 Now</span>
        </button>
      </div>
    </div>
  );
};
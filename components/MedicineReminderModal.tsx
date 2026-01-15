import React, { useState, useEffect } from 'react';
import { Pill, X, Clock } from 'lucide-react';
import { Medicine } from '../types';

interface MedicineReminderModalProps {
  medicine: Medicine;
  scheduledTime: string;
  onTaken: () => void;
  onSnooze: (minutes: number) => void;
  onDismiss: () => void;
}

export const MedicineReminderModal: React.FC<MedicineReminderModalProps> = ({
  medicine,
  scheduledTime,
  onTaken,
  onSnooze,
  onDismiss
}) => {
  const [snoozeMinutes, setSnoozeMinutes] = useState(5);
  const [ringSound, setRingSound] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Play alarm sound
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj==');
    audio.loop = true;
    audio.play().catch(() => console.log('Audio play failed'));
    setRingSound(audio);

    return () => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    };
  }, []);

  const handleTaken = () => {
    if (ringSound) {
      ringSound.pause();
      ringSound.currentTime = 0;
    }
    onTaken();
  };

  const handleSnooze = () => {
    if (ringSound) {
      ringSound.pause();
      ringSound.currentTime = 0;
    }
    onSnooze(snoozeMinutes);
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[9999] flex items-center justify-center p-4 animate-fade-in">
      {/* Pulse animation container */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-32 h-32 bg-blue-500 rounded-full opacity-20 animate-pulse"></div>
      </div>

      {/* Modal */}
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full relative z-10 overflow-hidden">
        {/* Header with pulse */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 text-white flex items-center gap-4">
          <div className="flex-shrink-0 animate-bounce">
            <Pill size={40} />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold">Time for Medicine!</h2>
            <p className="text-blue-100 text-sm mt-1">Don't forget to take your medication</p>
          </div>
          <button
            onClick={onDismiss}
            className="p-2 hover:bg-blue-700 rounded-full transition-colors flex-shrink-0"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Medicine Details */}
          <div className="bg-blue-50 rounded-2xl p-4 space-y-3">
            <div>
              <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">Medicine Name</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{medicine.name}</p>
            </div>
            
            <div className="flex items-center gap-3 bg-white rounded-xl p-3">
              <Clock size={20} className="text-blue-600 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Scheduled Time</p>
                <p className="font-bold text-gray-900">{scheduledTime}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Dosage</p>
              <p className="text-lg font-semibold text-gray-900 mt-1">{medicine.dosage}</p>
            </div>

            {medicine.instructions && (
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Instructions</p>
                <p className="text-sm text-gray-700 mt-1 italic">{medicine.instructions}</p>
              </div>
            )}
          </div>

          {/* Snooze Options */}
          <div>
            <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-3">Snooze for</p>
            <div className="grid grid-cols-3 gap-2">
              {[5, 10, 15].map((mins) => (
                <button
                  key={mins}
                  onClick={() => setSnoozeMinutes(mins)}
                  className={`py-2 px-3 rounded-lg font-semibold transition-all ${
                    snoozeMinutes === mins
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {mins}m
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleTaken}
              className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-lg transition-colors shadow-md hover:shadow-lg"
            >
              ✓ I've Taken It
            </button>
            <button
              onClick={handleSnooze}
              className="w-full py-4 bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl font-bold text-lg transition-colors shadow-md hover:shadow-lg"
            >
              ⏰ Snooze {snoozeMinutes}m
            </button>
            <button
              onClick={onDismiss}
              className="w-full py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-semibold transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

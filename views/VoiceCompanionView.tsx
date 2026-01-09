import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Check, Clock, BellRing, Mic } from 'lucide-react';
import { Reminder, Medicine, MedicineLog } from '../types';
import { MedicineReminders } from './MedicineReminders';

interface VoiceCompanionProps {
  userName: string;
  onSOS: () => void;
  isListening: boolean;
  onListeningChange: (isListening: boolean) => void;
  reminders: Reminder[];
  activeReminderId: string | null;
  onUpdateReminder: (id: string, status: Reminder['status']) => void;
  medicines?: Medicine[];
  medicineLogs?: MedicineLog[];
  onMarkTaken?: (medicineId: string, scheduledTime: string) => void;
  onSkipMedicine?: (medicineId: string, scheduledTime: string) => void;
  onSnoozeMedicine?: (medicineId: string, scheduledTime: string, snoozeUntil: string) => void;
}

export const VoiceCompanionView: React.FC<VoiceCompanionProps> = ({ 
  userName, 
  onSOS, 
  isListening, 
  onListeningChange,
  reminders,
  activeReminderId,
  onUpdateReminder,
  medicines = [],
  medicineLogs = [],
  onMarkTaken,
  onSkipMedicine,
  onSnoozeMedicine
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const recognitionRef = useRef<any>(null);
  const restartAttempts = useRef(0);
  
  // Find Active Reminder
  const activeReminder = reminders.find(r => r.id === activeReminderId);

  // --- AUDIO & VOICE LOGIC ---
  const speak = (text: string, onEnd?: () => void) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Stop current speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.onstart = () => setIsPlaying(true);
      utterance.onend = () => {
          setIsPlaying(false);
          if (onEnd) onEnd();
      };
      window.speechSynthesis.speak(utterance);
    }
  };

  // Setup Speech Recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true; // Keep listening while active
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const lastIndex = event.results.length - 1;
        const transcript = event.results[lastIndex][0].transcript.toLowerCase();
        console.log("Heard:", transcript);
        restartAttempts.current = 0; // Reset attempts on successful result
        handleVoiceResponse(transcript);
      };
      
      recognitionRef.current.onerror = (event: any) => {
          console.warn("Speech recognition error", event.error);
          if (event.error === 'not-allowed') {
              onListeningChange(false);
          }
      };

      recognitionRef.current.onend = () => {
         // Auto-restart if we are in alarm mode
         if (activeReminderId && isListening) {
             if (restartAttempts.current < 5) {
                restartAttempts.current += 1;
                try { 
                    setTimeout(() => {
                        if (isListening) recognitionRef.current.start(); 
                    }, 500);
                } catch(e) {}
             } else {
                 onListeningChange(false); // Stop loop if too many restarts without input
             }
         } else {
             onListeningChange(false);
         }
      };
    }
  }, [activeReminderId, isListening]);


  // Trigger Alarm when activeReminderId changes
  useEffect(() => {
    if (activeReminder) {
        // 1. Start Listening Mode automatically
        onListeningChange(true);
        restartAttempts.current = 0;
        try { recognitionRef.current?.start(); } catch(e) {}

        // 2. Play Voice Reminder
        const message = `It is ${activeReminder.time}. Time for your ${activeReminder.title}. ${activeReminder.instructions}. Say 'Taken' or 'Later'.`;
        speak(message);
    } else {
        // Stop listening if no alarm
        onListeningChange(false);
        try { recognitionRef.current?.stop(); } catch(e) {}
    }
  }, [activeReminder]);

  const handleVoiceResponse = (transcript: string) => {
      if (!activeReminder) return;

      if (transcript.includes('taken') || transcript.includes('yes') || transcript.includes('done')) {
          speak("Great. Marking as taken.");
          onUpdateReminder(activeReminder.id, 'COMPLETED');
      } 
      else if (transcript.includes('later') || transcript.includes('snooze') || transcript.includes('wait')) {
          speak("Okay. I will remind you in 15 minutes.");
          onUpdateReminder(activeReminder.id, 'SNOOZED');
      }
      else if (transcript.includes('help') || transcript.includes('emergency')) {
          speak("Calling for help.");
          onSOS();
      }
  };

  // --- RENDER ALARM MODE (Full Screen Overlay) ---
  if (activeReminder) {
      return (
          <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-fade-in pb-24">
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                  
                  {/* Pulsing Visual */}
                  <div className="relative mb-12">
                      <div className="absolute inset-0 bg-blue-500 rounded-full opacity-20 animate-ping"></div>
                      <div className="w-32 h-32 bg-blue-10 rounded-full flex items-center justify-center relative z-10">
                          <BellRing size={64} className="text-blue-600 animate-pulse" />
                      </div>
                  </div>

                  <h1 className="text-4xl font-black text-gray-900 mb-2">{activeReminder.title}</h1>
                  <p className="text-xl text-gray-600 mb-8">{activeReminder.instructions}</p>

                  <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 w-full max-w-xs mb-8">
                       <div className="flex items-center justify-center gap-2 text-gray-500 font-bold">
                           <Mic className={`text-red-500 ${isListening ? 'animate-pulse' : ''}`} />
                           Listening...
                       </div>
                       <p className="text-sm text-gray-400 mt-1">Say "Taken" or "Later"</p>
                  </div>

                  {/* Big Buttons */}
                  <div className="w-full space-y-4 max-w-xs">
                      <button 
                        onClick={() => onUpdateReminder(activeReminder.id, 'COMPLETED')}
                        className="w-full bg-green-500 hover:bg-green-600 text-white font-bold text-xl py-6 rounded-2xl shadow-lg shadow-green-200 flex items-center justify-center gap-2 transform active:scale-95 transition-all"
                      >
                          <Check size={32} />
                          Taken
                      </button>

                      <button 
                        onClick={() => onUpdateReminder(activeReminder.id, 'SNOOZED')}
                        className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-lg py-4 rounded-2xl flex items-center justify-center gap-2"
                      >
                          <Clock size={24} />
                          Snooze 15m
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  // --- RENDER IDLE MODE (Schedule List) ---
  const pendingReminders = reminders.filter(r => r.status === 'PENDING');
  const completedReminders = reminders.filter(r => r.status === 'COMPLETED');
  const ownerName = reminders.find(r => r.createdBy)?.createdBy;

  // Calculate today's medicines with their status
  const getTodaysMedicinesStatus = () => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    
    const todaysMeds: Array<{
      medicine: Medicine;
      time: string;
      status: 'TAKEN' | 'PENDING';
    }> = [];

    console.log('[VoiceCompanion] Calculating today\'s medicines. Total medicines:', medicines.length);

    medicines.forEach((medicine) => {
      // Check if medicine is active today
      const startDate = new Date(medicine.startDate);
      const startMidnight = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
      
      console.log(`[VoiceCompanion] Medicine: ${medicine.name}`, {
        startDate: startDate.toDateString(),
        endDate: medicine.endDate ? new Date(medicine.endDate).toDateString() : 'None',
        isOngoing: medicine.isOngoing,
        todayStart: todayStart,
        startMidnight: startMidnight,
        times: medicine.times
      });

      if (todayStart < startMidnight) {
        console.log(`[VoiceCompanion] Skipping ${medicine.name} - not started yet`);
        return; // Not started yet
      }
      
      // Check if medicine is ongoing or has no end date
      const isActive = medicine.isOngoing === true || !medicine.endDate;
      
      if (!isActive && medicine.endDate) {
        const endDate = new Date(medicine.endDate);
        const endMidnight = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime();
        if (todayStart > endMidnight) {
          console.log(`[VoiceCompanion] Skipping ${medicine.name} - already ended`);
          return; // Already ended
        }
      }

      console.log(`[VoiceCompanion] Medicine ${medicine.name} is active today`);

      // Check each scheduled time
      medicine.times.forEach((time) => {
        const log = medicineLogs.find((l) => {
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
        
        console.log(`[VoiceCompanion] Added ${medicine.name} at ${time} - Status: ${log ? 'TAKEN' : 'PENDING'}`);
      });
    });

    console.log('[VoiceCompanion] Total today\'s medicines:', todaysMeds.length);
    return todaysMeds;
  };

  const todaysMedicines = getTodaysMedicinesStatus();
  const pendingMedicines = todaysMedicines.filter(m => m.status === 'PENDING');
  const completedMedicines = todaysMedicines.filter(m => m.status === 'TAKEN');

  return (
    <div className="pb-48 pt-6 px-4 min-h-full bg-gray-50 animate-fade-in flex flex-col relative">
      
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-black text-gray-900 leading-tight">
                Medication<br/>
                <span className="text-blue-600">Schedule</span>
            </h1>
            <p className="text-sm text-gray-500 mt-1">Managed by {ownerName ? `${ownerName} (Caregiver)` : 'Household'}</p>
          </div>
      </div>

      {/* Upcoming Medicines for Today */}
      <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Upcoming Today</h2>
      <div className="space-y-3 mb-8">
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

      {/* Completed Medicines Today */}
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
  );
};
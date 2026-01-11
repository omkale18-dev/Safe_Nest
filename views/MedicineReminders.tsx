import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Pill, Clock, CheckCircle, X, AlertCircle, AlertTriangle, Volume2, VolumeX, Bell } from 'lucide-react';
import { Medicine, MedicineLog } from '../types';

// Normalize time strings to HH:MM (zero padded)
const normalizeTime = (time: string) => {
  if (!time) return time;
  const parts = time.split(':').map(s => parseInt(s, 10));
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return time.trim();
  return `${parts[0].toString().padStart(2,'0')}:${parts[1].toString().padStart(2,'0')}`;
};

// Timezone-safe: get local midnight timestamp for a date
const getLocalMidnight = (date: Date): number => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

// Check if two dates are the same local day
const isSameLocalDay = (date1: Date, date2: Date): boolean => {
  return getLocalMidnight(date1) === getLocalMidnight(date2);
};

// Check if medicine is active on a given date (timezone-safe)
const isMedicineActiveOnDate = (medicine: Medicine, targetDate: Date): boolean => {
  const targetMidnight = getLocalMidnight(targetDate);
  const startDate = new Date(medicine.startDate);
  const startMidnight = getLocalMidnight(startDate);
  
  // If it's before the start date, it's not active
  if (targetMidnight < startMidnight) {
    return false;
  }
  
  // If isOngoing is true or endDate is not set, it's active (no end date)
  if (medicine.isOngoing === true || !medicine.endDate) {
    return true;
  }
  
  // Check against end date if it exists
  const endMidnight = getLocalMidnight(new Date(medicine.endDate));
  return targetMidnight <= endMidnight;
};

// Check if a scheduled time has passed today
const isTimeOverdue = (scheduledTime: string, graceMinutes: number = 30): boolean => {
  const [hours, minutes] = scheduledTime.split(':').map(Number);
  const now = new Date();
  const scheduledDate = new Date();
  scheduledDate.setHours(hours, minutes, 0, 0);
  
  const overdueThreshold = new Date(scheduledDate.getTime() + graceMinutes * 60 * 1000);
  return now > overdueThreshold;
};

// Check if time is within reminder window (5 min before to 30 min after)
const isInReminderWindow = (scheduledTime: string): boolean => {
  const [hours, minutes] = scheduledTime.split(':').map(Number);
  const now = new Date();
  const scheduledDate = new Date();
  scheduledDate.setHours(hours, minutes, 0, 0);
  
  const windowStart = new Date(scheduledDate.getTime() - 5 * 60 * 1000); // 5 min before
  const windowEnd = new Date(scheduledDate.getTime() + 30 * 60 * 1000); // 30 min after
  return now >= windowStart && now <= windowEnd;
};

// Add minutes to time string
const addMinutesToTime = (time: string, mins: number): string => {
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes + mins, 0, 0);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

interface MedicineRemindersProps {
  medicines: Medicine[];
  onMarkTaken: (medicineId: string, time: string) => void;
  onSkip: (medicineId: string, time: string, markAsMissed?: boolean) => void;
  onSnooze?: (medicineId: string, time: string, snoozeUntil: string) => void;
  medicineLogs: MedicineLog[];
  voiceEnabled?: boolean;
}

export const MedicineReminders: React.FC<MedicineRemindersProps> = ({
  medicines,
  onMarkTaken,
  onSkip,
  onSnooze,
  medicineLogs,
  voiceEnabled = true,
}) => {
  const [todaysMedicines, setTodaysMedicines] = useState<
    Array<{
      medicine: Medicine;
      time: string;
      status: 'PENDING' | 'TAKEN' | 'MISSED' | 'SKIPPED' | 'OVERDUE' | 'SNOOZED';
      timeIndex: number;
      snoozedUntil?: string;
    }>
  >([]);
  const [voiceOn, setVoiceOn] = useState(voiceEnabled);
  const [missedAlertPlaying, setMissedAlertPlaying] = useState(false);
  const spokenRemindersRef = useRef<Set<string>>(new Set());
  const missedAlertIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Voice reminder using TTS
  const speakReminder = useCallback((medicine: Medicine, time: string) => {
    if (!voiceOn || !('speechSynthesis' in window)) return;
    
    const key = `${medicine.id}-${time}`;
    if (spokenRemindersRef.current.has(key)) return;
    spokenRemindersRef.current.add(key);
    
    const text = `Time to take ${medicine.name}. ${medicine.dosage}. ${medicine.instructions || ''}`;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    // Use Hindi voice if available
    const voices = window.speechSynthesis.getVoices();
    const hindiVoice = voices.find(v => v.lang.includes('hi'));
    const englishVoice = voices.find(v => v.lang.includes('en'));
    utterance.voice = hindiVoice || englishVoice || null;
    
    window.speechSynthesis.speak(utterance);
    console.log('[VoiceReminder] Speaking:', text);
  }, [voiceOn]);

  // Missed alert sound (loud beeping)
  const playMissedAlert = useCallback(() => {
    if (missedAlertPlaying) return;
    setMissedAlertPlaying(true);
    
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      
      const playBeep = () => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.frequency.value = 880; // High pitch
        oscillator.type = 'square';
        gainNode.gain.value = 0.3;
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.2);
      };
      
      // Play 3 beeps
      playBeep();
      setTimeout(playBeep, 300);
      setTimeout(playBeep, 600);
    } catch (e) {
      console.warn('[MissedAlert] Audio failed:', e);
    }
  }, [missedAlertPlaying]);

  const stopMissedAlert = useCallback(() => {
    setMissedAlertPlaying(false);
    if (missedAlertIntervalRef.current) {
      clearInterval(missedAlertIntervalRef.current);
      missedAlertIntervalRef.current = null;
    }
  }, []);

  // Handle snooze
  const handleSnooze = useCallback((medicineId: string, time: string) => {
    const snoozeUntil = addMinutesToTime(new Date().toTimeString().slice(0, 5), 15);
    console.log('[Snooze] Medicine', medicineId, 'snoozed until', snoozeUntil);
    
    if (onSnooze) {
      onSnooze(medicineId, time, snoozeUntil);
    }
    
    // Speak snooze confirmation
    if (voiceOn && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance('Reminder snoozed for 15 minutes');
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }, [onSnooze, voiceOn]);

  useEffect(() => {
    const today = new Date();
    const medicines_for_today: typeof todaysMedicines = [];

    console.log('[MedicineReminders] Building today\'s medicines list. Total medicines:', medicines.length, 'Date:', today.toDateString());

    medicines.forEach((medicine) => {
      // Check if medicine is active on today's date
      const isActive = isMedicineActiveOnDate(medicine, today);
      
      console.log(`[MedicineReminders] Medicine: ${medicine.name}`, {
        startDate: medicine.startDate?.toString(),
        endDate: medicine.endDate?.toString(),
        isOngoing: medicine.isOngoing,
        isActive: isActive,
        times: medicine.times
      });

      if (isActive) {
        medicine.times.forEach((time, timeIndex) => {
          const log = medicineLogs.find((l) => {
            const logDate = l.date instanceof Date ? l.date : new Date(l.date);
            return (
              l.medicineId === medicine.id &&
              isSameLocalDay(logDate, today) &&
              normalizeTime(l.scheduledTime || '') === normalizeTime(time)
            );
          });

          let status: 'PENDING' | 'TAKEN' | 'MISSED' | 'SKIPPED' | 'OVERDUE' | 'SNOOZED' = 
            (log?.status as any) || 'PENDING';
          
          // Check if snoozed
          if (log?.snoozedUntil) {
            const now = new Date();
            const [h, m] = log.snoozedUntil.split(':').map(Number);
            const snoozeTime = new Date();
            snoozeTime.setHours(h, m, 0, 0);
            if (now < snoozeTime) {
              status = 'SNOOZED';
            }
          }
          
          if (status === 'PENDING' && isTimeOverdue(time)) {
            status = 'OVERDUE';
          }

          medicines_for_today.push({
            medicine,
            time,
            status,
            timeIndex,
            snoozedUntil: log?.snoozedUntil,
          });
        });
      }
    });

    medicines_for_today.sort((a, b) => a.time.localeCompare(b.time));
    setTodaysMedicines(medicines_for_today);
  }, [medicines, medicineLogs]);

  // Voice reminders and missed alerts
  useEffect(() => {
    todaysMedicines.forEach((item) => {
      // Voice reminder for medicines in reminder window
      if ((item.status === 'PENDING' || item.status === 'OVERDUE') && isInReminderWindow(item.time)) {
        speakReminder(item.medicine, item.time);
      }
      
      // Missed alert for critical medicines overdue > 1 hour
      if (item.status === 'OVERDUE' && item.medicine.isCritical) {
        const [h, m] = item.time.split(':').map(Number);
        const scheduledTime = new Date();
        scheduledTime.setHours(h, m, 0, 0);
        const overdueMinutes = (Date.now() - scheduledTime.getTime()) / 60000;
        
        if (overdueMinutes > 60) {
          playMissedAlert();
        }
      }
    });
  }, [todaysMedicines, speakReminder, playMissedAlert]);

  // Cleanup
  useEffect(() => {
    return () => {
      stopMissedAlert();
      window.speechSynthesis?.cancel();
    };
  }, [stopMissedAlert]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'TAKEN':
        return 'bg-green-50 border-green-200';
      case 'MISSED':
        return 'bg-red-50 border-red-200';
      case 'OVERDUE':
        return 'bg-yellow-50 border-yellow-400 border-2';
      case 'SKIPPED':
        return 'bg-orange-50 border-orange-200';
      case 'SNOOZED':
        return 'bg-purple-50 border-purple-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'TAKEN':
        return <CheckCircle size={24} className="text-green-600" />;
      case 'MISSED':
        return <AlertCircle size={24} className="text-red-600" />;
      case 'OVERDUE':
        return <AlertTriangle size={24} className="text-yellow-600" />;
      case 'SKIPPED':
        return <X size={24} className="text-orange-600" />;
      case 'SNOOZED':
        return <Bell size={24} className="text-purple-600" />;
      default:
        return <Clock size={24} className="text-blue-600" />;
    }
  };

  const getTimeRemaining = (time: string, status: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const medicineTime = new Date();
    medicineTime.setHours(hours, minutes, 0, 0);

    const now = new Date();
    const diffMs = medicineTime.getTime() - now.getTime();

    if (diffMs < 0) {
      // Calculate how long overdue
      const overdueMs = Math.abs(diffMs);
      const overdueHours = Math.floor(overdueMs / (1000 * 60 * 60));
      const overdueMins = Math.floor((overdueMs % (1000 * 60 * 60)) / (1000 * 60));
      if (overdueHours > 0) return `${overdueHours}h ${overdueMins}m overdue`;
      return `${overdueMins}m overdue`;
    }

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 0) return `${diffHours}h ${diffMins}m`;
    return `${diffMins}m`;
  };

  const completionRate = todaysMedicines.length > 0
    ? Math.round(
        (todaysMedicines.filter((m) => m.status === 'TAKEN').length / todaysMedicines.length) * 100
      )
    : 0;

  return (
    <div className="space-y-4">
      {/* Header with Voice Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Pill size={20} className="text-purple-600" />
          <h2 className="text-lg font-semibold text-gray-900">Today's Medicines</h2>
        </div>
        {voiceEnabled && (
          <button
            onClick={() => setVoiceOn(!voiceOn)}
            className={`p-2 rounded-full transition-colors ${
              voiceOn ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-400'
            }`}
            title={voiceOn ? 'Voice reminders ON' : 'Voice reminders OFF'}
          >
            {voiceOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
        )}
      </div>

      {/* Missed Alert Banner */}
      {missedAlertPlaying && (
        <div className="bg-red-100 border-2 border-red-400 rounded-xl p-3 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2">
            <AlertCircle className="text-red-600" size={24} />
            <span className="font-bold text-red-800">Critical medicine missed!</span>
          </div>
          <button
            onClick={stopMissedAlert}
            className="px-3 py-1 bg-red-600 text-white rounded-lg text-sm font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Completion Indicator */}
      {todaysMedicines.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">
              {todaysMedicines.filter((m) => m.status === 'TAKEN').length} of {todaysMedicines.length} taken
            </span>
            <span className="text-xl font-bold text-purple-600">{completionRate}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${completionRate}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Medicines List */}
      {todaysMedicines.length === 0 ? (
        <div className="bg-white rounded-2xl p-6 text-center border border-gray-100 shadow-sm">
          <Pill size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-600 font-semibold">No medicines scheduled for today</p>
        </div>
      ) : (
        <div className="space-y-3">
          {todaysMedicines.map((item, idx) => (
            <div
              key={`${item.medicine.id}-${item.time}-${idx}`}
              className={`rounded-2xl p-4 border shadow-sm transition-all ${getStatusColor(item.status)}`}
            >
              <div className="flex items-start gap-3">
                {/* Status Icon */}
                <div className="flex-shrink-0">{getStatusIcon(item.status)}</div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Time & Medicine Name */}
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div>
                      <p className="text-xs font-bold text-gray-600 uppercase">{item.time}</p>
                      <h3 className="text-base font-bold text-gray-900">{item.medicine.name}</h3>
                    </div>
                    {(item.status === 'PENDING' || item.status === 'OVERDUE') && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${
                        item.status === 'OVERDUE' 
                          ? 'text-yellow-700 bg-yellow-100 animate-pulse' 
                          : 'text-blue-600 bg-blue-100'
                      }`}>
                        {getTimeRemaining(item.time, item.status)}
                      </span>
                    )}
                  </div>

                  {/* Dosage */}
                  <p className="text-sm font-semibold text-gray-700 mb-1">{item.medicine.dosage}</p>

                  {/* Instructions */}
                  {item.medicine.instructions && (
                    <p className="text-xs text-gray-600 italic mb-2">
                      💡 {item.medicine.instructions}
                    </p>
                  )}

                  {/* Status Text */}
                  {item.status === 'SNOOZED' && item.snoozedUntil && (
                    <p className="text-xs font-semibold text-purple-700 mb-2">
                      ⏰ Snoozed until {item.snoozedUntil}
                    </p>
                  )}
                  {item.status !== 'PENDING' && item.status !== 'OVERDUE' && item.status !== 'SNOOZED' && (
                    <p className="text-xs font-semibold mb-2">
                      {item.status === 'TAKEN' && '✓ Marked as taken'}
                      {item.status === 'MISSED' && '⚠️ Missed'}
                      {item.status === 'SKIPPED' && '— Skipped'}
                    </p>
                  )}

                  {/* Overdue Warning Banner */}
                  {item.status === 'OVERDUE' && (
                    <div className="bg-yellow-100 border border-yellow-300 rounded-lg px-3 py-1.5 mb-2">
                      <p className="text-xs font-bold text-yellow-800">
                        ⏰ Medicine time has passed! 
                        {item.medicine.isCritical && ' (Critical medicine)'}
                      </p>
                    </div>
                  )}

                  {/* Action Buttons - Show for PENDING, OVERDUE, and SNOOZED */}
                  {(item.status === 'PENDING' || item.status === 'OVERDUE' || item.status === 'SNOOZED') && (
                    <div className="flex flex-col gap-2">
                      {/* Main action row */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => { 
                            stopMissedAlert();
                            onMarkTaken(item.medicine.id, item.time); 
                          }}
                          className={`flex-1 py-3 text-white text-base font-bold rounded-xl transition-colors shadow-sm ${
                            item.status === 'OVERDUE' ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'
                          }`}
                        >
                          ✓ {item.status === 'OVERDUE' ? 'Took Late' : 'TAKEN'}
                        </button>
                      </div>
                      
                      {/* Secondary actions row */}
                      <div className="flex gap-2">
                        {/* Snooze button - only for PENDING */}
                        {item.status === 'PENDING' && onSnooze && (
                          <button
                            onClick={() => handleSnooze(item.medicine.id, item.time)}
                            className="flex-1 py-2 border-2 border-purple-300 text-purple-700 text-sm font-semibold rounded-lg hover:bg-purple-50 flex items-center justify-center gap-1"
                          >
                            <Bell size={16} />
                            Snooze 15m
                          </button>
                        )}
                        
                        {/* Skip/Missed button */}
                        <button
                          onClick={() => { 
                            stopMissedAlert();
                            onSkip(item.medicine.id, item.time, item.status === 'OVERDUE'); 
                          }}
                          className={`flex-1 py-2 border-2 text-sm font-semibold rounded-lg transition-colors ${
                            item.status === 'OVERDUE' 
                              ? 'border-red-300 text-red-700 hover:bg-red-50' 
                              : 'border-orange-300 text-orange-700 hover:bg-orange-50'
                          }`}
                        >
                          {item.status === 'OVERDUE' ? '✗ Missed' : 'Skip'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

import React, { useState, useMemo, useEffect } from 'react';
import { Pill, Clock, Check, X, AlertCircle, Bell, ChevronDown, ChevronUp } from 'lucide-react';
import { Medicine, MedicineLog } from '../types';

interface SeniorMedicineScheduleProps {
  medicines: Medicine[];
  medicineLogs: MedicineLog[];
  onMarkTaken: (medicineId: string, scheduledTime: string) => void;
  onSkipMedicine: (medicineId: string, scheduledTime: string, markAsMissed?: boolean) => void;
  householdId?: string;
}

interface ScheduledMedicine {
  medicine: Medicine;
  time: string;
  timeMinutes: number; // For sorting
  status: 'TAKEN' | 'PENDING' | 'OVERDUE' | 'UPCOMING' | 'SNOOZED' | 'MISSED' | 'SKIPPED';
  snoozeUntil?: Date;
}

export const SeniorMedicineSchedule: React.FC<SeniorMedicineScheduleProps> = ({
  medicines,
  medicineLogs,
  onMarkTaken,
  onSkipMedicine,
  householdId,
}) => {
  const [snoozedMedicines, setSnoozedMedicines] = useState<{ [key: string]: Date }>(() => {
    const saved = localStorage.getItem('safenest_snoozed_medicines');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Convert string dates back to Date objects and filter expired snoozes
      const now = new Date();
      const filtered: { [key: string]: Date } = {};
      Object.entries(parsed).forEach(([key, dateStr]) => {
        const snoozeDate = new Date(dateStr as string);
        if (snoozeDate > now) {
          filtered[key] = snoozeDate;
        }
      });
      return filtered;
    }
    return {};
  });
  
  const [showCompleted, setShowCompleted] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [alertedMedicines, setAlertedMedicines] = useState<Set<string>>(new Set());
  const [alert, setAlert] = useState<{ medicine: string; time: string; show: boolean } | null>(null);

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Save snoozed medicines to localStorage
  useEffect(() => {
    localStorage.setItem('safenest_snoozed_medicines', JSON.stringify(snoozedMedicines));
  }, [snoozedMedicines]);

  const handleSnooze = (medicineId: string, time: string, minutes: number = 15) => {
    const key = `${medicineId}_${time}`;
    const snoozeUntil = new Date(Date.now() + minutes * 60 * 1000);
    setSnoozedMedicines(prev => ({ ...prev, [key]: snoozeUntil }));
  };

  const scheduledMedicines = useMemo(() => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const now = currentTime;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const result: ScheduledMedicine[] = [];

    medicines.forEach((medicine) => {
      // Check if medicine is active today
      const startDate = new Date(medicine.startDate);
      const startMidnight = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
      
      if (todayStart < startMidnight) return;
      
      const isActive = medicine.isOngoing === true || !medicine.endDate;
      
      if (!isActive && medicine.endDate) {
        const endDate = new Date(medicine.endDate);
        const endMidnight = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime();
        if (todayStart > endMidnight) return;
      }

      medicine.times.forEach((time) => {
        const [hours, minutes] = time.split(':').map(Number);
        const timeMinutes = hours * 60 + minutes;
        const snoozeKey = `${medicine.id}_${time}`;
        const snoozeUntil = snoozedMedicines[snoozeKey];

        // Check if already taken/skipped/missed today
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
            normalizeTime(l.scheduledTime || '') === normalizeTime(time)
          );
        });

        let status: ScheduledMedicine['status'] = 'PENDING';
        
        if (log?.status === 'TAKEN') {
          status = 'TAKEN';
        } else if (log?.status === 'MISSED') {
          status = 'MISSED';
        } else if (log?.status === 'SKIPPED') {
          status = 'SKIPPED';
        } else if (snoozeUntil && snoozeUntil > now) {
          status = 'SNOOZED';
        } else if (currentMinutes > timeMinutes) {
          // Medicine time has passed
          if (currentMinutes > timeMinutes + 30) {
            // Beyond grace period = OVERDUE
            status = 'OVERDUE';
          } else {
            // Within grace period but past time = show as PENDING (will appear as late)
            status = 'PENDING';
          }
        } else if (currentMinutes < timeMinutes - 30) {
          status = 'UPCOMING';
        }

        result.push({
          medicine,
          time,
          timeMinutes,
          status,
          snoozeUntil: snoozeUntil && snoozeUntil > now ? snoozeUntil : undefined,
        });
      });
    });

    // Sort: OVERDUE first, then by time
    return result.sort((a, b) => {
      const statusOrder = { OVERDUE: 0, PENDING: 1, SNOOZED: 2, UPCOMING: 3, MISSED: 4, SKIPPED: 5, TAKEN: 6 };
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      return a.timeMinutes - b.timeMinutes;
    });
  }, [medicines, medicineLogs, snoozedMedicines, currentTime]);

  // Show alert for late medicines
  useEffect(() => {
    scheduledMedicines.forEach(m => {
      if (m.status === 'PENDING' && currentTime.getHours() * 60 + currentTime.getMinutes() > m.timeMinutes) {
        const key = `${m.medicine.id}_${m.time}`;
        if (!alertedMedicines.has(key)) {
          setAlert({ medicine: m.medicine.name, time: m.time, show: true });
          setAlertedMedicines(prev => new Set(prev).add(key));
          // Auto-hide alert after 5 seconds
          setTimeout(() => setAlert(null), 5000);
        }
      }
    });
  }, [currentTime, scheduledMedicines, alertedMedicines]);

  const pendingMedicines = scheduledMedicines.filter(m => 
    m.status !== 'TAKEN' && m.status !== 'MISSED' && m.status !== 'SKIPPED'
  );
  const completedMedicines = scheduledMedicines.filter(m => m.status === 'TAKEN');
  const missedMedicines = scheduledMedicines.filter(m => m.status === 'MISSED');
  const skippedMedicines = scheduledMedicines.filter(m => m.status === 'SKIPPED');
  const overdueCount = scheduledMedicines.filter(m => m.status === 'OVERDUE').length;

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const getTimeUntil = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const targetMinutes = hours * 60 + minutes;
    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    const diff = targetMinutes - currentMinutes;
    
    if (diff <= 0) return null;
    if (diff < 60) return `in ${diff} min`;
    const hrs = Math.floor(diff / 60);
    return `in ${hrs}h ${diff % 60}m`;
  };

  const getSnoozeRemaining = (snoozeUntil: Date) => {
    const diff = Math.ceil((snoozeUntil.getTime() - Date.now()) / 60000);
    if (diff <= 0) return null;
    return `${diff} min`;
  };

  return (
    <div className="flex-1 p-4 overflow-y-auto bg-gray-50 pb-24">
      {/* Late Medicine Alert */}
      {alert?.show && (
        <div className="mb-4 bg-red-50 border-2 border-red-400 rounded-lg p-4 flex items-start gap-3 animate-pulse shadow-lg">
          <AlertCircle size={24} className="text-red-500 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <p className="font-bold text-red-700">⏰ Medicine Late!</p>
            <p className="text-sm text-red-600 mt-1">
              {alert.medicine} was due at {alert.time}. Please take it now!
            </p>
          </div>
          <button onClick={() => setAlert(null)} className="text-red-400 hover:text-red-600">
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Today's Medicines</h1>
        <p className="text-sm text-gray-600 mt-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Summary Card */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-4 mb-6 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/80 text-sm font-medium">Today's Progress</p>
            <p className="text-3xl font-bold mt-1">
              {completedMedicines.length}/{scheduledMedicines.length}
            </p>
            <p className="text-white/80 text-xs mt-1">medicines taken</p>
          </div>
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
            <Pill size={32} className="text-white" />
          </div>
        </div>
        {overdueCount > 0 && (
          <div className="mt-3 bg-red-500/30 rounded-lg px-3 py-2 flex items-center gap-2">
            <AlertCircle size={18} />
            <span className="text-sm font-semibold">{overdueCount} medicine{overdueCount > 1 ? 's' : ''} overdue!</span>
          </div>
        )}
        {missedMedicines.length > 0 && (
          <div className="mt-2 bg-red-600/40 rounded-lg px-3 py-2 flex items-center gap-2">
            <X size={18} />
            <span className="text-sm font-semibold">{missedMedicines.length} medicine{missedMedicines.length > 1 ? 's' : ''} missed</span>
          </div>
        )}
      </div>

      {/* No Medicines */}
      {medicines.length === 0 && (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
          <Pill size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-gray-600 font-semibold">No medicines scheduled</p>
          <p className="text-sm text-gray-400 mt-1">Your caregiver will add medicines for you</p>
        </div>
      )}

      {/* Pending Medicines */}
      {pendingMedicines.length > 0 && (
        <div className="space-y-3 mb-6">
          {pendingMedicines.map((item, idx) => (
            <div 
              key={`${item.medicine.id}-${item.time}-${idx}`}
              className={`bg-white rounded-2xl shadow-sm border-2 overflow-hidden transition-all ${
                item.status === 'OVERDUE' 
                  ? 'border-red-300 bg-red-50' 
                  : item.status === 'SNOOZED'
                  ? 'border-yellow-300 bg-yellow-50'
                  : item.status === 'UPCOMING'
                  ? 'border-gray-200'
                  : 'border-blue-300 bg-blue-50'
              }`}
            >
              {/* Status Banner */}
              {item.status === 'OVERDUE' && (
                <div className="bg-red-500 text-white px-4 py-2 flex items-center gap-2">
                  <AlertCircle size={18} />
                  <span className="font-bold text-sm">OVERDUE - Take this medicine now!</span>
                </div>
              )}
              {item.status === 'SNOOZED' && item.snoozeUntil && (
                <div className="bg-yellow-500 text-white px-4 py-2 flex items-center gap-2">
                  <Bell size={18} />
                  <span className="font-bold text-sm">Snoozed - Reminder in {getSnoozeRemaining(item.snoozeUntil)}</span>
                </div>
              )}
              {item.status === 'PENDING' && (
                <div className={`px-4 py-2 flex items-center gap-2 ${
                  currentTime.getHours() * 60 + currentTime.getMinutes() > item.timeMinutes
                    ? 'bg-orange-500 text-white'
                    : 'bg-blue-500 text-white'
                }`}>
                  <Clock size={18} />
                  <span className="font-bold text-sm">
                    {currentTime.getHours() * 60 + currentTime.getMinutes() > item.timeMinutes
                      ? '⏰ LATE - Take now!'
                      : 'Due Now'
                    }
                  </span>
                </div>
              )}

              <div className="p-4">
                {/* Medicine Info */}
                <div className="flex items-start gap-4 mb-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold ${
                    item.status === 'OVERDUE' 
                      ? 'bg-red-100 text-red-600' 
                      : item.status === 'UPCOMING'
                      ? 'bg-gray-100 text-gray-500'
                      : 'bg-blue-100 text-blue-600'
                  }`}>
                    {formatTime(item.time).split(' ')[0]}
                    <span className="text-xs ml-0.5">{formatTime(item.time).split(' ')[1]}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-gray-900">{item.medicine.name}</h3>
                    <p className="text-gray-600">{item.medicine.dosage}</p>
                    {item.medicine.instructions && (
                      <p className="text-sm text-gray-500 mt-1 italic">{item.medicine.instructions}</p>
                    )}
                    {item.status === 'UPCOMING' && getTimeUntil(item.time) && (
                      <p className="text-sm text-gray-400 mt-1">⏰ {getTimeUntil(item.time)}</p>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                {item.status !== 'UPCOMING' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => onMarkTaken(item.medicine.id, item.time)}
                      className={`flex-1 py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-95 ${
                        item.status === 'OVERDUE' 
                          ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600' 
                          : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600'
                      }`}
                    >
                      <Check size={20} strokeWidth={3} />
                      {item.status === 'OVERDUE' ? "I Took It" : "Take Now"}
                    </button>
                    
                    {item.status !== 'SNOOZED' && (
                      <button
                        onClick={() => handleSnooze(item.medicine.id, item.time, 15)}
                        className="px-4 py-3 rounded-xl font-semibold border-2 border-gray-300 text-gray-600 hover:bg-gray-100 transition-all active:scale-95"
                      >
                        <Bell size={20} />
                      </button>
                    )}
                    
                    <button
                      onClick={() => onSkipMedicine(item.medicine.id, item.time, item.status === 'OVERDUE')}
                      className={`px-4 py-3 rounded-xl font-semibold border-2 transition-all active:scale-95 ${
                        item.status === 'OVERDUE'
                          ? 'border-red-300 text-red-600 hover:bg-red-50'
                          : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <X size={20} />
                    </button>
                  </div>
                )}

                {/* Upcoming - show when it's due */}
                {item.status === 'UPCOMING' && (
                  <div className="bg-gray-100 rounded-xl p-3 text-center">
                    <p className="text-gray-500 text-sm">This medicine is scheduled for later</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* All Done Message - only show if ALL medicines are taken (none missed/skipped) */}
      {pendingMedicines.length === 0 && missedMedicines.length === 0 && skippedMedicines.length === 0 && medicines.length > 0 && (
        <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6 text-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Check size={32} className="text-green-600" />
          </div>
          <h3 className="text-lg font-bold text-green-800">All Done for Today! 🎉</h3>
          <p className="text-green-600 text-sm mt-1">You've taken all your medicines</p>
        </div>
      )}

      {/* Missed Medicines Section */}
      {missedMedicines.length > 0 && (
        <div className="mb-4">
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <X size={20} className="text-red-600" />
              <span className="font-bold text-red-700">
                Missed ({missedMedicines.length})
              </span>
            </div>
            <p className="text-sm text-red-600">These medicines were not taken on time</p>
          </div>
          <div className="space-y-2">
            {missedMedicines.map((item, idx) => (
              <div 
                key={`missed-${item.medicine.id}-${item.time}-${idx}`}
                className="bg-red-50 rounded-xl p-4 flex items-center gap-4 border border-red-200"
              >
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <X size={20} className="text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-red-700">{item.medicine.name}</h3>
                  <p className="text-sm text-red-500">{item.medicine.dosage} • {formatTime(item.time)}</p>
                </div>
                <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded">MISSED</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skipped Medicines Section */}
      {skippedMedicines.length > 0 && (
        <div className="mb-4">
          <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={20} className="text-orange-600" />
              <span className="font-bold text-orange-700">
                Skipped ({skippedMedicines.length})
              </span>
            </div>
            <p className="text-sm text-orange-600">These medicines were intentionally skipped</p>
          </div>
          <div className="space-y-2">
            {skippedMedicines.map((item, idx) => (
              <div 
                key={`skipped-${item.medicine.id}-${item.time}-${idx}`}
                className="bg-orange-50 rounded-xl p-4 flex items-center gap-4 border border-orange-200"
              >
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                  <AlertCircle size={20} className="text-orange-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-orange-700">{item.medicine.name}</h3>
                  <p className="text-sm text-orange-500">{item.medicine.dosage} • {formatTime(item.time)}</p>
                </div>
                <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-1 rounded">SKIPPED</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed Section */}
      {completedMedicines.length > 0 && (
        <div>
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="w-full flex items-center justify-between py-3 px-4 bg-gray-100 rounded-xl mb-3"
          >
            <span className="font-semibold text-gray-600">
              Completed ({completedMedicines.length})
            </span>
            {showCompleted ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
          
          {showCompleted && (
            <div className="space-y-2 opacity-60">
              {completedMedicines.map((item, idx) => (
                <div 
                  key={`completed-${item.medicine.id}-${item.time}-${idx}`}
                  className="bg-white rounded-xl p-4 flex items-center gap-4 border border-gray-100"
                >
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <Check size={20} className="text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-600 line-through">{item.medicine.name}</h3>
                    <p className="text-sm text-gray-400">{item.medicine.dosage} • {formatTime(item.time)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

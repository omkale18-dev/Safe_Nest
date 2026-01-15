import React, { useState } from 'react';
import { Droplet, CheckCircle, HelpCircle, Activity, RefreshCw, Thermometer, Gauge, Plus, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { SeniorStatus, VitalReading } from '../types';
import { ManualVitalsEntry } from './ManualVitalsEntry';
import { useStepCounter } from '../hooks/useStepCounter';

interface VitalsViewProps {
  status: SeniorStatus;
  onRefresh?: () => void;
  isFitConnected?: boolean;
  vitalReadings?: VitalReading[];
  onAddVital?: (vital: Omit<VitalReading, 'id' | 'timestamp'>) => void;
  enteredBy?: 'senior' | 'caregiver';
  householdId?: string;
}

export const VitalsView: React.FC<VitalsViewProps> = ({ 
  status, 
  onRefresh, 
  isFitConnected = false, 
  vitalReadings = [],
  onAddVital,
  enteredBy = 'senior',
  householdId
}) => {
  const [showVitalsEntry, setShowVitalsEntry] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<Date | null>(null);
  const [remainingTime, setRemainingTime] = useState<string>('');
  const [stepTarget, setStepTarget] = useState<number>(() => {
    return parseInt(localStorage.getItem('safenest_step_target') || '5000', 10);
  });
  const [isEditingStepTarget, setIsEditingStepTarget] = useState(false);
  const [editStepValue, setEditStepValue] = useState(stepTarget.toString());
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  
  // Use step counter hook for real-time step detection
  const { steps, isTracking, startTracking, stopTracking } = useStepCounter(true);
  
  // Update daily steps from sensor data
  const dailySteps = steps;

  // Save step target to localStorage when it changes
  React.useEffect(() => {
    localStorage.setItem('safenest_step_target', stepTarget.toString());
  }, [stepTarget]);

  // Check cooldown on mount and when vitalReadings or householdId changes
  React.useEffect(() => {
    if (!householdId) return;
    
    const lastEntryKey = `vitalsLastCompletedEntry_${householdId}`;
    const lastEntryStr = localStorage.getItem(lastEntryKey);
    if (lastEntryStr) {
      const lastEntry = new Date(lastEntryStr);
      const cooldownEnd = new Date(lastEntry.getTime() + 1 * 24 * 60 * 60 * 1000);
      const now = new Date();
      if (now < cooldownEnd) {
        setCooldownUntil(cooldownEnd);
      } else {
        // Cooldown has expired
        setCooldownUntil(null);
        localStorage.removeItem(lastEntryKey);
      }
    }
  }, [vitalReadings, householdId]);

  // Update remaining time every minute
  React.useEffect(() => {
    if (!cooldownUntil || !householdId) return;
    
    const updateTimer = () => {
      const now = new Date();
      const diff = cooldownUntil.getTime() - now.getTime();
      
      if (diff <= 0) {
        setCooldownUntil(null);
        setRemainingTime('');
        localStorage.removeItem(`vitalsLastCompletedEntry_${householdId}`);
        
        // Clear today's vitals tracking when cooldown expires
        const today = new Date().toDateString();
        localStorage.removeItem(`vitals_entered_${householdId}_${today}`);
        return;
      }
      
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
      const mins = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
      
      setRemainingTime(`${days}d ${hours}h ${mins}m`);
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [cooldownUntil, householdId]);

  // Check if today is different from stored date, reset if needed
  React.useEffect(() => {
    if (!householdId) return;
    
    const lastEntryKey = `vitalsLastCompletedEntry_${householdId}`;
    const lastEntryStr = localStorage.getItem(lastEntryKey);
    if (lastEntryStr) {
      const lastEntry = new Date(lastEntryStr);
      const lastEntryDate = lastEntry.toDateString();
      const today = new Date().toDateString();
      
      // If it's a new day after cooldown expires, clear old tracking
      if (lastEntryDate !== today) {
        localStorage.removeItem(`vitals_entered_${householdId}_${lastEntryDate}`);
      }
    }
  }, [householdId]);

  // Get vitals for a specific date
  const getVitalsForDate = (date: Date) => {
    const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return {
      bp: vitalReadings?.find(v => {
        const vDate = v.timestamp instanceof Date ? v.timestamp : new Date(v.timestamp);
        const normalizedDate = new Date(vDate.getFullYear(), vDate.getMonth(), vDate.getDate());
        return normalizedDate.getTime() === targetDate.getTime() && v.type === 'bloodPressure';
      }),
      temp: vitalReadings?.find(v => {
        const vDate = v.timestamp instanceof Date ? v.timestamp : new Date(v.timestamp);
        const normalizedDate = new Date(vDate.getFullYear(), vDate.getMonth(), vDate.getDate());
        return normalizedDate.getTime() === targetDate.getTime() && v.type === 'temperature';
      }),
      weight: vitalReadings?.find(v => {
        const vDate = v.timestamp instanceof Date ? v.timestamp : new Date(v.timestamp);
        const normalizedDate = new Date(vDate.getFullYear(), vDate.getMonth(), vDate.getDate());
        return normalizedDate.getTime() === targetDate.getTime() && v.type === 'weight';
      }),
      bg: vitalReadings?.find(v => {
        const vDate = v.timestamp instanceof Date ? v.timestamp : new Date(v.timestamp);
        const normalizedDate = new Date(vDate.getFullYear(), vDate.getMonth(), vDate.getDate());
        return normalizedDate.getTime() === targetDate.getTime() && v.type === 'bloodSugar';
      }),
      hr: vitalReadings?.find(v => {
        const vDate = v.timestamp instanceof Date ? v.timestamp : new Date(v.timestamp);
        const normalizedDate = new Date(vDate.getFullYear(), vDate.getMonth(), vDate.getDate());
        return normalizedDate.getTime() === targetDate.getTime() && v.type === 'heartRate';
      }),
      spo2: vitalReadings?.find(v => {
        const vDate = v.timestamp instanceof Date ? v.timestamp : new Date(v.timestamp);
        const normalizedDate = new Date(vDate.getFullYear(), vDate.getMonth(), vDate.getDate());
        return normalizedDate.getTime() === targetDate.getTime() && v.type === 'spo2';
      }),
    };
  };

  // Get all dates with vital data
  const getDatesWithVitals = (): Set<number> => {
    const datesWithData = new Set<number>();
    vitalReadings?.forEach(reading => {
      const date = reading.timestamp instanceof Date ? reading.timestamp : new Date(reading.timestamp);
      const dayKey = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      datesWithData.add(dayKey);
    });
    return datesWithData;
  };

  // Get latest manual vitals
  const getLatestVital = (type: 'bloodPressure' | 'temperature' | 'weight' | 'bloodSugar' | 'heartRate' | 'spo2') => {
    const filtered = vitalReadings
      .filter(v => v.type === type && v.source === 'manual')
      .sort((a, b) => {
        const dateA = a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp);
        const dateB = b.timestamp instanceof Date ? b.timestamp : new Date(b.timestamp);
        return dateB.getTime() - dateA.getTime();
      });
    return filtered[0];
  };

  // Get vitals for selected date or latest
  const selectedDateVitals = getVitalsForDate(selectedDate);
  const isViewingSelectedDate = selectedDate.toDateString() !== new Date().toDateString();
  
  const latestBP = isViewingSelectedDate ? selectedDateVitals.bp : getLatestVital('bloodPressure');
  const latestTemp = isViewingSelectedDate ? selectedDateVitals.temp : getLatestVital('temperature');
  const latestWeight = isViewingSelectedDate ? selectedDateVitals.weight : getLatestVital('weight');
  const latestBG = isViewingSelectedDate ? selectedDateVitals.bg : getLatestVital('bloodSugar');
  const latestHR = isViewingSelectedDate ? selectedDateVitals.hr : getLatestVital('heartRate');
  const latestSpO2 = isViewingSelectedDate ? selectedDateVitals.spo2 : getLatestVital('spo2');

  const formatTimestamp = (timestamp: Date | string) => {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} mins ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hours ago`;
    return date.toLocaleDateString();
  };

  const handleSaveVital = (vital: Omit<VitalReading, 'id' | 'timestamp'>) => {
    if (onAddVital && householdId) {
      onAddVital(vital);
    }
    
    if (!householdId) return;
    
    // Store entry in localStorage for immediate tracking (household-specific)
    const today = new Date().toDateString();
    const storedKey = `vitals_entered_${householdId}_${today}`;
    const storedEntered = JSON.parse(localStorage.getItem(storedKey) || '[]') as string[];
    if (!storedEntered.includes(vital.type)) {
      storedEntered.push(vital.type);
    }
    localStorage.setItem(storedKey, JSON.stringify(storedEntered));
    
    // Check if all 4 vitals are now entered today
    if (storedEntered.length === 4) {
      const now = new Date();
      localStorage.setItem(`vitalsLastCompletedEntry_${householdId}`, now.toISOString());
      const cooldownEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      setCooldownUntil(cooldownEnd);
    }
    
    setShowVitalsEntry(false);
  };

  return (
    <div className="pb-24 pt-6 px-4 space-y-4 animate-fade-in bg-gray-50 min-h-screen overflow-y-auto">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-3xl font-black text-gray-900">Vitals</h1>
        <button className="text-gray-400 hover:text-gray-600">
           <HelpCircle size={24} />
        </button>
      </div>

      {/* Sync Status */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center justify-between">
         <div className="flex items-center gap-2">
            <div className="bg-green-100 rounded-full p-1">
                <CheckCircle size={16} className="text-green-500" />
            </div>
            <span className="text-sm text-gray-600 font-medium">Manually tracked</span>
         </div>
         <button
           onClick={() => setShowCalendar(!showCalendar)}
           className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
         >
           <Calendar size={16} />
           <span className="text-xs font-bold">History</span>
         </button>
      </div>

      {/* Calendar Modal */}
      {showCalendar && (
        <>
          {/* Backdrop */}
          <div 
            onClick={() => setShowCalendar(false)}
            className="fixed inset-0 bg-black/50 z-40"
          />
          {/* Modal */}
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl p-6 shadow-2xl border border-gray-100 space-y-4 w-full max-w-sm max-h-[90vh] overflow-y-auto z-50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Select Date</h3>
              <button
                onClick={() => setShowCalendar(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            {/* Calendar Navigation */}
          <div className="flex items-center justify-between gap-4 mb-4">
            <button
              onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ChevronLeft size={20} className="text-gray-600" />
            </button>
            <h4 className="font-bold text-gray-900 text-center flex-1">
              {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h4>
            <button
              onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ChevronRight size={20} className="text-gray-600" />
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-2">
            {/* Day headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-xs font-bold text-gray-500 py-2">
                {day}
              </div>
            ))}

            {/* Calendar days */}
            {(() => {
              const year = calendarMonth.getFullYear();
              const month = calendarMonth.getMonth();
              const firstDay = new Date(year, month, 1);
              const lastDay = new Date(year, month + 1, 0);
              const daysInMonth = lastDay.getDate();
              const startingDayOfWeek = firstDay.getDay();
              
              const days = [];
              const datesWithData = getDatesWithVitals();

              // Empty cells before month starts
              for (let i = 0; i < startingDayOfWeek; i++) {
                days.push(
                  <div key={`empty-${i}`} className="p-2"></div>
                );
              }

              // Days of month
              for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(year, month, day);
                const dateKey = date.getTime();
                const hasData = datesWithData.has(dateKey);
                const isSelected = selectedDate.toDateString() === date.toDateString();
                const isToday = new Date().toDateString() === date.toDateString();

                days.push(
                  <button
                    key={day}
                    onClick={() => {
                      setSelectedDate(date);
                      setShowCalendar(false);
                    }}
                    className={`p-2 rounded-lg text-sm font-bold transition-all ${
                      isSelected
                        ? 'bg-blue-500 text-white shadow-md'
                        : hasData
                        ? 'bg-green-100 text-gray-900 hover:bg-green-200'
                        : isToday
                        ? 'bg-gray-200 text-gray-900 hover:bg-gray-300'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {day}
                    {hasData && <div className="w-1 h-1 bg-green-500 rounded-full mx-auto mt-1"></div>}
                  </button>
                );
              }

              return days;
            })()}
          </div>

          <button
            onClick={() => setShowCalendar(false)}
            className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200 transition"
          >
            Close
          </button>
          </div>
        </>
      )}

      {/* Date Display */}
      {selectedDate.toDateString() !== new Date().toDateString() && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
          <p className="text-sm text-blue-700 font-bold">
            Viewing vitals from: <span className="text-blue-900">{selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </p>
        </div>
      )}

      {/* Blood Pressure Card (New) */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center">
                      <Gauge className="text-orange-500" size={24} />
                  </div>
                  <div>
                      <h3 className="font-bold text-gray-900 text-lg">Blood Pressure</h3>
                      <p className="text-gray-500 text-sm">{latestBP ? formatTimestamp(latestBP.timestamp) : 'No data'}</p>
                  </div>
              </div>
              {latestBP && (
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  (latestBP.value as { systolic: number }).systolic > 140 
                    ? 'bg-red-100 text-red-700' 
                    : 'bg-green-100 text-green-700'
                }`}>
                    {(latestBP.value as { systolic: number }).systolic > 140 ? 'Elevated' : 'Normal'}
                </span>
              )}
          </div>

          <div className="flex items-end gap-2 mb-2">
              <span className="text-5xl font-black text-gray-900">
                {latestBP 
                  ? `${(latestBP.value as { systolic: number; diastolic: number }).systolic}/${(latestBP.value as { systolic: number; diastolic: number }).diastolic}`
                  : '--/--'}
              </span>
              <span className="text-gray-500 font-bold mb-1">mmHg</span>
          </div>

          <p className="text-gray-500 text-sm font-medium">
             {latestBP ? 'Recent reading' : 'Add your first blood pressure reading'}
          </p>
      </div>

      {/* Temperature Card */}
      {latestTemp && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-yellow-50 rounded-full flex items-center justify-center">
                        <Thermometer className="text-yellow-500" size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 text-lg">Temperature</h3>
                        <p className="text-gray-500 text-sm">{formatTimestamp(latestTemp.timestamp)}</p>
                    </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  (latestTemp.value as number) > 100.4 
                    ? 'bg-red-100 text-red-700' 
                    : 'bg-green-100 text-green-700'
                }`}>
                    {(latestTemp.value as number) > 100.4 ? 'Fever' : 'Normal'}
                </span>
            </div>

            <div className="flex items-end gap-2 mb-2">
                <span className="text-5xl font-black text-gray-900">{(latestTemp.value as number).toFixed(1)}</span>
                <span className="text-gray-500 font-bold mb-1">°F</span>
            </div>
        </div>
      )}

      {/* Weight Card */}
      {latestWeight && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center">
                        <Activity className="text-purple-500" size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 text-lg">Weight</h3>
                        <p className="text-gray-500 text-sm">{formatTimestamp(latestWeight.timestamp)}</p>
                    </div>
                </div>
            </div>

            <div className="flex items-end gap-2 mb-2">
                <span className="text-5xl font-black text-gray-900">{(latestWeight.value as number).toFixed(1)}</span>
                <span className="text-gray-500 font-bold mb-1">kg</span>
            </div>
        </div>
      )}

      {/* Blood Sugar Card */}
      {latestBG && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-pink-50 rounded-full flex items-center justify-center">
                        <Droplet className="text-pink-500" size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 text-lg">Blood Sugar</h3>
                        <p className="text-gray-500 text-sm">{formatTimestamp(latestBG.timestamp)}</p>
                    </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  (latestBG.value as number) > 180 || (latestBG.value as number) < 70
                    ? 'bg-red-100 text-red-700' 
                    : 'bg-green-100 text-green-700'
                }`}>
                    {(latestBG.value as number) > 180 ? 'High' : (latestBG.value as number) < 70 ? 'Low' : 'Normal'}
                </span>
            </div>

            <div className="flex items-end gap-2 mb-2">
                <span className="text-5xl font-black text-gray-900">{Math.round(latestBG.value as number)}</span>
                <span className="text-gray-500 font-bold mb-1">mg/dL</span>
            </div>
        </div>
      )}

      {/* SpO2 (Oxygen Saturation) Card */}
      {latestSpO2 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-cyan-50 rounded-full flex items-center justify-center">
                        <Activity className="text-cyan-500" size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 text-lg">Oxygen Saturation</h3>
                        <p className="text-gray-500 text-sm">{formatTimestamp(latestSpO2.timestamp)}</p>
                    </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  (latestSpO2.value as number) < 95
                    ? 'bg-red-100 text-red-700' 
                    : 'bg-green-100 text-green-700'
                }`}>
                    {(latestSpO2.value as number) < 95 ? 'Low' : 'Normal'}
                </span>
            </div>

            <div className="flex items-end gap-2 mb-2">
                <span className="text-5xl font-black text-gray-900">{Math.round(latestSpO2.value as number)}</span>
                <span className="text-gray-500 font-bold mb-1">%</span>
            </div>
        </div>
      )}

      {/* Manual Heart Rate Card */}
      {latestHR && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
                        <Activity className="text-red-500" size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 text-lg">Heart Rate (Manual)</h3>
                        <p className="text-gray-500 text-sm">{formatTimestamp(latestHR.timestamp)}</p>
                    </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  (latestHR.value as number) > 100 || (latestHR.value as number) < 60
                    ? 'bg-yellow-100 text-yellow-700' 
                    : 'bg-green-100 text-green-700'
                }`}>
                    {(latestHR.value as number) > 100 ? 'High' : (latestHR.value as number) < 60 ? 'Low' : 'Normal'}
                </span>
            </div>

            <div className="flex items-end gap-2 mb-2">
                <span className="text-5xl font-black text-gray-900">{Math.round(latestHR.value as number)}</span>
                <span className="text-gray-500 font-bold mb-1">BPM</span>
            </div>
        </div>
      )}

      {/* Daily Steps Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-teal-50 rounded-full flex items-center justify-center">
                      <Activity className="text-teal-500" size={24} />
                  </div>
                  <div>
                      <h3 className="font-bold text-gray-900 text-lg">Daily Steps</h3>
                      <p className="text-gray-500 text-sm">{isTracking ? 'Tracking...' : 'Activity'}</p>
                  </div>
              </div>
              <div className="flex items-center gap-2">
                {!isEditingStepTarget ? (
                  <button
                    onClick={() => {
                      setIsEditingStepTarget(true);
                      setEditStepValue(stepTarget.toString());
                    }}
                    className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-bold hover:bg-gray-200 transition-colors"
                  >
                    Goal: {stepTarget.toLocaleString()}
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={editStepValue}
                      onChange={(e) => setEditStepValue(e.target.value)}
                      className="w-20 px-2 py-1 rounded text-xs border border-gray-300 text-gray-900"
                      min="100"
                      max="50000"
                    />
                    <button
                      onClick={() => {
                        const newValue = parseInt(editStepValue, 10);
                        if (!isNaN(newValue) && newValue > 0) {
                          setStepTarget(newValue);
                          setIsEditingStepTarget(false);
                        }
                      }}
                      className="bg-blue-500 text-white px-2 py-1 rounded text-xs font-bold hover:bg-blue-600"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setIsEditingStepTarget(false)}
                      className="bg-gray-300 text-gray-700 px-2 py-1 rounded text-xs font-bold hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
          </div>

          <div className="flex items-end gap-2 mb-2">
              <span className="text-5xl font-black text-gray-900">{dailySteps.toLocaleString()}</span>
              <span className="text-gray-500 font-bold mb-1">steps</span>
          </div>

          <div className="mb-2 flex justify-between items-center text-xs text-gray-500 font-medium">
             <span>Progress</span>
             <span>{Math.round((dailySteps / stepTarget) * 100)}%</span>
          </div>

          <div className="relative mb-4">
            <div className="overflow-hidden h-2.5 text-xs flex rounded-full bg-gray-100">
                <div style={{ width: `${Math.min((dailySteps / stepTarget) * 100, 100)}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-teal-400 rounded-full"></div>
            </div>
          </div>
          
          <p className="text-gray-500 text-sm font-medium">
             {dailySteps < stepTarget ? `${(stepTarget - dailySteps).toLocaleString()} steps to go!` : 'Goal achieved! 🎉'}
          </p>
      </div>

      {/* Cooldown Message */}
      {cooldownUntil && (
        <div className="fixed bottom-32 left-4 right-4 bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 shadow-lg z-30">
          <div className="flex items-start gap-3">
            <div className="text-2xl mt-0.5">⏱️</div>
            <div>
              <p className="font-bold text-amber-900">You've completed all 6 vitals!</p>
              <p className="text-sm text-amber-700 mt-1">Come back in <span className="font-bold">{remainingTime}</span> to log again.</p>
            </div>
          </div>
        </div>
      )}

      {/* Add Vitals Button (Floating) */}
      {onAddVital && (
        <button
          onClick={() => setShowVitalsEntry(true)}
          disabled={!!cooldownUntil}
          className={`fixed bottom-24 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white transition-all active:scale-95 z-40 ${
            cooldownUntil
              ? 'bg-gray-300 opacity-50 cursor-not-allowed'
              : 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-300 hover:shadow-xl'
          }`}
          aria-label="Add Vitals"
        >
          <Plus size={28} strokeWidth={2.5} />
        </button>
      )}

      {/* Manual Vitals Entry Modal */}
      {showVitalsEntry && onAddVital && (
        <ManualVitalsEntry
          onSave={handleSaveVital}
          onClose={() => setShowVitalsEntry(false)}
          enteredBy={enteredBy}
        />
      )}

    </div>
  );
};
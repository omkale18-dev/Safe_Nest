import React, { useState } from 'react';
import { Droplet, CheckCircle, HelpCircle, Activity, RefreshCw, Thermometer, Gauge, Plus, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { SeniorStatus, VitalReading } from '../types';
import { ManualVitalsEntry } from './ManualVitalsEntry';
import { useStepCounter } from '../hooks/useStepCounter';
import { useLanguage } from '../i18n/LanguageContext';

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
  const { t } = useLanguage();
  const [showVitalsEntry, setShowVitalsEntry] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
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

  // Get vitals for a specific date
  const getVitalsForDate = (date: Date) => {
    const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayStart = targetDate.getTime();
    const dayEnd = dayStart + (24 * 60 * 60 * 1000);
    
    return {
      bp: vitalReadings?.find(v => {
        const vDate = v.timestamp instanceof Date ? v.timestamp : new Date(v.timestamp);
        return vDate.getTime() >= dayStart && vDate.getTime() < dayEnd && v.type === 'bloodPressure' && v.source === 'manual';
      }),
      temp: vitalReadings?.find(v => {
        const vDate = v.timestamp instanceof Date ? v.timestamp : new Date(v.timestamp);
        return vDate.getTime() >= dayStart && vDate.getTime() < dayEnd && v.type === 'temperature' && v.source === 'manual';
      }),
      weight: vitalReadings?.find(v => {
        const vDate = v.timestamp instanceof Date ? v.timestamp : new Date(v.timestamp);
        return vDate.getTime() >= dayStart && vDate.getTime() < dayEnd && v.type === 'weight' && v.source === 'manual';
      }),
      bg: vitalReadings?.find(v => {
        const vDate = v.timestamp instanceof Date ? v.timestamp : new Date(v.timestamp);
        return vDate.getTime() >= dayStart && vDate.getTime() < dayEnd && v.type === 'bloodSugar' && v.source === 'manual';
      }),
      hr: vitalReadings?.find(v => {
        const vDate = v.timestamp instanceof Date ? v.timestamp : new Date(v.timestamp);
        return vDate.getTime() >= dayStart && vDate.getTime() < dayEnd && v.type === 'heartRate' && v.source === 'manual';
      }),
      spo2: vitalReadings?.find(v => {
        const vDate = v.timestamp instanceof Date ? v.timestamp : new Date(v.timestamp);
        return vDate.getTime() >= dayStart && vDate.getTime() < dayEnd && v.type === 'spo2' && v.source === 'manual';
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

  // Get vitals for selected date or today's vitals (not latest from previous days)
  const selectedDateVitals = getVitalsForDate(selectedDate);
  const todaysVitals = getVitalsForDate(new Date()); // Today's actual vitals
  const isViewingSelectedDate = selectedDate.toDateString() !== new Date().toDateString();
  
  // Show selected date vitals, or today's vitals (not previous day's data)
  // If today has no data, show null (undefined) instead of previous day's data
  const latestBP = isViewingSelectedDate ? selectedDateVitals.bp : todaysVitals.bp;
  const latestTemp = isViewingSelectedDate ? selectedDateVitals.temp : todaysVitals.temp;
  const latestWeight = isViewingSelectedDate ? selectedDateVitals.weight : todaysVitals.weight;
  const latestBG = isViewingSelectedDate ? selectedDateVitals.bg : todaysVitals.bg;
  const latestHR = isViewingSelectedDate ? selectedDateVitals.hr : todaysVitals.hr;
  const latestSpO2 = isViewingSelectedDate ? selectedDateVitals.spo2 : todaysVitals.spo2;

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

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (onRefresh) {
        await onRefresh();
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSaveVital = (vital: Omit<VitalReading, 'id' | 'timestamp'>) => {
    if (onAddVital && householdId) {
      onAddVital(vital);
    }
    
    setShowVitalsEntry(false);
    // Reset to today's view after saving
    setSelectedDate(new Date());
    
    // Refresh vitals data from Firebase after saving
    if (onRefresh) {
      // Use a longer delay to ensure Firebase has updated
      setTimeout(() => onRefresh(), 2000);
    }
  };

  return (
    <div className="pb-24 pt-6 px-4 space-y-4 animate-fade-in bg-gray-50 min-h-screen overflow-y-auto">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-3xl font-black text-gray-900">Vitals</h1>
        <button 
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          title="Refresh vitals data"
        >
           <RefreshCw size={24} className={isRefreshing ? 'animate-spin' : ''} />
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
                    {(latestBG.value as number) > 180 ? t.high : (latestBG.value as number) < 70 ? t.low : t.normal}
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
                    {(latestSpO2.value as number) < 95 ? t.low : t.normal}
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
                    {(latestHR.value as number) > 100 ? t.high : (latestHR.value as number) < 60 ? t.low : t.normal}
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

      {/* Add Vitals Button (Floating) */}
      {onAddVital && (
        <button
          onClick={() => setShowVitalsEntry(true)}
          className="fixed bottom-24 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white transition-all active:scale-95 z-40 bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-300 hover:shadow-xl"
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
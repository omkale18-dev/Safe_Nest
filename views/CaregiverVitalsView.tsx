import React, { useState } from 'react';
import { Heart, Droplet, Thermometer, Gauge, Activity, Plus, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { VitalReading, SeniorStatus } from '../types';
import { ManualVitalsEntry } from './ManualVitalsEntry';
import { useLanguage } from '../i18n/LanguageContext';

interface CaregiverVitalsViewProps {
  vitalReadings: VitalReading[];
  onAddVital: (vital: Omit<VitalReading, 'id' | 'timestamp'>) => void;
  seniorStatus?: SeniorStatus;
}

export const CaregiverVitalsView: React.FC<CaregiverVitalsViewProps> = ({
  vitalReadings,
  onAddVital,
  seniorStatus,
}) => {
  const { t } = useLanguage();
  const [showVitalsEntry, setShowVitalsEntry] = useState(false);
  const [stepTarget, setStepTarget] = useState<number>(() => {
    return parseInt(localStorage.getItem('safenest_caregiver_step_target') || '5000', 10);
  });
  const [isEditingStepTarget, setIsEditingStepTarget] = useState(false);
  const [editStepValue, setEditStepValue] = useState(stepTarget.toString());
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());

  // Get daily steps from senior status
  const dailySteps = seniorStatus?.steps || 0;

  // Save step target to localStorage when it changes
  React.useEffect(() => {
    localStorage.setItem('safenest_caregiver_step_target', stepTarget.toString());
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

  // Get latest readings for each vital type
  const getLatestVital = (type: VitalReading['type']) => {
    const filtered = vitalReadings
      .filter(v => v.type === type)
      .sort((a, b) => {
        const dateA = a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp);
        const dateB = b.timestamp instanceof Date ? b.timestamp : new Date(b.timestamp);
        return dateB.getTime() - dateA.getTime();
      });
    return filtered[0];
  };

  // Always get vitals for the selected date (including today)
  const selectedDateVitals = getVitalsForDate(selectedDate);
  const isViewingToday = selectedDate.toDateString() === new Date().toDateString();
  
  // Always use date-specific vitals, never show latest across all dates
  const latestBP = selectedDateVitals.bp;
  const latestHR = selectedDateVitals.hr;
  const latestTemp = selectedDateVitals.temp;
  const latestWeight = selectedDateVitals.weight;
  const latestBG = selectedDateVitals.bg;
  const latestSpO2 = selectedDateVitals.spo2;

  const formatTimestamp = (timestamp: Date | string) => {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} mins ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const handleSaveVital = (vital: Omit<VitalReading, 'id' | 'timestamp'>) => {
    onAddVital({ ...vital, enteredBy: 'caregiver' });
    setShowVitalsEntry(false);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 pb-24">
      <div className="p-6 space-y-4">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Daily Vitals</h2>
              <p className="text-sm text-gray-600 mt-1">
                {isViewingToday ? "Today's readings" : `Readings for ${selectedDate.toLocaleDateString()}`}
              </p>
            </div>
            <button
              onClick={() => setShowCalendar(!showCalendar)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
            >
              <Calendar size={16} />
              <span className="text-xs font-bold">History</span>
            </button>
          </div>
        </div>

        {/* Date Display - always show when not today */}
        {!isViewingToday && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center mb-4">
            <p className="text-sm text-blue-700 font-bold">
              Viewing vitals from: <span className="text-blue-900">{selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </p>
            <button 
              onClick={() => setSelectedDate(new Date())}
              className="mt-2 text-xs text-blue-600 underline hover:text-blue-800"
            >
              View Today
            </button>
          </div>
        )}

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

        {/* Blood Pressure Card */}
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
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  (latestBP.value as { systolic: number }).systolic > 140
                    ? 'bg-red-100 text-red-700'
                    : 'bg-green-100 text-green-700'
                }`}
              >
                {(latestBP.value as { systolic: number }).systolic > 140 ? 'Elevated' : 'Normal'}
              </span>
            )}
          </div>

          <div className="flex items-end gap-2 mb-2">
            <span className="text-5xl font-black text-gray-900">
              {latestBP
                ? `${(latestBP.value as { systolic: number; diastolic: number }).systolic}/${
                    (latestBP.value as { systolic: number; diastolic: number }).diastolic
                  }`
                : '--/--'}
            </span>
            <span className="text-gray-500 font-bold mb-1">mmHg</span>
          </div>

          <p className="text-gray-500 text-sm font-medium">
            {latestBP ? 'Latest reading' : 'Add first blood pressure reading'}
          </p>
        </div>

        {/* Daily Steps Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-teal-50 rounded-full flex items-center justify-center">
                <Activity size={24} className="text-teal-500" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg">Daily Steps</h3>
                <p className="text-gray-500 text-sm">Today's activity</p>
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

          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-bold text-gray-700">Daily Goal: {stepTarget.toLocaleString()} steps</span>
            <span>{Math.round((dailySteps / stepTarget) * 100)}%</span>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div style={{ width: `${Math.min((dailySteps / stepTarget) * 100, 100)}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-teal-400 rounded-full h-full transition-all duration-500"></div>
          </div>

          <p className="text-gray-500 text-sm font-medium mt-2">
            {dailySteps < stepTarget ? `${(stepTarget - dailySteps).toLocaleString()} steps to go!` : 'Goal achieved! 🎉'}
          </p>
        </div>

        {/* Heart Rate Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
                <Heart size={24} className="text-red-500" fill="currentColor" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg">Heart Rate</h3>
                <p className="text-gray-500 text-sm">{latestHR ? formatTimestamp(latestHR.timestamp) : 'No data'}</p>
              </div>
            </div>
            {latestHR && (
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  (latestHR.value as number) < 60 || (latestHR.value as number) > 100
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-green-100 text-green-700'
                }`}
              >
                {(latestHR.value as number) < 60 || (latestHR.value as number) > 100 ? 'Abnormal' : 'Normal'}
              </span>
            )}
          </div>

          <div className="flex items-end gap-2 mb-2">
            <span className="text-5xl font-black text-gray-900">{latestHR ? Math.round(latestHR.value as number) : '--'}</span>
            <span className="text-gray-500 font-bold mb-1">bpm</span>
          </div>

          <p className="text-gray-500 text-sm font-medium">
            {latestHR ? 'Latest reading' : 'Add first heart rate reading'}
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
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  (latestTemp.value as number) > 100.4
                    ? 'bg-red-100 text-red-700'
                    : 'bg-green-100 text-green-700'
                }`}
              >
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
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  (latestBG.value as number) > 180 || (latestBG.value as number) < 70
                    ? 'bg-red-100 text-red-700'
                    : 'bg-green-100 text-green-700'
                }`}
              >
                {(latestBG.value as number) > 180 ? t.high : (latestBG.value as number) < 70 ? t.low : t.normal}
              </span>
            </div>

            <div className="flex items-end gap-2 mb-2">
              <span className="text-5xl font-black text-gray-900">{Math.round(latestBG.value as number)}</span>
              <span className="text-gray-500 font-bold mb-1">mg/dL</span>
            </div>
          </div>
        )}

        {/* SpO2 Card */}
        {latestSpO2 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
                  <div className="text-blue-500 font-bold text-lg">O₂</div>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">Blood Oxygen</h3>
                  <p className="text-gray-500 text-sm">{formatTimestamp(latestSpO2.timestamp)}</p>
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  (latestSpO2.value as number) < 95
                    ? 'bg-red-100 text-red-700'
                    : 'bg-green-100 text-green-700'
                }`}
              >
                {(latestSpO2.value as number) < 95 ? t.low : t.good}
              </span>
            </div>

            <div className="flex items-end gap-2 mb-2">
              <span className="text-5xl font-black text-gray-900">{Math.round(latestSpO2.value as number)}</span>
              <span className="text-gray-500 font-bold mb-1">%</span>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!latestBP && !latestHR && !latestTemp && !latestWeight && !latestBG && (
          <div className="bg-gray-50 rounded-2xl p-8 text-center border border-gray-100 mt-6">
            <Gauge className="mx-auto mb-4 text-gray-400" size={48} />
            <p className="text-gray-600 font-semibold">No vitals recorded yet</p>
            <p className="text-sm text-gray-500 mt-1">Add vital readings below to track daily data</p>
          </div>
        )}

        {/* Add Vitals Button */}
        <button
          onClick={() => setShowVitalsEntry(true)}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 mt-6"
        >
          <Plus size={24} strokeWidth={2.5} />
          Add Vital Reading
        </button>
      </div>

      {/* Manual Vitals Entry Modal */}
      {showVitalsEntry && (
        <ManualVitalsEntry
          onSave={handleSaveVital}
          onClose={() => setShowVitalsEntry(false)}
          enteredBy="caregiver"
        />
      )}
    </div>
  );
};

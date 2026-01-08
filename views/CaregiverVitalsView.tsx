import React, { useState } from 'react';
import { Heart, Droplet, Thermometer, Gauge, Activity, Plus } from 'lucide-react';
import { VitalReading } from '../types';
import { ManualVitalsEntry } from './ManualVitalsEntry';

interface CaregiverVitalsViewProps {
  vitalReadings: VitalReading[];
  onAddVital: (vital: Omit<VitalReading, 'id' | 'timestamp'>) => void;
}

export const CaregiverVitalsView: React.FC<CaregiverVitalsViewProps> = ({
  vitalReadings,
  onAddVital,
}) => {
  const [showVitalsEntry, setShowVitalsEntry] = useState(false);

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

  const latestBP = getLatestVital('bloodPressure');
  const latestHR = getLatestVital('heartRate');
  const latestTemp = getLatestVital('temperature');
  const latestWeight = getLatestVital('weight');
  const latestBG = getLatestVital('bloodSugar');
  const latestSpO2 = getLatestVital('spo2');

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
          <h2 className="text-2xl font-bold text-gray-900">Daily Vitals</h2>
          <p className="text-sm text-gray-600 mt-1">Latest readings for the senior</p>
        </div>

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
                {(latestBG.value as number) > 180 ? 'High' : (latestBG.value as number) < 70 ? 'Low' : 'Normal'}
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
                {(latestSpO2.value as number) < 95 ? 'Low' : 'Good'}
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

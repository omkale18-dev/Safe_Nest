import React, { useState } from 'react';
import { X, AlertCircle, Heart, Thermometer, Scale } from 'lucide-react';
import { VitalReading } from '../types';

interface ManualVitalsEntryProps {
  onSave: (vital: Omit<VitalReading, 'id' | 'timestamp'>) => void;
  onClose: () => void;
  enteredBy: 'senior' | 'caregiver';
}

export const ManualVitalsEntry: React.FC<ManualVitalsEntryProps> = ({ onSave, onClose, enteredBy }) => {
  const [activeTab, setActiveTab] = useState<'bloodPressure' | 'temperature' | 'weight' | 'heartRate'>('bloodPressure');
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [temperature, setTemperature] = useState('');
  const [tempUnit, setTempUnit] = useState<'F' | 'C'>('F');
  const [weight, setWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');
  const [heartRate, setHeartRate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const validateAndSave = () => {
    setError('');
    
    if (activeTab === 'bloodPressure') {
      const sys = parseInt(systolic);
      const dia = parseInt(diastolic);
      
      if (!systolic || !diastolic || isNaN(sys) || isNaN(dia)) {
        setError('Please enter both systolic and diastolic values');
        return;
      }
      
      if (sys < 80 || sys > 200) {
        setError('Systolic pressure must be between 80-200 mmHg');
        return;
      }
      
      if (dia < 40 || dia > 120) {
        setError('Diastolic pressure must be between 40-120 mmHg');
        return;
      }
      
      // Warning for high BP
      if (sys > 140 || dia > 90) {
        if (!window.confirm('⚠️ High blood pressure detected (>140/90). Save anyway?')) {
          return;
        }
      }
      
      onSave({
        type: 'bloodPressure',
        value: { systolic: sys, diastolic: dia },
        source: 'manual',
        enteredBy,
        notes: notes || undefined,
      });
      
    } else if (activeTab === 'temperature') {
      const temp = parseFloat(temperature);
      
      if (!temperature || isNaN(temp)) {
        setError('Please enter temperature');
        return;
      }
      
      const tempF = tempUnit === 'F' ? temp : (temp * 9/5) + 32;
      
      if (tempF < 95 || tempF > 105) {
        setError('Temperature must be between 95-105°F');
        return;
      }
      
      // Warning for fever
      if (tempF > 100.4) {
        if (!window.confirm('🔥 Fever detected (>100.4°F). Save anyway?')) {
          return;
        }
      }
      
      onSave({
        type: 'temperature',
        value: tempF,
        source: 'manual',
        enteredBy,
        notes: notes || undefined,
      });
      
    } else if (activeTab === 'weight') {
      const wt = parseFloat(weight);
      
      if (!weight || isNaN(wt)) {
        setError('Please enter weight');
        return;
      }
      
      const wtKg = weightUnit === 'kg' ? wt : wt * 0.453592;
      
      if (wtKg < 30 || wtKg > 200) {
        setError('Weight must be between 30-200 kg');
        return;
      }
      
      onSave({
        type: 'weight',
        value: wtKg,
        source: 'manual',
        enteredBy,
        notes: notes || undefined,
      });
      
    } else if (activeTab === 'heartRate') {
      const hr = parseInt(heartRate);
      
      if (!heartRate || isNaN(hr)) {
        setError('Please enter heart rate');
        return;
      }
      
      if (hr < 40 || hr > 200) {
        setError('Heart rate must be between 40-200 bpm');
        return;
      }
      
      // Warning for abnormal heart rate
      if (hr < 60 || hr > 100) {
        if (!window.confirm('⚠️ Abnormal heart rate detected (<60 or >100 bpm). Save anyway?')) {
          return;
        }
      }
      
      onSave({
        type: 'heartRate',
        value: hr,
        source: 'manual',
        enteredBy,
        notes: notes || undefined,
      });
    }
    
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center rounded-t-2xl">
          <h3 className="text-2xl font-bold text-gray-900">Add Vitals</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6 bg-gray-50 overflow-x-auto">
          <button
            onClick={() => setActiveTab('bloodPressure')}
            className={`flex items-center gap-2 px-4 py-3 font-semibold transition-colors ${
              activeTab === 'bloodPressure'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Heart size={18} />
            BP
          </button>
          <button
            onClick={() => setActiveTab('temperature')}
            className={`flex items-center gap-2 px-4 py-3 font-semibold transition-colors ${
              activeTab === 'temperature'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Thermometer size={18} />
            Temp
          </button>
          <button
            onClick={() => setActiveTab('weight')}
            className={`flex items-center gap-2 px-4 py-3 font-semibold transition-colors ${
              activeTab === 'weight'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Scale size={18} />
            Weight
          </button>
          <button
            onClick={() => setActiveTab('heartRate')}
            className={`flex items-center gap-2 px-4 py-3 font-semibold transition-colors ${
              activeTab === 'heartRate'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Heart size={18} />
            HR
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-semibold text-red-800">{error}</p>
            </div>
          )}

          {/* Blood Pressure */}
          {activeTab === 'bloodPressure' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Systolic (Upper)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={systolic}
                    onChange={(e) => setSystolic(e.target.value)}
                    placeholder="120"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-lg font-semibold"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">mmHg</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Diastolic (Lower)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={diastolic}
                    onChange={(e) => setDiastolic(e.target.value)}
                    placeholder="80"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-lg font-semibold"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">mmHg</span>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <p className="text-xs text-blue-800">
                  <strong>Normal:</strong> &lt;120/80 • <strong>Elevated:</strong> 120-129/&lt;80 • <strong>High:</strong> ≥140/90
                </p>
              </div>
            </div>
          )}

          {/* Temperature */}
          {activeTab === 'temperature' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Temperature</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      step="0.1"
                      value={temperature}
                      onChange={(e) => setTemperature(e.target.value)}
                      placeholder="98.6"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-lg font-semibold"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">°{tempUnit}</span>
                  </div>
                  <button
                    onClick={() => setTempUnit(tempUnit === 'F' ? 'C' : 'F')}
                    className="px-4 py-3 border-2 border-gray-200 rounded-xl font-bold text-gray-700 hover:bg-gray-50"
                  >
                    °{tempUnit === 'F' ? 'C' : 'F'}
                  </button>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <p className="text-xs text-blue-800">
                  <strong>Normal:</strong> 97-99°F (36.1-37.2°C) • <strong>Fever:</strong> &gt;100.4°F (38°C)
                </p>
              </div>
            </div>
          )}

          {/* Weight */}
          {activeTab === 'weight' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Weight</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      step="0.1"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      placeholder="70"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-lg font-semibold"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">{weightUnit}</span>
                  </div>
                  <button
                    onClick={() => setWeightUnit(weightUnit === 'kg' ? 'lbs' : 'kg')}
                    className="px-4 py-3 border-2 border-gray-200 rounded-xl font-bold text-gray-700 hover:bg-gray-50"
                  >
                    {weightUnit === 'kg' ? 'lbs' : 'kg'}
                  </button>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <p className="text-xs text-blue-800">
                  Track daily to detect fluid retention (&gt;2kg in 3 days) or malnutrition (&gt;5kg loss)
                </p>
              </div>
            </div>
          )}

          {/* Heart Rate */}
          {activeTab === 'heartRate' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Heart Rate</label>
                <div className="relative">
                  <input
                    type="number"
                    value={heartRate}
                    onChange={(e) => setHeartRate(e.target.value)}
                    placeholder="72"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-lg font-semibold"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">bpm</span>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <p className="text-xs text-blue-800">
                  <strong>Normal (Resting):</strong> 60-100 bpm • <strong>Elevated:</strong> &gt;100 bpm • <strong>Low:</strong> &lt;60 bpm
                </p>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., After morning walk, Before medication"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none resize-none"
              rows={2}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={validateAndSave}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-md"
            >
              Save Vital
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useMemo } from 'react';
import { Lightbulb, Droplets, Footprints, HeartPulse, Wind, CheckCircle } from 'lucide-react';
import type { VitalReading, MedicineLog } from '../types';

interface ActivitySuggestionsProps {
  vitalReadings: VitalReading[];
  medicineLogs: MedicineLog[];
}

export const ActivitySuggestions: React.FC<ActivitySuggestionsProps> = ({ vitalReadings, medicineLogs }) => {
  const suggestions = useMemo(() => {
    const items: Array<{ icon: React.ReactNode; text: string }> = [];

    const today = new Date();
    const isToday = (d: Date | string) => {
      const date = d instanceof Date ? d : new Date(d);
      const a = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
      const b = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      return a === b;
    };

    const recentHR = vitalReadings
      .filter(v => v.type === 'heartRate')
      .slice()
      .sort((a, b) => (new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()))[0] as VitalReading | undefined;

    const recentSpO2 = vitalReadings
      .filter(v => v.type === 'spo2')
      .slice()
      .sort((a, b) => (new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()))[0] as VitalReading | undefined;

    // Only count truly missed doses that haven't been taken
    // Build a set of taken medicine+time combinations
    const takenDoses = new Set(
      medicineLogs
        .filter(l => isToday(l.date) && l.status === 'TAKEN')
        .map(l => `${l.medicineId}_${l.scheduledTime}`)
    );
    
    // Count MISSED doses that don't have a corresponding TAKEN entry
    const trulyMissed = medicineLogs.filter(l => {
      if (!isToday(l.date) || l.status !== 'MISSED') return false;
      const key = `${l.medicineId}_${l.scheduledTime}`;
      return !takenDoses.has(key);
    }).length;

    if (trulyMissed > 0) {
      items.push({ icon: <CheckCircle size={18} className="text-orange-600" />, text: 'You missed a dose today. Keep water nearby and set a snooze to take the next one on time.' });
    }

    // Light walk suggestion if steps low (approximation via absence of readings)
    items.push({ icon: <Footprints size={18} className="text-blue-600" />, text: 'Consider a 10–15 minute light walk if you feel okay.' });

    if (recentHR && typeof recentHR.value === 'number') {
      const hr = recentHR.value as number;
      if (hr > 100) {
        items.push({ icon: <HeartPulse size={18} className="text-red-600" />, text: 'Heart rate is high. Try deep breathing and rest for a bit.' });
      }
    }

    if (recentSpO2 && typeof recentSpO2.value === 'number') {
      const spo2 = recentSpO2.value as number;
      if (spo2 < 95) {
        items.push({ icon: <Wind size={18} className="text-indigo-600" />, text: 'Oxygen level looks low. Do slow, deep breaths and sit comfortably.' });
      }
    }

    items.push({ icon: <Droplets size={18} className="text-teal-600" />, text: 'Sip water regularly to stay hydrated.' });

    return items.slice(0, 4);
  }, [vitalReadings, medicineLogs]);

  if (suggestions.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-6">
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb size={20} className="text-yellow-600" />
        <h3 className="font-semibold text-gray-900">Today's Suggestions</h3>
      </div>
      <div className="space-y-2">
        {suggestions.map((s, idx) => (
          <div key={idx} className="flex items-center gap-2 text-sm">
            {s.icon}
            <span className="text-gray-700">{s.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

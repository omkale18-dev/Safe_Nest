import React from 'react';
import { Reminder, Medicine, MedicineLog } from '../types';
import { MedicineReminders } from './MedicineReminders';

interface VoiceCompanionProps {
  userName: string;
  reminders: Reminder[];
  medicines?: Medicine[];
  medicineLogs?: MedicineLog[];
  onMarkTaken?: (medicineId: string, scheduledTime: string) => void;
  onSkipMedicine?: (medicineId: string, scheduledTime: string) => void;
  onSnoozeMedicine?: (medicineId: string, scheduledTime: string, snoozeUntil: string) => void;
}

export const VoiceCompanionView: React.FC<VoiceCompanionProps> = ({ 
  reminders,
  medicines = [],
  medicineLogs = [],
  onMarkTaken,
  onSkipMedicine,
  onSnoozeMedicine
}) => {
  const ownerName = reminders.find(r => r.createdBy)?.createdBy;

  return (
    <div className="pb-20 pt-6 px-4 min-h-full bg-gray-50 animate-fade-in flex flex-col relative">
      
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

      {/* Use MedicineReminders Component */}
      {medicines.length > 0 && onMarkTaken && onSkipMedicine ? (
        <MedicineReminders
          medicines={medicines}
          medicineLogs={medicineLogs}
          onMarkTaken={onMarkTaken}
          onSkip={onSkipMedicine}
          onSnooze={onSnoozeMedicine}
          voiceEnabled={false}
        />
      ) : (
        <div className="text-center text-gray-400 py-8">
          <p className="text-sm italic">No medications scheduled yet.</p>
        </div>
      )}
    </div>
  );
};
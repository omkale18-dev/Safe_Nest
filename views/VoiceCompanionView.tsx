import React from 'react';
import { Reminder } from '../types';

interface VoiceCompanionProps {
  userName: string;
  reminders: Reminder[];
}

export const VoiceCompanionView: React.FC<VoiceCompanionProps> = ({ 
  reminders
}) => {
  const ownerName = reminders.find(r => r.createdBy)?.createdBy;

  return (
    <div className="pb-20 pt-6 px-4 min-h-full bg-gray-50 animate-fade-in flex flex-col relative">
      
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-black text-gray-900 leading-tight">
                Voice<br/>
                <span className="text-blue-600">Companion</span>
            </h1>
            <p className="text-sm text-gray-500 mt-1">Managed by {ownerName ? `${ownerName} (Caregiver)` : 'Household'}</p>
          </div>
      </div>

      <div className="text-center text-gray-400 py-8">
        <p className="text-sm italic">Voice features available. Medicine reminders have been disabled.</p>
      </div>
    </div>
  );
};
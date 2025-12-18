import React, { useState, useEffect } from 'react';
import { Phone, Shield, XCircle, Volume2, MapPin, CheckCircle, Check } from 'lucide-react';
import { HouseholdMember, UserRole } from '../types';

interface EmergencyActiveProps {
  onSafe: () => void;
  type: 'FALL' | 'SOS';
  caregivers?: HouseholdMember[];
}

export const EmergencyActive: React.FC<EmergencyActiveProps> = ({ onSafe, type, caregivers = [] }) => {
  const [notificationState, setNotificationState] = useState<'sending' | 'sent'>('sending');

  // Filter only caregivers
  const activeCaregivers = caregivers.filter(m => m.role === UserRole.CAREGIVER);

  // Simulate network delay for notification delivery status
  useEffect(() => {
    const timer = setTimeout(() => {
        setNotificationState('sent');
    }, 2500); // 2.5 seconds delay
    return () => clearTimeout(timer);
  }, []);

  // Call 102 Emergency Services
  const handleCall102 = () => {
    const telUrl = 'tel:102';
    window.location.href = telUrl;
  };

  return (
    <div className="h-full bg-white flex flex-col">
        {/* Header */}
        <div className="p-6 flex items-center justify-between">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                 <Shield className="text-gray-600" size={20} />
            </div>
            <span className="font-bold text-gray-900">SafeNest Emergency</span>
            <div className="w-10"></div> {/* Spacer */}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6">
            <h2 className="text-3xl font-black text-gray-900 mb-8">
                {type === 'FALL' ? 'Fall Detected' : 'SOS Active'}
            </h2>

            {/* Pulsing Alert Circle */}
            <div className="relative mb-12">
                <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-20 h-48 w-48 -m-4"></div>
                <div className="absolute inset-0 bg-red-500 rounded-full animate-pulse opacity-40 h-40 w-40"></div>
                <div className="relative bg-gradient-to-tr from-red-500 to-red-600 h-40 w-40 rounded-full flex flex-col items-center justify-center shadow-2xl border-4 border-white">
                    <span className="text-white text-4xl font-bold">HELP</span>
                    <span className="text-red-100 text-xs mt-1">SENT</span>
                </div>
            </div>

            <div className="flex items-center gap-2 mb-6 text-red-600">
                <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
                <span className="font-bold">Alarm sounding & vibrating</span>
            </div>
            
            <div className="flex gap-4 mb-10">
                <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full text-sm font-bold text-gray-700">
                    <Volume2 size={16} /> LOUD
                </button>
                 <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full text-sm font-bold text-gray-700">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M7 2h10v20H7V2zm2 2v16h6V4H9z" /></svg> ON
                </button>
            </div>

            {/* Notification Card */}
            <div className={`w-full bg-gray-50 rounded-xl p-4 border transition-colors duration-500 flex items-center gap-4 ${notificationState === 'sent' ? 'border-green-200 bg-green-50' : 'border-gray-100'}`}>
                <div className="bg-gray-200 rounded-lg w-16 h-16 flex items-center justify-center overflow-hidden relative">
                    {/* Simulated Map */}
                    <div className="absolute inset-0 opacity-50 bg-[url('https://upload.wikimedia.org/wikipedia/commons/e/ec/Neighborhood_Map.svg')] bg-cover"></div>
                    <MapPin className="relative text-red-500 z-10" size={24} />
                </div>
                <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                        <p className={`text-xs font-bold uppercase ${notificationState === 'sent' ? 'text-green-600' : 'text-gray-400'}`}>
                            {notificationState === 'sent' ? 'ALERTS SENT' : 'NOTIFYING...'}
                        </p>
                        {notificationState === 'sent' && <CheckCircle size={14} className="text-green-600" />}
                    </div>
                    
                    {/* Caregivers notified */}
                    {activeCaregivers.length > 0 ? (
                      activeCaregivers.slice(0, 2).map((caregiver, idx) => (
                        <div key={caregiver.id} className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <img src={caregiver.avatar} alt={caregiver.name} className="w-5 h-5 rounded-full" />
                            <span className="font-bold text-gray-900 text-sm">{caregiver.name}</span>
                          </div>
                          {notificationState === 'sent' ? (
                            <Check size={14} className="text-green-500 animate-scale-in" />
                          ) : (
                            <div className="w-3 h-3 rounded-full border-2 border-gray-300 border-t-blue-500 animate-spin"></div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-gray-500">No caregivers linked</div>
                    )}
                    
                    {/* Emergency Services */}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                      <div className="flex items-center gap-2">
                        <div className="bg-red-500 rounded-full p-0.5"><Shield size={8} className="text-white" /></div>
                        <span className="font-bold text-gray-900 text-sm">Emergency Services (102)</span>
                      </div>
                      {notificationState === 'sent' ? (
                        <Check size={14} className="text-green-500 animate-scale-in" />
                      ) : (
                        <div className="w-3 h-3 rounded-full border-2 border-gray-300 border-t-red-500 animate-spin"></div>
                      )}
                    </div>
                </div>
            </div>
        </div>

        <div className="p-6">
            <button
                onClick={handleCall102}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all mb-3"
            >
                <Phone size={24} />
                Call 102 Emergency Services
            </button>
            <button
                onClick={onSafe}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all"
            >
                <XCircle size={24} />
                I am Safe - Cancel
            </button>
            <p className="text-center text-xs text-gray-400 mt-4 pb-4">Tap button above to cancel false alarm</p>
        </div>
    </div>
  );
};
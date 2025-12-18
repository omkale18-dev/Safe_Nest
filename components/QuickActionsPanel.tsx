import React from 'react';
import { Phone, MapPin, Pill, Activity, Calendar, Bell, AlertCircle, Heart, User } from 'lucide-react';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  onClick: () => void;
}

interface QuickActionsPanelProps {
  actions: QuickAction[];
  title?: string;
}

export const QuickActionsPanel: React.FC<QuickActionsPanelProps> = ({ 
  actions, 
  title = 'Quick Actions' 
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      <div className="grid grid-cols-4 gap-3">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={action.onClick}
            className={`flex flex-col items-center justify-center p-3 rounded-lg ${action.color} transition-all hover:scale-105 active:scale-95`}
          >
            <div className="mb-1">
              {action.icon}
            </div>
            <span className="text-xs font-medium text-center leading-tight">
              {action.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export { Phone, MapPin, Pill, Activity, Calendar, Bell, AlertCircle, Heart, User };

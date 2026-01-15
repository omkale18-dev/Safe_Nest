import React from 'react';
import { Home, Map, Activity, Users, Pill, Settings } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isListening?: boolean;
  onVoiceClick?: () => void;
  className?: string;
  customItems?: Array<{ id: string; icon: React.ComponentType<any>; label: string }>;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab, isListening = false, onVoiceClick, className = '', customItems }) => {
  const { t } = useLanguage();
  
  const navItems = customItems || [
    { id: 'home', icon: Home, label: t.home },
    { id: 'map', icon: Map, label: t.location },
    { id: 'medicine', icon: Pill, label: 'Medicines' },
    { id: 'vitals', icon: Activity, label: t.vitals },
    { id: 'carers', icon: Users, label: t.carers },
    { id: 'settings', icon: Settings, label: t.settings },
  ];

  const handleTabClick = (id: string) => {
    setActiveTab(id);
  };

  const baseClasses = "fixed bottom-0 left-0 right-0 w-full bg-white border-t border-gray-200 px-4 py-2 flex justify-between items-center pb-[calc(1rem+env(safe-area-inset-bottom))] z-50 shadow-lg";

  return (
    // Added pb-[calc(1rem+env(safe-area-inset-bottom))] for modern mobile safe areas
    <div className={`${baseClasses} ${className}`} style={{ position: 'fixed', bottom: 0, left: 0, right: 0 }}>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;

        return (
          <button
            key={item.id}
            onClick={() => handleTabClick(item.id)}
            className={`flex flex-col items-center gap-1 transition-colors min-w-[3.5rem] py-2 ${isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};
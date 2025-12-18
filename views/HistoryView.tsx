import React from 'react';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { AlertHistory } from '../types';
import { useLanguage } from '../i18n/LanguageContext';

const MOCK_ALERTS: AlertHistory[] = [
  {
    id: '1',
    type: 'SOS',
    timestamp: new Date(Date.now() - 3600000),
    resolved: true,
    resolvedBy: 'John Doe'
  },
  {
    id: '2',
    type: 'FALL',
    timestamp: new Date(Date.now() - 7200000),
    resolved: true,
    resolvedBy: 'Jane Smith'
  },
  {
    id: '3',
    type: 'SOS',
    timestamp: new Date(Date.now() - 86400000),
    resolved: false,
    resolvedBy: ''
  }
];

export const HistoryView: React.FC = () => {
  const { t } = useLanguage();
  return (
    <div className="pb-24 pt-6 px-4 space-y-4 animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t.alertHistory}</h1>

      <div className="space-y-4">
        {MOCK_ALERTS.map((alert) => (
          <div key={alert.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-start gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${alert.type === 'SOS' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
              <AlertTriangle size={20} />
            </div>
            
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-gray-900">{alert.type === 'SOS' ? t.emergencySOS : t.fallDetected}</h3>
                <span className="text-xs text-gray-400">
                  {alert.timestamp.toLocaleDateString()}
                </span>
              </div>
              
              <div className="flex items-center gap-1 text-gray-500 text-sm mt-1">
                <Clock size={12} />
                <span>{alert.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>

              {alert.resolved && (
                <div className="mt-3 flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1.5 rounded-lg text-xs font-medium w-fit">
                  <CheckCircle size={12} />
                  {t.resolvedBy} {alert.resolvedBy}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Empty state simulation */}
        <div className="text-center py-8">
            <p className="text-gray-400 text-xs uppercase tracking-widest">{t.endOfHistory}</p>
        </div>
      </div>
    </div>
  );
};
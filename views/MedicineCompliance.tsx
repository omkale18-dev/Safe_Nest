import React, { useMemo } from 'react';
import { TrendingUp, AlertCircle, CheckCircle, Pill, Calendar, Clock, Target, Activity } from 'lucide-react';
import { Medicine, MedicineLog } from '../types';

interface MedicineComplianceProps {
  medicines: Medicine[];
  medicineLogs: MedicineLog[];
}

export const MedicineCompliance: React.FC<MedicineComplianceProps> = ({
  medicines,
  medicineLogs,
}) => {
  console.log('[MedicineCompliance] Received props:', { medicinesCount: medicines.length, logsCount: medicineLogs.length });
  console.log('[MedicineCompliance] Sample logs:', medicineLogs.slice(0, 3).map(l => ({
    id: l.id,
    medicineId: l.medicineId,
    status: l.status,
    date: l.date,
    dateType: typeof l.date,
    isDateObject: l.date instanceof Date
  })));
  
  const complianceStats = useMemo(() => {
    console.log('[MedicineCompliance] Recalculating stats with logs:', medicineLogs.map(l => ({ id: l.id, status: l.status, date: l.date })));
    const today = new Date();
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Filter logs from last 7 days
    const recentLogs = medicineLogs.filter(
      (log) => {
        const logDate = log.date instanceof Date ? log.date : new Date(log.date);
        return logDate >= sevenDaysAgo && logDate <= today;
      }
    );

    if (recentLogs.length === 0) {
      return {
        totalComplianceRate: 0,
        taken: 0,
        missed: 0,
        skipped: 0,
        total: 0,
        medicineStats: [],
        mostMissedTime: null,
      };
    }

    const taken = recentLogs.filter((l) => l.status === 'TAKEN').length;
    const missed = recentLogs.filter((l) => l.status === 'MISSED').length;
    const skipped = recentLogs.filter((l) => l.status === 'SKIPPED').length;

    // Medicine-specific stats
    const medicineStats = medicines.map((medicine) => {
      const medicineLogs = recentLogs.filter((l) => l.medicineId === medicine.id);
      const taken = medicineLogs.filter((l) => l.status === 'TAKEN').length;
      const missed = medicineLogs.filter((l) => l.status === 'MISSED').length;
      const compliance = medicineLogs.length > 0 ? Math.round((taken / medicineLogs.length) * 100) : 0;

      return {
        medicineId: medicine.id,
        medicineName: medicine.name,
        compliance,
        taken,
        missed,
        total: medicineLogs.length,
      };
    });

    // Find most missed time
    const timeStats: { [key: string]: number } = {};
    recentLogs
      .filter((l) => l.status === 'MISSED')
      .forEach((log) => {
        timeStats[log.scheduledTime] = (timeStats[log.scheduledTime] || 0) + 1;
      });

    const mostMissedTime = Object.entries(timeStats).sort(([, a], [, b]) => b - a)[0]?.[0] || null;

    return {
      totalComplianceRate: Math.round((taken / recentLogs.length) * 100),
      taken,
      missed,
      skipped,
      total: recentLogs.length,
      medicineStats,
      mostMissedTime,
    };
  }, [medicines, medicineLogs]);

  return (
    <div key={medicineLogs.length} className="flex-1 p-6 overflow-y-auto bg-gray-50">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Medication Compliance</h2>
        <p className="text-sm text-gray-600 mt-1">Last 7 days analytics</p>
      </div>

      {/* Overall Compliance Card */}
      <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-blue-50 rounded-2xl p-6 shadow-sm border border-blue-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">Overall Compliance</h3>
          <TrendingUp size={24} className="text-blue-600" />
        </div>
        <div className="text-4xl font-bold text-blue-600 mb-2">{complianceStats.totalComplianceRate}%</div>
        <div className="text-sm text-gray-600">
          {complianceStats.taken} taken • {complianceStats.missed} missed • {complianceStats.skipped} skipped
        </div>

        {/* Progress Bar */}
        <div className="mt-4 space-y-2">
          <div className="flex gap-2 text-xs">
            <span className="flex items-center gap-1 text-green-700 font-semibold">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              Taken
            </span>
            <span className="flex items-center gap-1 text-red-700 font-semibold">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              Missed
            </span>
            <span className="flex items-center gap-1 text-orange-700 font-semibold">
              <div className="w-2 h-2 rounded-full bg-orange-500"></div>
              Skipped
            </span>
          </div>
          <div className="w-full flex gap-1 h-2 rounded-full overflow-hidden bg-gray-200">
            <div
              className="bg-green-500"
              style={{
                width: `${complianceStats.total > 0 ? (complianceStats.taken / complianceStats.total) * 100 : 0}%`,
              }}
            ></div>
            <div
              className="bg-red-500"
              style={{
                width: `${complianceStats.total > 0 ? (complianceStats.missed / complianceStats.total) * 100 : 0}%`,
              }}
            ></div>
            <div
              className="bg-orange-500"
              style={{
                width: `${complianceStats.total > 0 ? (complianceStats.skipped / complianceStats.total) * 100 : 0}%`,
              }}
            ></div>
          </div>
        </div>
      </div>

      {/* Insights */}
      {complianceStats.mostMissedTime && (
        <div className="bg-orange-50 rounded-2xl p-4 border-2 border-orange-200 flex gap-3">
          <AlertCircle size={20} className="text-orange-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-orange-900 text-sm">Pattern Detected</p>
            <p className="text-sm text-orange-800 mt-0.5">
              Medicines are often missed at {complianceStats.mostMissedTime}
            </p>
          </div>
        </div>
      )}

      {/* Per-Medicine Compliance - Enhanced Grid Layout */}
      {complianceStats.medicineStats.length > 0 && (
        <div className="space-y-4 mt-6">
          <div className="flex items-center gap-2">
            <Pill size={20} className="text-blue-600" />
            <h3 className="font-bold text-gray-900 text-lg">Medicine-wise Compliance</h3>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {complianceStats.medicineStats.map((stat) => {
              const complianceLevel =
                stat.compliance >= 90 ? 'excellent' :
                stat.compliance >= 70 ? 'good' :
                stat.compliance >= 50 ? 'fair' : 'poor';

              const complianceColor = {
                excellent: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-900', progress: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700' },
                good: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900', progress: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700' },
                fair: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900', progress: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700' },
                poor: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-900', progress: 'bg-red-500', badge: 'bg-red-100 text-red-700' },
              };

              const colors = complianceColor[complianceLevel];

              return (
                <div
                  key={stat.medicineId}
                  className={`${colors.bg} rounded-2xl p-5 shadow-sm border-2 ${colors.border} transition-all hover:shadow-md`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                          <Pill size={20} className="text-white" />
                        </div>
                        <div>
                          <h4 className={`font-bold text-base ${colors.text}`}>{stat.medicineName}</h4>
                          <p className="text-xs text-gray-600">Last 7 days</p>
                        </div>
                      </div>
                    </div>

                    {/* Compliance Score */}
                    <div className="text-right">
                      <div className={`text-3xl font-black ${colors.text}`}>
                        {stat.compliance}%
                      </div>
                      <div className={`text-xs font-bold px-3 py-1 rounded-full mt-2 ${colors.badge} flex items-center gap-1 w-fit ml-auto`}>
                        {stat.compliance >= 90 && <CheckCircle size={12} />}
                        {stat.compliance >= 90 && 'Perfect'}
                        {stat.compliance >= 70 && stat.compliance < 90 && 'Good'}
                        {stat.compliance >= 50 && stat.compliance < 70 && 'Fair'}
                        {stat.compliance < 50 && <AlertCircle size={12} />}
                        {stat.compliance < 50 && 'Needs Help'}
                      </div>
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-white/60 rounded-lg p-2.5 text-center">
                      <div className="text-sm font-bold text-emerald-600">{stat.taken}</div>
                      <div className="text-xs text-gray-600 font-medium">Taken</div>
                    </div>
                    <div className="bg-white/60 rounded-lg p-2.5 text-center">
                      <div className="text-sm font-bold text-red-600">{stat.missed}</div>
                      <div className="text-xs text-gray-600 font-medium">Missed</div>
                    </div>
                    <div className="bg-white/60 rounded-lg p-2.5 text-center">
                      <div className="text-sm font-bold text-gray-700">{stat.total}</div>
                      <div className="text-xs text-gray-600 font-medium">Total</div>
                    </div>
                  </div>

                  {/* Progress Bar with Animation */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs font-semibold mb-1">
                      <span className="text-gray-700">Adherence</span>
                      <span className={colors.text}>{stat.taken}/{stat.total} doses</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full overflow-hidden bg-gray-300/40 shadow-inner">
                      <div
                        className={`${colors.progress} h-full rounded-full transition-all duration-300 shadow-sm`}
                        style={{
                          width: `${stat.total > 0 ? (stat.taken / stat.total) * 100 : 0}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* Insights */}
                  <div className="mt-4 pt-4 border-t border-white/40 flex items-start gap-3">
                    {stat.compliance >= 90 && (
                      <div className="flex gap-2 items-start flex-1">
                        <CheckCircle size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-emerald-900">Excellent Adherence</p>
                          <p className="text-xs text-emerald-800 mt-0.5">Keep up this great habit! Your consistency is impressive.</p>
                        </div>
                      </div>
                    )}
                    {stat.compliance >= 70 && stat.compliance < 90 && (
                      <div className="flex gap-2 items-start flex-1">
                        <Activity size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-blue-900">Good Progress</p>
                          <p className="text-xs text-blue-800 mt-0.5">You're doing well! Try to avoid missing doses.</p>
                        </div>
                      </div>
                    )}
                    {stat.compliance >= 50 && stat.compliance < 70 && (
                      <div className="flex gap-2 items-start flex-1">
                        <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-amber-900">Needs Attention</p>
                          <p className="text-xs text-amber-800 mt-0.5">Try setting reminders for better adherence.</p>
                        </div>
                      </div>
                    )}
                    {stat.compliance < 50 && (
                      <div className="flex gap-2 items-start flex-1">
                        <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-red-900">Low Compliance</p>
                          <p className="text-xs text-red-800 mt-0.5">Regular doses are important for your health. Please prioritize.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {complianceStats.total === 0 && (
        <div className="bg-gray-50 rounded-2xl p-8 text-center border border-gray-100">
          <p className="text-gray-600 font-semibold">No medication logs yet</p>
          <p className="text-sm text-gray-500 mt-1">Logs will appear once medicines are tracked</p>
        </div>
      )}
    </div>
  );
};

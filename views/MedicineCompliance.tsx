import React, { useMemo } from 'react';
import { TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
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

      {/* Per-Medicine Compliance */}
      {complianceStats.medicineStats.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-bold text-gray-900">Per Medicine</h3>
          {complianceStats.medicineStats.map((stat) => (
            <div
              key={stat.medicineId}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-bold text-gray-900">{stat.medicineName}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {stat.taken} taken • {stat.missed} missed out of {stat.total}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-600">{stat.compliance}%</p>
                </div>
              </div>

              {/* Mini Progress Bar */}
              <div className="flex gap-1 h-1.5 rounded-full overflow-hidden bg-gray-200">
                <div
                  className="bg-green-500"
                  style={{
                    width: `${stat.total > 0 ? (stat.taken / stat.total) * 100 : 0}%`,
                  }}
                ></div>
                <div
                  className="bg-red-500"
                  style={{
                    width: `${stat.total > 0 ? (stat.missed / stat.total) * 100 : 0}%`,
                  }}
                ></div>
              </div>

              {/* Status Indicator */}
              <div className="mt-3 flex items-center gap-2">
                {stat.compliance >= 90 && (
                  <span className="text-xs font-bold px-2.5 py-1 bg-green-100 text-green-700 rounded-full flex items-center gap-1">
                    <CheckCircle size={14} />
                    Excellent
                  </span>
                )}
                {stat.compliance >= 70 && stat.compliance < 90 && (
                  <span className="text-xs font-bold px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full">
                    Good
                  </span>
                )}
                {stat.compliance < 70 && (
                  <span className="text-xs font-bold px-2.5 py-1 bg-orange-100 text-orange-700 rounded-full flex items-center gap-1">
                    <AlertCircle size={14} />
                    Needs Attention
                  </span>
                )}
              </div>
            </div>
          ))}
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

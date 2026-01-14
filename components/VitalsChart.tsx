import React from 'react';
import { VitalReading } from '../types';

interface VitalsChartProps {
  vitalReadings?: VitalReading[];
  data?: VitalReading[];
  type?: 'bloodPressure' | 'heartRate' | 'temperature' | 'weight' | 'bloodSugar';
  period?: 7 | 30;
  days?: 7 | 30;
  showThresholds?: boolean;
}

export const VitalsChart: React.FC<VitalsChartProps> = ({
  vitalReadings,
  data,
  type,
  period = 30,
  days,
  showThresholds = true,
}) => {
  // Use vitalReadings if provided, otherwise fall back to data
  const readings = vitalReadings || data || [];
  const daysPeriod = days ?? period ?? 30;

  // Filter data by time period
  const cutoffDate = new Date(Date.now() - daysPeriod * 24 * 60 * 60 * 1000);
  const filteredData = readings
    .filter((v) => {
      const vDate = v.timestamp instanceof Date ? v.timestamp : new Date(v.timestamp);
      return vDate >= cutoffDate;
    })
    .sort((a, b) => {
      const dateA = a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp);
      const dateB = b.timestamp instanceof Date ? b.timestamp : new Date(b.timestamp);
      return dateA.getTime() - dateB.getTime();
    });

  if (filteredData.length === 0) {
    return (
      <div className="bg-gray-50 rounded-xl p-8 text-center border border-gray-200">
        <p className="text-gray-500 font-semibold">No data available</p>
        <p className="text-sm text-gray-400 mt-1">Data will appear once vitals are tracked</p>
      </div>
    );
  }

  // Group data by vital type and day
  const vitalTypeGroups: { [key: string]: { [key: string]: typeof filteredData } } = {};
  
  filteredData.forEach((reading) => {
    const vitalType = reading.type;
    const readingDate = reading.timestamp instanceof Date ? reading.timestamp : new Date(reading.timestamp);
    const dayKey = readingDate.toLocaleDateString('en-US');

    if (!vitalTypeGroups[vitalType]) {
      vitalTypeGroups[vitalType] = {};
    }
    if (!vitalTypeGroups[vitalType][dayKey]) {
      vitalTypeGroups[vitalType][dayKey] = [];
    }
    vitalTypeGroups[vitalType][dayKey].push(reading);
  });

  // Render separate graphs for each vital type and day
  return (
    <div className="space-y-8">
      {Object.entries(vitalTypeGroups).map(([vitalType, dayData]) => (
        <div key={vitalType} className="space-y-4">
          {/* Vital Type Header */}
          <div className="flex items-center gap-2 sticky top-0 bg-white z-10">
            <div className="w-1 h-6 bg-blue-600 rounded-full"></div>
            <h3 className="text-lg font-bold text-gray-900">{getVitalLabel(vitalType as any)}</h3>
            <span className="ml-auto text-sm text-gray-500 font-medium">{Object.keys(dayData).length} days recorded</span>
          </div>

          {/* Day-wise charts */}
          <div className="grid grid-cols-1 gap-4">
            {Object.entries(dayData)
              .sort(([dateA], [dateB]) => new Date(dateA).getTime() - new Date(dateB).getTime())
              .reverse() // Show newest first
              .map(([dayKey, dayReadings]) => (
                <DayVitalCard
                  key={`${vitalType}-${dayKey}`}
                  vitalType={vitalType as any}
                  dayKey={dayKey}
                  readings={dayReadings}
                  showThresholds={showThresholds}
                />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// Helper component for individual day card
const DayVitalCard: React.FC<{
  vitalType: string;
  dayKey: string;
  readings: VitalReading[];
  showThresholds: boolean;
}> = ({ vitalType, dayKey, readings, showThresholds }) => {
  const height = 180;

  // Extract values based on vital type
  const values = readings.map((v) => {
    if (vitalType === 'bloodPressure') {
      const bp = v.value as { systolic: number; diastolic: number };
      return { sys: bp.systolic, dia: bp.diastolic, time: v.timestamp };
    }
    return { value: v.value as number, time: v.timestamp };
  });

  // Determine thresholds
  const thresholds = getThresholds(vitalType);

  // Calculate min/max
  let minValue = Infinity;
  let maxValue = -Infinity;

  values.forEach((v) => {
    if ('sys' in v) {
      minValue = Math.min(minValue, v.dia);
      maxValue = Math.max(maxValue, v.sys);
    } else {
      minValue = Math.min(minValue, v.value);
      maxValue = Math.max(maxValue, v.value);
    }
  });

  const padding = (maxValue - minValue) * 0.15 || 10;
  minValue = Math.max(0, minValue - padding);
  maxValue = maxValue + padding;

  const valueRange = maxValue - minValue || 1;

  // Generate SVG path
  const generatePath = (dataPoints: number[]) => {
    if (dataPoints.length === 0) return '';
    const points = dataPoints.map((value, index) => {
      const x = dataPoints.length === 1 ? 50 : (index / (dataPoints.length - 1)) * 100;
      const y = Math.max(0, Math.min(100, ((maxValue - value) / valueRange) * 100));
      return `${x},${y}`;
    });
    return `M ${points.join(' L ')}`;
  };

  const sysValues = values.map((v) => ('sys' in v ? v.sys : v.value));
  const diaValues = vitalType === 'bloodPressure' ? values.map((v) => ('dia' in v ? v.dia : 0)) : [];

  const sysPath = generatePath(sysValues);
  const diaPath = vitalType === 'bloodPressure' ? generatePath(diaValues) : '';

  // Get time range
  const firstTime = new Date(readings[0].timestamp);
  const lastTime = new Date(readings[readings.length - 1].timestamp);
  const timeRange = `${firstTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - ${lastTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;

  const latestValue = sysValues[sysValues.length - 1];
  const latestDia = diaValues.length > 0 ? diaValues[diaValues.length - 1] : 0;

  return (
    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="text-sm font-bold text-gray-900">{dayKey}</p>
          <p className="text-xs text-gray-500 mt-0.5">{readings.length} reading{readings.length > 1 ? 's' : ''} • {timeRange}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-blue-600">
            {vitalType === 'bloodPressure' ? `${Math.round(latestValue)}/${Math.round(latestDia)}` : Math.round(latestValue)}
          </p>
          <p className="text-xs text-gray-500 font-medium">{getVitalUnit(vitalType)}</p>
        </div>
      </div>

      {/* Mini Chart */}
      <div className="relative" style={{ height: `${height}px` }}>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="w-full h-full"
          style={{ overflow: 'hidden' }}
        >
          {/* Threshold zones */}
          {showThresholds && (() => {
            const getY = (val: number) => Math.max(0, Math.min(100, ((maxValue - val) / valueRange) * 100));
            const zones = [];

            if (maxValue > thresholds.max) {
              const y1 = 0;
              const y2 = getY(thresholds.max);
              if (y2 > y1) {
                zones.push(
                  <rect key="danger" x="0" y={y1} width="100" height={y2 - y1} fill="#fee2e2" opacity="0.4" />
                );
              }
            }

            if (maxValue > thresholds.high && minValue < thresholds.max) {
              const y1 = getY(Math.min(maxValue, thresholds.max));
              const y2 = getY(Math.max(minValue, thresholds.high));
              if (y2 > y1) {
                zones.push(
                  <rect key="warning" x="0" y={y1} width="100" height={y2 - y1} fill="#fef3c7" opacity="0.4" />
                );
              }
            }

            if (maxValue > thresholds.low && minValue < thresholds.high) {
              const y1 = getY(Math.min(maxValue, thresholds.high));
              const y2 = getY(Math.max(minValue, thresholds.low));
              if (y2 > y1) {
                zones.push(
                  <rect key="normal" x="0" y={y1} width="100" height={y2 - y1} fill="#d1fae5" opacity="0.4" />
                );
              }
            }

            if (minValue < thresholds.low) {
              const y1 = getY(Math.min(maxValue, thresholds.low));
              const y2 = 100;
              if (y2 > y1) {
                zones.push(
                  <rect key="low" x="0" y={y1} width="100" height={y2 - y1} fill="#dbeafe" opacity="0.4" />
                );
              }
            }

            return zones;
          })()}

          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((y) => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2="100"
              y2={y}
              stroke="#e5e7eb"
              strokeWidth="0.2"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* Systolic line */}
          <path
            d={sysPath}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Diastolic line */}
          {vitalType === 'bloodPressure' && (
            <path
              d={diaPath}
              fill="none"
              stroke="#8b5cf6"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data points */}
          {sysValues.map((value, index) => {
            const x = sysValues.length === 1 ? 50 : (index / (sysValues.length - 1)) * 100;
            const y = Math.max(0, Math.min(100, ((maxValue - value) / valueRange) * 100));
            return (
              <circle
                key={`sys-${index}`}
                cx={x}
                cy={y}
                r="1.2"
                fill="#3b82f6"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          {vitalType === 'bloodPressure' &&
            diaValues.map((value, index) => {
              const x = diaValues.length === 1 ? 50 : (index / (diaValues.length - 1)) * 100;
              const y = Math.max(0, Math.min(100, ((maxValue - value) / valueRange) * 100));
              return (
                <circle
                  key={`dia-${index}`}
                  cx={x}
                  cy={y}
                  r="1.2"
                  fill="#8b5cf6"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
        </svg>

        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-0 w-10 flex flex-col justify-between text-xs text-gray-500 font-semibold pr-2">
          <span>{Math.round(maxValue)}</span>
          <span>{Math.round((maxValue + minValue) / 2)}</span>
          <span>{Math.round(minValue)}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-2 text-xs font-semibold">
        {vitalType === 'bloodPressure' ? (
          <>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span className="text-gray-700">Systolic</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
              <span className="text-gray-700">Diastolic</span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            <span className="text-gray-700">Value</span>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper function to get vital label
function getVitalLabel(vitalType: 'bloodPressure' | 'heartRate' | 'temperature' | 'weight' | 'bloodSugar'): string {
  switch (vitalType) {
    case 'bloodPressure':
      return 'Blood Pressure';
    case 'heartRate':
      return 'Heart Rate';
    case 'temperature':
      return 'Temperature';
    case 'weight':
      return 'Weight';
    case 'bloodSugar':
      return 'Blood Sugar';
    default:
      return vitalType;
  }
}

// Helper function to get vital unit
function getVitalUnit(vitalType: string): string {
  switch (vitalType) {
    case 'bloodPressure':
      return 'mmHg';
    case 'heartRate':
      return 'BPM';
    case 'temperature':
      return '°F';
    case 'weight':
      return 'kg';
    case 'bloodSugar':
      return 'mg/dL';
    default:
      return '';
  }
}

// Helper function to get thresholds
function getThresholds(
  vitalType: string
): { low: number; normal: number; high: number; max: number } {
  switch (vitalType) {
    case 'bloodPressure':
      return { low: 90, normal: 120, high: 140, max: 180 };
    case 'heartRate':
      return { low: 50, normal: 60, high: 100, max: 120 };
    case 'temperature':
      return { low: 97, normal: 98.6, high: 100, max: 103 };
    case 'weight':
      return { low: 50, normal: 70, high: 90, max: 120 };
    case 'bloodSugar':
      return { low: 70, normal: 100, high: 140, max: 200 };
    default:
      return { low: 0, normal: 50, high: 75, max: 100 };
  }
}


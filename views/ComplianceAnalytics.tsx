import React, { useMemo, useState } from 'react';
import { TrendingUp, AlertCircle, CheckCircle, Activity, AlertTriangle, Heart, Droplet, Thermometer, Gauge, TrendingDown, BarChart3, FileText } from 'lucide-react';
import { Medicine, MedicineLog, VitalReading } from '../types';
import { analyzeHealthData } from '../services/healthPredictions';
import { VitalsChart } from '../components/VitalsChart';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

interface ComplianceAnalyticsProps {
  medicines: Medicine[];
  medicineLogs: MedicineLog[];
  vitalReadings: VitalReading[];
}

export const ComplianceAnalytics: React.FC<ComplianceAnalyticsProps> = ({
  medicines,
  medicineLogs,
  vitalReadings,
}) => {
  const [chartPeriod, setChartPeriod] = useState<7 | 30>(7);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Helper to get vitals stats
  const getVitalsStats = (readings: VitalReading[], type: string) => {
    if (readings.length === 0) return null;
    
    const last30Days = readings.filter(r => {
      const date = r.timestamp instanceof Date ? r.timestamp : new Date(r.timestamp);
      return date >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }).sort((a, b) => {
      const dateA = a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp);
      const dateB = b.timestamp instanceof Date ? b.timestamp : new Date(b.timestamp);
      return dateB.getTime() - dateA.getTime();
    });
    
    if (last30Days.length === 0) return null;
    
    const latest = last30Days[0];
    
    if (type === 'bloodPressure') {
      const systolicValues = last30Days.map(r => {
        if (typeof r.value === 'object' && 'systolic' in r.value) return r.value.systolic;
        if (r.systolic) return r.systolic;
        return null;
      }).filter(v => v !== null) as number[];
      
      const diastolicValues = last30Days.map(r => {
        if (typeof r.value === 'object' && 'diastolic' in r.value) return r.value.diastolic;
        if (r.diastolic) return r.diastolic;
        return null;
      }).filter(v => v !== null) as number[];
      
      if (systolicValues.length === 0) return null;
      
      return {
        latest: `${systolicValues[0]}/${diastolicValues[0]} mmHg`,
        latestValue: systolicValues[0], // For comparisons
        avgSystolic: Math.round(systolicValues.reduce((a, b) => a + b, 0) / systolicValues.length),
        avgDiastolic: Math.round(diastolicValues.reduce((a, b) => a + b, 0) / diastolicValues.length),
        min: `${Math.min(...systolicValues)}/${Math.min(...diastolicValues)}`,
        max: `${Math.max(...systolicValues)}/${Math.max(...diastolicValues)}`,
        count: last30Days.length,
        lastDate: latest.timestamp instanceof Date ? latest.timestamp : new Date(latest.timestamp),
      };
    } else {
      const values = last30Days.map(r => typeof r.value === 'number' ? r.value : 0);
      const latestNum = values[0];
      return {
        latest: latestNum,
        latestValue: latestNum, // For comparisons - always a number
        avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
        min: Math.min(...values),
        max: Math.max(...values),
        count: last30Days.length,
        lastDate: latest.timestamp instanceof Date ? latest.timestamp : new Date(latest.timestamp),
      };
    }
  };

  // Generate and download PDF report
  const generatePdfReport = async () => {
    setIsGeneratingPdf(true);
    try {
      const reportDate = new Date().toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      // Get vitals stats for report
      const bpStats = getVitalsStats(vitalReadings.filter(v => v.type === 'bloodPressure'), 'bloodPressure');
      const sugarStats = getVitalsStats(vitalReadings.filter(v => v.type === 'bloodSugar'), 'bloodSugar');
      const heartRateStats = getVitalsStats(vitalReadings.filter(v => v.type === 'heartRate'), 'heartRate');
      const tempStats = getVitalsStats(vitalReadings.filter(v => v.type === 'temperature'), 'temperature');
      const weightStats = getVitalsStats(vitalReadings.filter(v => v.type === 'weight'), 'weight');
      const spo2Stats = getVitalsStats(vitalReadings.filter(v => v.type === 'spo2'), 'spo2');

      // Get recent vital readings for detailed table (last 10 of each type)
      const getRecentReadings = (type: VitalReading['type'], limit = 10) => {
        return vitalReadings
          .filter(v => v.type === type)
          .sort((a, b) => {
            const dateA = a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp);
            const dateB = b.timestamp instanceof Date ? b.timestamp : new Date(b.timestamp);
            return dateB.getTime() - dateA.getTime();
          })
          .slice(0, limit);
      };

      // Create printable HTML content
      const content = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>SafeNest Comprehensive Health Report - ${reportDate}</title>
  <style>
    * { box-sizing: border-box; font-family: 'Segoe UI', Arial, sans-serif; }
    body { padding: 40px; max-width: 900px; margin: 0 auto; color: #333; }
    h1 { color: #1e40af; border-bottom: 3px solid #1e40af; padding-bottom: 10px; }
    h2 { color: #374151; margin-top: 30px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
    h3 { color: #4b5563; margin-top: 20px; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
    .date { color: #6b7280; font-size: 14px; }
    .section { page-break-inside: avoid; margin-bottom: 30px; }
    .risk-score { 
      background: ${healthAnalysis.riskScore.overall >= 70 ? '#fecaca' : healthAnalysis.riskScore.overall >= 40 ? '#fef3c7' : '#dcfce7'};
      padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0;
    }
    .risk-score .number { font-size: 48px; font-weight: bold; color: ${healthAnalysis.riskScore.overall >= 70 ? '#dc2626' : healthAnalysis.riskScore.overall >= 40 ? '#d97706' : '#16a34a'}; }
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0; }
    .stats-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 20px 0; }
    .stat-card { background: #f9fafb; padding: 16px; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb; }
    .stat-number { font-size: 24px; font-weight: bold; color: #111827; }
    .stat-label { font-size: 12px; color: #6b7280; margin-top: 4px; }
    .vital-card { background: white; padding: 16px; border-radius: 12px; border: 2px solid #e5e7eb; margin: 12px 0; }
    .vital-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .vital-title { font-weight: bold; font-size: 16px; color: #374151; }
    .vital-value { font-size: 28px; font-weight: bold; }
    .vital-value.normal { color: #16a34a; }
    .vital-value.warning { color: #d97706; }
    .vital-value.danger { color: #dc2626; }
    .vital-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb; }
    .vital-stat { text-align: center; }
    .vital-stat-label { font-size: 11px; color: #9ca3af; }
    .vital-stat-value { font-size: 14px; font-weight: 600; color: #374151; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f3f4f6; font-weight: 600; color: #374151; }
    tr:hover { background: #f9fafb; }
    .compliance-bar { width: 100%; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; }
    .compliance-fill { height: 100%; border-radius: 4px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 12px; }
    .alert { padding: 12px 16px; border-radius: 8px; margin: 8px 0; }
    .alert-high { background: #fecaca; color: #991b1b; }
    .alert-medium { background: #fef3c7; color: #92400e; }
    .alert-low { background: #e0f2fe; color: #075985; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    @media print {
      body { padding: 20px; }
      .no-print { display: none; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🏥 SafeNest Comprehensive Health Report</h1>
    <div class="date">Generated: ${reportDate}</div>
  </div>

  <!-- Overall Health Risk Score -->
  <div class="section">
    <div class="risk-score">
      <div class="number">${healthAnalysis.riskScore.overall}</div>
      <div style="font-size: 18px; font-weight: 600;">Overall Health Risk Score</div>
      <div style="margin-top: 8px; color: #6b7280;">
        ${healthAnalysis.riskScore.overall >= 70 ? '⚠️ High Risk - Requires Attention' : 
          healthAnalysis.riskScore.overall >= 40 ? '⚡ Moderate Risk - Monitor Closely' : 
          '✅ Low Risk - Good Health Status'}
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-number">${healthAnalysis.riskScore.cardiovascular}</div>
        <div class="stat-label">❤️ Cardiovascular</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${healthAnalysis.riskScore.metabolic}</div>
        <div class="stat-label">🩸 Metabolic</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${healthAnalysis.riskScore.compliance}</div>
        <div class="stat-label">💊 Med Compliance</div>
      </div>
      <div class="stat-card">
        <div class="stat-number" style="color: ${healthAnalysis.riskScore.trend === 'improving' ? '#16a34a' : healthAnalysis.riskScore.trend === 'declining' ? '#dc2626' : '#6b7280'};">
          ${healthAnalysis.riskScore.trend === 'improving' ? '↗️' : healthAnalysis.riskScore.trend === 'declining' ? '↘️' : '→'}
        </div>
        <div class="stat-label">${healthAnalysis.riskScore.trend.charAt(0).toUpperCase() + healthAnalysis.riskScore.trend.slice(1)}</div>
      </div>
    </div>
  </div>

  <!-- Vitals Summary -->
  <div class="section">
    <h2>📊 Vitals Summary (Last 30 Days)</h2>
    
    <div class="two-col">
      ${bpStats ? `
        <div class="vital-card">
          <div class="vital-header">
            <span class="vital-title">❤️ Blood Pressure</span>
            <span style="font-size: 12px; color: #9ca3af;">${bpStats.count} readings</span>
          </div>
          <div class="vital-value ${bpStats.avgSystolic > 140 || bpStats.avgDiastolic > 90 ? 'danger' : bpStats.avgSystolic > 130 ? 'warning' : 'normal'}">
            ${bpStats.latest}
          </div>
          <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Latest reading</div>
          <div class="vital-stats">
            <div class="vital-stat">
              <div class="vital-stat-label">Average</div>
              <div class="vital-stat-value">${bpStats.avgSystolic}/${bpStats.avgDiastolic}</div>
            </div>
            <div class="vital-stat">
              <div class="vital-stat-label">Min</div>
              <div class="vital-stat-value">${bpStats.min}</div>
            </div>
            <div class="vital-stat">
              <div class="vital-stat-label">Max</div>
              <div class="vital-stat-value">${bpStats.max}</div>
            </div>
          </div>
        </div>
      ` : '<div class="vital-card"><div class="vital-title">❤️ Blood Pressure</div><div style="color: #9ca3af;">No readings available</div></div>'}

      ${sugarStats ? `
        <div class="vital-card">
          <div class="vital-header">
            <span class="vital-title">🩸 Blood Sugar</span>
            <span style="font-size: 12px; color: #9ca3af;">${sugarStats.count} readings</span>
          </div>
          <div class="vital-value ${sugarStats.latestValue > 200 ? 'danger' : sugarStats.latestValue > 140 ? 'warning' : 'normal'}">
            ${sugarStats.latest} mg/dL
          </div>
          <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Latest reading</div>
          <div class="vital-stats">
            <div class="vital-stat">
              <div class="vital-stat-label">Average</div>
              <div class="vital-stat-value">${sugarStats.avg} mg/dL</div>
            </div>
            <div class="vital-stat">
              <div class="vital-stat-label">Min</div>
              <div class="vital-stat-value">${sugarStats.min}</div>
            </div>
            <div class="vital-stat">
              <div class="vital-stat-label">Max</div>
              <div class="vital-stat-value">${sugarStats.max}</div>
            </div>
          </div>
        </div>
      ` : '<div class="vital-card"><div class="vital-title">🩸 Blood Sugar</div><div style="color: #9ca3af;">No readings available</div></div>'}

      ${heartRateStats ? `
        <div class="vital-card">
          <div class="vital-header">
            <span class="vital-title">💓 Heart Rate</span>
            <span style="font-size: 12px; color: #9ca3af;">${heartRateStats.count} readings</span>
          </div>
          <div class="vital-value ${heartRateStats.latestValue > 100 || heartRateStats.latestValue < 60 ? 'warning' : 'normal'}">
            ${heartRateStats.latest} BPM
          </div>
          <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Latest reading</div>
          <div class="vital-stats">
            <div class="vital-stat">
              <div class="vital-stat-label">Average</div>
              <div class="vital-stat-value">${heartRateStats.avg} BPM</div>
            </div>
            <div class="vital-stat">
              <div class="vital-stat-label">Min</div>
              <div class="vital-stat-value">${heartRateStats.min}</div>
            </div>
            <div class="vital-stat">
              <div class="vital-stat-label">Max</div>
              <div class="vital-stat-value">${heartRateStats.max}</div>
            </div>
          </div>
        </div>
      ` : '<div class="vital-card"><div class="vital-title">💓 Heart Rate</div><div style="color: #9ca3af;">No readings available</div></div>'}

      ${spo2Stats ? `
        <div class="vital-card">
          <div class="vital-header">
            <span class="vital-title">🫁 SpO2</span>
            <span style="font-size: 12px; color: #9ca3af;">${spo2Stats.count} readings</span>
          </div>
          <div class="vital-value ${spo2Stats.latestValue < 95 ? 'danger' : spo2Stats.latestValue < 97 ? 'warning' : 'normal'}">
            ${spo2Stats.latest}%
          </div>
          <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Latest reading</div>
          <div class="vital-stats">
            <div class="vital-stat">
              <div class="vital-stat-label">Average</div>
              <div class="vital-stat-value">${spo2Stats.avg}%</div>
            </div>
            <div class="vital-stat">
              <div class="vital-stat-label">Min</div>
              <div class="vital-stat-value">${spo2Stats.min}%</div>
            </div>
            <div class="vital-stat">
              <div class="vital-stat-label">Max</div>
              <div class="vital-stat-value">${spo2Stats.max}%</div>
            </div>
          </div>
        </div>
      ` : ''}

      ${tempStats ? `
        <div class="vital-card">
          <div class="vital-header">
            <span class="vital-title">🌡️ Temperature</span>
            <span style="font-size: 12px; color: #9ca3af;">${tempStats.count} readings</span>
          </div>
          <div class="vital-value ${tempStats.latestValue > 99.5 ? 'danger' : tempStats.latestValue > 99 ? 'warning' : 'normal'}">
            ${tempStats.latest}°F
          </div>
          <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Latest reading</div>
          <div class="vital-stats">
            <div class="vital-stat">
              <div class="vital-stat-label">Average</div>
              <div class="vital-stat-value">${tempStats.avg}°F</div>
            </div>
            <div class="vital-stat">
              <div class="vital-stat-label">Min</div>
              <div class="vital-stat-value">${tempStats.min}°F</div>
            </div>
            <div class="vital-stat">
              <div class="vital-stat-label">Max</div>
              <div class="vital-stat-value">${tempStats.max}°F</div>
            </div>
          </div>
        </div>
      ` : ''}

      ${weightStats ? `
        <div class="vital-card">
          <div class="vital-header">
            <span class="vital-title">⚖️ Weight</span>
            <span style="font-size: 12px; color: #9ca3af;">${weightStats.count} readings</span>
          </div>
          <div class="vital-value normal">
            ${weightStats.latest} kg
          </div>
          <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">Latest reading</div>
          <div class="vital-stats">
            <div class="vital-stat">
              <div class="vital-stat-label">Average</div>
              <div class="vital-stat-value">${weightStats.avg} kg</div>
            </div>
            <div class="vital-stat">
              <div class="vital-stat-label">Min</div>
              <div class="vital-stat-value">${weightStats.min} kg</div>
            </div>
            <div class="vital-stat">
              <div class="vital-stat-label">Max</div>
              <div class="vital-stat-value">${weightStats.max} kg</div>
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  </div>

  <!-- Detailed Vitals History -->
  ${vitalReadings.length > 0 ? `
    <div class="section">
      <h2>📈 Recent Vitals History</h2>
      
      ${getRecentReadings('bloodPressure', 10).length > 0 ? `
        <h3>Blood Pressure Readings</h3>
        <table>
          <thead>
            <tr>
              <th>Date & Time</th>
              <th>Systolic</th>
              <th>Diastolic</th>
              <th>Status</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${getRecentReadings('bloodPressure', 10).map(r => {
              const date = r.timestamp instanceof Date ? r.timestamp : new Date(r.timestamp);
              const sys = typeof r.value === 'object' ? r.value.systolic : r.systolic || 0;
              const dia = typeof r.value === 'object' ? r.value.diastolic : r.diastolic || 0;
              const status = sys > 140 || dia > 90 ? '🔴 High' : sys > 130 || dia > 85 ? '🟡 Elevated' : '🟢 Normal';
              return `
                <tr>
                  <td>${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td><strong>${sys}</strong> mmHg</td>
                  <td><strong>${dia}</strong> mmHg</td>
                  <td>${status}</td>
                  <td>${r.notes || '-'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      ` : ''}

      ${getRecentReadings('bloodSugar', 10).length > 0 ? `
        <h3>Blood Sugar Readings</h3>
        <table>
          <thead>
            <tr>
              <th>Date & Time</th>
              <th>Value</th>
              <th>Status</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${getRecentReadings('bloodSugar', 10).map(r => {
              const date = r.timestamp instanceof Date ? r.timestamp : new Date(r.timestamp);
              const value = typeof r.value === 'number' ? r.value : 0;
              const status = value > 200 ? '🔴 High' : value > 140 ? '🟡 Elevated' : value < 70 ? '🔴 Low' : '🟢 Normal';
              return `
                <tr>
                  <td>${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td><strong>${value}</strong> mg/dL</td>
                  <td>${status}</td>
                  <td>${r.notes || '-'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      ` : ''}

      ${getRecentReadings('heartRate', 10).length > 0 ? `
        <h3>Heart Rate Readings</h3>
        <table>
          <thead>
            <tr>
              <th>Date & Time</th>
              <th>Value</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${getRecentReadings('heartRate', 10).map(r => {
              const date = r.timestamp instanceof Date ? r.timestamp : new Date(r.timestamp);
              const value = typeof r.value === 'number' ? r.value : 0;
              const status = value > 100 ? '🟡 Elevated' : value < 60 ? '🟡 Low' : '🟢 Normal';
              return `
                <tr>
                  <td>${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td><strong>${value}</strong> BPM</td>
                  <td>${status}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      ` : ''}
    </div>
  ` : ''}

  <!-- Medication Compliance Section -->
  <div class="section">
    <h2>💊 Medication Compliance (Last 7 Days)</h2>
    
    <div class="stats-grid-3">
      <div class="stat-card">
        <div class="stat-number" style="color: #16a34a;">${complianceStats.taken}</div>
        <div class="stat-label">✓ Taken</div>
      </div>
      <div class="stat-card">
        <div class="stat-number" style="color: #dc2626;">${complianceStats.missed}</div>
        <div class="stat-label">✗ Missed</div>
      </div>
      <div class="stat-card">
        <div class="stat-number" style="color: #d97706;">${complianceStats.skipped}</div>
        <div class="stat-label">— Skipped</div>
      </div>
    </div>

    <div style="text-align: center; margin: 20px 0;">
      <div style="font-size: 48px; font-weight: bold; color: ${complianceStats.totalComplianceRate >= 80 ? '#16a34a' : complianceStats.totalComplianceRate >= 60 ? '#d97706' : '#dc2626'};">
        ${complianceStats.totalComplianceRate}%
      </div>
      <div style="color: #6b7280;">Overall Compliance Rate</div>
    </div>

    <h3>Medicine-wise Breakdown</h3>
    <table>
      <thead>
        <tr>
          <th>Medicine</th>
          <th>Compliance</th>
          <th>Taken</th>
          <th>Missed</th>
        </tr>
      </thead>
      <tbody>
        ${complianceStats.medicineStats.map(stat => `
          <tr>
            <td><strong>${stat.medicineName}</strong></td>
            <td>
              <div style="display: flex; align-items: center; gap: 8px;">
                <div class="compliance-bar">
                  <div class="compliance-fill" style="width: ${stat.compliance}%; background: ${stat.compliance >= 80 ? '#22c55e' : stat.compliance >= 60 ? '#f59e0b' : '#ef4444'};"></div>
                </div>
                <span style="font-weight: 600;">${stat.compliance}%</span>
              </div>
            </td>
            <td style="color: #16a34a;">${stat.taken}</td>
            <td style="color: #dc2626;">${stat.missed}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    ${complianceStats.mostMissedTime ? `
      <div class="alert alert-medium">
        ⏰ <strong>Most Missed Time:</strong> ${complianceStats.mostMissedTime} - Consider setting a stronger reminder for this time.
      </div>
    ` : ''}
  </div>

  <!-- Active Medicines -->
  <div class="section">
    <h2>💊 Active Medicines</h2>
    <table>
      <thead>
        <tr>
          <th>Medicine</th>
          <th>Dosage</th>
          <th>Times</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${medicines.map(med => `
          <tr>
            <td><strong>${med.name}</strong>${med.isCritical ? ' 🔴' : ''}</td>
            <td>${med.dosage}</td>
            <td>${med.times.join(', ')}</td>
            <td>${med.isOngoing ? '🔄 Ongoing' : med.endDate ? 'Until ' + new Date(med.endDate).toLocaleDateString() : ''}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <!-- Health Alerts -->
  ${healthAnalysis.predictions.length > 0 ? `
    <div class="section">
      <h2>⚠️ Health Alerts & Recommendations</h2>
      ${healthAnalysis.predictions.map(p => `
        <div class="alert alert-${p.severity}">
          <strong>${p.type.toUpperCase()}:</strong> ${p.message}
          ${p.recommendation ? `<br><em>💡 Recommendation: ${p.recommendation}</em>` : ''}
        </div>
      `).join('')}
    </div>
  ` : ''}

  <!-- Doctor Summary -->
  ${healthAnalysis.doctorSummary ? `
    <div class="section">
      <h2>📋 Summary for Healthcare Provider</h2>
      <div style="background: #f9fafb; padding: 16px; border-radius: 8px; white-space: pre-line; border: 1px solid #e5e7eb;">
        ${healthAnalysis.doctorSummary}
      </div>
    </div>
  ` : ''}

  <div class="footer">
    <p>📱 Generated by SafeNest - Senior Care Companion</p>
    <p>Report Period: Last 30 days for vitals, Last 7 days for medication compliance</p>
    <p style="margin-top: 12px;"><em>This report is for informational purposes only. Please consult healthcare providers for medical advice.</em></p>
  </div>
</body>
</html>
      `;

      // Create blob and download/save to file
      const blob = new Blob([content], { type: 'text/html' });
      const fileName = `SafeNest_Health_Report_${new Date().toISOString().split('T')[0]}.html`;
      
      // Try to save to device file manager (Android/iOS)
      try {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64 = (e.target?.result as string).split(',')[1];
          try {
            const result = await Filesystem.writeFile({
              path: fileName,
              data: base64,
              directory: Directory.Documents,
              encoding: Encoding.UTF8,
            });
            console.log('✅ Report saved to:', result.uri);
            alert(`✅ Report saved to Documents folder!\nFile: ${fileName}`);
          } catch (saveError) {
            console.warn('Could not save to Documents, trying cache:', saveError);
            // Fallback: save to cache directory
            try {
              const cacheResult = await Filesystem.writeFile({
                path: fileName,
                data: base64,
                directory: Directory.Cache,
                encoding: Encoding.UTF8,
              });
              console.log('✅ Report saved to cache:', cacheResult.uri);
              alert(`✅ Report saved!\nFile: ${fileName}`);
            } catch (cacheError) {
              console.error('Failed to save to cache too:', cacheError);
              // Last resort: download as blob in browser
              downloadAsBlob(blob, fileName);
            }
          }
        };
        reader.readAsDataURL(blob);
      } catch (e) {
        console.warn('Filesystem plugin not available, using browser download:', e);
        // Fallback to browser download
        downloadAsBlob(blob, fileName);
      }

      // Also offer to print as PDF (for web/browser)
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(content);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.print();
        }, 500);
      }
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Helper: fallback download function for browsers
  const downloadAsBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Medicine compliance stats (original logic)
  const complianceStats = useMemo(() => {
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

  // Health analysis (NEW)
  const healthAnalysis = useMemo(() => {
    return analyzeHealthData(vitalReadings, medicineLogs);
  }, [vitalReadings, medicineLogs]);

  // Filter vital readings by type
  const getVitalsByType = (type: VitalReading['type']) => {
    return vitalReadings.filter(v => v.type === type);
  };

  const bpReadings = getVitalsByType('bloodPressure');
  const heartRateReadings = getVitalsByType('heartRate');
  const tempReadings = getVitalsByType('temperature');
  const weightReadings = getVitalsByType('weight');
  const bgReadings = getVitalsByType('bloodSugar');

  const getRiskColor = (score: number) => {
    if (score >= 70) return 'text-red-600 bg-red-50 border-red-200';
    if (score >= 40) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };

  const getRiskLabel = (score: number) => {
    if (score >= 70) return 'High Risk';
    if (score >= 40) return 'Moderate Risk';
    return 'Low Risk';
  };

  const getSeverityEmoji = (severity: 'high' | 'medium' | 'low') => {
    switch (severity) {
      case 'high': return '🚨';
      case 'medium': return '⚠️';
      case 'low': return 'ℹ️';
    }
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-gray-50 pb-24">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Health Analytics</h2>
          <p className="text-sm text-gray-600 mt-1">Medication compliance & vitals insights</p>
        </div>
        <button
          onClick={generatePdfReport}
          disabled={isGeneratingPdf}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm shadow-sm transition-all ${
            isGeneratingPdf 
              ? 'bg-gray-100 text-gray-400 cursor-wait' 
              : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
          }`}
        >
          {isGeneratingPdf ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <FileText size={18} />
              Export Report
            </>
          )}
        </button>
      </div>

      {/* Health Risk Score Card (NEW) */}
      <div className={`rounded-2xl p-6 shadow-sm border-2 ${getRiskColor(healthAnalysis.riskScore.overall)} mb-4`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Overall Health Risk</h3>
          <Activity size={24} />
        </div>
        <div className="text-5xl font-bold mb-2">{healthAnalysis.riskScore.overall}</div>
        <div className="text-sm font-semibold mb-4">{getRiskLabel(healthAnalysis.riskScore.overall)}</div>
        
        {/* Risk Breakdown */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Heart size={16} />
              Cardiovascular
            </span>
            <span className="font-bold">{healthAnalysis.riskScore.cardiovascular}/100</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Droplet size={16} />
              Metabolic
            </span>
            <span className="font-bold">{healthAnalysis.riskScore.metabolic}/100</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CheckCircle size={16} />
              Medication Compliance
            </span>
            <span className="font-bold">{healthAnalysis.riskScore.compliance}/100</span>
          </div>
        </div>

        {/* Trend */}
        <div className="mt-4 pt-4 border-t border-current border-opacity-20">
          <div className="flex items-center gap-2 text-sm font-semibold">
            {healthAnalysis.riskScore.trend === 'improving' && (
              <>
                <TrendingDown size={16} className="text-green-600" />
                <span className="text-green-600">Improving trend</span>
              </>
            )}
            {healthAnalysis.riskScore.trend === 'stable' && (
              <>
                <Activity size={16} />
                <span>Stable condition</span>
              </>
            )}
            {healthAnalysis.riskScore.trend === 'declining' && (
              <>
                <TrendingUp size={16} className="text-red-600" />
                <span className="text-red-600">Needs attention</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Health Predictions (NEW) */}
      {healthAnalysis.predictions.length > 0 && (
        <div className="mb-4 space-y-3">
          <h3 className="font-bold text-gray-900 text-lg">Health Alerts</h3>
          {healthAnalysis.predictions
            .sort((a, b) => {
              const severityOrder = { high: 3, medium: 2, low: 1 };
              return severityOrder[b.severity] - severityOrder[a.severity];
            })
            .map((prediction) => (
              <div
                key={prediction.id}
                className={`rounded-2xl p-4 shadow-sm border-2 ${
                  prediction.severity === 'high'
                    ? 'bg-red-50 border-red-200'
                    : prediction.severity === 'medium'
                    ? 'bg-orange-50 border-orange-200'
                    : 'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex gap-3">
                  <span className="text-2xl">{getSeverityEmoji(prediction.severity)}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-gray-900">{prediction.type}</h4>
                      <span className="text-sm font-bold px-2.5 py-1 bg-white bg-opacity-60 rounded-full">
                        {prediction.probability}% probability
                      </span>
                    </div>
                    <p className="text-sm text-gray-800 mb-2">{prediction.description}</p>
                    <p className="text-sm font-semibold text-gray-900 mb-1">💡 Recommendation:</p>
                    <p className="text-sm text-gray-700">{prediction.recommendation}</p>
                    {prediction.basedOn && prediction.basedOn.length > 0 && (
                      <p className="text-xs text-gray-600 mt-2">
                        Based on: {prediction.basedOn.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Overall Medication Compliance Card */}
      <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-blue-50 rounded-2xl p-6 shadow-sm border border-blue-100 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">Medication Compliance</h3>
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
                width: `${(complianceStats.taken / complianceStats.total) * 100}%`,
              }}
            ></div>
            <div
              className="bg-red-500"
              style={{
                width: `${(complianceStats.missed / complianceStats.total) * 100}%`,
              }}
            ></div>
            <div
              className="bg-orange-500"
              style={{
                width: `${(complianceStats.skipped / complianceStats.total) * 100}%`,
              }}
            ></div>
          </div>
        </div>
      </div>

      {/* Insights */}
      {complianceStats.mostMissedTime && (
        <div className="bg-orange-50 rounded-2xl p-4 border-2 border-orange-200 flex gap-3 mb-4">
          <AlertCircle size={20} className="text-orange-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-orange-900 text-sm">Pattern Detected</p>
            <p className="text-sm text-orange-800 mt-0.5">
              Medicines are often missed at {complianceStats.mostMissedTime}
            </p>
          </div>
        </div>
      )}

      {/* Vitals Trends Section (NEW) */}
      {vitalReadings.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900 text-lg">Vitals Trends</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setChartPeriod(7)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  chartPeriod === 7
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                7 Days
              </button>
              <button
                onClick={() => setChartPeriod(30)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  chartPeriod === 30
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                30 Days
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {/* Blood Pressure Chart */}
            {bpReadings.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-3">
                  <Gauge className="text-orange-500" size={20} />
                  <h4 className="font-bold text-gray-900">Blood Pressure</h4>
                </div>
                <VitalsChart
                  data={bpReadings}
                  type="bloodPressure"
                  days={chartPeriod}
                  showThresholds={true}
                />
              </div>
            )}

            {/* Heart Rate Chart */}
            {heartRateReadings.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-3">
                  <Heart className="text-red-500" size={20} />
                  <h4 className="font-bold text-gray-900">Heart Rate</h4>
                </div>
                <VitalsChart
                  data={heartRateReadings}
                  type="heartRate"
                  days={chartPeriod}
                  showThresholds={true}
                />
              </div>
            )}

            {/* Temperature Chart */}
            {tempReadings.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-3">
                  <Thermometer className="text-yellow-500" size={20} />
                  <h4 className="font-bold text-gray-900">Temperature</h4>
                </div>
                <VitalsChart
                  data={tempReadings}
                  type="temperature"
                  days={chartPeriod}
                  showThresholds={true}
                />
              </div>
            )}

            {/* Weight Chart */}
            {weightReadings.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="text-purple-500" size={20} />
                  <h4 className="font-bold text-gray-900">Weight</h4>
                </div>
                <VitalsChart
                  data={weightReadings}
                  type="weight"
                  days={chartPeriod}
                  showThresholds={true}
                />
              </div>
            )}

            {/* Blood Sugar Chart */}
            {bgReadings.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-3">
                  <Droplet className="text-pink-500" size={20} />
                  <h4 className="font-bold text-gray-900">Blood Sugar</h4>
                </div>
                <VitalsChart
                  data={bgReadings}
                  type="bloodSugar"
                  days={chartPeriod}
                  showThresholds={true}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Per-Medicine Compliance */}
      {complianceStats.medicineStats.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-bold text-gray-900">Per Medicine Compliance</h3>
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
                    width: `${(stat.taken / stat.total) * 100}%`,
                  }}
                ></div>
                <div
                  className="bg-red-500"
                  style={{
                    width: `${(stat.missed / stat.total) * 100}%`,
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

      {/* Generate Report Button */}
      {vitalReadings.length > 0 && (
        <button
          onClick={() => setShowAnalysis(true)}
          className="w-full mt-6 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
        >
          <BarChart3 size={20} />
          Generate Report & Analysis
        </button>
      )}

      {/* Analysis Modal */}
      {showAnalysis && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50">
          <div className="w-full bg-white rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Health Analysis</h2>
              <button
                onClick={() => setShowAnalysis(false)}
                className="text-gray-500 hover:text-gray-700 font-bold text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Overall Health Risk */}
            <div className={`rounded-2xl p-6 shadow-sm border-2 ${getRiskColor(healthAnalysis.riskScore.overall)} mb-4`}>
              <h3 className="font-bold text-lg mb-2">Overall Health Risk</h3>
              <div className="text-4xl font-bold mb-2">{healthAnalysis.riskScore.overall}</div>
              <div className="text-sm font-semibold mb-4">{getRiskLabel(healthAnalysis.riskScore.overall)}</div>
              
              {/* Risk Breakdown */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Cardiovascular</span>
                  <span className="font-bold">{healthAnalysis.riskScore.cardiovascular}/100</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Metabolic</span>
                  <span className="font-bold">{healthAnalysis.riskScore.metabolic}/100</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Medication Compliance</span>
                  <span className="font-bold">{healthAnalysis.riskScore.compliance}/100</span>
                </div>
              </div>
            </div>

            {/* Health Predictions */}
            {healthAnalysis.predictions.length > 0 && (
              <div className="mb-4">
                <h3 className="font-bold text-gray-900 mb-3">Health Alerts</h3>
                <div className="space-y-3">
                  {healthAnalysis.predictions
                    .sort((a, b) => {
                      const severityOrder = { high: 3, medium: 2, low: 1 };
                      return severityOrder[b.severity] - severityOrder[a.severity];
                    })
                    .map((prediction) => (
                      <div
                        key={prediction.id}
                        className={`rounded-lg p-3 ${
                          prediction.severity === 'high'
                            ? 'bg-red-50 border border-red-200'
                            : prediction.severity === 'medium'
                            ? 'bg-orange-50 border border-orange-200'
                            : 'bg-blue-50 border border-blue-200'
                        }`}
                      >
                        <div className="flex gap-2 mb-1">
                          <span className="text-lg">
                            {prediction.severity === 'high' ? '🚨' : prediction.severity === 'medium' ? '⚠️' : 'ℹ️'}
                          </span>
                          <h4 className="font-bold text-gray-900">{prediction.type}</h4>
                        </div>
                        <p className="text-sm text-gray-700 mb-1">{prediction.description}</p>
                        <p className="text-sm font-semibold text-gray-900">💡 {prediction.recommendation}</p>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Close Button */}
            <button
              onClick={() => setShowAnalysis(false)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl mt-6"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {complianceStats.total === 0 && vitalReadings.length === 0 && (
        <div className="bg-gray-50 rounded-2xl p-8 text-center border border-gray-100">
          <p className="text-gray-600 font-semibold">No health data yet</p>
          <p className="text-sm text-gray-500 mt-1">Add medicines and vitals to see analytics</p>
        </div>
      )}
    </div>
  );
};

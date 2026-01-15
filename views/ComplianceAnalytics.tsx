import React, { useMemo, useState } from 'react';
import { TrendingUp, AlertCircle, CheckCircle, Activity, AlertTriangle, Heart, Droplet, Thermometer, Gauge, TrendingDown, BarChart3, FileText, ArrowLeft } from 'lucide-react';
import { Medicine, MedicineLog, VitalReading } from '../types';
import { analyzeHealthData } from '../services/healthPredictions';
import { VitalsChart } from '../components/VitalsChart';

interface ComplianceAnalyticsProps {
  medicines: Medicine[];
  medicineLogs: MedicineLog[];
  vitalReadings: VitalReading[];
  onBack?: () => void;
}

export const ComplianceAnalytics: React.FC<ComplianceAnalyticsProps> = ({
  medicines = [],
  medicineLogs = [],
  vitalReadings = [],
  onBack,
}) => {
  const [chartPeriod, setChartPeriod] = useState<7 | 30>(7);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Get vitals statistics
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
        latestValue: systolicValues[0],
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
        latestValue: latestNum,
        avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
        min: Math.min(...values),
        max: Math.max(...values),
        count: last30Days.length,
        lastDate: latest.timestamp instanceof Date ? latest.timestamp : new Date(latest.timestamp),
      };
    }
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

    console.log('[ComplianceAnalytics] Total recent logs:', recentLogs.length);
    console.log('[ComplianceAnalytics] All medicines IDs:', medicines.map(m => m.id));
    console.log('[ComplianceAnalytics] All log medicine IDs:', [...new Set(recentLogs.map(l => l.medicineId))]);
    
    // Find orphaned logs (logs for medicines that no longer exist)
    const orphanedLogs = recentLogs.filter(log => !medicines.some(m => m.id === log.medicineId));
    if (orphanedLogs.length > 0) {
      console.warn('[ComplianceAnalytics] Found orphaned logs (medicines deleted/not in list):', orphanedLogs.length);
      console.warn('[ComplianceAnalytics] Orphaned medicine IDs:', [...new Set(orphanedLogs.map(l => l.medicineId))]);
    }

    // Only count logs for medicines that still exist
    const validLogs = recentLogs.filter(log => medicines.some(m => m.id === log.medicineId));
    
    console.log('[ComplianceAnalytics] Valid logs (after filtering orphaned):', validLogs.length);
    console.log('[ComplianceAnalytics] Valid logs breakdown:', {
      taken: validLogs.filter((l) => l.status === 'TAKEN').length,
      missed: validLogs.filter((l) => l.status === 'MISSED').length,
      skipped: validLogs.filter((l) => l.status === 'SKIPPED').length
    });

    if (validLogs.length === 0) {
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

    const taken = validLogs.filter((l) => l.status === 'TAKEN').length;
    const missed = validLogs.filter((l) => l.status === 'MISSED').length;
    const skipped = validLogs.filter((l) => l.status === 'SKIPPED').length;

    // Medicine-specific stats
    const medicineStats = medicines.map((medicine) => {
      const medicineLogs = validLogs.filter((l) => l.medicineId === medicine.id);
      const takenCount = medicineLogs.filter((l) => l.status === 'TAKEN').length;
      const missedCount = medicineLogs.filter((l) => l.status === 'MISSED').length;
      const skippedCount = medicineLogs.filter((l) => l.status === 'SKIPPED').length;
      const totalLogs = medicineLogs.length;
      
      // Calculate compliance only from taken vs (taken + missed), excluding skipped
      const relevantTotal = takenCount + missedCount;
      const compliance = relevantTotal > 0 ? Math.round((takenCount / relevantTotal) * 100) : 0;

      console.log(`[ComplianceAnalytics] ${medicine.name}:`, {
        taken: takenCount,
        missed: missedCount,
        skipped: skippedCount,
        total: totalLogs,
        relevantTotal,
        compliance
      });

      return {
        medicineId: medicine.id,
        medicineName: medicine.name,
        compliance,
        taken: takenCount,
        missed: missedCount,
        skipped: skippedCount,
        total: totalLogs,
      };
    }).filter(stat => stat.total > 0); // Only include medicines with logs

    // Find most missed time
    const timeStats: { [key: string]: number } = {};
    validLogs
      .filter((l) => l.status === 'MISSED')
      .forEach((log) => {
        timeStats[log.scheduledTime] = (timeStats[log.scheduledTime] || 0) + 1;
      });

    const mostMissedTime = Object.entries(timeStats).sort(([, a], [, b]) => b - a)[0]?.[0] || null;

    return {
      totalComplianceRate: Math.round((taken / validLogs.length) * 100),
      taken,
      missed,
      skipped,
      total: validLogs.length,
      medicineStats,
      mostMissedTime,
    };
  }, [medicines, medicineLogs]);

  // Health analysis
  const healthAnalysis = useMemo(() => {
    try {
      return analyzeHealthData(vitalReadings || [], medicineLogs || []);
    } catch (error) {
      console.error('Error analyzing health data:', error);
      return {
        predictions: [],
        riskScore: {
          overall: 0,
          cardiovascular: 0,
          metabolic: 0,
          compliance: 0,
          trend: 'stable' as const,
        }
      };
    }
  }, [vitalReadings, medicineLogs]);

  // Generate and download PDF report
  const generatePdfReport = async () => {
    setIsGeneratingPdf(true);
    try {
      const reportDate = new Date().toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      // Get all medicine compliance data (not just last 7 days)
      const allComplianceLogs = medicineLogs.filter(log => log.status === 'taken' || log.status === 'missed');
      const totalTaken = allComplianceLogs.filter(log => log.status === 'taken').length;
      const totalMissed = allComplianceLogs.filter(log => log.status === 'missed').length;
      const totalCompliance = allComplianceLogs.length > 0 
        ? Math.round((totalTaken / allComplianceLogs.length) * 100) 
        : 0;

      // Format all vitals data by type
      const formatVitalsData = (type: VitalReading['type'], label: string, unit: string) => {
        const readings = vitalReadings.filter(v => v.type === type).sort((a, b) => {
          const dateA = a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp);
          const dateB = b.timestamp instanceof Date ? b.timestamp : new Date(b.timestamp);
          return dateB.getTime() - dateA.getTime();
        });
        
        if (readings.length === 0) return `${label}: No data recorded\n`;
        
        let output = `${label} (${readings.length} readings):\n`;
        readings.forEach((r, i) => {
          const date = r.timestamp instanceof Date ? r.timestamp : new Date(r.timestamp);
          const dateStr = date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
          const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
          let valueStr = '';
          
          if (type === 'bloodPressure' && typeof r.value === 'object' && 'systolic' in r.value) {
            valueStr = `${r.value.systolic}/${r.value.diastolic}`;
          } else if (typeof r.value === 'number') {
            valueStr = r.value.toFixed(1);
          }
          
          output += `  ${i + 1}. ${dateStr} ${timeStr} - ${valueStr} ${unit}\n`;
        });
        return output + '\n';
      };

      // Get step count data (from latest reading if available)
      const stepData = vitalReadings.find(v => v.type === 'steps');
      const stepCount = stepData ? (typeof stepData.value === 'number' ? stepData.value : 0) : 0;

      // Create HTML formatted report
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SafeNest Health Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
      color: #333;
    }
    .container { 
      max-width: 900px; 
      margin: 0 auto; 
      background: white; 
      border-radius: 16px; 
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    .header { 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white; 
      padding: 40px 30px; 
      text-align: center;
    }
    .header h1 { font-size: 32px; margin-bottom: 10px; font-weight: 700; }
    .header p { font-size: 16px; opacity: 0.95; }
    .content { padding: 30px; }
    .section { 
      margin-bottom: 35px; 
      padding: 25px; 
      background: #f8f9fa; 
      border-radius: 12px;
      border-left: 5px solid #667eea;
    }
    .section-title { 
      font-size: 20px; 
      font-weight: 700; 
      color: #667eea; 
      margin-bottom: 20px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .risk-card { 
      background: white;
      padding: 20px; 
      border-radius: 10px; 
      margin-bottom: 15px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .risk-score { 
      font-size: 48px; 
      font-weight: 800; 
      color: #667eea;
      margin: 10px 0;
    }
    .risk-high { color: #dc2626; }
    .risk-moderate { color: #f59e0b; }
    .risk-low { color: #10b981; }
    .stat-grid { 
      display: grid; 
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
      gap: 15px; 
      margin-top: 15px;
    }
    .stat-box { 
      background: white; 
      padding: 20px; 
      border-radius: 10px; 
      text-align: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .stat-label { 
      font-size: 12px; 
      color: #6b7280; 
      text-transform: uppercase; 
      font-weight: 600;
      margin-bottom: 8px;
    }
    .stat-value { 
      font-size: 28px; 
      font-weight: 700; 
      color: #667eea;
    }
    .medicine-list { 
      background: white; 
      padding: 15px; 
      border-radius: 8px; 
      margin-top: 15px;
    }
    .medicine-item { 
      padding: 12px; 
      border-bottom: 1px solid #e5e7eb; 
      display: flex;
      align-items: center;
    }
    .medicine-item:last-child { border-bottom: none; }
    .medicine-icon { 
      width: 40px; 
      height: 40px; 
      background: #667eea; 
      color: white; 
      border-radius: 8px; 
      display: flex; 
      align-items: center; 
      justify-content: center; 
      font-weight: 700;
      margin-right: 15px;
    }
    .vitals-table { 
      width: 100%; 
      background: white; 
      border-radius: 8px; 
      overflow: hidden;
      margin-top: 15px;
    }
    .vitals-table th { 
      background: #667eea; 
      color: white; 
      padding: 15px; 
      text-align: left;
      font-weight: 600;
      font-size: 14px;
    }
    .vitals-table td { 
      padding: 12px 15px; 
      border-bottom: 1px solid #e5e7eb;
      font-size: 14px;
    }
    .vitals-table tr:last-child td { border-bottom: none; }
    .vitals-table tr:hover { background: #f3f4f6; }
    .footer { 
      background: #1f2937; 
      color: white; 
      text-align: center; 
      padding: 25px;
      font-size: 14px;
    }
    .badge { 
      display: inline-block; 
      padding: 6px 12px; 
      border-radius: 20px; 
      font-size: 12px; 
      font-weight: 600;
      margin-top: 10px;
    }
    .badge-success { background: #d1fae5; color: #065f46; }
    .badge-warning { background: #fef3c7; color: #92400e; }
    .badge-danger { background: #fee2e2; color: #991b1b; }
    @media print {
      body { background: white; padding: 0; }
      .container { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🏥 SafeNest Health Report</h1>
      <p>Comprehensive Health Analytics & Vital Monitoring</p>
      <p style="margin-top: 10px; font-size: 14px;">Generated: ${reportDate}</p>
    </div>

    <div class="content">
      <!-- Health Risk Analysis -->
      <div class="section">
        <div class="section-title">📊 Overall Health Risk Analysis</div>
        <div class="risk-card">
          <div class="risk-score ${healthAnalysis.riskScore.overall >= 70 ? 'risk-high' : healthAnalysis.riskScore.overall >= 40 ? 'risk-moderate' : 'risk-low'}">${healthAnalysis.riskScore.overall}<span style="font-size: 24px;">/100</span></div>
          <span class="badge ${healthAnalysis.riskScore.overall >= 70 ? 'badge-danger' : healthAnalysis.riskScore.overall >= 40 ? 'badge-warning' : 'badge-success'}">
            ${healthAnalysis.riskScore.overall >= 70 ? '🚨 HIGH RISK' : healthAnalysis.riskScore.overall >= 40 ? '⚠️ MODERATE RISK' : '✅ LOW RISK'}
          </span>
        </div>
        <div class="stat-grid">
          <div class="stat-box">
            <div class="stat-label">❤️ Cardiovascular</div>
            <div class="stat-value">${healthAnalysis.riskScore.cardiovascular}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">🩺 Metabolic</div>
            <div class="stat-value">${healthAnalysis.riskScore.metabolic}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">💊 Compliance</div>
            <div class="stat-value">${healthAnalysis.riskScore.compliance}</div>
          </div>
        </div>
      </div>

      <!-- Medication Compliance -->
      <div class="section">
        <div class="section-title">💊 Medication Compliance (All Time)</div>
        <div class="stat-grid">
          <div class="stat-box">
            <div class="stat-label">Compliance Rate</div>
            <div class="stat-value">${totalCompliance}%</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Taken</div>
            <div class="stat-value" style="color: #10b981;">${totalTaken}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Missed</div>
            <div class="stat-value" style="color: #dc2626;">${totalMissed}</div>
          </div>
        </div>
        
        <div style="margin-top: 20px; font-weight: 600; color: #374151;">Active Medicines:</div>
        <div class="medicine-list">
          ${medicines.length > 0 ? medicines.map((m, i) => `
            <div class="medicine-item">
              <div class="medicine-icon">${i + 1}</div>
              <div>
                <div style="font-weight: 600; color: #1f2937;">${m.name}</div>
                <div style="font-size: 13px; color: #6b7280;">${m.dosage} • Times: ${m.times.join(', ')}</div>
              </div>
            </div>
          `).join('') : '<div style="padding: 20px; text-align: center; color: #9ca3af;">No active medicines</div>'}
        </div>
      </div>

      <!-- Vitals Data -->
      <div class="section">
        <div class="section-title">📈 Vitals Data - Complete History</div>
        
        ${['bloodPressure', 'heartRate', 'temperature', 'bloodSugar', 'spo2', 'weight'].map(type => {
          const labels = {
            bloodPressure: { icon: '🩺', name: 'Blood Pressure', unit: 'mmHg' },
            heartRate: { icon: '❤️', name: 'Heart Rate', unit: 'bpm' },
            temperature: { icon: '🌡️', name: 'Temperature', unit: '°F' },
            bloodSugar: { icon: '🩸', name: 'Blood Sugar', unit: 'mg/dL' },
            spo2: { icon: '💨', name: 'Oxygen Saturation', unit: '%' },
            weight: { icon: '⚖️', name: 'Weight', unit: 'kg' }
          };
          const readings = vitalReadings.filter(v => v.type === type).sort((a, b) => {
            const dateA = a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp);
            const dateB = b.timestamp instanceof Date ? b.timestamp : new Date(b.timestamp);
            return dateB.getTime() - dateA.getTime();
          });
          
          if (readings.length === 0) return '';
          
          return `
            <div style="margin-bottom: 25px;">
              <h3 style="color: #374151; font-size: 16px; font-weight: 600; margin-bottom: 10px;">
                ${labels[type].icon} ${labels[type].name} <span style="color: #9ca3af; font-size: 14px; font-weight: 400;">(${readings.length} readings)</span>
              </h3>
              <table class="vitals-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Date & Time</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  ${readings.slice(0, 50).map((r, i) => {
                    const date = r.timestamp instanceof Date ? r.timestamp : new Date(r.timestamp);
                    const dateStr = date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
                    const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                    let valueStr = '';
                    
                    if (type === 'bloodPressure' && typeof r.value === 'object' && 'systolic' in r.value) {
                      valueStr = `${r.value.systolic}/${r.value.diastolic}`;
                    } else if (typeof r.value === 'number') {
                      valueStr = r.value.toFixed(1);
                    }
                    
                    return `
                      <tr>
                        <td style="font-weight: 600; color: #667eea;">${i + 1}</td>
                        <td>${dateStr} <span style="color: #9ca3af;">at</span> ${timeStr}</td>
                        <td style="font-weight: 700; color: #1f2937;">${valueStr} <span style="color: #9ca3af; font-weight: 400;">${labels[type].unit}</span></td>
                      </tr>
                    `;
                  }).join('')}
                  ${readings.length > 50 ? `<tr><td colspan="3" style="text-align: center; color: #9ca3af; font-style: italic;">... and ${readings.length - 50} more readings</td></tr>` : ''}
                </tbody>
              </table>
            </div>
          `;
        }).join('')}

        <div style="margin-top: 20px;">
          <h3 style="color: #374151; font-size: 16px; font-weight: 600; margin-bottom: 10px;">🚶 Daily Steps</h3>
          <div class="stat-box" style="text-align: left;">
            <div class="stat-label">Current Step Count</div>
            <div class="stat-value">${stepCount.toLocaleString()}</div>
          </div>
        </div>
      </div>

      <!-- Summary -->
      <div class="section" style="border-left-color: #10b981;">
        <div class="section-title" style="color: #10b981;">📋 Report Summary</div>
        <div class="stat-grid">
          <div class="stat-box">
            <div class="stat-label">Total Vital Readings</div>
            <div class="stat-value" style="color: #10b981;">${vitalReadings.length}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Report Period</div>
            <div style="font-size: 16px; font-weight: 600; color: #374151; margin-top: 8px;">All Time Data</div>
          </div>
        </div>
      </div>
    </div>

    <div class="footer">
      <p style="font-weight: 600; font-size: 16px; margin-bottom: 8px;">SafeNest - Senior Care Companion</p>
      <p style="opacity: 0.8;">Empowering seniors with comprehensive health monitoring</p>
    </div>
  </div>
</body>
</html>`;

      // Create blob and download
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const fileName = `SafeNest_Health_Report_${new Date().toISOString().split('T')[0]}.html`;
      
      // Request storage permission for Android
      if (typeof (window as any).Capacitor !== 'undefined') {
        try {
          const cap = (window as any).Capacitor;
          if (cap.isPluginAvailable('Permissions')) {
            try {
              const { Permissions } = cap.Plugins;
              await Permissions.requestPermissions({
                permissions: ['storage'],
              });
            } catch (e) {
              console.warn('Permission request failed:', e);
            }
          }
        } catch (e) {
          console.warn('Capacitor not fully available:', e);
        }
      }

      // Download the file
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 100);
      
      alert(`✅ Report downloaded!\n\n📄 File: ${fileName}\n\n👉 Check your Downloads folder`);
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Filter vital readings by type
  const getVitalsByType = (type: VitalReading['type']) => {
    return vitalReadings.filter(v => v.type === type);
  };

  const bpReadings = getVitalsByType('bloodPressure');
  const heartRateReadings = getVitalsByType('heartRate');
  const tempReadings = getVitalsByType('temperature');
  const weightReadings = getVitalsByType('weight');
  const bgReadings = getVitalsByType('bloodSugar');

  // Get stats for each vital type
  const bpStats = getVitalsStats(bpReadings, 'bloodPressure');
  const heartRateStats = getVitalsStats(heartRateReadings, 'heartRate');
  const tempStats = getVitalsStats(tempReadings, 'temperature');
  const weightStats = getVitalsStats(weightReadings, 'weight');
  const sugarStats = getVitalsStats(bgReadings, 'bloodSugar');

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
      {/* Header with Back Button */}
      <div className="mb-6">
        {onBack && (
          <button
            onClick={onBack}
            className="mb-4 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="font-medium">Back</span>
          </button>
        )}
        
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Health Analytics</h2>
        <p className="text-gray-600">Comprehensive health and medication compliance analysis</p>
      </div>

      {/* Overall Health Risk Card */}
      <div className={`rounded-2xl p-6 shadow-sm border-2 ${getRiskColor(healthAnalysis.riskScore.overall)} mb-4`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Overall Health Risk</h3>
          <AlertCircle size={24} />
        </div>
        <div className="text-5xl font-bold mb-2">{healthAnalysis.riskScore.overall}</div>
        <div className="text-sm font-semibold mb-4">{getRiskLabel(healthAnalysis.riskScore.overall)}</div>
        
        {/* Risk Breakdown */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span>Cardiovascular Risk</span>
            <span className="font-bold">{healthAnalysis.riskScore.cardiovascular}/100</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Metabolic Risk</span>
            <span className="font-bold">{healthAnalysis.riskScore.metabolic}/100</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Medication Compliance</span>
            <span className="font-bold text-blue-600">{complianceStats.totalComplianceRate}%</span>
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

      {/* Health Predictions */}
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
            <span className="flex items-center gap-1 text-yellow-700 font-semibold">
              <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
              Skipped
            </span>
          </div>
          <div className="flex h-3 rounded-full overflow-hidden bg-gray-200">
            {complianceStats.total > 0 && (
              <>
                <div 
                  className="bg-green-500" 
                  style={{ width: `${(complianceStats.taken / complianceStats.total) * 100}%` }}
                />
                <div 
                  className="bg-red-500" 
                  style={{ width: `${(complianceStats.missed / complianceStats.total) * 100}%` }}
                />
                <div 
                  className="bg-yellow-500" 
                  style={{ width: `${(complianceStats.skipped / complianceStats.total) * 100}%` }}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Medicine-wise Compliance - Enhanced */}
      {complianceStats.medicineStats.length > 0 && (
        <div className="mb-4 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-1 h-6 bg-blue-600 rounded-full"></div>
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
                          <Heart size={20} className="text-white" />
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

      {/* Vitals Chart */}
      {vitalReadings.length > 0 && (
        <div className="mb-4">
          <h3 className="font-bold text-gray-900 mb-3">Vitals Trend</h3>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4 w-full max-w-full">
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => setChartPeriod(7)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  chartPeriod === 7 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                7 Days
              </button>
              <button
                onClick={() => setChartPeriod(30)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  chartPeriod === 30 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                30 Days
              </button>
            </div>
            <div className="w-full max-w-full overflow-x-auto">
              <div className="min-w-[320px] w-full">
                <VitalsChart vitalReadings={vitalReadings} period={chartPeriod} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Report Button - Always Visible */}
      <div className="space-y-3 mt-6">
        {vitalReadings.length > 0 && (
          <button
            onClick={() => setShowAnalysis(true)}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
          >
            <BarChart3 size={20} />
            View Full Analysis
          </button>
        )}
        
        <button
          onClick={generatePdfReport}
          disabled={isGeneratingPdf}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
        >
          <FileText size={20} />
          {isGeneratingPdf ? 'Exporting Report...' : '📄 Export Health Report'}
        </button>
      </div>

      {/* Analysis Modal */}
      {showAnalysis && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50">
          <div className="w-full bg-white rounded-t-3xl flex flex-col max-h-[90vh]">
            {/* Scrollable Content */}
            <div className="overflow-y-auto flex-1 p-6">
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
            </div>

            {/* Fixed Action Buttons */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 flex gap-3">
              <button
                onClick={generatePdfReport}
                disabled={isGeneratingPdf}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                <FileText size={20} />
                {isGeneratingPdf ? 'Exporting...' : 'Export Report'}
              </button>
              <button
                onClick={() => setShowAnalysis(false)}
                className="flex-1 bg-gray-400 hover:bg-gray-500 text-white font-bold py-3 rounded-xl"
              >
                Close
              </button>
            </div>
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

import { SeniorStatus, UserRole, AlertHistory } from './types';

export const INITIAL_SENIOR_STATUS: SeniorStatus = {
  userId: 'u1',
  batteryLevel: 92, // Will be overwritten by real sensor
  heartRate: 72,
  spo2: 98,
  steps: 0,
  // New Mock Data
  sleepHours: 7.5,
  sleepScore: 85,
  bloodPressureSys: 124,
  bloodPressureDia: 82,
  bodyTemp: 98.4,
  
  isMoving: false,
  lastUpdate: new Date(),
  status: 'Normal',
  isFallDetectionEnabled: true,
  isLocationSharingEnabled: true,
  location: {
    lat: 18.5204,  // Pune, India coordinates as default
    lng: 73.8567,
    address: 'Loading location...',
    updatedAt: new Date()
  },
  recentActivity: [
    {
      id: 'init-1',
      type: 'INFO',
      title: 'System Active',
      timestamp: new Date(),
      details: 'SafeNest monitoring started'
    }
  ]
};
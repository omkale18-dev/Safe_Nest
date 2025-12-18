import { SeniorStatus, UserRole, AlertHistory } from './types';

export const INITIAL_SENIOR_STATUS: SeniorStatus = {
  userId: 'u1',
  batteryLevel: 92, // Will be overwritten by real sensor
  heartRate: 72,
  spo2: 98,
  steps: 3450,
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
    lat: 37.7749,
    lng: -122.4194,
    address: 'Initializing GPS...',
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
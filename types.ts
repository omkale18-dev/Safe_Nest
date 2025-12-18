
export enum UserRole {
  SENIOR = 'SENIOR',
  CAREGIVER = 'CAREGIVER',
}

export enum AppStatus {
  IDLE = 'IDLE',
  WARNING_FALL = 'WARNING_FALL', // Countdown after fall detection
  WARNING_SOS = 'WARNING_SOS',   // Countdown after SOS press
  EMERGENCY = 'EMERGENCY',       // Active emergency
  SAFE = 'SAFE',                 // Post-emergency check-in
}

export interface LocationData {
  lat: number;
  lng: number;
  address: string;
  updatedAt: Date;
}

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  avatar: string;
  phone: string;
}

export interface ActivityItem {
  id: string;
  type: 'LOCATION' | 'BATTERY' | 'EMERGENCY' | 'INFO';
  title: string;
  timestamp: Date;
  details?: string;
}

export interface Reminder {
  id: string;
  title: string;
  instructions: string; // e.g., "Take with food"
  time: string; // 24hr format "HH:MM"
  type: 'MEDICATION' | 'HYDRATION' | 'APPOINTMENT';
  status: 'PENDING' | 'COMPLETED' | 'SKIPPED' | 'SNOOZED';
  image?: string;
  createdBy?: string; // Name of the user who created/managed this reminder
}

export interface SeniorStatus {
  userId: string;
  batteryLevel: number;
  heartRate: number;
  spo2: number;
  steps: number;
  // New Health Metrics
  sleepHours: number;
  sleepScore: number;
  bloodPressureSys: number;
  bloodPressureDia: number;
  bodyTemp: number;
  
  isMoving: boolean;
  lastUpdate: Date;
  status: 'Normal' | 'Fall Detected' | 'SOS Active';
  location: LocationData;
  recentActivity: ActivityItem[];
  // Sensor Configuration
  isFallDetectionEnabled: boolean;
  isLocationSharingEnabled: boolean;
}

export interface AlertHistory {
  id: string;
  type: 'FALL' | 'SOS';
  timestamp: Date;
  resolved: boolean;
  resolvedBy?: string;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  relationship?: string;
  avatar?: string;
  isPrimary?: boolean;
}

export interface HouseholdMember {
  id: string;
  name: string;
  role: UserRole;
  avatar: string;
  phone: string;
  joinedAt: string;
}

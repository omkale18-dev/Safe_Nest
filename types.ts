
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
  email?: string; // Email address for notifications and OTP verification
  isPhoneVerified?: boolean; // Phone OTP verification status
  isEmailVerified?: boolean; // Email OTP verification status
  deviceName?: string; // Device name where senior is logged in
  lastActiveDevice?: string; // Last device that was active
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
  deviceName?: string; // Device name where senior is logged in
  lastActiveDevice?: string; // Last device that was active
}

// ===== MEDICINE MANAGEMENT =====
export interface Medicine {
  id: string;
  name: string; // e.g., "Aspirin", "Metformin"
  dosage: string; // e.g., "2 tablets", "5ml syrup"
  frequency: number; // 1, 2, 3, 4 times daily
  times: string[]; // ["08:00", "13:00", "20:00"] - 24hr format
  timeLabels?: string[]; // ["Breakfast", "Lunch", "Dinner"] - optional friendly names
  startDate: Date;
  endDate?: Date; // Optional - if null, it's ongoing
  durationDays?: number; // e.g., 30, 60 - calculated from start and end
  isOngoing: boolean; // true if no end date
  instructions: string; // e.g., "After food", "With water"
  doctorName?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  // NEW: Refill tracking
  totalQuantity?: number; // Total pills/doses in pack (e.g., 30)
  remainingQuantity?: number; // Current remaining (auto-decremented)
  refillAlertThreshold?: number; // Alert when this many left (e.g., 5)
  // NEW: Voice reminder
  voiceReminderEnabled?: boolean; // Enable TTS for this medicine
  // NEW: Critical medicine flag
  isCritical?: boolean; // If true, escalate missed alerts
}

export interface MedicineLog {
  id: string;
  medicineId: string;
  medicineName: string;
  dosage: string;
  scheduledTime: string; // Time it was supposed to be taken
  actualTime?: string; // When it was actually taken
  status: 'PENDING' | 'TAKEN' | 'MISSED' | 'SKIPPED' | 'SNOOZED';
  date: Date;
  notes?: string;
  // NEW: Snooze tracking
  snoozedUntil?: string; // Time snoozed until (e.g., "08:15")
  snoozeCount?: number; // How many times snoozed
}

export interface MedicineHistory {
  medicineId: string;
  medicineName: string;
  logs: MedicineLog[];
  compliancePercentage: number; // 0-100
  mostMissedTime?: string; // Time most often missed
}

// ===== MEDICINE SIDE EFFECTS =====
export interface SideEffectLog {
  id: string;
  householdId: string;
  medicineId: string;
  medicineName: string;
  effect: 'dizziness' | 'nausea' | 'headache' | 'fatigue' | 'dryMouth' | 'other';
  severity: 'mild' | 'moderate' | 'severe';
  notes?: string;
  timestamp: Date;
}

// ===== HEALTH DATA & VITALS =====
export interface VitalReading {
  id: string;
  type: 'bloodPressure' | 'temperature' | 'weight' | 'bloodSugar' | 'heartRate' | 'spo2' | 'stress';
  value: number | { systolic: number; diastolic: number }; // BP is object, others are numbers
  unit?: string; // Unit of measurement (e.g., "mmHg", "°F", "mg/dL")
  systolic?: number; // For blood pressure readings
  diastolic?: number; // For blood pressure readings
  timestamp: Date;
  source: 'manual'; // Where data came from
  enteredBy?: 'senior' | 'caregiver'; // Who entered it (for manual entries)
  notes?: string;
}

export interface HealthPrediction {
  id: string;
  type: 'hypertension' | 'diabetes' | 'cardiac' | 'infection' | 'malnutrition' | 'medication';
  severity: 'low' | 'medium' | 'high';
  probability: number; // 0-100%
  description: string;
  recommendation: string;
  basedOn: string[]; // Data points used for prediction
  timestamp: Date;
}

export interface HealthRiskScore {
  overall: number; // 0-100
  cardiovascular: number; // 0-100
  metabolic: number; // 0-100
  compliance: number; // 0-100
  trend: 'improving' | 'stable' | 'declining';
}

// ===== HEALTH REPORTS =====
export interface HealthReport {
  id: string;
  householdId: string;
  seniorId: string;
  period: 'weekly' | 'monthly';
  startDate: Date;
  endDate: Date;
  generatedAt: Date;
  
  // Vital averages for the period
  vitalsData: {
    bloodPressure?: { avgSystolic: number; avgDiastolic: number };
    heartRate?: number;
    temperature?: number;
    weight?: number;
    bloodSugar?: number;
    spo2?: number;
  };
  
  // Predictions for the period
  predictions: HealthPrediction[];
  
  // Risk score for the period
  riskScore: HealthRiskScore;
  
  // Medication compliance
  medicationCompliance: number; // 0-100%
  
  // Summary insights
  summary: string;
  recommendations: string[];
}

export interface ReportNotification {
  id: string;
  householdId: string;
  seniorId: string;
  reportId: string;
  period: 'weekly' | 'monthly';
  createdAt: Date;
  read: boolean;
}

// ===== DOCTOR APPOINTMENTS =====
export interface DoctorAppointment {
  id: string;
  doctorName: string;
  specialty?: string; // e.g., "Cardiologist", "General Physician"
  hospitalName?: string;
  address?: string;
  phone?: string;
  date: Date;
  time: string; // "10:30" - 24hr format
  purpose?: string; // e.g., "Follow-up", "Blood Test", "Routine Checkup"
  notes?: string;
  reminderBefore: number; // Minutes before to remind (e.g., 60 = 1 hour before)
  status: 'UPCOMING' | 'COMPLETED' | 'CANCELLED' | 'MISSED';
  createdAt: Date;
  createdBy: 'senior' | 'caregiver';
}

// ===== HEALTH LOGS (BP, Sugar, Sleep, Water) =====
export interface BloodPressureLog {
  id: string;
  systolic: number; // e.g., 120
  diastolic: number; // e.g., 80
  pulse?: number; // Optional pulse rate
  timestamp: Date;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  notes?: string;
  enteredBy: 'senior' | 'caregiver';
}

export interface BloodSugarLog {
  id: string;
  value: number; // mg/dL (e.g., 110)
  measurementType: 'fasting' | 'before_meal' | 'after_meal' | 'random' | 'bedtime';
  timestamp: Date;
  notes?: string;
  enteredBy: 'senior' | 'caregiver';
}

export interface SleepLog {
  id: string;
  date: Date; // The night of sleep (e.g., Jan 5 = night of Jan 5-6)
  bedTime?: string; // "22:30" when went to bed
  wakeTime?: string; // "06:30" when woke up
  duration?: number; // Hours of sleep (auto-calculated or manual)
  quality: 1 | 2 | 3 | 4 | 5; // 1=Very Poor, 5=Excellent
  interruptions?: number; // Times woke up during night
  notes?: string;
  enteredBy: 'senior' | 'caregiver';
}

export interface WaterLog {
  id: string;
  amount: number; // ml (e.g., 250 for 1 glass)
  timestamp: Date;
}

export interface WaterSettings {
  dailyGoal: number; // ml (e.g., 2000 = 2 liters)
  reminderInterval: number; // minutes between reminders (e.g., 60)
  startTime: string; // "07:00" - when to start reminders
  endTime: string; // "21:00" - when to stop reminders
  enabled: boolean;
}

// ===== GEOFENCE =====
export interface Geofence {
  id: string;
  name: string; // e.g., "Home", "Temple", "Park"
  latitude: number;
  longitude: number;
  radius: number; // meters (e.g., 100)
  type: 'home' | 'safe_zone' | 'restricted';
  alertOnExit: boolean; // Alert caregiver when senior leaves
  alertOnEntry?: boolean; // Alert when senior enters (for restricted zones)
  enabled: boolean;
  createdAt: Date;
}

export interface GeofenceEvent {
  id: string;
  geofenceId: string;
  geofenceName: string;
  eventType: 'EXIT' | 'ENTRY';
  timestamp: Date;
  location: {
    latitude: number;
    longitude: number;
  };
  notifiedCaregivers: string[]; // IDs of caregivers notified
}

// ===== OFFLINE EMERGENCY DATA =====
export interface OfflineEmergencyData {
  contacts: Contact[];
  seniorProfile: {
    name: string;
    phone: string;
    bloodGroup?: string;
    allergies?: string[];
    medicalConditions?: string[];
    currentMedicines?: string[];
  };
  homeAddress?: string;
  lastSyncedAt: Date;
}

export type Language = 'en' | 'hi' | 'bn' | 'te' | 'mr' | 'ta' | 'gu' | 'kn' | 'ml' | 'pa' | 'or';

// Language code mapping for LibreTranslate API
export const languageMap: Record<Language, { name: string; flag: string; code: string }> = {
  en: { name: 'English', flag: '🇮🇳', code: 'en' },
  hi: { name: 'हिन्दी (Hindi)', flag: '🇮🇳', code: 'hi' },
  bn: { name: 'বাংলা (Bengali)', flag: '🇮🇳', code: 'bn' },
  te: { name: 'తెలుగు (Telugu)', flag: '🇮🇳', code: 'te' },
  mr: { name: 'मराठी (Marathi)', flag: '🇮🇳', code: 'mr' },
  ta: { name: 'தமிழ् (Tamil)', flag: '🇮🇳', code: 'ta' },
  gu: { name: 'ગુજરાતી (Gujarati)', flag: '🇮🇳', code: 'gu' },
  kn: { name: 'ಕನ್ನಡ (Kannada)', flag: '🇮🇳', code: 'kn' },
  ml: { name: 'മലയാളം (Malayalam)', flag: '🇮🇳', code: 'ml' },
  pa: { name: 'ਪੰਜਾਬੀ (Punjabi)', flag: '🇮🇳', code: 'pa' },
  or: { name: 'ଓଡ଼ିଆ (Odia)', flag: '🇮🇳', code: 'or' },
};

export interface Translations {
  // Common
  appName: string;
  yes: string;
  no: string;
  ok: string;
  cancel: string;
  save: string;
  back: string;
  
  // Auth & Setup
  welcome: string;
  welcomeSubtitle: string;
  iAmSenior: string;
  iAmCaregiver: string;
  seniorDescription: string;
  caregiverDescription: string;
  createProfile: string;
  fullName: string;
  phoneNumber: string;
  enterName: string;
  enterPhone: string;
  getStarted: string;
  editProfile: string;
  signOut: string;
  
  // Household
  householdCode: string;
  createHouseholdCode: string;
  joinHousehold: string;
  linkHousehold: string;
  random: string;
  
  // Home
  hello: string;
  
  // SOS
  sos: string;
  help: string;
  caregiverNotified: string;
  simulateFall: string;
  
  // Vitals
  myVitals: string;
  heartRate: string;
  normal: string;
  good: string;
  bpm: string;
  
  // Safety
  safetyStatus: string;
  fallDetection: string;
  accelerometer: string;
  active: string;
  off: string;
  location: string;
  sharing: string;
  on: string;
  locationSharingPaused: string;
  locating: string;
  
  // Settings
  settings: string;
  safetyDetection: string;
  fallSensitivity: string;
  adjustDetection: string;
  autoSOSTimer: string;
  delayBefore102: string;
  alerts: string;
  sirenVolume: string;
  maxVolume: string;
  notifications: string;
  alertsForCaregivers: string;
  language: string;
  selectLanguage: string;
  account: string;
  version: string;
  
  // Emergency
  fallDetected: string;
  areYouOkay: string;
  imOkay: string;
  call102Now: string;
  sendingAlert: string;
  sendAlertNow: string;
  alarmSounding: string;
  loud: string;
  iAmSafe: string;
  cancelFalseAlarm: string;
  emergencyAlert: string;
  emergencyActive: string;
  alertsSent: string;
  emergencyServices102: string;
  
  // Navigation
  home: string;
  vitals: string;
  companion: string;
  carers: string;
  listening: string;
  // History
  alertHistory: string;
  emergencySOS: string;
  resolvedBy: string;
  endOfHistory: string;
  // Countdown
  seconds: string;
  // Contacts & Network
  safetyNetwork: string;
  caregiversHeading: string;
  caregiversSubtext: string;
  primary: string;
  secondary: string;
  otherContacts: string;
  localDispatch: string;
  
  // Validation
  enterValidName: string;
  enterValid10Digit: string;
  phoneNumberRequired: string;
  phoneMust10Digits: string;
  
  // New Features
  logWaterIntake: string;
  stayHydrated: string;
  upcomingAppointments: string;
  today: string;
  tomorrow: string;
  
  // Voice Emergency
  voiceEmergency: string;
  detectShouts: string;
  
  // Vitals labels
  low: string;
  high: string;
  moderate: string;
}

// Base English translations - all other languages will be auto-translated
export const baseTranslations: Translations = {
  appName: 'SafeNest',
  yes: 'Yes',
  no: 'No',
  ok: 'OK',
  cancel: 'Cancel',
  save: 'Save',
  back: 'Back',
  
  welcome: 'Welcome to SafeNest',
  welcomeSubtitle: "Let's set up your profile",
  iAmSenior: "I'm a Senior",
  iAmCaregiver: "I'm a Caregiver",
  seniorDescription: 'Get emergency alerts and health monitoring',
  caregiverDescription: 'Monitor and respond to senior alerts',
  createProfile: 'Create Your Profile',
  fullName: 'Full Name',
  phoneNumber: 'Phone Number',
  enterName: 'Enter your name',
  enterPhone: '10-digit mobile number',
  getStarted: 'Get Started',
  editProfile: 'Edit Profile',
  signOut: 'Sign Out',
  
  householdCode: 'Household Code',
  createHouseholdCode: 'Create or confirm your household code',
  joinHousehold: 'Join your senior household',
  linkHousehold: 'Link Household',
  random: 'Random',
  
  hello: 'Hello',
  
  sos: 'SOS',
  help: 'HELP',
  caregiverNotified: 'Caregiver contacts will be notified immediately.',
  simulateFall: 'Simulate Fall',
  
  myVitals: 'My Vitals',
  heartRate: 'Heart Rate',
  normal: 'Normal',
  good: 'Good',
  bpm: 'BPM',
  
  safetyStatus: 'Safety Status',
  fallDetection: 'Fall Detection',
  accelerometer: 'Accelerometer',
  active: 'Active',
  off: 'Off',
  location: 'Location',
  sharing: 'Sharing',
  on: 'On',
  locationSharingPaused: 'Location Sharing Paused',
  locating: 'Locating...',
  
  settings: 'Settings',
  safetyDetection: 'Safety Detection',
  fallSensitivity: 'Fall Sensitivity',
  adjustDetection: 'Adjust detection threshold',
  autoSOSTimer: 'Auto-SOS Timer',
  delayBefore102: 'Delay before calling 102',
  alerts: 'Alerts',
  sirenVolume: 'Siren Volume',
  maxVolume: 'Max volume during SOS',
  notifications: 'Notifications',
  alertsForCaregivers: 'Alerts for caregivers',
  language: 'Language',
  selectLanguage: 'Select Language',
  account: 'Account',
  version: 'Version',
  
  fallDetected: 'Fall Detected!',
  areYouOkay: 'Are you okay?',
  imOkay: "I'm Okay",
  call102Now: 'Call 102 Now',
  sendingAlert: 'Sending alert in...',
  sendAlertNow: 'Send Alert Now',
  alarmSounding: 'Alarm sounding & vibrating',
  loud: 'LOUD',
  iAmSafe: 'I am Safe - Cancel',
  cancelFalseAlarm: 'Tap button above to cancel false alarm',
  emergencyAlert: 'EMERGENCY ALERT',
  emergencyActive: 'Emergency Active',
  alertsSent: 'ALERTS SENT',
  emergencyServices102: 'Emergency Services (102)',
  
  home: 'Home',
  vitals: 'Vitals',
  companion: 'Companion',
  carers: 'Carers',
  listening: 'Listening',
  alertHistory: 'Alert History',
  emergencySOS: 'Emergency SOS',
  resolvedBy: 'Resolved by',
  endOfHistory: 'End of History',
  seconds: 'SECONDS',
  safetyNetwork: 'Safety Network',
  caregiversHeading: 'Caregivers',
  caregiversSubtext: 'These people receive immediate alerts and live location updates during emergencies.',
  primary: 'Primary',
  secondary: 'Secondary',
  otherContacts: 'Other Contacts',
  localDispatch: 'Local Dispatch',
  
  enterValidName: 'Please enter your name',
  enterValid10Digit: 'Please enter a valid 10-digit mobile number',
  phoneNumberRequired: 'Phone number is required',
  phoneMust10Digits: 'Phone number must be exactly 10 digits',
  
  // New Features
  logWaterIntake: 'Log Water Intake',
  stayHydrated: 'Stay hydrated today!',
  upcomingAppointments: 'Upcoming Appointments',
  today: 'Today',
  tomorrow: 'Tomorrow',
  
  // Voice Emergency
  voiceEmergency: 'Voice Emergency',
  detectShouts: 'Detect shouts/loud sounds after fall',
  
  // Vitals labels
  low: 'Low',
  high: 'High',
  moderate: 'Moderate',
};

// Static Hindi translations (partial)
export const staticHindiMap: Partial<Translations> = {
  appName: 'सेफनेस्ट',
  welcome: 'सेफनेस्ट में आपका स्वागत है',
  welcomeSubtitle: 'चलो आपका प्रोफ़ाइल सेट करें',
  iAmSenior: 'मैं वरिष्ठ हूँ',
  iAmCaregiver: 'मैं देखभालकर्ता हूँ',
  createProfile: 'अपनी प्रोफ़ाइल बनाएँ',
  fullName: 'पूरा नाम',
  phoneNumber: 'मोबाइल नंबर',
  enterName: 'अपना नाम दर्ज करें',
  enterPhone: '10-अंकों का मोबाइल नंबर',
  getStarted: 'शुरू करें',
  editProfile: 'प्रोफ़ाइल संपादित करें',
  signOut: 'साइन आउट',
  householdCode: 'परिवार कोड',
  joinHousehold: 'अपने वरिष्ठ परिवार से जुड़ें',
  linkHousehold: 'परिवार जोड़ें',
  hello: 'नमस्ते',
 
  help: 'मदद',
  simulateFall: 'गिरावट सिमुलेट करें',
  myVitals: 'मेरे संकेत',
  heartRate: 'हृदय गति',
  normal: 'सामान्य',
  good: 'अच्छा',
  bpm: 'बीपीएम',
  safetyStatus: 'सुरक्षा स्थिति',
  fallDetection: 'गिरावट पहचान',
  accelerometer: 'त्वरणमापी',
  active: 'सक्रिय',
  off: 'बंद',
  location: 'स्थान',
  sharing: 'साझा करना',
  on: 'चालू',
  locating: 'खोज रहा है…',
  settings: 'सेटिंग्स',
  safetyDetection: 'सुरक्षा पहचान',
  fallSensitivity: 'गिरावट संवेदनशीलता',
  adjustDetection: 'पहचान सीमा समायोजित करें',
  autoSOSTimer: 'ऑटो-एसओएस टाइमर',
  delayBefore102: '102 कॉल करने से पहले देरी',
  alerts: 'अलर्ट्स',
  sirenVolume: 'सायरन वॉल्यूम',
  maxVolume: 'एसओएस के दौरान अधिकतम वॉल्यूम',
  notifications: 'सूचनाएँ',
  alertsForCaregivers: 'देखभालकर्ताओं के लिए अलर्ट',
  language: 'भाषा',
  selectLanguage: 'भाषा चुनें',
  account: 'खाता',
  version: 'संस्करण',
  fallDetected: 'गिरावट का पता चला!',
  areYouOkay: 'क्या आप ठीक हैं?',
  imOkay: 'मैं ठीक हूँ',
  call102Now: '102 अभी कॉल करें',
  sendingAlert: 'अलर्ट भेज रहा है…',
  sendAlertNow: 'अभी अलर्ट भेजें',
  alarmSounding: 'अलार्म बज रहा है',
  loud: 'जोरदार',
  iAmSafe: 'मैं सुरक्षित हूँ - रद्द करें',
  emergencyAlert: 'आपातकालीन अलर्ट',
  emergencyActive: 'आपातकाल सक्रिय',
  alertsSent: 'अलर्ट भेजे गए',
  emergencyServices102: 'आपातकालीन सेवाएँ (102)',
  home: 'होम',
  vitals: 'संकेत',
  companion: 'सहायक',
  carers: 'देखभालकर्ता',
  listening: 'सुन रहा है',
  alertHistory: 'अलर्ट इतिहास',
  emergencySOS: 'आपातकालीन एसओएस',
  resolvedBy: 'द्वारा सुलझाया गया',
  endOfHistory: 'इतिहास समाप्त',
  seconds: 'सेकंड',
  safetyNetwork: 'सुरक्षा नेटवर्क',
  caregiversHeading: 'देखभालकर्ता',
  caregiversSubtext: 'आपातकाल में इन लोगों को तुरंत अलर्ट और लाइव लोकेशन अपडेट मिलते हैं।',
  primary: 'प्राथमिक',
  secondary: 'द्वितीयक',
  otherContacts: 'अन्य संपर्क',
  localDispatch: 'स्थानीय डिस्पैच',
  enterValidName: 'कृपया अपना नाम दर्ज करें',
  enterValid10Digit: 'कृपया वैध 10-अंकों का नंबर दर्ज करें',
  phoneNumberRequired: 'मोबाइल नंबर आवश्यक है',
  phoneMust10Digits: 'मोबाइल नंबर 10 अंकों का होना चाहिए',
  logWaterIntake: 'पानी का सेवन दर्ज करें',
  stayHydrated: 'आज हाइड्रेटेड रहें!',
  upcomingAppointments: 'आगामी अपॉइंटमेंट',
  today: 'आज',
  tomorrow: 'कल',
  voiceEmergency: 'आवाज़ आपातकाल',
  detectShouts: 'गिरने के बाद चिल्लाने/तेज़ आवाज़ का पता लगाएं',
  low: 'कम',
  high: 'अधिक',
  moderate: 'मध्यम',
};

// Static Marathi translations (partial)
export const staticMarathiMap: Partial<Translations> = {
  appName: 'सेफनेस्ट',
  welcome: 'सेफनेस्टमध्ये आपले स्वागत आहे',
  welcomeSubtitle: 'चला तुमची प्रोफाइल सेट करूया',
  iAmSenior: 'मी ज्येष्ठ आहे',
  iAmCaregiver: 'मी काळजीवाहक आहे',
  createProfile: 'तुमची प्रोफाइल तयार करा',
  fullName: 'पूर्ण नाव',
  phoneNumber: 'मोबाईल क्रमांक',
  enterName: 'तुमचे नाव लिहा',
  enterPhone: '१० अंकी मोबाईल क्रमांक',
  getStarted: 'सुरू करा',
  editProfile: 'प्रोफाइल संपादित करा',
  signOut: 'साइन आउट',
  householdCode: 'कुटुंब कोड',
  joinHousehold: 'तुमच्या ज्येष्ठ कुटुंबात सामील व्हा',
  linkHousehold: 'कुटुंब जोडा',
  hello: 'नमस्कार',
  help: 'मदत',
  simulateFall: 'पडणे अनुकरण करा',
  myVitals: 'माझी आरोग्य माहिती',
  heartRate: 'हृदय गती',
  normal: 'सामान्य',
  good: 'चांगले',
  bpm: 'बीपीएम',
  safetyStatus: 'सुरक्षा स्थिती',
  fallDetection: 'पडणे ओळख',
  accelerometer: 'त्वरणमापक',
  active: 'सक्रिय',
  off: 'बंद',
  location: 'स्थान',
  sharing: 'शेअरिंग',
  on: 'चालू',
  locating: 'शोधत आहे…',
  settings: 'सेटिंग्ज',
  safetyDetection: 'सुरक्षा ओळख',
  fallSensitivity: 'पडण्याची संवेदनशीलता',
  adjustDetection: 'ओळख मर्यादा समायोजित करा',
  autoSOSTimer: 'ऑटो-एसओएस टाइमर',
  delayBefore102: '102 कॉल करण्यापूर्वी विलंब',
  alerts: 'अलर्ट',
  sirenVolume: 'सायरेन आवाज',
  maxVolume: 'एसओएस दरम्यान जास्तीत जास्त आवाज',
  notifications: 'सूचना',
  alertsForCaregivers: 'काळजीवाहकांसाठी अलर्ट',
  language: 'भाषा',
  selectLanguage: 'भाषा निवडा',
  account: 'खाते',
  version: 'आवृत्ती',
  fallDetected: 'पडणे आढळले!',
  areYouOkay: 'तुम्ही ठीक आहात का?',
  imOkay: 'मी ठीक आहे',
  call102Now: 'आत्ताच 102 कॉल करा',
  sendingAlert: 'अलर्ट पाठवित आहे…',
  sendAlertNow: 'आत्ताच अलर्ट पाठवा',
  alarmSounding: 'अलार्म वाजत आहे',
  loud: 'मोठा आवाज',
  iAmSafe: 'मी सुरक्षित आहे - रद्द करा',
  emergencyAlert: 'आपत्कालीन अलर्ट',
  emergencyActive: 'आपत्काल सक्रिय',
  alertsSent: 'अलर्ट पाठविले',
  emergencyServices102: 'आपत्कालीन सेवा (102)',
  home: 'मुख्य',
  vitals: 'आरोग्य',
  companion: 'सहचर',
  carers: 'काळजीवाहक',
  listening: 'ऐकत आहे',
  alertHistory: 'अलर्ट इतिहास',
  emergencySOS: 'आपत्कालीन एसओएस',
  resolvedBy: 'यांनी सोडवले',
  endOfHistory: 'इतिहास समाप्त',
  seconds: 'सेकंद',
  safetyNetwork: 'सुरक्षा नेटवर्क',
  caregiversHeading: 'काळजीवाहक',
  caregiversSubtext: 'आपत्कालात या लोकांना तात्काळ अलर्ट आणि थेट लोकेशन अपडेट मिळतात.',
  primary: 'प्राथमिक',
  secondary: 'दुय्यम',
  otherContacts: 'इतर संपर्क',
  localDispatch: 'स्थानिक डिस्पॅच',
  enterValidName: 'कृपया तुमचे नाव लिहा',
  enterValid10Digit: 'कृपया वैध १० अंकी क्रमांक लिहा',
  phoneNumberRequired: 'मोबाईल क्रमांक आवश्यक आहे',
  phoneMust10Digits: 'मोबाईल क्रमांक १० अंकी असावा',
  logWaterIntake: 'पाणी नोंदवा',
  stayHydrated: 'आज हायड्रेटेड राहा!',
  upcomingAppointments: 'आगामी भेटी',
  today: 'आज',
  tomorrow: 'उद्या',
  voiceEmergency: 'आवाज आपत्कालीन',
  detectShouts: 'पडल्यानंतर ओरडणे/मोठ्या आवाजाची ओळख',
  low: 'कमी',
  high: 'जास्त',
  moderate: 'मध्यम',
};

export function buildStaticTranslations(lang: 'en' | 'hi' | 'mr'): Translations {
  if (lang === 'en') return baseTranslations;
  const map = lang === 'hi' ? staticHindiMap : staticMarathiMap;
  const out: any = {};
  for (const [key, value] of Object.entries(baseTranslations)) {
    const translated = (map as any)[key];
    // Show only localized term if available; otherwise fallback to English
    out[key] = translated ? translated : value;
  }
  return out as Translations;
}


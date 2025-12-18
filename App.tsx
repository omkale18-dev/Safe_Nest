
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UserRole, AppStatus, SeniorStatus, ActivityItem, UserProfile, Reminder } from './types';
import { SeniorHome } from './views/SeniorHome';
import { ProfileView } from './views/ProfileView';
import { FallCountdown } from './views/FallCountdown';
import { SOSCountdown } from './views/SOSCountdown';
import { EmergencyActive } from './views/EmergencyActive';
import { CaregiverDashboard } from './views/CaregiverDashboard';
import { LocationView } from './views/LocationView';
import { ContactsView } from './views/ContactsView';
import { SettingsView } from './views/SettingsView';
import { VitalsView } from './views/VitalsView';
import { VoiceCompanionView } from './views/VoiceCompanionView';
import { BottomNav } from './components/BottomNav';
import { INITIAL_SENIOR_STATUS } from './constants';
import { useAppSensors } from './hooks/useAppSensors';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications, PermissionStatus as LNPermissionStatus } from '@capacitor/local-notifications';
import { FirstTimeSetup } from './views/FirstTimeSetup';
import { db, initializeAuth } from './services/firebase';
import { ref, set, onValue, off, get } from 'firebase/database';
import { HouseholdLink } from './views/HouseholdLink';
import { HouseholdMember, Contact } from './types';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { startFallDetection, stopFallDetection, subscribeFallDetected } from './services/fallDetection';
import VoiceEmergencyDetector from './services/voiceEmergency';
import { 
  initVolumeButtonShortcut, 
  showLockScreenSOSButton, 
  hideLockScreenSOSButton, 
  registerLockScreenSOSHandler,
  cleanupEmergencyShortcuts 
} from './services/emergencyShortcuts';

const normalizePhone = (value: string) => value ? value.replace(/\D/g, '') : '';

// Global widget event queue - register listener at module load time
let setAppStatusGlobal: ((status: AppStatus) => void) | null = null;
let pendingWidgetEvent = false;
let currentAppStatusGlobal: AppStatus = AppStatus.IDLE;

const handleModuleLevelWidgetSOS = () => {
  console.log('[Widget] Module-level widget SOS received!');
  // Avoid duplicate triggers if already in SOS flow
  if (currentAppStatusGlobal === AppStatus.WARNING_SOS || currentAppStatusGlobal === AppStatus.EMERGENCY) {
    console.log('[Widget] Ignoring duplicate SOS (already active)');
    return;
  }
  pendingWidgetEvent = true;
  if (setAppStatusGlobal) {
    setAppStatusGlobal(AppStatus.WARNING_SOS);
  }
};

// Register at module level before component mounts
window.addEventListener('widgetSOS', handleModuleLevelWidgetSOS);

const App = () => {
  // Initialize Firebase Auth on app start
  useEffect(() => {
    const initAuth = async () => {
      const success = await initializeAuth();
      if (!success) {
        console.error('[App] Failed to initialize Firebase Auth');
      }
    };
    initAuth();
  }, []);
  
  const [appStatus, setAppStatus] = useState<AppStatus>(AppStatus.IDLE);
  const appStatusRef = useRef<AppStatus>(AppStatus.IDLE);
  const seniorStatusRef = useRef<SeniorStatus>(INITIAL_SENIOR_STATUS);

  // Connect global widget handler to component state
  useEffect(() => {
    setAppStatusGlobal = setAppStatus;
    console.log('[Widget] Global handler connected to setAppStatus');
    // keep global status in sync for duplicate filtering
    currentAppStatusGlobal = appStatus;
    
    // If event arrived before listener was ready, process it now
    if (pendingWidgetEvent) {
      console.log('[Widget] Processing pending widget event');
      setAppStatus(AppStatus.WARNING_SOS);
      pendingWidgetEvent = false;
    }
  }, []);
  
  // Keep refs/globals in sync with appStatus
  useEffect(() => {
    appStatusRef.current = appStatus;
    currentAppStatusGlobal = appStatus;
  }, [appStatus]);
  
  // Early widget SOS listener - registers immediately on app mount
  useEffect(() => {
    const handleWidgetSOSEarly = (event: any) => {
      console.log('[Widget] Early SOS event received from widget!');
      if (appStatusRef.current === AppStatus.WARNING_SOS || appStatusRef.current === AppStatus.EMERGENCY) {
        console.log('[Widget] Early handler ignoring duplicate SOS');
        return;
      }
      // Set SOS status immediately, before role/household checks
      setAppStatus(AppStatus.WARNING_SOS);
      console.log('[Widget] Set app status to WARNING_SOS');
    };
    
    window.addEventListener('widgetSOS', handleWidgetSOSEarly);
    console.log('[Widget] Early event listener registered');
    
    return () => {
      window.removeEventListener('widgetSOS', handleWidgetSOSEarly);
    };
  }, []);

  // Check if user has completed setup
  const [isFirstTime, setIsFirstTime] = useState<boolean>(() => {
    const savedProfile = localStorage.getItem('safenest_user_profile');
    return !savedProfile;
  });

  const [role, setRole] = useState<UserRole | null>(() => {
    if (isFirstTime) return null;
    const savedProfile = localStorage.getItem('safenest_user_profile');
    if (savedProfile) {
      const profile: UserProfile = JSON.parse(savedProfile);
      return profile.role;
    }
    return null;
  });

  const [activeTab, setActiveTab] = useState('home');
  const [seniorStatus, setSeniorStatus] = useState<SeniorStatus>(INITIAL_SENIOR_STATUS);
  
  // Keep seniorStatus ref in sync
  useEffect(() => {
    seniorStatusRef.current = seniorStatus;
  }, [seniorStatus]);
  
  const [householdId, setHouseholdId] = useState<string>(() => {
    return localStorage.getItem('safenest_household_id') || '';
  });
  const [householdIds, setHouseholdIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('safenest_household_ids');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeHouseholdId, setActiveHouseholdId] = useState<string>(() => {
    return localStorage.getItem('safenest_active_household') || '';
  });
  
  // Voice/Reminder State
  const [isListening, setIsListening] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [activeReminderId, setActiveReminderId] = useState<string | null>(null);
  
  // Household Members and Contacts
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [allHouseholdSeniors, setAllHouseholdSeniors] = useState<{ [householdId: string]: HouseholdMember }>({});
  
  // Audio Context Ref for Caregiver Alert
  const audioContextRef = useRef<AudioContext | null>(null);
  const sirenIntervalRef = useRef<any>(null);

  // User Profile State - Load from localStorage
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    if (isFirstTime) return {
      id: '',
      name: '',
      role: UserRole.SENIOR,
      avatar: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNFNUU3RUIiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjM1IiByPSIxNSIgZmlsbD0iIzlDQTNCNCIvPjxwYXRoIGQ9Ik0yMCA4NUMyMCA2NS4xMTggMzMuNDMxNSA1MCA1MCA1MEM2Ni41Njg1IDUwIDgwIDY1LjExOCA4MCA4NVYxMDBIMjBWODVaIiBmaWxsPSIjOUNBM0I0Ii8+PC9zdmc+',
      phone: ''
    };
    const savedProfile = localStorage.getItem('safenest_user_profile');
    return savedProfile ? JSON.parse(savedProfile) : {
      id: '',
      name: '',
      role: UserRole.SENIOR,
      avatar: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNFNUU3RUIiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjM1IiByPSIxNSIgZmlsbD0iIzlDQTNCNCIvPjxwYXRoIGQ9Ik0yMCA4NUMyMCA2NS4xMTggMzMuNDMxNSA1MCA1MCA1MEM2Ni41Njg1IDUwIDgwIDY1LjExOCA4MCA4NVYxMDBIMjBWODVaIiBmaWxsPSIjOUNBM0I0Ii8+PC9zdmc+',
      phone: ''
    };
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [householdError, setHouseholdError] = useState('');
  const [isValidatingHousehold, setIsValidatingHousehold] = useState(false);
  const [isAppInForeground, setIsAppInForeground] = useState(true);
  const fallCountdownTimerRef = useRef<any>(null);
  const voiceDetectorRef = useRef<VoiceEmergencyDetector | null>(null);
  const [isVoiceEmergencyEnabled, setIsVoiceEmergencyEnabled] = useState(false);

  const handleLookupCodeByPhone = async (phone: string): Promise<string | null> => {
    const normalized = normalizePhone(phone);
    console.log('[LookupCodeByPhone] Starting lookup for phone:', normalized);
    
    if (normalized.length !== 10) {
      console.log('[LookupCodeByPhone] Invalid phone length:', normalized.length);
      return null;
    }
    
    try {
      console.log('[LookupCodeByPhone] Initializing auth...');
      await initializeAuth();
      console.log('[LookupCodeByPhone] Auth initialized, querying phoneIndex...');
      
      // First try phoneIndex (fast path for seniors)
      const phoneIndexSnap = await get(ref(db, `phoneIndex/${normalized}`));
      console.log('[LookupCodeByPhone] phoneIndex query complete, exists:', phoneIndexSnap.exists());
      
      if (phoneIndexSnap.exists()) {
        const code = phoneIndexSnap.val();
        console.log('[LookupCodeByPhone] Code found in phoneIndex:', code);
        return code;
      }
      console.log('[LookupCodeByPhone] Not found in phoneIndex, searching all households...');
      
      // If not in index, search all households for members with this phone (handles caregivers + incomplete setups)
      const householdsSnap = await get(ref(db, 'households'));
      if (householdsSnap.exists()) {
        const households = householdsSnap.val();
        console.log('[LookupCodeByPhone] Searching through households...');
        
        for (const householdCode of Object.keys(households)) {
          const household = households[householdCode];
          
          // Check members of this household
          if (household.members) {
            const members = Object.values(household.members) as HouseholdMember[];
            const matchingMember = members.find((m: HouseholdMember) => 
              normalizePhone(m.phone) === normalized
            );
            if (matchingMember) {
              console.log('[LookupCodeByPhone] Found member in household', householdCode, '- Name:', matchingMember.name);
              return householdCode;
            }
          }
        }
      }
      console.log('[LookupCodeByPhone] No household code found for phone:', normalized);
    } catch (e) {
      console.error('[Phone Lookup Error]', e);
    }
    
    console.log('[LookupCodeByPhone] Returning null');
    return null;
  };

  const handleCheckPhoneUsed = async (phone: string): Promise<boolean> => {
    const normalized = normalizePhone(phone);
    console.log('[CheckPhoneUsed] Raw input:', phone, '-> Normalized:', normalized);
    
    if (normalized.length !== 10) {
      console.log('[CheckPhoneUsed] Invalid phone length:', normalized.length);
      return false;
    }
    
    try {
      await initializeAuth();
      
      // First check phoneIndex (for seniors)
      console.log('[CheckPhoneUsed] Checking phoneIndex/${normalized}...');
      const phoneIndexSnap = await get(ref(db, `phoneIndex/${normalized}`));
      if (phoneIndexSnap.exists()) {
        console.log('[CheckPhoneUsed] ✓ FOUND in phoneIndex:', phoneIndexSnap.val());
        return true;
      }
      console.log('[CheckPhoneUsed] ✗ Not in phoneIndex');

      // Then check all households for members with this phone
      console.log('[CheckPhoneUsed] Checking all households...');
      const householdsSnap = await get(ref(db, 'households'));
      if (householdsSnap.exists()) {
        const households = householdsSnap.val();
        const householdCodes = Object.keys(households);
        console.log('[CheckPhoneUsed] Scanning', householdCodes.length, 'households');
        
        for (const householdCode of householdCodes) {
          const household = households[householdCode];
          if (household.members) {
            const members = Object.values(household.members) as HouseholdMember[];
            for (const member of members) {
              const memberPhone = normalizePhone(member.phone || '');
              if (memberPhone === normalized) {
                console.log('[CheckPhoneUsed] ✓ FOUND in household', householdCode, '- Member:', member.name, 'Phone:', member.phone, '-> Normalized:', memberPhone);
                return true;
              }
            }
          }
        }
      }
      
      console.log('[CheckPhoneUsed] ✓ Phone', normalized, 'is AVAILABLE (not found anywhere)');
      return false;
    } catch (e) {
      console.error('[CheckPhoneUsed] ERROR during check:', e);
      // On error, return false to allow registration attempt (Firebase will enforce uniqueness)
      return false;
    }
  };

  const handleValidateHousehold = async (householdCode: string): Promise<boolean> => {
    try {
      await initializeAuth();
      const metaSnap = await get(ref(db, `households/${householdCode}/meta`));
      return metaSnap.exists();
    } catch (e) {
      console.error('[Validate Household Error]', e);
      return false;
    }
  };

  const handleCheckExistingMember = async (householdCode: string, phone: string): Promise<UserProfile | null> => {
    try {
      await initializeAuth();
      const membersSnap = await get(ref(db, `households/${householdCode}/members`));
      if (membersSnap.exists()) {
        const members = Object.values(membersSnap.val() || {}) as HouseholdMember[];
        
        // If phone is empty, return the senior (for auto-login)
        if (!phone || phone.trim() === '') {
          const seniorMember = members.find((m: HouseholdMember) => m.role === UserRole.SENIOR);
          if (seniorMember) {
            return {
              id: seniorMember.id,
              name: seniorMember.name,
              role: seniorMember.role,
              avatar: seniorMember.avatar,
              phone: seniorMember.phone
            };
          }
        } else {
          // Search by phone
          const normalized = normalizePhone(phone);
          if (normalized.length !== 10) return null;
          const existingMember = members.find((m: HouseholdMember) => normalizePhone(m.phone) === normalized);
          if (existingMember) {
            return {
              id: existingMember.id,
              name: existingMember.name,
              role: existingMember.role,
              avatar: existingMember.avatar,
              phone: existingMember.phone
            };
          }
        }
      }
    } catch (e) {
      console.error('[Check Existing Member Error]', e);
    }
    return null;
  };

  const handleHouseholdSet = async (code: string) => {
    setIsValidatingHousehold(true);
    setHouseholdError('');
    try {
      // Ensure Firebase Auth is ready
      await initializeAuth();
      
      const cleanCode = code.trim().toUpperCase();
      console.log('[HouseholdSet] Starting with code:', cleanCode, 'role:', role);
      
      if (!cleanCode || cleanCode.length < 3) {
        setHouseholdError('Enter a valid code (min 3 characters).');
        return;
      }

      // Check if user already has a different household code
      const existingHouseholdId = localStorage.getItem('safenest_household_id');
      console.log('[HouseholdSet] Existing household ID:', existingHouseholdId);
      if (existingHouseholdId && existingHouseholdId !== cleanCode) {
        setHouseholdError(`You are already linked to household "${existingHouseholdId}". Cannot join multiple households. Please sign out first to join a different household.`);
        return;
      }

      // If caregiver, auto-create household meta if it doesn't exist (allows caregivers to initialize households)
      if (role === UserRole.CAREGIVER) {
        console.log('[HouseholdSet] Caregiver - checking if household exists...');
        const metaSnap = await get(ref(db, `households/${cleanCode}/meta`));
        if (!metaSnap.exists()) {
          console.log('[HouseholdSet] Household not found - creating for caregiver...');
          // Auto-create household meta so caregiver can initialize it
          await set(ref(db, `households/${cleanCode}/meta`), {
            createdBy: currentUser.name || 'Caregiver',
            role: 'CAREGIVER',
            updatedAt: new Date().toISOString(),
          });
          console.log('[HouseholdSet] Household meta created by caregiver');
        } else {
          console.log('[HouseholdSet] Household already exists');
        }
      }

      // If senior, check if another senior already exists in this household
      if (role === UserRole.SENIOR) {
        console.log('[HouseholdSet] Senior - checking for existing senior...');
        const existingMembersSnap = await get(ref(db, `households/${cleanCode}/members`));
        if (existingMembersSnap.exists()) {
          const members = Object.values(existingMembersSnap.val() || {}) as HouseholdMember[];
          const existingSenior = members.find((m: HouseholdMember) => m.role === UserRole.SENIOR);
          if (existingSenior) {
            console.log('[HouseholdSet] Found existing senior:', existingSenior.name);
            // Check if it's the same person
            const isSamePerson = 
              (currentUser.phone && normalizePhone(existingSenior.phone) === normalizePhone(currentUser.phone)) ||
              (currentUser.id && existingSenior.id === currentUser.id);
            
            if (!isSamePerson) {
              setHouseholdError(`A senior (${existingSenior.name}) is already registered with this code. Each household code supports exactly one senior.`);
              return;
            }
            console.log('[HouseholdSet] Same senior - allowed');
          }
        }
        // Create/update meta for senior
        console.log('[HouseholdSet] Creating/updating household meta...');
        await set(ref(db, `households/${cleanCode}/meta`), {
          createdBy: currentUser.name || 'Senior',
          role: 'SENIOR',
          updatedAt: new Date().toISOString(),
        });
        console.log('[HouseholdSet] Meta created');

        // Register phone in index if senior has a phone
        if (currentUser.phone && currentUser.phone !== 'Not provided') {
          const normalizedPhone = normalizePhone(currentUser.phone);
          if (normalizedPhone.length === 10) {
            console.log('[HouseholdSet] Registering phone in index:', normalizedPhone);
            await set(ref(db, `phoneIndex/${normalizedPhone}`), cleanCode);
            console.log('[HouseholdSet] Phone registered');
          }
        }
      }

      console.log('[HouseholdSet] Setting household ID...');
      setHouseholdId(cleanCode);
      localStorage.setItem('safenest_household_id', cleanCode);
      setHouseholdError('');
      console.log('[HouseholdSet] Success!');
    } catch (e) {
      console.error('[HouseholdSet Error]', e);
      console.error('[HouseholdSet Error Details]', e instanceof Error ? e.message : 'Unknown error');
      setHouseholdError(`Could not set household: ${e instanceof Error ? e.message : 'Unknown error'}. Check your network and try again.`);
    } finally {
      setIsValidatingHousehold(false);
    }
  };

  // Helper to add activity
  const addActivity = (type: ActivityItem['type'], title: string, details?: string) => {
      setSeniorStatus(prev => {
          const newState = {
            ...prev,
            recentActivity: [
                {
                    id: Date.now().toString(),
                    type,
                    title,
                    details,
                    timestamp: new Date()
                },
                ...prev.recentActivity
            ].slice(0, 10) // Keep last 10
          };
          return newState;
      });
  };

  // --- SYSTEM LEVEL REMINDER TRIGGER ---
  useEffect(() => {
    if (role !== UserRole.SENIOR) return;

    const checkReminders = () => {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        const dueReminder = reminders.find(r => r.time === currentTime && r.status === 'PENDING');
        
        if (dueReminder && activeReminderId !== dueReminder.id) {
            console.log("TRIGGERING REMINDER:", dueReminder.title);
            setActiveReminderId(dueReminder.id);
            setActiveTab('voice');
            (async () => {
              if (Capacitor.isNativePlatform()) {
                try {
                  const p: LNPermissionStatus = await LocalNotifications.checkPermissions();
                  if (p.display === 'granted') {
                    await LocalNotifications.schedule({
                      notifications: [{
                        id: parseInt(dueReminder.id.replace(/\D/g, ''), 10) || Date.now(),
                        title: `Medication Time: ${dueReminder.title}`,
                        body: dueReminder.instructions,
                        sound: 'default',
                        smallIcon: 'ic_stat_name'
                      }]
                    });
                  } else {
                    await LocalNotifications.requestPermissions();
                  }
                } catch {}
              } else if ('Notification' in window && Notification.permission === 'granted') {
                try {
                  new Notification(`Medication Time: ${dueReminder.title}`, {
                      body: dueReminder.instructions,
                      requireInteraction: true,
                  });
                } catch(e) {}
              }
            })();
        }
    };

    const interval = setInterval(checkReminders, 10000); 
    return () => clearInterval(interval);
  }, [reminders, activeReminderId, role]);


  // Caregiver Function: Add new Reminder
  const handleAddReminder = async (newReminder: Reminder) => {
      if (!householdId) return;
      try {
        const reminderWithCreator = {
          ...newReminder,
          createdBy: currentUser?.name || (currentUser?.role === UserRole.CAREGIVER ? 'Caregiver' : 'Senior')
        } as Reminder & { createdBy?: string };
        await set(ref(db, `households/${householdId}/reminders/${reminderWithCreator.id}`), reminderWithCreator);
      } catch (e) {
        console.error('[Firebase] Failed to add reminder', e);
      }
  };

  const handleUpdateReminderStatus = async (id: string, status: Reminder['status']) => {
      if (!householdId) return;
      try {
        await set(ref(db, `households/${householdId}/reminders/${id}/status`), status);
        if (status === 'COMPLETED' || status === 'SNOOZED') {
          setActiveReminderId(null); // Clear alarm
          addActivity('INFO', 'Medication Adherence', `${status}: Reminder ${id}`);
        }
      } catch (e) {
        console.error('[Firebase] Failed to update reminder', e);
      }
  };

  // Add contact to household
  const handleAddContact = async (contact: Contact) => {
      if (!householdId) return;
      try {
        await set(ref(db, `households/${householdId}/contacts/${contact.id}`), contact);
      } catch (e) {
        console.error('[Firebase] Failed to add contact', e);
      }
  };


  // --- CROSS-TAB SYNCHRONIZATION ---
  useEffect(() => {
    localStorage.setItem('safenest_senior_status', JSON.stringify(seniorStatus));
  }, [seniorStatus]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'safenest_senior_status' && e.newValue) {
        const remoteStatus: SeniorStatus = JSON.parse(e.newValue);
        setSeniorStatus(remoteStatus);

        if (role === UserRole.CAREGIVER) {
           const wasNormal = seniorStatus.status === 'Normal';
           const isEmergency = remoteStatus.status !== 'Normal';
           
           if (wasNormal && isEmergency) {
               playCaregiverAlert();
           } else if (!isEmergency) {
               stopCaregiverAlert();
           }
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [role, seniorStatus.status]);


  // Caregiver Alert Sound Logic - Uses native sound + vibration
  const playCaregiverAlert = async () => {
      try {
          // Vibration (works even when phone is silent)
          if (navigator.vibrate) {
              navigator.vibrate([500, 200, 500, 200, 500, 200, 500, 200, 500, 200, 500]);
          }
          
          // Try Web Audio API as fallback
          try {
              if (!audioContextRef.current) {
                  audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
              }
              const ctx = audioContextRef.current;
              if (ctx.state === 'suspended') ctx.resume();

              const playTone = () => {
                  const osc = ctx.createOscillator();
                  const gain = ctx.createGain();
                  osc.connect(gain);
                  gain.connect(ctx.destination);
                  osc.type = 'sawtooth';
                  osc.frequency.setValueAtTime(800, ctx.currentTime);
                  osc.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 0.15);
                  osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.3);
                  gain.gain.setValueAtTime(0.2, ctx.currentTime);
                  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
                  osc.start(ctx.currentTime);
                  osc.stop(ctx.currentTime + 0.3);
              };

              playTone();
              if (sirenIntervalRef.current) clearInterval(sirenIntervalRef.current);
              sirenIntervalRef.current = setInterval(playTone, 500);
          } catch (audioErr) {
              console.warn('[Audio API Error]', audioErr);
          }
      } catch (e) {
          console.error("[Alert Error]", e);
      }
  };

  const stopCaregiverAlert = () => {
      if (sirenIntervalRef.current) {
          clearInterval(sirenIntervalRef.current);
          sirenIntervalRef.current = null;
      }
      if (navigator.vibrate) navigator.vibrate(0);
  };

  useEffect(() => {
      return () => stopCaregiverAlert();
  }, []);

  useEffect(() => {
      (async () => {
        if (Capacitor.isNativePlatform()) {
          try { await LocalNotifications.requestPermissions(); } catch {}
        } else if ('Notification' in window && Notification.permission !== 'granted') {
          Notification.requestPermission();
        }
      })();
  }, [role]);

  // Ensure loud Emergency notification channel exists (Android 8+)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    (async () => {
      try {
        // Create/ensure a high-importance channel with sound + vibration
        // If a channel with same id existed without sound, Android would keep old config.
        // Using a new id guarantees sound.
        await (LocalNotifications as any).createChannel?.({
          id: 'emergency_alerts_v2',
          name: 'Emergency Alerts',
          description: 'Urgent SOS/Fall notifications',
          importance: 5, // IMPORTANCE_HIGH
          visibility: 1, // VISIBILITY_PUBLIC
          vibration: true,
          lights: true,
          lightColor: '#FF0000',
          sound: 'default',
          vibrationPattern: [500, 200, 500, 200, 500, 200, 500],
        });
        console.log('[Notifications] Emergency channel ready');

        // Register action types for fall detection
        await (LocalNotifications as any).registerActionTypes?.({
          types: [
            {
              id: 'FALL_RESPONSE',
              actions: [
                {
                  id: 'IM_OK',
                  title: 'I am OK',
                  foreground: false
                },
                {
                  id: 'NEED_HELP',
                  title: 'Send Alert',
                  foreground: true,
                  destructive: true
                }
              ]
            }
          ]
        });
        console.log('[Notifications] Action types registered');
      } catch (e) {
        console.error('[Notifications] Channel creation error', e);
      }
    })();
  }, []);

  // Handle notification actions for fall detection
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    
    const handleNotificationAction = async (action: any) => {
      console.log('[Notification Action]', action);
      const notificationType = action.notification?.extra?.type;
      const notificationId = action.notification?.id;
      
      // Lock screen SOS button
      if (notificationType === 'lock_screen_sos_button' || notificationId === 99999) {
        console.log('[LockScreenSOS] Notification tapped -> trigger SOS flow');
        setAppStatus(AppStatus.WARNING_SOS);
        addActivity('EMERGENCY', 'SOS Triggered', 'Lock screen button');
        return;
      }
      
      if (notificationType === 'fall_detected') {
        // Clear the countdown timer
        if (fallCountdownTimerRef.current) {
          clearTimeout(fallCountdownTimerRef.current);
          fallCountdownTimerRef.current = null;
        }

        // Cancel the notification
        await LocalNotifications.cancel({ notifications: [{ id: action.notification.id }] });

        if (action.actionId === 'IM_OK') {
          // User is OK - cancel the fall alert
          console.log('[Fall Response] User is OK');
          addActivity('INFO', 'Fall Alert Cancelled', 'User confirmed they are okay');
        } else if (action.actionId === 'NEED_HELP' || action.actionId === 'tap') {
          // User needs help or tapped notification - trigger emergency
          console.log('[Fall Response] Emergency triggered');
          setAppStatus(AppStatus.EMERGENCY);
          setSeniorStatus(prev => ({ 
            ...prev, 
            status: 'Fall Detected',
            heartRate: 115
          }));
          addActivity('EMERGENCY', 'Fall Detected - Help Requested', 'User triggered emergency from notification');
        }
      }
    };

    LocalNotifications.addListener('localNotificationActionPerformed', handleNotificationAction);

    return () => {
      LocalNotifications.removeAllListeners();
    };
  }, []);

  // --- FCM Setup for Background Notifications ---
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      console.log('[FCM] Not on native platform, skipping FCM setup');
      return;
    }
    
    (async () => {
      try {
        console.log('[FCM] Starting FCM setup for role:', role, 'household:', householdId);
        
        // Initialize FCM
          // No need to initialize FCM
        console.log('[FCM] Firebase Messaging initialized');
        
        // Request FCM permission
        const permission = await FirebaseMessaging.requestPermissions();
        console.log('[FCM] Permission status:', permission);
        
        // Get FCM token and store it for this device
        const result = await FirebaseMessaging.getToken();
        const fcmToken = result.token;
        console.log('[FCM] Token retrieved:', fcmToken);
        
        // Store FCM token in Firebase under member's profile
        if (fcmToken && role && householdId) {
          const userProfile = localStorage.getItem('safenest_user_profile');
          if (userProfile) {
            const profile: UserProfile = JSON.parse(userProfile);
            const tokenPath = `households/${householdId}/members/${profile.id}/fcmToken`;
            console.log('[FCM] Storing token at path:', tokenPath);
            await set(ref(db, tokenPath), fcmToken);
            console.log('[FCM] Token stored successfully');
          } else {
            console.warn('[FCM] No user profile in localStorage');
          }
        } else {
          console.warn('[FCM] Missing requirements - token:', !!fcmToken, 'role:', role, 'householdId:', householdId);
        }
        
        // Handle incoming notifications when app is in foreground
        await FirebaseMessaging.addListener('notificationReceived', async (event) => {
          console.log('[FCM] Notification received (foreground):', event);
          if (role === UserRole.CAREGIVER) {
            playCaregiverAlert();
          }
        });
        
        // Handle notification action when user taps notification
        await FirebaseMessaging.addListener('notificationActionPerformed', async (event) => {
          console.log('[FCM] Notification action performed:', event);
          if (role === UserRole.CAREGIVER) {
            playCaregiverAlert();
          }
        });
        
        console.log('[FCM] Setup complete');
        
      } catch (err) {
        console.error('[FCM Setup Error]', err, 'Stack:', err instanceof Error ? err.stack : 'N/A');
      }
    })();
  }, [role, householdId]);

  // Track app foreground/background state
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    
    const handleVisibilityChange = () => {
      setIsAppInForeground(!document.hidden);
    };
    
    const handleFocus = () => setIsAppInForeground(true);
    const handleBlur = () => setIsAppInForeground(false);
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Background fall detection via native foreground service
  useEffect(() => {
    if (role === UserRole.SENIOR && householdId && seniorStatus.isFallDetectionEnabled) {
      startFallDetection();
      
      // Also start voice emergency monitoring
      if (!voiceDetectorRef.current) {
        voiceDetectorRef.current = new VoiceEmergencyDetector({
          volumeThreshold: 50,
          durationMs: 300,
          onEmergencyDetected: () => {
            console.log('[App] Voice emergency detected!');
            setAppStatus(AppStatus.WARNING_FALL);
            setSeniorStatus(prev => ({ 
              ...prev, 
              status: 'Voice Distress Detected',
              heartRate: 120 
            }));
            addActivity('EMERGENCY', 'Voice Distress', 'Loud sound/shout detected');
          }
        });
      }
      voiceDetectorRef.current.startMonitoring();
      setIsVoiceEmergencyEnabled(true);
      const unsubscribe = subscribeFallDetected(async () => {
        // Use refs to get current values, not stale closure
        const currentEnabled = seniorStatusRef.current.isFallDetectionEnabled;
        const currentForeground = isAppInForeground;
        const currentStatus = appStatusRef.current;
        
        console.log('[Fall] Native event received. Enabled:', currentEnabled, 'Foreground:', currentForeground, 'Status:', currentStatus);
        
        // Ignore if fall detection has been disabled
        if (!currentEnabled) {
          console.log('[Fall] Ignored - detection is disabled');
          return;
        }
        
        // Clear any existing countdown timer
        if (fallCountdownTimerRef.current) {
          clearTimeout(fallCountdownTimerRef.current);
        }

        // Always show in-app countdown when native event fires
        console.log('[Fall] Setting app status to WARNING_FALL');
        setAppStatus(AppStatus.WARNING_FALL);
        addActivity('EMERGENCY', 'Fall Detected', 'Background detector');
      });
      return () => {
        unsubscribe();
        stopFallDetection();
        if (voiceDetectorRef.current) {
          voiceDetectorRef.current.stopMonitoring();
          setIsVoiceEmergencyEnabled(false);
        }
        if (fallCountdownTimerRef.current) {
          clearTimeout(fallCountdownTimerRef.current);
        }
      };
    }

    // Stop service when not needed
    stopFallDetection();
    if (voiceDetectorRef.current) {
      voiceDetectorRef.current.stopMonitoring();
      setIsVoiceEmergencyEnabled(false);
    }
    return undefined;
  }, [role, householdId, seniorStatus.isFallDetectionEnabled, isAppInForeground]);

  // --- Sensor Integration ---
  const { location, batteryLevel, requestMotionPermission } = useAppSensors({
    isMonitoring: role === UserRole.SENIOR,
    fallDetectionEnabled: seniorStatus.isFallDetectionEnabled,
    locationEnabled: seniorStatus.isLocationSharingEnabled,
    onFallDetected: () => {
      // Use ref to get current value
      const currentEnabled = seniorStatusRef.current.isFallDetectionEnabled;
      const currentStatus = appStatusRef.current;
      
      console.log('[Fall] JS callback triggered. Enabled:', currentEnabled, 'Status:', currentStatus);
      
      // Double-check fall detection is still enabled
      if (!currentEnabled) {
        console.log('[Fall] JS callback ignored - detection disabled');
        return;
      }
      
      // Don't override if already in emergency
      if (currentStatus !== AppStatus.EMERGENCY) {
        console.log('[Fall] JS: Setting WARNING_FALL');
        setAppStatus(AppStatus.WARNING_FALL);
        addActivity('EMERGENCY', 'Fall Detected', 'Accelerometer triggered');
      } else {
        console.log('[Fall] JS: Already in EMERGENCY, not showing countdown');
      }
    },
    onSOSTriggered: () => {
       if (appStatusRef.current === AppStatus.IDLE) {
        setAppStatus(AppStatus.WARNING_SOS);
        addActivity('EMERGENCY', 'SOS Triggered', 'Manual button press');
       }
    }
  });

  // Sync Battery
  useEffect(() => {
      setSeniorStatus(prev => {
          return { ...prev, batteryLevel };
      });
  }, [batteryLevel]);

  // Emergency Logic
  useEffect(() => {
    const isEmergencyActive = appStatus === AppStatus.EMERGENCY || 
                              appStatus === AppStatus.WARNING_FALL || 
                              appStatus === AppStatus.WARNING_SOS;

    if (isEmergencyActive && location) {
      setSeniorStatus(prev => ({
        ...prev,
        location: location,
        lastUpdate: new Date(),
        status: appStatus === AppStatus.EMERGENCY 
          ? (prev.status === 'Fall Detected' ? 'Fall Detected' : 'SOS Active') 
          : 'Normal',
        isMoving: true
      }));
    } else if (location && role === UserRole.SENIOR) {
       setSeniorStatus(prev => ({
            ...prev,
            location: location,
            lastUpdate: new Date(),
       }));
    }
  }, [location, appStatus, role]);

  const handleRoleSelect = (selectedRole: UserRole) => {
    setRole(selectedRole);
  };

  const handleFirstTimeSetupComplete = async (profile: UserProfile, selectedRole: UserRole) => {
    // Save profile to localStorage
    localStorage.setItem('safenest_user_profile', JSON.stringify(profile));
    
    // Update app state
    setCurrentUser(profile);
    setRole(selectedRole);
    setIsFirstTime(false);
  };

  const handleRejoinWithCode = async (code: string, profile: UserProfile, selectedRole: UserRole) => {
    setIsValidatingHousehold(true);
    setHouseholdError('');
    
    try {
      // Ensure Firebase Auth is ready
      await initializeAuth();
      
      const cleanCode = code.trim().toUpperCase();
      console.log('[Rejoin] Starting with code:', cleanCode, 'role:', selectedRole, 'profile:', profile);
      
      // Check if household exists
      console.log('[Rejoin] Checking if household exists...');
      const metaSnap = await get(ref(db, `households/${cleanCode}/meta`));
      if (!metaSnap.exists()) {
        console.log('[Rejoin] Household not found');
        
        // For caregivers, auto-create household so they can initialize it
        if (selectedRole === UserRole.CAREGIVER) {
          console.log('[Rejoin] Caregiver - auto-creating household...');
          await set(ref(db, `households/${cleanCode}/meta`), {
            createdBy: profile.name || 'Caregiver',
            role: 'CAREGIVER',
            updatedAt: new Date().toISOString(),
          });
          console.log('[Rejoin] Household created by caregiver');
        } else {
          // Seniors must join existing household (created by senior)
          setHouseholdError('Household code not found. Please verify the code and try again.');
          setIsValidatingHousehold(false);
          return;
        }
      }
      console.log('[Rejoin] Household exists');

      // Enforce single-senior-per-code rule (but allow same senior to rejoin)
      if (selectedRole === UserRole.SENIOR) {
        console.log('[Rejoin] Checking for existing senior...');
        const existingMembersSnap = await get(ref(db, `households/${cleanCode}/members`));
        if (existingMembersSnap.exists()) {
          const members = Object.values(existingMembersSnap.val() || {}) as HouseholdMember[];
          const existingSenior = members.find((m: HouseholdMember) => m.role === UserRole.SENIOR);
          if (existingSenior) {
            console.log('[Rejoin] Found existing senior:', existingSenior);
            console.log('[Rejoin] Comparing - Profile phone:', profile.phone, 'Existing phone:', existingSenior.phone);
            console.log('[Rejoin] Comparing - Profile ID:', profile.id, 'Existing ID:', existingSenior.id);
            
            // Check if it's the same person (by phone or ID)
            const isSamePerson = 
              (profile.phone && normalizePhone(existingSenior.phone) === normalizePhone(profile.phone)) ||
              (profile.id && existingSenior.id === profile.id);
            
            console.log('[Rejoin] Is same person?', isSamePerson);
            
            if (!isSamePerson) {
              console.log('[Rejoin] Different senior trying to join - blocked');
              setHouseholdError(`A senior (${existingSenior.name}) is already registered with this code. Each household code supports exactly one senior.`);
              setIsValidatingHousehold(false);
              return;
            }
            console.log('[Rejoin] Same senior rejoining - allowed');
          }
        }
      }

      // Check if user already has household code stored
      const existingHouseholdId = localStorage.getItem('safenest_household_id');
      const existingHouseholdIds = localStorage.getItem('safenest_household_ids');
      const householdsList = existingHouseholdIds ? JSON.parse(existingHouseholdIds) : [];
      
      console.log('[Rejoin] Existing household in storage:', existingHouseholdId);
      console.log('[Rejoin] Existing households list:', householdsList);
      
      // For seniors, block if different household
      if (selectedRole === UserRole.SENIOR && existingHouseholdId && existingHouseholdId !== cleanCode) {
        console.log('[Rejoin] Senior already linked to different household');
        setHouseholdError(`You are already linked to household "${existingHouseholdId}". Please sign out first to join a different household.`);
        setIsValidatingHousehold(false);
        return;
      }
      
      // For caregivers, allow multiple households
      if (selectedRole === UserRole.CAREGIVER) {
        if (!householdsList.includes(cleanCode)) {
          householdsList.push(cleanCode);
          localStorage.setItem('safenest_household_ids', JSON.stringify(householdsList));
          setHouseholdIds(householdsList);
        }
        localStorage.setItem('safenest_active_household', cleanCode);
        setActiveHouseholdId(cleanCode);
      }

      // Save profile and household
      console.log('[Rejoin] Saving profile and household...');
      localStorage.setItem('safenest_user_profile', JSON.stringify(profile));
      localStorage.setItem('safenest_household_id', cleanCode);
      
      // If senior, register phone in index
      if (selectedRole === UserRole.SENIOR && profile.phone) {
        const normalized = normalizePhone(profile.phone);
        console.log('[Rejoin] Registering phone in index:', normalized);
        if (normalized.length === 10) {
          await set(ref(db, `phoneIndex/${normalized}`), cleanCode);
        }
      }

      // Update app state
      console.log('[Rejoin] Updating app state...');
      setCurrentUser(profile);
      setRole(selectedRole);
      setHouseholdId(cleanCode);
      setIsFirstTime(false);
      setHouseholdError('');
      console.log('[Rejoin] Success!');
      
    } catch (e) {
      console.error('[Rejoin Error]', e);
      console.error('[Rejoin Error Stack]', e instanceof Error ? e.stack : 'N/A');
      console.error('[Rejoin Error Details]', JSON.stringify(e));
      setHouseholdError(`Failed to join household: ${e instanceof Error ? e.message : 'Unknown error'}. Check your network connection and try again.`);
    } finally {
      setIsValidatingHousehold(false);
    }
  };

  // Validate existing household code when caregiver role is active
  useEffect(() => {
    const validate = async () => {
      if (role !== UserRole.CAREGIVER || !householdId) return;
      setIsValidatingHousehold(true);
      try {
        const metaSnap = await get(ref(db, `households/${householdId}/meta`));
        if (!metaSnap.exists()) {
          setHouseholdError('Household not found. Enter the correct code shared by the senior.');
          setHouseholdId('');
          localStorage.removeItem('safenest_household_id');
        } else {
          setHouseholdError('');
        }
      } catch (e) {
        setHouseholdError('Could not validate household. Check your network.');
      } finally {
        setIsValidatingHousehold(false);
      }
    };
    validate();
  }, [role, householdId]);

  // Senior: ensure household meta exists so caregivers can validate, and register phone index
  useEffect(() => {
    const ensureMeta = async () => {
      if (role !== UserRole.SENIOR || !householdId) return;
      try {
        const metaSnap = await get(ref(db, `households/${householdId}/meta`));
        if (!metaSnap.exists()) {
          await set(ref(db, `households/${householdId}/meta`), {
            createdBy: currentUser.name || 'Senior',
            role: 'SENIOR',
            updatedAt: new Date().toISOString(),
          });
        }

        // Register senior's phone in phone index for lookup
        if (currentUser.phone) {
          const normalized = normalizePhone(currentUser.phone);
          if (normalized.length === 10) {
            await set(ref(db, `phoneIndex/${normalized}`), householdId);
          }
        }
      } catch {}
    };
    ensureMeta();
  }, [role, householdId, currentUser.name, currentUser.phone]);

  // Senior device: write status to Firebase when changes occur
  useEffect(() => {
    if (role === UserRole.SENIOR && householdId) {
      const path = `households/${householdId}/status`;
      try {
        set(ref(db, path), {
          ...seniorStatus,
          lastUpdate: new Date().toISOString(),
        }).catch((e: any) => {
          console.error('[Firebase Write Error]', {
            path,
            error: e.code || 'UNKNOWN',
            message: e.message,
            details: e
          });
        });
      } catch (e) {
        console.error('[Firebase Exception]', e);
      }
    }
  }, [role, householdId, seniorStatus]);

  // Caregiver device: subscribe to senior status in Firebase
  useEffect(() => {
    if (role !== UserRole.CAREGIVER || !householdId) return;
    const path = `households/${householdId}/status`;
    const r = ref(db, path);
    
    let previousStatus = seniorStatus.status;
    
    const unsub = onValue(
      r,
      async (snapshot) => {
        const data = snapshot.val();
        if (!data) {
          console.warn('[Firebase] No data at path:', path);
          return;
        }
        console.log('[Firebase] Received status update:', data);
        
        const newStatus = data.status;
        const wasNormal = previousStatus === 'Normal';
        const isEmergency = newStatus !== 'Normal';
        
        // Update local state
        setSeniorStatus(prev => ({
          ...prev,
          ...data,
          lastUpdate: data.lastUpdate ? new Date(data.lastUpdate) : new Date(),
        }));
        
        // Send native notification and sound only on status change to emergency
        if (wasNormal && isEmergency) {
          console.log('[Alert] Emergency detected, sending notification');
          
          // Play sound and vibration
          playCaregiverAlert();
          
          // Send native notification
          try {
            if (Capacitor.isNativePlatform()) {
              const p: LNPermissionStatus = await LocalNotifications.checkPermissions();
              if (p.display === 'granted') {
                const notificationId = Math.floor(Math.random() * 1000000);
                await LocalNotifications.schedule({
                  notifications: [{
                    id: notificationId,
                    title: '⚠️ EMERGENCY ALERT',
                    body: `${data.userId || 'Senior'} needs help! Status: ${newStatus}`,
                    sound: 'default',
                    channelId: 'emergency_alerts_v2',
                    smallIcon: 'ic_stat_name',
                    actionTypeId: 'EMERGENCY',
                    largeBody: `Location: ${data.location?.address || 'Tracking...'}\nHeart Rate: ${data.heartRate} bpm\nBattery: ${data.batteryLevel}%`
                  }]
                });
              } else {
                await LocalNotifications.requestPermissions();
              }
            } else if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('⚠️ EMERGENCY ALERT', {
                body: `${data.userId || 'Senior'} needs help! Status: ${newStatus}`,
                requireInteraction: true,
              });
            }
          } catch (e) {
            console.error('[Notification Error]', e);
          }
        } else if (!isEmergency && previousStatus !== 'Normal') {
          // Stop alarm when emergency is cleared
          stopCaregiverAlert();
        }
        
        previousStatus = newStatus;
      },
      (error: any) => {
        console.error('[Firebase Subscribe Error]', {
          code: error.code,
          message: error.message,
          path
        });
      }
    );
    return () => off(r, 'value');
  }, [role, householdId, seniorStatus.status]);

  // Register current user as household member when household is set
  useEffect(() => {
    if (!householdId || !role) return;
    const registerMember = async () => {
      try {
        const memberData: HouseholdMember = {
          id: currentUser.id || `user-${Date.now()}`,
          name: currentUser.name,
          role,
          avatar: currentUser.avatar,
          phone: currentUser.phone,
          joinedAt: new Date().toISOString()
        };
        await set(ref(db, `households/${householdId}/members/${memberData.id}`), memberData);
      } catch (e) {
        console.error('[Firebase] Failed to register member', e);
      }
    };
    registerMember();
  }, [householdId, role, currentUser]);

  // Subscribe to household members
  useEffect(() => {
    if (!householdId) return;
    const membersRef = ref(db, `households/${householdId}/members`);
    const unsub = onValue(membersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const members = Object.values(data) as HouseholdMember[];
        setHouseholdMembers(members);
      }
    });
    return () => off(membersRef, 'value');
  }, [householdId]);

  // Subscribe to contacts (shared across household)
  useEffect(() => {
    if (!householdId) return;
    const contactsRef = ref(db, `households/${householdId}/contacts`);
    const unsub = onValue(contactsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const contactsList = Object.values(data) as Contact[];
        setContacts(contactsList);
      }
    });
    return () => off(contactsRef, 'value');
  }, [householdId]);

  // Subscribe to reminders
  useEffect(() => {
    if (!householdId) return;
    const remindersRef = ref(db, `households/${householdId}/reminders`);
    const unsub = onValue(remindersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const remindersList = Object.values(data) as Reminder[];
        setReminders(remindersList);
      }
    });
    return () => off(remindersRef, 'value');
  }, [householdId]);

  // Multi-household support for caregivers - fetch senior info from all households
  useEffect(() => {
    if (role !== UserRole.CAREGIVER || householdIds.length === 0) return;
    
    console.log('[App] Setting up multi-household listeners for:', householdIds);
    const unsubscribers: Array<() => void> = [];
    
    householdIds.forEach((hId) => {
      // Listen to members to get senior info
      const membersRef = ref(db, `households/${hId}/members`);
      const memberUnsub = onValue(membersRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const members = Object.values(data) as HouseholdMember[];
          const seniorMember = members.find(m => m.role === UserRole.SENIOR);
          
          // Store senior info for ALL households in allHouseholdSeniors
          if (seniorMember) {
            setAllHouseholdSeniors(prev => ({
              ...prev,
              [hId]: seniorMember
            }));
            
            // For active household, also update householdMembers
            if (hId === activeHouseholdId || hId === householdId) {
              setHouseholdMembers(members);
            }
          }
        }
      });
      unsubscribers.push(() => off(membersRef, 'value'));
      
      // Listen to status for alerts from all households
      const statusRef = ref(db, `households/${hId}/status`);
      const statusUnsub = onValue(statusRef, (snapshot) => {
        const statusData = snapshot.val();
        if (statusData) {
          // Update status for active household
          if (hId === activeHouseholdId || hId === householdId) {
            setSeniorStatus(statusData);
          }
          
          // Check for emergencies in any household
          if (statusData.status === 'Emergency' || statusData.status === 'Fall Detected') {
            console.log(`[App] Emergency detected in household ${hId}:`, statusData.status);
            // For non-active households, show notification
            if (hId !== activeHouseholdId && hId !== householdId) {
              // Show alert that another senior needs help
              LocalNotifications.schedule({
                notifications: [{
                  title: 'Emergency Alert',
                  body: `Another senior in your care needs help!`,
                  id: Date.now(),
                  schedule: { at: new Date(Date.now() + 100) },
                }]
              }).catch(console.error);
            }
          }
        }
      });
      unsubscribers.push(() => off(statusRef, 'value'));
    });
    
    return () => {
      console.log('[App] Cleaning up multi-household listeners');
      unsubscribers.forEach(unsub => unsub());
    };
  }, [role, householdIds, activeHouseholdId, householdId]);

  const handleSOSClick = useCallback(() => {
    console.log('[SOS] handleSOSClick triggered - showing SOS countdown');
    console.trace('[SOS] Call stack:');
    setAppStatus(AppStatus.WARNING_SOS);
    addActivity('EMERGENCY', 'SOS Triggered', 'In-app button');
  }, []);

  const handleSimulateFall = () => {
    setAppStatus(AppStatus.WARNING_FALL);
    addActivity('EMERGENCY', 'Fall Detected', 'Simulated test');
  };

  // Initialize emergency shortcuts for seniors
  useEffect(() => {
    if (role === UserRole.SENIOR && householdId) {
      console.log('[EmergencyShortcuts] Initializing for senior...');
      
      // Initialize volume button shortcut (3 rapid presses = SOS)
      initVolumeButtonShortcut(() => {
        console.log('[EmergencyShortcuts] Volume button SOS triggered!');
        handleSOSClick();
      });
      
      // Show persistent lock screen SOS button
      showLockScreenSOSButton();
      
      // Register lock screen SOS button handler
      registerLockScreenSOSHandler(() => {
        console.log('[EmergencyShortcuts] Lock screen SOS triggered!');
        handleSOSClick();
      });
      
      // Listen for widget SOS trigger from native Android
      const handleWidgetSOS = () => {
        console.log('[EmergencyShortcuts] Widget SOS triggered!');
        if (appStatusRef.current === AppStatus.WARNING_SOS || appStatusRef.current === AppStatus.EMERGENCY) {
          console.log('[EmergencyShortcuts] Ignoring duplicate widget SOS');
          return;
        }
        handleSOSClick();
      };
      
      window.addEventListener('widgetSOS', handleWidgetSOS);
      
      // Cleanup on unmount or role change
      return () => {
        console.log('[EmergencyShortcuts] Cleaning up...');
        window.removeEventListener('widgetSOS', handleWidgetSOS);
        cleanupEmergencyShortcuts();
      };
    } else if (role === UserRole.CAREGIVER || !householdId) {
      // Hide lock screen button for caregivers
      hideLockScreenSOSButton();
    }
  }, [role, householdId]);

  const handleCancelEmergency = useCallback(() => {
    setAppStatus(AppStatus.IDLE);
    setSeniorStatus(prev => ({ ...prev, status: 'Normal' }));
    addActivity('INFO', 'Emergency Cancelled', 'Marked safe by user');
  }, []);

  const handleSwitchHousehold = (newHouseholdId: string) => {
    console.log('[App] Switching to household:', newHouseholdId);
    localStorage.setItem('safenest_active_household', newHouseholdId);
    localStorage.setItem('safenest_household_id', newHouseholdId);
    setActiveHouseholdId(newHouseholdId);
    setHouseholdId(newHouseholdId);
    // Reset states for new household
    setHouseholdMembers([]);
    setContacts([]);
    setReminders([]);
    setSeniorStatus(INITIAL_SENIOR_STATUS);
  };

  const handleSignOut = () => {
    try {
      stopCaregiverAlert();
      localStorage.removeItem('safenest_user_profile');
      localStorage.removeItem('safenest_household_id');
      localStorage.removeItem('safenest_household_ids');
      localStorage.removeItem('safenest_active_household');
      localStorage.removeItem('safenest_senior_status');
    } catch {}

    setRole(null);
    setIsFirstTime(true);
    setHouseholdId('');
    setHouseholdIds([]);
    setActiveHouseholdId('');
    setHouseholdMembers([]);
    setContacts([]);
    setReminders([]);
    setActiveReminderId(null);
    setActiveTab('home');
    setIsEditingProfile(false);
    setAppStatus(AppStatus.IDLE);
    setSeniorStatus(INITIAL_SENIOR_STATUS);
    setCurrentUser({
      id: '',
      name: '',
      role: UserRole.SENIOR,
      avatar: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNFNUU3RUIiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjM1IiByPSIxNSIgZmlsbD0iIzlDQTNCNCIvPjxwYXRoIGQ9Ik0yMCA4NUMyMCA2NS4xMTggMzMuNDMxNSA1MCA1MCA1MEM2Ni41Njg1IDUwIDgwIDY1LjExOCA4MCA4NVYxMDBIMjBWODVaIiBmaWxsPSIjOUNBM0I0Ii8+PC9zdmc+',
      phone: ''
    });
  };

  const handleConfirmEmergency = useCallback(() => {
    setAppStatus(AppStatus.EMERGENCY);
    const isFall = appStatus === AppStatus.WARNING_FALL;
    setSeniorStatus(prev => ({ 
        ...prev, 
        status: isFall ? 'Fall Detected' : 'SOS Active',
        heartRate: 115, 
    }));
    addActivity('EMERGENCY', 'Emergency Confirmed', 'Alert sent to contacts');
  }, [appStatus]);

  const toggleSensor = async (sensor: 'fall' | 'location' | 'voice', enabled: boolean) => {
      if (sensor === 'fall' && enabled) {
          const granted = await requestMotionPermission();
          if (!granted) return; 
      }

      // If user turns fall detection off, proactively stop the native service and clear timers.
      if (sensor === 'fall' && !enabled) {
        stopFallDetection();
        if (fallCountdownTimerRef.current) {
          clearTimeout(fallCountdownTimerRef.current);
          fallCountdownTimerRef.current = null;
        }
        // Reset status if in warning state
        if (appStatus === AppStatus.WARNING_FALL) {
          setAppStatus(AppStatus.IDLE);
        }
      }
      
      if (sensor === 'voice') {
        if (enabled) {
          // Start voice emergency detection
          if (!voiceDetectorRef.current) {
            voiceDetectorRef.current = new VoiceEmergencyDetector({
              volumeThreshold: 50, // dB threshold for shouting (adjustable)
              durationMs: 300, // 300ms of sustained loud sound
              onEmergencyDetected: () => {
                console.log('[App] Voice emergency detected!');
                setAppStatus(AppStatus.WARNING_FALL);
                setSeniorStatus(prev => ({ 
                  ...prev, 
                  status: 'Voice Distress Detected',
                  heartRate: 120 
                }));
                addActivity('EMERGENCY', 'Voice Distress', 'Loud sound/shout detected');
              }
            });
          }
          voiceDetectorRef.current.startMonitoring();
          setIsVoiceEmergencyEnabled(true);
          console.log('[App] Voice emergency monitoring started');
        } else {
          // Stop voice emergency detection
          if (voiceDetectorRef.current) {
            voiceDetectorRef.current.stopMonitoring();
            console.log('[App] Voice emergency monitoring stopped');
          }
          setIsVoiceEmergencyEnabled(false);
        }
      }
      
      setSeniorStatus(prev => ({
          ...prev,
          isFallDetectionEnabled: sensor === 'fall' ? enabled : prev.isFallDetectionEnabled,
          isLocationSharingEnabled: sensor === 'location' ? enabled : prev.isLocationSharingEnabled
      }));
  };

  const handleVoicePress = () => {
      if (activeTab !== 'voice') {
          setActiveTab('voice');
          setIsListening(true);
      } else {
          setIsListening(!isListening);
      }
  };

  // Logic to determine if we should show the bottom navigation
  const shouldShowNav = role === UserRole.SENIOR && 
                        appStatus === AppStatus.IDLE && 
                        !isEditingProfile;

  // Render ONLY the active view (Nav bar is handled separately)
  const renderCurrentView = () => {
    // Show first-time setup if no profile exists
    if (isFirstTime) {
      return (
        <FirstTimeSetup 
          onComplete={handleFirstTimeSetupComplete}
          onRejoinWithCode={handleRejoinWithCode}
          onLookupCodeByPhone={handleLookupCodeByPhone}
          onCheckExistingMember={handleCheckExistingMember}
          onValidateHousehold={handleValidateHousehold}
          onCheckPhoneUsed={handleCheckPhoneUsed}
          rejoinError={householdError}
          isValidatingRejoin={isValidatingHousehold}
          existingProfile={currentUser}
          existingRole={role}
        />
      );
    }

    

    // Require household link before proceeding
    if (!householdId) {
      return (
        <HouseholdLink
          role={role}
          onSubmit={handleHouseholdSet}
          existingCode={householdId}
          errorMessage={householdError}
          isValidating={isValidatingHousehold}
        />
      );
    }

    // Emergency screens take priority over role-based screens
    if (appStatus === AppStatus.WARNING_FALL) {
       return <FallCountdown onCancel={handleCancelEmergency} onConfirm={handleConfirmEmergency} />;
    }

    if (appStatus === AppStatus.WARNING_SOS) {
       return <SOSCountdown onCancel={handleCancelEmergency} onConfirm={handleConfirmEmergency} caregivers={householdMembers} />;
    }

    if (appStatus === AppStatus.EMERGENCY) {
       return <EmergencyActive onSafe={handleCancelEmergency} type={seniorStatus.status === 'Fall Detected' ? 'FALL' : 'SOS'} caregivers={householdMembers} />;
    }

    if (role === UserRole.CAREGIVER) {
      const senior = householdMembers.find(m => m.role === UserRole.SENIOR);
      
      return (
        <CaregiverDashboard 
            onBack={() => setRole(null)} 
            seniorStatus={seniorStatus}
            reminders={reminders}
            onAddReminder={handleAddReminder}
            stopAlert={stopCaregiverAlert}
            senior={senior}
            onSignOut={handleSignOut}
            onJoinAnotherHousehold={() => setIsFirstTime(true)}
            householdId={householdId}
            householdIds={householdIds}
            onSwitchHousehold={handleSwitchHousehold}
            seniors={allHouseholdSeniors}
        />
      );
    }
    
    if (isEditingProfile) {
      return <ProfileView user={currentUser} householdId={householdId} onBack={() => setIsEditingProfile(false)} onSave={(updatedUser) => setCurrentUser(updatedUser)} />;
    }

    switch (activeTab) {
      case 'map':
        const seniorMember = householdMembers.find(m => m.id === currentUser.id);
        const caregiverMembers = householdMembers.filter(m => m.role === UserRole.CAREGIVER);
        return <LocationView status={seniorStatus} seniorProfile={seniorMember} caregivers={caregiverMembers} />;
      case 'voice':
        return (
            <VoiceCompanionView 
                userName={currentUser.name} 
                onSOS={handleSOSClick} 
                isListening={isListening}
                onListeningChange={setIsListening}
                reminders={reminders}
                activeReminderId={activeReminderId}
                onUpdateReminder={handleUpdateReminderStatus}
            />
        );
      case 'vitals':
        return <VitalsView status={seniorStatus} />;
      case 'carers':
        return <ContactsView caregivers={householdMembers.filter(m => m.role === UserRole.CAREGIVER)} contacts={contacts} onAddContact={handleAddContact} />;
      case 'settings':
         return <SettingsView onSignOut={handleSignOut} onJoinAnotherHousehold={() => setIsFirstTime(true)} userRole={role} />;
      case 'home':
      default:
        return (
            <SeniorHome 
              status={seniorStatus} 
              userProfile={currentUser}
              onSignOut={handleSignOut}
              householdId={householdId}
              onSOSClick={handleSOSClick} 
              onFallSimulation={handleSimulateFall}
              onEditProfile={() => setIsEditingProfile(true)}
              onToggleFallDetection={(val) => toggleSensor('fall', val)}
              onToggleLocation={(val) => toggleSensor('location', val)}
              onToggleVoiceEmergency={(val) => toggleSensor('voice', val)}
              isVoiceEmergencyEnabled={isVoiceEmergencyEnabled}
            />
        );
    }
  };

  return (
    <div className="min-h-screen w-full bg-white flex flex-col font-sans text-gray-900">
           {/* Scrollable Content Area */}
           <div className="flex-1 overflow-y-auto no-scrollbar relative bg-white">
              {renderCurrentView()}
           </div>

           {/* Fixed Bottom Navigation (Sibling to content, so it doesn't scroll away) */}
           {shouldShowNav && (
               <div className="shrink-0 z-50 bg-white shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
                   <BottomNav 
                        activeTab={activeTab} 
                        setActiveTab={setActiveTab}
                        isListening={isListening}
                        onVoiceClick={handleVoicePress}
                   />
               </div>
           )}
    </div>
  );
};

export default App;
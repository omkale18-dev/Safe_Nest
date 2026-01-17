import React, { useState, useEffect } from 'react';
import { UserRole, UserProfile } from '../types';
import { User, Phone, Camera, AlertCircle, Mail } from 'lucide-react';
import { sanitizeForLog, getDeviceName } from '../utils/sanitize';
import { OTPVerification } from './OTPVerification';
import { sendPhoneOTP, verifyPhoneOTP, sendEmailOTP, verifyEmailOTP } from '../services/otpService';

interface FirstTimeSetupProps {
  onComplete: (profile: UserProfile, role: UserRole) => void;
  onRejoinWithCode?: (householdCode: string, profile: UserProfile, role: UserRole) => Promise<boolean>;
  onLookupCodeByPhone?: (phone: string) => Promise<string | null>;
  onCheckExistingMember?: (householdCode: string, phone: string) => Promise<UserProfile | null>;
  onFetchSeniorPhoneByCode?: (householdCode: string) => Promise<string | null>;
  onValidateHousehold?: (householdCode: string) => Promise<boolean>;
  onCheckPhoneUsed?: (phone: string) => Promise<boolean>;
  onSearchCaregiverByPhone?: (phone: string) => Promise<{householdCode: string, profile: UserProfile} | null>;
  rejoinError?: string;
  isValidatingRejoin?: boolean;
  existingProfile?: UserProfile;
  existingRole?: UserRole;
  onCancel?: () => void;
  startStep?: 'role' | 'choice' | 'profile' | 'rejoin';
}

export const FirstTimeSetup: React.FC<FirstTimeSetupProps> = ({ 
  onComplete, onRejoinWithCode, onLookupCodeByPhone, onCheckExistingMember, 
  onFetchSeniorPhoneByCode, onValidateHousehold, onCheckPhoneUsed, onSearchCaregiverByPhone, 
  rejoinError, existingProfile, existingRole, onCancel, startStep 
}) => {
  // 1. STATE DEFINITIONS
  const initialStep = startStep || ((existingProfile && existingRole) ? 'rejoin' : 'role');
  const [step, setStep] = useState<'role' | 'choice' | 'profile' | 'otp-verification' | 'rejoin' | 'rejoin-otp' | 'lookup-caregiver' | 'caregiver-found'>(initialStep);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(existingRole || null);
  const [householdCode, setHouseholdCode] = useState('');
  const [name, setName] = useState(existingProfile?.name || '');
  const [phone, setPhone] = useState(existingProfile?.phone || '');
  const [email, setEmail] = useState(existingProfile?.email || '');
  const [avatar, setAvatar] = useState(existingProfile?.avatar || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNFNUU3RUIiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjM1IiByPSIxNSIgZmlsbD0iIzlDQTNCNCIvPjxwYXRoIGQ9Ik0yMCA4NUMyMCA2NS4xMTggMzMuNDMxNSA1MCA1MCA1MEM2Ni41Njg1IDUwIDgwIDY1LjExOCA4MCA4NVYxMDBIMjBWODVaIiBmaWxsPSIjOUNBM0I0Ii8+PC9zdmc+');
  const [existingProfileId, setExistingProfileId] = useState<string | null>(existingProfile?.id || null);
  const [isRejoinFlow, setIsRejoinFlow] = useState(false);
  const [lookupPhone, setLookupPhone] = useState('');
  const [lookupEmail, setLookupEmail] = useState('');
  const [useEmailForLookup, setUseEmailForLookup] = useState(false);
  const [lookupMessage, setLookupMessage] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [rejoinPhone, setRejoinPhone] = useState('');
  const [useEmailForRejoin, setUseEmailForRejoin] = useState(false);
  const [rejoinEmail, setRejoinEmail] = useState('');
  const [localValidating, setLocalValidating] = useState(false);
  const [localError, setLocalError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const seniorOTPRefs = React.useRef<(HTMLInputElement | null)[]>([]);
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [seniorOTP, setSeniorOTP] = useState(['', '', '', '', '', '']);
  const [seniorOTPResendTimer, setSeniorOTPResendTimer] = useState(60);
  const [seniorOTPCanResend, setSeniorOTPCanResend] = useState(false);
  const [caregiverPostVerification, setCaregiverPostVerification] = useState(false);
  const [caregiverSeniorsList, setCaregiverSeniorsList] = useState<UserProfile[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  // Store navigation intent from verification to be executed by onVerifySuccess
  const rejoinVerificationRef = React.useRef<{
    type: 'caregiver-found' | 'rejoin-complete';
    profile?: UserProfile;
    code?: string;
  } | null>(null);
  const [foundCaregiver, setFoundCaregiver] = useState<UserProfile | null>(null);
  const [pendingCaregiverApproval, setPendingCaregiverApproval] = useState(false);
  const [seniorPhone, setSeniorPhone] = useState('');
  const [seniorOTPSent, setSeniorOTPSent] = useState(false);

  const normalizePhone = (value: string) => value.replace(/\D/g, '');

  // Ensure stable member IDs so repeated logins update the same Firebase record
  const buildStableId = (role: UserRole, phoneValue: string, fallbackId?: string) => {
    const digits = normalizePhone(phoneValue);
    if (digits.length === 10) {
      return `${role === UserRole.SENIOR ? 'senior' : 'caregiver'}-${digits}`;
    }
    return fallbackId || `u${Date.now()}`;
  };

  // Auto-send senior OTP after caregiver enters household code (only once per code)
  useEffect(() => {
    const run = async () => {
      if (step !== 'senior-otp-request') return;
      // Guard: don't send if already sent
      if (seniorOTPSent) return;

      const code = householdCode.trim().toUpperCase();
      if (!code) {
        setLocalError('Household code missing.');
        return;
      }

      setLocalValidating(true);
      setLocalError('');
      try {
        if (!onFetchSeniorPhoneByCode) {
          setLocalError('Senior phone lookup not available.');
          return;
        }

        const phoneFromCode = await onFetchSeniorPhoneByCode(code);
        if (!phoneFromCode) {
          setLocalError('No senior phone found for this household.');
          return;
        }

        const normalized = normalizePhone(phoneFromCode);
        if (normalized.length !== 10) {
          setLocalError('Linked senior phone is invalid.');
          return;
        }

        setSeniorPhone(normalized);
        await sendPhoneOTP(`+91${normalized}`);
        setSeniorOTPSent(true);
        setStep('senior-otp-verification');
      } catch (error: any) {
        setLocalError(error.message || 'Failed to send OTP to senior.');
      } finally {
        setLocalValidating(false);
      }
    };

    run();
  }, [step, householdCode, onFetchSeniorPhoneByCode, seniorOTPSent]);

  // Senior OTP resend timer
  useEffect(() => {
    if (step !== 'senior-otp-verification') return;
    if (seniorOTPResendTimer > 0 && !seniorOTPCanResend) {
      const timer = setTimeout(() => setSeniorOTPResendTimer(seniorOTPResendTimer - 1), 1000);
      return () => clearTimeout(timer);
    } else if (seniorOTPResendTimer === 0) {
      setSeniorOTPCanResend(true);
    }
  }, [seniorOTPResendTimer, seniorOTPCanResend, step]);

  // 2. HELPER FUNCTIONS
  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setIsRejoinFlow(false);
    setStep('choice');
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image too large. Max 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) setAvatar(event.target.result.toString());
    };
    reader.readAsDataURL(file);
  };

  const handleCaregiverPhoneLookup = async (contact: string, type: 'phone' | 'email' = 'phone') => {
    if (type === 'phone') {
      const digits = normalizePhone(contact);
      if (digits.length !== 10) {
        setLocalError('Enter a valid 10-digit phone number.');
        return;
      }
      setLocalValidating(true);
      setLocalError('');
      try {
        setPhone(digits);
        await sendPhoneOTP(`+91${digits}`);
        setStep('rejoin-otp');
        setLocalValidating(false);
      } catch (e: any) {
        setLocalError(e.message || 'Could not send OTP. Please try again.');
        setLocalValidating(false);
      }
    } else if (type === 'email') {
      const emailValid = contact.trim().includes('@');
      if (!emailValid) {
        setLocalError('Enter a valid email address.');
        return;
      }
      setLocalValidating(true);
      setLocalError('');
      try {
        const emailVal = contact.trim();
        setEmail(emailVal);
        await sendEmailOTP(emailVal);
        setStep('rejoin-otp');
      } catch (e: any) {
        setLocalError(e.message || 'Could not send OTP. Please try again.');
      } finally {
        setLocalValidating(false);
      }
    }
  };

  const handleRejoinSendOTP = async () => {
    // Caregiver: household code (6 chars alphanumeric) for adding a new senior
    // Senior: phone number (digits only) or email
    const caregiverCode = rejoinPhone.trim().toUpperCase();
    const seniorDigits = normalizePhone(rejoinPhone);

    if (selectedRole === UserRole.CAREGIVER) {
      // Caregiver always enters household code
      if (!caregiverCode || caregiverCode.length !== 6) {
        setLocalError('Enter the 6-character household code.');
        return;
      }

      setLocalError('');
      setLocalValidating(true);
      try {
        // Validate household code
        if (onValidateHousehold) {
          const isValid = await onValidateHousehold(caregiverCode);
          if (!isValid) {
            setLocalError('Invalid household code.');
            setLocalValidating(false);
            return;
          }
          
          // Store the household code and proceed to senior OTP
          setHouseholdCode(caregiverCode);
          setPendingCaregiverApproval(true);
          setStep('senior-otp-request');
          setLocalValidating(false);
          return;
        }
      } catch (error: any) {
        setLocalError(error.message || 'Failed to validate code.');
      } finally {
        setLocalValidating(false);
      }
    } else {
      // For seniors: phone or email verification
      if (!useEmailForRejoin && seniorDigits.length !== 10) {
        setLocalError('Enter a valid 10-digit mobile number.');
        return;
      }
      if (useEmailForRejoin) {
        const emailValid = rejoinEmail.trim().includes('@');
        if (!emailValid) {
          setLocalError('Enter a valid email address.');
          return;
        }
      }
      
      setLocalError('');
      setLocalValidating(true);
      try {
        if (useEmailForRejoin) {
          const emailVal = rejoinEmail.trim();
          setEmail(emailVal);
          await sendEmailOTP(emailVal);
          setStep('rejoin-otp');
        } else {
          await sendPhoneOTP(`+91${seniorDigits}`);
          setPhone(seniorDigits);
          setStep('rejoin-otp');
        }
      } catch (error: any) {
        setLocalError(error.message || 'Failed to send OTP.');
      } finally {
        setLocalValidating(false);
      }
    }
  };

  // 3. RENDER BLOCKS (Steps)
  if (step === 'role') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="text-center mb-12">
            <div className="inline-block p-4 bg-blue-100 rounded-full mb-4">
              <User className="w-12 h-12 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to SafeNest</h1>
            <p className="text-gray-600">Let's set up your profile</p>
          </div>
          <div className="space-y-4">
            <button onClick={() => handleRoleSelect(UserRole.SENIOR)} className="w-full p-6 bg-white border-2 border-gray-200 rounded-2xl hover:border-blue-500 hover:shadow-lg transition-all text-left group">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-blue-100 rounded-xl group-hover:bg-blue-500 transition-colors">
                  <User className="w-8 h-8 text-blue-600 group-hover:text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">I'm a Senior</h3>
                  <p className="text-sm text-gray-500">Get emergency alerts and health monitoring</p>
                </div>
              </div>
            </button>
            <button onClick={() => handleRoleSelect(UserRole.CAREGIVER)} className="w-full p-6 bg-white border-2 border-gray-200 rounded-2xl hover:border-purple-500 hover:shadow-lg transition-all text-left group">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-purple-100 rounded-xl group-hover:bg-purple-500 transition-colors">
                  <User className="w-8 h-8 text-purple-600 group-hover:text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">I'm a Caregiver</h3>
                  <p className="text-sm text-gray-500">Monitor and respond to senior alerts</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'choice') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="text-center mb-12">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">How would you like to continue?</h1>
            <p className="text-gray-600">{selectedRole === UserRole.CAREGIVER ? 'Are you already a caregiver or creating a new profile?' : 'Create a new profile or rejoin an existing household'}</p>
          </div>
          <div className="space-y-4">
            {selectedRole === UserRole.SENIOR && (
              <>
                <button
                  onClick={() => { setIsRejoinFlow(false); setHouseholdCode(''); setName(''); setPhone(''); setStep('profile'); }}
                  className="w-full p-6 bg-white border-2 border-gray-200 rounded-2xl hover:border-blue-500 hover:shadow-lg transition-all text-left group"
                >
                   <div className="flex items-center space-x-4">
                    <div className="p-3 bg-blue-100 rounded-xl group-hover:bg-blue-500 transition-colors">
                      <User className="w-8 h-8 text-blue-600 group-hover:text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Create New Profile</h3>
                      <p className="text-sm text-gray-500">Set up as a new senior</p>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => { setIsRejoinFlow(true); setHouseholdCode(''); setStep('rejoin'); }}
                  className="w-full p-6 bg-white border-2 border-gray-200 rounded-2xl hover:border-green-500 hover:shadow-lg transition-all text-left group"
                >
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-green-100 rounded-xl group-hover:bg-green-500 transition-colors">
                      <User className="w-8 h-8 text-green-600 group-hover:text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Already Have Code?</h3>
                      <p className="text-sm text-gray-500">Rejoin your existing household</p>
                    </div>
                  </div>
                </button>
              </>
            )}

            {selectedRole === UserRole.CAREGIVER && (
              <>
                <button
                  onClick={() => { setStep('lookup-caregiver'); }}
                  className="w-full p-6 bg-white border-2 border-gray-200 rounded-2xl hover:border-green-500 hover:shadow-lg transition-all text-left group"
                >
                   <div className="flex items-center space-x-4">
                    <div className="p-3 bg-green-100 rounded-xl group-hover:bg-green-500 transition-colors">
                      <User className="w-8 h-8 text-green-600 group-hover:text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">I'm Already a Caregiver</h3>
                      <p className="text-sm text-gray-500">Look up your profile by phone number</p>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => { setIsRejoinFlow(false); setHouseholdCode(''); setName(''); setPhone(''); setStep('profile'); }}
                  className="w-full p-6 bg-white border-2 border-gray-200 rounded-2xl hover:border-blue-500 hover:shadow-lg transition-all text-left group"
                >
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-blue-100 rounded-xl group-hover:bg-blue-500 transition-colors">
                      <User className="w-8 h-8 text-blue-600 group-hover:text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Create New Profile</h3>
                      <p className="text-sm text-gray-500">Set up as a new caregiver</p>
                    </div>
                  </div>
                </button>
              </>
            )}
            
            <button onClick={onCancel ? onCancel : () => setStep('role')} className="w-full py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors">
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'lookup-caregiver') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-100 flex items-center justify-center p-6">
        <div className="max-w-lg w-full">
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            {/* Header Section */}
            <div className="relative bg-white px-6 py-4">
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6 shadow-lg">
                  <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Find Your Profile</h2>
                <p className="text-gray-600 text-lg">Enter your registered phone number</p>
              </div>
            </div>

            {/* Form Section */}
            <div className="px-8 py-6">
              <div className="space-y-6">
                {/* Phone/Email Toggle */}
                {!useEmailForLookup ? (
                  <>
                    {/* Phone Input with Icon */}
                    <div className="space-y-3">
                      <label className="block text-sm font-semibold text-gray-700 ml-1">Phone Number</label>
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                        </div>
                        <input
                          type="tel"
                          value={lookupPhone}
                          onChange={(e) => setLookupPhone(normalizePhone(e.target.value))}
                          placeholder="10-digit mobile number"
                          maxLength={10}
                          className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all text-lg"
                        />
                        {lookupPhone.length === 10 && (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-500 ml-1">We'll verify your identity with an OTP</p>
                        <button
                          type="button"
                          onClick={() => { setLookupPhone(''); setUseEmailForLookup(true); }}
                          className="text-xs text-purple-600 font-semibold hover:underline"
                        >
                          Use email instead
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Email Input */}
                    <div className="space-y-3">
                      <label className="block text-sm font-semibold text-gray-700 ml-1">Email Address</label>
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <input
                          type="email"
                          value={lookupEmail}
                          onChange={(e) => setLookupEmail(e.target.value)}
                          placeholder="your@email.com"
                          className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all text-lg"
                        />
                        {lookupEmail.includes('@') && (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-500 ml-1">We'll send an OTP to your email</p>
                        <button
                          type="button"
                          onClick={() => { setLookupEmail(''); setUseEmailForLookup(false); }}
                          className="text-xs text-purple-600 font-semibold hover:underline"
                        >
                          Use phone instead
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* Error Message */}
                {localError && (
                  <div className="flex items-start space-x-2 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <p className="text-sm text-red-700">{localError}</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex space-x-3 pt-2">
                  <button 
                    onClick={() => setStep('choice')} 
                    className="flex-1 py-4 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all"
                  >
                    Back
                  </button>
                  <button 
                    onClick={() => {
                      if (useEmailForLookup) {
                        handleCaregiverPhoneLookup(lookupEmail, 'email');
                      } else {
                        handleCaregiverPhoneLookup(lookupPhone, 'phone');
                      }
                    }} 
                    disabled={(useEmailForLookup ? !lookupEmail.includes('@') : lookupPhone.length !== 10) || localValidating}
                    className="flex-1 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {localValidating ? (
                      <span className="flex items-center justify-center space-x-2">
                        <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Sending OTP...</span>
                      </span>
                    ) : (
                      <span className="flex items-center justify-center space-x-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <span>Send OTP</span>
                      </span>
                    )}
                  </button>
                </div>

                {/* Info Box */}
                <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                  <div className="flex items-start space-x-3">
                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div className="text-sm text-blue-800">
                      <p className="font-semibold mb-1">Already a caregiver?</p>
                      <p>Enter your registered phone number to access your account and manage your seniors.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'caregiver-found' && foundCaregiver) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          {/* Welcome Card */}
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Header Section with Avatar */}
            <div className="relative bg-white px-5 pt-6 pb-4">
              <div className="absolute top-2 right-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              </div>
              <div className="flex flex-col items-center">
                <div className="relative mb-2">
                  <div className="w-16 h-16 rounded-full overflow-hidden border-3 border-gray-100 shadow-lg">
                    <img 
                      src={foundCaregiver.avatar} 
                      alt={foundCaregiver.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 bg-green-500 p-1 rounded-full shadow-lg">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">Welcome Back!</h2>
                <p className="text-gray-600 text-sm font-medium">{foundCaregiver.name}</p>
                <div className="mt-2 px-3 py-1 bg-green-100 rounded-full">
                  <p className="text-xs text-green-800 font-medium">✓ Verified Caregiver</p>
                </div>
              </div>
            </div>

            {/* Action Cards */}
            <div className="px-5 pb-5">
              <div className="space-y-2.5">
                {/* Proceed to Dashboard Card */}
                <button
                  onClick={() => {
                     if (householdCode && onRejoinWithCode) {
                       onRejoinWithCode(householdCode, foundCaregiver, UserRole.CAREGIVER);
                     } else {
                       onComplete(foundCaregiver, UserRole.CAREGIVER);
                     }
                  }}
                  className="group w-full bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 p-3.5 border-2 border-transparent hover:border-blue-500"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <h3 className="text-base font-bold text-gray-900 group-hover:text-blue-600 transition-colors">View Dashboard</h3>
                        <p className="text-xs text-gray-500">Monitor your seniors</p>
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>

                {/* Add Another Senior Card */}
                <button
                  onClick={() => {
                    setIsRejoinFlow(true);
                    setName(foundCaregiver.name);
                    setPhone(foundCaregiver.phone.replace(/\D/g, ''));
                    setStep('rejoin');
                  }}
                  className="group w-full bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 p-3.5 border-2 border-transparent hover:border-green-500"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-11 h-11 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <h3 className="text-base font-bold text-gray-900 group-hover:text-green-600 transition-colors">Add Another Senior</h3>
                        <p className="text-xs text-gray-500">Join a new household</p>
                      </div>
                    </div>
                    <svg className="w-5 h-5 text-gray-400 group-hover:text-green-600 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              </div>

              {/* Info Section */}
              <div className="mt-3 p-2.5 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex items-start space-x-2">
                  <svg className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <p className="text-xs text-blue-800">
                    Your account is verified and ready. Choose an option above to continue.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'rejoin') {
     return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {selectedRole === UserRole.CAREGIVER ? 'Join Senior Household' : 'Rejoin Household'}
            </h2>
            <p className="text-gray-600">
              {selectedRole === UserRole.CAREGIVER ? 'Enter the senior\'s household code' : 'Verify your phone number to rejoin'}
            </p>
          </div>
          <div className="space-y-6">
            <div>
              {/* Caregiver: household code only; Senior: phone/email */}
              {selectedRole === UserRole.CAREGIVER ? (
                <>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Household Code *</label>
                  <input
                    type="text"
                    value={rejoinPhone}
                    onChange={(e) => setRejoinPhone(e.target.value.toUpperCase())}
                    placeholder="Enter 6-character code"
                    maxLength={6}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                  />
                </>
              ) : !useEmailForRejoin ? (
                <>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label>
                  <input
                    type="tel"
                    value={rejoinPhone}
                    onChange={(e) => setRejoinPhone(normalizePhone(e.target.value))}
                    placeholder="10-digit mobile number"
                    maxLength={10}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                  />
                </>
              ) : null}
              {/* Toggle rendered below the active input field */}
              {selectedRole === UserRole.SENIOR && !useEmailForRejoin && (
                <div className="mt-2 text-sm text-gray-600">
                  Prefer email?{' '}
                  <button
                    type="button"
                    onClick={() => setUseEmailForRejoin(true)}
                    className="text-purple-600 font-semibold hover:underline"
                  >
                    Verify using email instead
                  </button>
                </div>
              )}
            </div>

            {selectedRole === UserRole.SENIOR && useEmailForRejoin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Address *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={rejoinEmail}
                    onChange={(e) => setRejoinEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none"
                    placeholder="Email Address"
                  />
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  Prefer email?{' '}
                  <button
                    type="button"
                    onClick={() => setUseEmailForRejoin(false)}
                    className="text-purple-600 font-semibold hover:underline"
                  >
                    Use phone verification instead
                  </button>
                </div>
              </div>
            )}
            {localError && <div className="text-red-500 text-sm">{localError}</div>}
            <div className="flex space-x-3 pt-4">
              <button onClick={() => setStep('choice')} disabled={localValidating} className="flex-1 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50">Back</button>
              <button 
                onClick={handleRejoinSendOTP} 
                disabled={
                  localValidating ||
                  (selectedRole === UserRole.CAREGIVER ? rejoinPhone.length !== 6 : (useEmailForRejoin ? !rejoinEmail.trim().includes('@') : rejoinPhone.length !== 10))
                } 
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {localValidating
                  ? 'Validating...'
                  : selectedRole === UserRole.CAREGIVER
                    ? 'Verify Code'
                    : useEmailForRejoin
                      ? 'Send Email OTP'
                      : 'Send OTP'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Senior OTP Request - auto lookup senior phone by household code and send OTP
  if (step === 'senior-otp-request') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="inline-block p-4 bg-purple-100 rounded-full mb-4">
              <AlertCircle className="w-12 h-12 text-purple-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Senior Approval Required</h2>
            <p className="text-gray-600">Sending OTP to the senior linked with this household</p>
            <p className="text-sm text-gray-500 mt-2">Household Code: <span className="font-bold text-purple-600">{householdCode}</span></p>
            {seniorPhone && <p className="text-sm text-gray-500">Senior Phone: ****{seniorPhone.slice(-4)}</p>}
          </div>
          <div className="space-y-4">
            {localError && <div className="text-red-500 text-sm">{localError}</div>}
            {localValidating ? (
              <p className="text-center text-gray-600">Sending OTP...</p>
            ) : (
              <div className="text-center text-gray-600">If this takes too long, go back and re-enter the household code.</div>
            )}
            <div className="pt-4">
              <button onClick={() => setStep('rejoin')} disabled={localValidating} className="w-full py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50">Back</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Senior OTP Verification - Senior enters OTP
  if (step === 'senior-otp-verification') {
    const handleSeniorOTPChange = (index: number, value: string) => {
      const numericValue = value.replace(/[^0-9]/g, '').slice(-1);
      const newOTP = [...seniorOTP];
      newOTP[index] = numericValue;
      setSeniorOTP(newOTP);
      setLocalError('');

      // Auto-focus to next input if digit entered
      if (numericValue && index < 5) {
        seniorOTPRefs.current[index + 1]?.focus();
      }

      // Auto-verify when all 6 digits entered
      if (index === 5 && numericValue && newOTP.slice(0, 5).every(d => d)) {
        const code = newOTP.join('');
        handleSeniorOTPSubmit(code);
      }
    };

    const handleSeniorOTPSubmit = async (code?: string) => {
      const otpCode = code || seniorOTP.join('');
      
      if (otpCode.length !== 6) {
        setLocalError('Please enter all 6 digits');
        return;
      }

      setLocalValidating(true);
      setLocalError('');
      try {
        const isValid = await verifyPhoneOTP(otpCode);
        if (!isValid) {
          setLocalError('Invalid OTP. Please try again.');
          setSeniorOTP(['', '', '', '', '', '']);
          return;
        }

        // Senior approved! Now complete caregiver registration
        const profile: UserProfile = {
          id: buildStableId(UserRole.CAREGIVER, phone, existingProfileId),
          name: name.trim(),
          role: UserRole.CAREGIVER,
          phone: phone.replace(/\D/g, ''),
          email: email.trim(),
          isPhoneVerified: true,
          isEmailVerified: true,
          avatar,
          deviceName: undefined,
          lastActiveDevice: getDeviceName()
        };

        if (onRejoinWithCode) {
          onRejoinWithCode(householdCode.toUpperCase(), profile, UserRole.CAREGIVER);
        }
      } catch (error: any) {
        setLocalError(error.message || 'Verification failed. Please try again.');
        setSeniorOTP(['', '', '', '', '', '']);
      } finally {
        setLocalValidating(false);
      }
    };

    const handleSeniorOTPResend = async () => {
      if (!seniorOTPCanResend) return;

      setSeniorOTPCanResend(false);
      setSeniorOTPResendTimer(60);
      setLocalError('');
      setSeniorOTP(['', '', '', '', '', '']);

      try {
        await sendPhoneOTP(`+91${seniorPhone}`);
      } catch (error: any) {
        setLocalError(error.message || 'Failed to resend OTP');
        setSeniorOTPCanResend(true);
      }
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 border-t-4 border-green-500">
          <div className="text-center mb-8">
            <div className="inline-block p-4 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full mb-6 shadow-lg">
              <Phone className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Senior Approval</h2>
            <p className="text-gray-600 text-sm mb-6">OTP sent to Senior Mobile number : ******{seniorPhone.slice(-4)}</p>
            
            <div className="space-y-4">
              {/* OTP Input */}
              <label className="block text-sm font-semibold text-gray-700">Enter OTP</label>
              <div className="flex justify-center gap-2">
                {seniorOTP.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (seniorOTPRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength="1"
                    value={digit}
                    onChange={(e) => handleSeniorOTPChange(index, e.target.value)}
                    disabled={localValidating}
                    className="w-10 h-10 text-center border-2 border-gray-300 rounded-lg focus:border-blue-500 outline-none font-bold text-lg disabled:opacity-50"
                  />
                ))}
              </div>

              {/* Error Message */}
              {localError && <p className="text-red-500 text-sm text-center">{localError}</p>}

              {/* Verify Button */}
              <button 
                onClick={() => handleSeniorOTPSubmit()}
                disabled={localValidating || seniorOTP.some(d => !d)}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 mt-4"
              >
                {localValidating ? 'Verifying...' : 'Verify OTP'}
              </button>

              {/* Resend OTP */}
              <p className="text-sm text-gray-600 mt-2">
                Didn't receive?{' '}
                <button
                  onClick={handleSeniorOTPResend}
                  disabled={!seniorOTPCanResend || localValidating}
                  className={`font-semibold ${seniorOTPCanResend ? 'text-blue-600 hover:underline' : 'text-gray-400 cursor-not-allowed'}`}
                >
                  {seniorOTPCanResend ? 'Resend OTP' : `Resend in ${seniorOTPResendTimer}s`}
                </button>
              </p>

              {/* Back Button */}
              <button 
                onClick={() => setStep('senior-otp-request')} 
                disabled={localValidating}
                className="w-full py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 disabled:opacity-50"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Caregiver Post-Verification Options (for already registered caregivers)
  if (step === 'caregiver-post-verification' && caregiverPostVerification) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="text-center mb-12">
            <div className="inline-block p-4 bg-blue-100 rounded-full mb-4">
              <User className="w-12 h-12 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
            <p className="text-gray-600">What would you like to do?</p>
          </div>
          <div className="space-y-4">
            {caregiverSeniorsList.length > 0 && (
              <button
                onClick={() => {
                  const profile: UserProfile = {
                    id: buildStableId(UserRole.CAREGIVER, phone, existingProfileId),
                    name: name || 'Caregiver',
                    role: UserRole.CAREGIVER,
                    avatar: avatar,
                    phone: phone,
                    email: email || '',
                    isPhoneVerified: true,
                    isEmailVerified: false,
                    deviceName: undefined,
                    lastActiveDevice: getDeviceName()
                  };
                  if (onComplete) onComplete(profile, UserRole.CAREGIVER);
                }}
                className="w-full p-6 bg-white border-2 border-gray-200 rounded-2xl hover:border-blue-500 hover:shadow-lg transition-all text-left group"
              >
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-blue-100 rounded-xl group-hover:bg-blue-500 transition-colors">
                    <User className="w-8 h-8 text-blue-600 group-hover:text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">View Dashboard</h3>
                    <p className="text-sm text-gray-500">Monitor {caregiverSeniorsList.length} senior(s)</p>
                  </div>
                </div>
              </button>
            )}
            <button
              onClick={() => {
                setStep('choice');
                setSelectedRole(UserRole.CAREGIVER);
              }}
              className="w-full p-6 bg-white border-2 border-gray-200 rounded-2xl hover:border-green-500 hover:shadow-lg transition-all text-left group"
            >
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-green-100 rounded-xl group-hover:bg-green-500 transition-colors">
                  <User className="w-8 h-8 text-green-600 group-hover:text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Add New Senior</h3>
                  <p className="text-sm text-gray-500">Invite another senior to join</p>
                </div>
              </div>
            </button>
            <button
              onClick={() => {
                setStep('rejoin');
                setCaregiverPostVerification(false);
              }}
              className="w-full py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'rejoin-otp') {
    const handleRejoinOTPVerifyWrapper = async (type: 'phone' | 'email', contact: string, code: string): Promise<boolean> => {
      try {
        // Verify based on type
        const isValid = type === 'phone' 
          ? await verifyPhoneOTP(code) 
          : await verifyEmailOTP(contact, code);
        if (!isValid) return false;

        const lookupPhone = phone || normalizePhone(rejoinPhone);
        
        // Check if this is a caregiver verifying from lookup flow
        if (selectedRole === UserRole.CAREGIVER && lookupPhone && onSearchCaregiverByPhone) {
          const result = await onSearchCaregiverByPhone(lookupPhone);
          if (result) {
            const cgProfile: UserProfile = {
              id: result.profile.id,
              name: result.profile.name,
              role: UserRole.CAREGIVER,
              avatar: result.profile.avatar,
              phone: result.profile.phone
            };
            setFoundCaregiver(cgProfile);
            setHouseholdCode(result.householdCode);
            setIsRejoinFlow(true);
            rejoinVerificationRef.current = { type: 'caregiver-found' };
            return true;
          } else {
            alert('No caregiver profile found with this phone number. Please create a new profile.');
            setStep('lookup-caregiver');
            return false;
          }
        }
        
        if (onLookupCodeByPhone && lookupPhone) {
          const foundCode = await onLookupCodeByPhone(lookupPhone);
          if (!foundCode) {
            alert('No household found for this phone number.');
            return false;
          }
          setHouseholdCode(foundCode);

          let existingMember: UserProfile | null = null;
          if (onCheckExistingMember) {
            existingMember = await onCheckExistingMember(foundCode, lookupPhone);
            if (existingMember?.id) setExistingProfileId(existingMember.id);
            if (existingMember?.name && !name) setName(existingMember.name);
            if (existingMember?.avatar && !avatar) setAvatar(existingMember.avatar);
          }

          const profile: UserProfile = {
            id: buildStableId(selectedRole!, lookupPhone, existingMember?.id || existingProfileId),
            name: (existingMember?.name || name?.trim() || existingProfile?.name || 'Senior'),
            role: selectedRole!,
            phone: lookupPhone,
            email: email || '',
            isPhoneVerified: type === 'phone',
            isEmailVerified: type === 'email',
            avatar: existingMember?.avatar || avatar,
            deviceName: selectedRole === UserRole.SENIOR ? getDeviceName() : undefined,
            lastActiveDevice: getDeviceName()
          };
          rejoinVerificationRef.current = { type: 'rejoin-complete', profile, code: foundCode };
          return true;
        }
        return false;
      } catch (error) {
        console.error('[Rejoin OTP] Verification error:', error);
        return false;
      }
    };

    const handleRejoinVerifySuccess = async () => {
      const intent = rejoinVerificationRef.current;
      if (!intent) return;
      
      if (intent.type === 'caregiver-found') {
        setStep('caregiver-found');
      } else if (intent.type === 'rejoin-complete' && intent.profile && intent.code) {
        if (onRejoinWithCode) {
          const success = await onRejoinWithCode(intent.code, intent.profile, selectedRole!);
          if (!success) {
            // Rejoin failed - go back to rejoin step to show error
            setStep('rejoin');
          }
        }
      }
    };

    return (
      <OTPVerification
        phoneNumber={useEmailForRejoin ? undefined : `+91${phone || normalizePhone(rejoinPhone)}`}
        email={useEmailForRejoin ? email : undefined}
        onVerifySuccess={handleRejoinVerifySuccess}
        onBack={() => setStep(selectedRole === UserRole.CAREGIVER && !rejoinPhone ? 'lookup-caregiver' : 'rejoin')}
        onSendOTP={async (type, contact) => type === 'phone' ? await sendPhoneOTP(contact) : await sendEmailOTP(contact)}
        onVerifyOTP={handleRejoinOTPVerifyWrapper}
      />
    );
  }

  if (step === 'otp-verification') {
    const handleOTPVerifySuccess = () => {
      const profile: UserProfile = {
        id: buildStableId(selectedRole!, phone, existingProfileId),
        name: name.trim(),
        role: selectedRole!,
        phone: phone.replace(/\D/g, ''),
        email: email.trim(),
        isPhoneVerified: true,
        isEmailVerified: true,
        avatar,
        deviceName: selectedRole === UserRole.SENIOR ? getDeviceName() : undefined,
        lastActiveDevice: getDeviceName()
      };

      // If caregiver, redirect to household code entry for senior approval
      if (selectedRole === UserRole.CAREGIVER && !isRejoinFlow) {
        setName(profile.name);
        setPhone(profile.phone);
        setEmail(profile.email);
        setAvatar(profile.avatar);
        setExistingProfileId(profile.id);
        setStep('rejoin');
        return;
      }

      if (isRejoinFlow && onRejoinWithCode) {
        if (!householdCode.trim()) {
           // Should not happen if flow is correct, but safe guard
           alert('Household code missing');
           return;
        }
        onRejoinWithCode(householdCode.trim().toUpperCase(), profile, selectedRole!);
      } else {
        onComplete(profile, selectedRole!);
      }
    };

    return (
      <OTPVerification
        phoneNumber={`+91${phone}`}
        email={email}
        onVerifySuccess={handleOTPVerifySuccess}
        onBack={() => setStep('profile')}
        onSendOTP={async (type, contact) => type === 'phone' ? await sendPhoneOTP(contact) : await sendEmailOTP(contact)}
        onVerifyOTP={async (type, contact, code) => type === 'phone' ? await verifyPhoneOTP(code) : await verifyEmailOTP(contact, code)}
      />
    );
  }

  // 4. FINAL PROFILE SETUP STEP (Default Return)
  const handleProfileSubmit = async () => {
    if (!name.trim()) { alert('Please enter name'); return; }
    if (phone.length !== 10) { setPhoneError('Phone must be 10 digits'); return; }
    if (!email.trim().includes('@')) { alert('Invalid email'); return; }
    
    setPhoneError('');
    setIsCheckingPhone(true);
    try {
      if (!isRejoinFlow && onCheckPhoneUsed) {
        const isUsed = await onCheckPhoneUsed(phone);
        if (isUsed) {
          setPhoneError('Phone number already registered.');
          setIsCheckingPhone(false);
          return;
        }
      }
      await sendPhoneOTP(`+91${phone}`);
      setStep('otp-verification');
    } catch (e: any) {
      alert(e.message || 'Error sending OTP');
    } finally {
      setIsCheckingPhone(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Create Your Profile</h2>
          {isRejoinFlow && householdCode && <p className="text-green-600 font-semibold">Joining Code: {householdCode}</p>}
        </div>
        
        <div className="space-y-6">
           <div className="flex justify-center mb-6">
            <div className="relative">
              <img src={avatar} alt="Profile" className="w-24 h-24 rounded-full object-cover border-4 border-blue-100" />
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 p-2 bg-blue-500 rounded-full text-white shadow-lg">
                <Camera className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none" placeholder="Enter Name" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label>
             <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="tel" value={phone} onChange={(e) => setPhone(normalizePhone(e.target.value))} maxLength={10} className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none" placeholder="10-digit number" />
            </div>
            {phoneError && <p className="text-red-600 text-xs mt-1">{phoneError}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email Address *</label>
             <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none" placeholder="Email Address" />
            </div>
          </div>

          <div className="flex space-x-3 pt-4">
            <button onClick={() => setStep(isRejoinFlow ? 'rejoin' : 'choice')} disabled={isCheckingPhone} className="flex-1 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50">Back</button>
            <button onClick={handleProfileSubmit} disabled={isCheckingPhone || !name || phone.length !== 10 || !email} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50">
               {isCheckingPhone ? 'Checking...' : 'Send OTP →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
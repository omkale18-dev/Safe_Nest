import React, { useState } from 'react';
import { UserRole, UserProfile } from '../types';
import { User, Phone, Camera } from 'lucide-react';

interface FirstTimeSetupProps {
  onComplete: (profile: UserProfile, role: UserRole) => void;
  onRejoinWithCode?: (householdCode: string, profile: UserProfile, role: UserRole) => void;
  onLookupCodeByPhone?: (phone: string) => Promise<string | null>;
  onCheckExistingMember?: (householdCode: string, phone: string) => Promise<UserProfile | null>;
  onValidateHousehold?: (householdCode: string) => Promise<boolean>;
  onCheckPhoneUsed?: (phone: string) => Promise<boolean>;
  rejoinError?: string;
  isValidatingRejoin?: boolean;
  existingProfile?: UserProfile; // User's existing profile when joining another household
  existingRole?: UserRole; // User's existing role
}

export const FirstTimeSetup: React.FC<FirstTimeSetupProps> = ({ onComplete, onRejoinWithCode, onLookupCodeByPhone, onCheckExistingMember, onValidateHousehold, onCheckPhoneUsed, rejoinError, isValidatingRejoin, existingProfile, existingRole }) => {
  // If existing user joining another household, skip to rejoin step with their profile
  const initialStep = (existingProfile && existingRole) ? 'rejoin' : 'role';
  const [step, setStep] = useState<'role' | 'choice' | 'profile' | 'rejoin'>(initialStep);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(existingRole || null);
  const [householdCode, setHouseholdCode] = useState('');
  const [name, setName] = useState(existingProfile?.name || '');
  const [phone, setPhone] = useState(existingProfile?.phone || '');
  const [avatar, setAvatar] = useState(existingProfile?.avatar || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNFNUU3RUIiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjM1IiByPSIxNSIgZmlsbD0iIzlDQTNCNCIvPjxwYXRoIGQ9Ik0yMCA4NUMyMCA2NS4xMTggMzMuNDMxNSA1MCA1MCA1MEM2Ni41Njg1IDUwIDgwIDY1LjExOCA4MCA4NVYxMDBIMjBWODVaIiBmaWxsPSIjOUNBM0I0Ii8+PC9zdmc+');
  const [isRejoinFlow, setIsRejoinFlow] = useState(false);
  const [lookupPhone, setLookupPhone] = useState('');
  const [lookupMessage, setLookupMessage] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [rejoinPhone, setRejoinPhone] = useState('');
  const [localValidating, setLocalValidating] = useState(false);
  const [localError, setLocalError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const normalizePhone = (value: string) => value.replace(/\D/g, '');

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setIsRejoinFlow(false);
    setStep('choice');
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleComplete = async () => {
    if (!name.trim()) {
      alert('Please enter your name');
      return;
    }

    // Validate phone number - must be exactly 10 digits
    const phoneDigits = phone.trim().replace(/\D/g, '');
    if (phone.trim() && phoneDigits.length !== 10) {
      alert('Please enter a valid 10-digit mobile number');
      return;
    }

    // Check if phone number is already used (if provided)
    // SKIP phone uniqueness check for caregivers in rejoin flow - they can have multiple seniors with same phone
    const isCaregiver = selectedRole === UserRole.CAREGIVER;
    const shouldSkipPhoneCheck = isRejoinFlow && isCaregiver;
    
    if (phone.trim() && phoneDigits.length === 10 && onCheckPhoneUsed && !shouldSkipPhoneCheck) {
      setIsCheckingPhone(true);
      setPhoneError('');
      
      try {
        const isUsed = await onCheckPhoneUsed(phoneDigits);
        setIsCheckingPhone(false);
        
        if (isUsed) {
          setPhoneError('This phone number is already registered. Please use a different number.');
          return;
        }
      } catch (e) {
        console.error('[Phone Check Error]', e);
        setIsCheckingPhone(false);
        setPhoneError('Could not verify phone number. Please try again.');
        return;
      }
    }

    // Phone is validated or not provided, proceed
    const profile: UserProfile = {
      id: `u${Date.now()}`,
      name: name.trim(),
      role: selectedRole!,
      phone: phone.trim() || 'Not provided',
      avatar
    };

    if (isRejoinFlow && onRejoinWithCode) {
      if (!householdCode.trim()) {
        alert('Please enter your household code');
        return;
      }
      onRejoinWithCode(householdCode.trim().toUpperCase(), profile, selectedRole!);
      return;
    }

    onComplete(profile, selectedRole!);
  };

  const handleRejoin = async () => {
    if (!householdCode.trim()) {
      alert('Please enter your household code');
      return;
    }

    const cleanCode = householdCode.trim().toUpperCase();
    setLocalError('');
    setLocalValidating(true);

    try {
      // First, validate that household exists
      if (onValidateHousehold) {
        const exists = await onValidateHousehold(cleanCode);
        if (!exists) {
          setLocalError('Household code not found. Please verify the code and try again.');
          setLocalValidating(false);
          return;
        }
      }

      // If senior, check if senior exists in household and auto-login
      if (selectedRole === UserRole.SENIOR && onCheckExistingMember) {
        const existingProfile = await onCheckExistingMember(cleanCode, '');
        if (existingProfile && existingProfile.role === UserRole.SENIOR) {
          // Senior exists - auto-login with existing profile
          if (onRejoinWithCode) {
            onRejoinWithCode(cleanCode, existingProfile, existingProfile.role);
          }
          setLocalValidating(false);
          return;
        }
      }

      // Caregiver or new senior - proceed to profile creation
      setHouseholdCode(cleanCode);
      setIsRejoinFlow(true);
      setStep('profile');
      setLocalValidating(false);
    } catch (e) {
      console.error('[Rejoin Error]', e);
      setLocalError('Failed to validate household. Please check your connection and try again.');
      setLocalValidating(false);
    }
  };

  const handleLookupCode = async () => {
    if (!onLookupCodeByPhone) {
      setLookupError('Mobile lookup is not available right now.');
      return;
    }

    const digits = normalizePhone(lookupPhone);
    if (digits.length !== 10) {
      setLookupError('Enter a valid 10-digit mobile number.');
      return;
    }

    setLookupError('');
    setLookupMessage('');
    setIsLookingUp(true);
    try {
      const result = await onLookupCodeByPhone(digits);
      if (result) {
        setHouseholdCode(result);
        setLookupMessage(`Code found and prefilled: ${result}`);
      } else {
        setLookupError('No household code found for this number.');
      }
    } catch (e) {
      setLookupError('Could not retrieve code. Please try again.');
    } finally {
      setIsLookingUp(false);
    }
  };

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
            <button
              onClick={() => handleRoleSelect(UserRole.SENIOR)}
              className="w-full p-6 bg-white border-2 border-gray-200 rounded-2xl hover:border-blue-500 hover:shadow-lg transition-all text-left group"
            >
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

            <button
              onClick={() => handleRoleSelect(UserRole.CAREGIVER)}
              className="w-full p-6 bg-white border-2 border-gray-200 rounded-2xl hover:border-purple-500 hover:shadow-lg transition-all text-left group"
            >
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

  // Choice step: Create new profile or rejoin with household code
  if (step === 'choice') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="text-center mb-12">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">How would you like to continue?</h1>
            <p className="text-gray-600">Create a new profile or rejoin an existing household</p>
          </div>

          <div className="space-y-4">
            {selectedRole === UserRole.SENIOR && (
              <button
                onClick={() => {
                  setIsRejoinFlow(false);
                  setHouseholdCode('');
                  setStep('profile');
                }}
                className="w-full p-6 bg-white border-2 border-gray-200 rounded-2xl hover:border-blue-500 hover:shadow-lg transition-all text-left group"
              >
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-blue-100 rounded-xl group-hover:bg-blue-500 transition-colors">
                    <User className="w-8 h-8 text-blue-600 group-hover:text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Create New Senior Profile</h3>
                    <p className="text-sm text-gray-500">Start fresh with a new household</p>
                  </div>
                </div>
              </button>
            )}

            {selectedRole === UserRole.CAREGIVER && (
              <button
                onClick={() => {
                  setIsRejoinFlow(false);
                  setHouseholdCode('');
                  setStep('profile');
                }}
                className="w-full p-6 bg-white border-2 border-gray-200 rounded-2xl hover:border-blue-500 hover:shadow-lg transition-all text-left group"
              >
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-blue-100 rounded-xl group-hover:bg-blue-500 transition-colors">
                    <User className="w-8 h-8 text-blue-600 group-hover:text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Create New Caregiver Profile</h3>
                    <p className="text-sm text-gray-500"> a new Caregiver to monitor in a new household</p>
                  </div>
                </div>
              </button>
            )}

            <button
              onClick={() => {
                setIsRejoinFlow(true);
                setHouseholdCode('');
                setLookupPhone('');
                setLookupMessage('');
                setLookupError('');
                setName('');
                setPhone('');
                setRejoinPhone('');
                setStep('rejoin');
              }}
              className="w-full p-6 bg-white border-2 border-gray-200 rounded-2xl hover:border-green-500 hover:shadow-lg transition-all text-left group"
            >
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-green-100 rounded-xl group-hover:bg-green-500 transition-colors">
                  <User className="w-8 h-8 text-green-600 group-hover:text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{selectedRole === UserRole.CAREGIVER ? 'Join Household' : 'Already Have Code?'}</h3>
                  <p className="text-sm text-gray-500">{selectedRole === UserRole.CAREGIVER ? 'Enter the code to join' : 'Rejoin your existing household'}</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                setIsRejoinFlow(false);
                setHouseholdCode('');
                setStep('role');
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

  // Rejoin with household code step
  if (step === 'rejoin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Rejoin Household</h2>
            <p className="text-gray-600">Enter the household code shared by your senior</p>
          </div>

          <div className="space-y-6">
            {/* Household Code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Household Code *
              </label>
              <input
                type="text"
                value={householdCode}
                onChange={(e) => setHouseholdCode(e.target.value.toUpperCase())}
                placeholder="Enter household code"
                maxLength={12}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none transition-colors font-semibold text-center tracking-widest"
              />
              <p className="text-xs text-gray-500 mt-2">{selectedRole === UserRole.SENIOR ? 'We\'ll automatically log you in if you\'re registered with this code.' : 'Enter the code shared by your senior to join their household.'}</p>
            </div>

            {/* Lookup helper */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3">
              <p className="text-sm text-gray-700 font-semibold">Don't know your code?</p>
              <p className="text-xs text-gray-600">Enter the senior's registered mobile number to auto-fill the code.</p>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="tel"
                  value={lookupPhone}
                  onChange={(e) => {
                    const digits = normalizePhone(e.target.value);
                    if (digits.length <= 10) setLookupPhone(digits);
                  }}
                  placeholder="10-digit mobile number"
                  maxLength={10}
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleLookupCode}
                  disabled={isLookingUp || isValidatingRejoin}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60"
                >
                  {isLookingUp ? 'Fetching...' : 'Get Code'}
                </button>
                {lookupMessage && <span className="text-xs text-green-600 font-semibold">{lookupMessage}</span>}
                {lookupError && <span className="text-xs text-red-600 font-semibold">{lookupError}</span>}
              </div>
            </div>

            {/* Error Message */}
            {(rejoinError || localError) && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-sm text-red-800">
                <p className="font-semibold">❌ {localError || rejoinError}</p>
              </div>
            )}

            {/* Buttons */}
            <div className="flex space-x-3 pt-4">
              <button
                onClick={() => setStep('choice')}
                disabled={isValidatingRejoin || localValidating}
                className="flex-1 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={handleRejoin}
                disabled={isValidatingRejoin || localValidating}
                className="flex-1 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {(isValidatingRejoin || localValidating) ? 'Validating...' : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Profile setup step
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Create Your Profile</h2>
          <p className="text-gray-600">Tell us a bit about yourself</p>
          {isRejoinFlow && householdCode && (
            <p className="text-xs text-green-600 font-semibold mt-2">Joining household code: {householdCode}</p>
          )}
        </div>

        {isRejoinFlow && rejoinError && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-sm text-red-800 mb-4">
            <p className="font-semibold">❌ {rejoinError}</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Avatar */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <img 
                src={avatar} 
                alt="Profile" 
                className="w-24 h-24 rounded-full object-cover border-4 border-blue-100"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-2 bg-blue-500 rounded-full text-white hover:bg-blue-600 transition-colors shadow-lg"
                title="Select profile picture"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Full Name *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number *
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '');
                  if (value.length <= 10) {
                    setPhone(value);
                  }
                }}
                placeholder="10-digit mobile number"
                maxLength={10}
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
              />
            </div>
            {phone && phone.length !== 10 && (
              <p className="text-xs text-red-500 mt-1">Phone number must be exactly 10 digits</p>
            )}
            {phoneError && (
              <p className="text-xs text-red-600 mt-1 font-semibold">❌ {phoneError}</p>
            )}
          </div>

          {/* Buttons */}
          <div className="flex space-x-3 pt-4">
            <button
              onClick={() => setStep(isRejoinFlow ? 'rejoin' : 'role')}
              className="flex-1 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleComplete}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
            >
              {isRejoinFlow ? 'Join Household' : 'Get Started'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

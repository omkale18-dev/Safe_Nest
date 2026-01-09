import React, { useState, useEffect } from 'react';
import { ArrowLeft, Camera, Save, User, Phone, Smartphone } from 'lucide-react';
import { UserProfile } from '../types';
import * as googleFitService from '../services/googleFit';
import { ref, onValue } from 'firebase/database';
import { db } from '../services/firebase';

interface DeviceInfo {
  deviceName: string;
  loginTime: string;
  lastActive: string;
  phone: string;
}

interface ProfileViewProps {
    user: UserProfile;
    onBack: () => void;
    onSave: (updatedUser: UserProfile) => void;
    householdId?: string;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ user, onBack, onSave, householdId }) => {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [avatar, setAvatar] = useState(user.avatar);
  const [isSaving, setIsSaving] = useState(false);
  const [isFitConnected, setIsFitConnected] = useState<boolean | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const displayHouseholdId = (householdId || localStorage.getItem('safenest_household_id') || '').toString().trim();

  // Check Google Fit status on mount
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const ok = await googleFitService.hasPermissions();
        if (mounted) setIsFitConnected(ok);
      } catch (e) {
        if (mounted) setIsFitConnected(false);
      }
    })();
    return () => { mounted = false };
  }, []);

  // Listen to device info from Firebase
  useEffect(() => {
    if (!displayHouseholdId) return;
    
    const deviceRef = ref(db, `households/${displayHouseholdId}/connectedDevice`);
    const unsub = onValue(deviceRef, (snapshot) => {
      if (snapshot.exists()) {
        setDeviceInfo(snapshot.val() as DeviceInfo);
      }
    });
    
    return () => unsub();
  }, [displayHouseholdId]);

  const handleSave = () => {
    setIsSaving(true);
    // Simulate network delay
    setTimeout(() => {
        const updatedUser = {
            ...user,
            name,
            phone,
            avatar
        };
        // Save to localStorage
        localStorage.setItem('safenest_user_profile', JSON.stringify(updatedUser));
        onSave(updatedUser);
        setIsSaving(false);
        onBack();
    }, 800);
  };

  return (
    <div className="h-full bg-white flex flex-col animate-fade-in z-50 absolute inset-0">
      {/* Header */}
      <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between">
        <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-50 rounded-full transition-colors">
            <ArrowLeft size={24} className="text-gray-900" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">Edit Profile</h1>
        <div className="w-10"></div> {/* Spacer */}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        
        {/* Avatar Section */}
        <div className="flex flex-col items-center mb-8">
            <div className="relative group cursor-pointer">
                <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-gray-100 shadow-sm">
                    <img src={avatar} alt="Profile" className="w-full h-full object-cover" />
                </div>
                <div className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full border-2 border-white shadow-md">
                    <Camera size={16} />
                </div>
            </div>
            <p className="mt-3 text-sm text-blue-600 font-semibold">Change Photo</p>
        </div>

        {/* Form Fields */}
        <div className="space-y-6">
            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Full Name</label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User size={18} className="text-gray-400" />
                    </div>
                    <input 
                        type="text" 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 p-3 font-semibold"
                        placeholder="Enter your name"
                    />
                </div>
            </div>

            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Phone Number</label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Phone size={18} className="text-gray-400" />
                    </div>
                    <input 
                        type="tel" 
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 p-3 font-semibold"
                        placeholder="+1 (555) 000-0000"
                    />
                </div>
            </div>

                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mt-6 space-y-2">
                                <div>
                                    <h3 className="font-bold text-blue-800 text-sm mb-1">Safety ID</h3>
                                    <p className="text-sm font-semibold text-blue-900 tracking-wide">{user.id}</p>
                                </div>
                                <div className="pt-1 border-t border-blue-100">
                                    <h3 className="font-bold text-blue-800 text-sm mb-1">Household Code</h3>
                                    <p className="text-sm font-semibold text-blue-900 tracking-wide">{displayHouseholdId || 'Not linked yet'}</p>
                                    <p className="text-xs text-blue-600 leading-relaxed mt-1">
                                        Share this code with caregivers to link devices.
                                    </p>
                                </div>
                                {/* Connected Device Info */}
                                {deviceInfo && deviceInfo.phone === user.phone && (
                                  <div className="pt-4 border-t border-blue-100">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Smartphone size={16} className="text-green-600" />
                                      <h3 className="font-bold text-blue-800 text-sm">Connected Device</h3>
                                      <span className="inline-block w-2 h-2 bg-green-600 rounded-full"></span>
                                    </div>
                                    <p className="text-sm font-semibold text-blue-900">{deviceInfo.deviceName}</p>
                                    <p className="text-xs text-blue-600 mt-1">
                                      Logged in: {new Date(deviceInfo.loginTime).toLocaleDateString()} at {new Date(deviceInfo.loginTime).toLocaleTimeString()}
                                    </p>
                                    <p className="text-xs text-blue-600">
                                      Last active: {new Date(deviceInfo.lastActive).toLocaleTimeString()}
                                    </p>
                                  </div>
                                )}
                                {/* Google Fit Connect */}
                                <div className="pt-4 border-t border-blue-100">
                                    <h3 className="font-bold text-blue-800 text-sm mb-1">Connect Smartwatch</h3>
                                    <p className="text-sm text-blue-900 tracking-wide">Connect your Wear OS watch via Google Fit to sync steps, heart rate, calories and distance.</p>

                                    <div className="mt-3 flex items-center gap-3">
                                        <button id="connectFitBtn" onClick={async () => {
                                            try {
                                                setIsConnecting(true);
                                                // Start permission flow
                                                const started = await googleFitService.requestPermissions();
                                                if (started) {
                                                    // Ask user to complete sign-in in Google dialog and then check status
                                                    // Delay briefly to let user complete the dialog
                                                    await new Promise(r => setTimeout(r, 1000));
                                                    const ok = await googleFitService.hasPermissions();
                                                    if (ok) {
                                                        setIsFitConnected(true);
                                                        alert('Google Fit permissions granted — syncing enabled');
                                                        await googleFitService.ensureSubscriptions();
                                                        // Notify global app state so UI updates immediately
                                                        window.dispatchEvent(new Event('googleFitConnected'));
                                                    } else {
                                                        setIsFitConnected(false);
                                                        alert('Please complete Google Sign-In to grant Fit access');
                                                    }
                                                } else {
                                                    alert('Could not start Google Fit sign-in flow on this device');
                                                }
                                            } catch (e) {
                                                console.error('Google Fit connect error', e);
                                                alert('Error initiating Google Fit connection');
                                                setIsFitConnected(false);
                                            } finally {
                                                setIsConnecting(false);
                                            }
                                        }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold">
                                            {isConnecting ? 'Connecting...' : 'Connect via Google Fit'}
                                        </button>

                                        <button onClick={async () => {
                                            const ok = await googleFitService.hasPermissions();
                                            setIsFitConnected(ok);
                                            if (ok) alert('Google Fit connected'); else alert('Not connected');
                                        }} className="bg-gray-100 px-3 py-2 rounded-xl text-sm">Check Status</button>
                                    </div>

                                    <p className="text-xs text-blue-600 leading-relaxed mt-3">If your watch is paired and Google Fit installed on your phone, granting access here will enable automatic sync.</p>
                                </div>
                                <p className="text-xs text-blue-600 leading-relaxed">
                                        This info is visible to your caregivers during an alert.
                                </p>
                        </div>
        </div>

      </div>

      {/* Footer Button */}
      <div className="p-6 border-t border-gray-100 bg-white">
        <button 
            onClick={handleSave}
            disabled={isSaving}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-200 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-70 disabled:scale-100"
        >
            {isSaving ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
                <>
                    <Save size={20} /> Save Changes
                </>
            )}
        </button>
      </div>
    </div>
  );
};
import React, { useState, useEffect } from 'react';
import { 
  MapPin, Home, Plus, Trash2, ChevronLeft, 
  AlertTriangle, Shield, Navigation, Settings
} from 'lucide-react';
import { Geofence } from '../types';
import { geofenceService } from '../services/geofenceService';

interface GeofenceViewProps {
  onBack?: () => void;
  householdId: string;
  userRole: 'senior' | 'caregiver';
}

export const GeofenceView: React.FC<GeofenceViewProps> = ({
  onBack,
  householdId,
  userRole
}) => {
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isAtHome, setIsAtHome] = useState<boolean | null>(null);
  const [distanceFromHome, setDistanceFromHome] = useState<number | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState<'home' | 'safe_zone' | 'restricted'>('safe_zone');
  const [radius, setRadius] = useState(100);
  const [alertOnExit, setAlertOnExit] = useState(true);
  const [alertOnEntry, setAlertOnEntry] = useState(false);

  useEffect(() => {
    geofenceService.init(householdId);
    loadGeofences();
    
    // Start monitoring if senior
    if (userRole === 'senior') {
      geofenceService.startMonitoring();
      updateLocationStatus();
      
      const interval = setInterval(updateLocationStatus, 30000); // Update every 30s
      return () => {
        clearInterval(interval);
      };
    }
  }, [householdId, userRole]);

  const loadGeofences = () => {
    setGeofences(geofenceService.getGeofences());
  };

  const updateLocationStatus = () => {
    setIsAtHome(geofenceService.isAtHome());
    setDistanceFromHome(geofenceService.getDistanceFromHome());
  };

  const handleSetupHome = async () => {
    setIsLoading(true);
    try {
      const result = await geofenceService.setupHomeGeofence(100);
      if (result) {
        loadGeofences();
      } else {
        // Show error for insecure origin (HTTP)
        alert('Location access requires HTTPS or the native app. Please test on the Android/iOS app or use localhost.');
      }
    } catch (error: any) {
      console.error('Failed to setup home:', error);
      if (error?.code === 1) {
        alert('Location permission denied. Please enable location access.');
      } else if (error?.message?.includes('secure origins')) {
        alert('Location requires HTTPS. This will work on the native Android/iOS app.');
      } else {
        alert('Failed to get location. Please try again.');
      }
    }
    setIsLoading(false);
  };

  const handleAddGeofence = async () => {
    if (!name) return;
    setIsLoading(true);
    
    try {
      // Get current location
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000
        });
      });

      await geofenceService.addGeofence({
        name,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        radius,
        type,
        alertOnExit,
        alertOnEntry,
        enabled: true,
      });

      loadGeofences();
      resetForm();
      setShowAddModal(false);
    } catch (error: any) {
      console.error('Failed to add geofence:', error);
      if (error?.code === 1) {
        alert('Location permission denied. Please enable location access in your browser settings.');
      } else if (error?.message?.includes('secure origins') || error?.code === 1) {
        alert('Location requires HTTPS. This will work on the native Android/iOS app.');
      } else {
        alert('Failed to get location. Please enable GPS and try again.');
      }
    }
    
    setIsLoading(false);
  };

  const handleDeleteGeofence = async (id: string) => {
    if (confirm('Delete this zone?')) {
      await geofenceService.removeGeofence(id);
      loadGeofences();
    }
  };

  const handleToggleGeofence = async (id: string, enabled: boolean) => {
    await geofenceService.updateGeofence(id, { enabled });
    loadGeofences();
  };

  const resetForm = () => {
    setName('');
    setType('safe_zone');
    setRadius(100);
    setAlertOnExit(true);
    setAlertOnEntry(false);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'home': return <Home size={20} className="text-green-600" />;
      case 'restricted': return <AlertTriangle size={20} className="text-red-600" />;
      default: return <Shield size={20} className="text-blue-600" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'home': return 'bg-green-100 border-green-300';
      case 'restricted': return 'bg-red-100 border-red-300';
      default: return 'bg-blue-100 border-blue-300';
    }
  };

  const homeGeofence = geofences.find(g => g.type === 'home');

  return (
    <div className="pb-24 pt-6 px-4 min-h-full bg-gray-50">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        {onBack && (
          <button onClick={onBack} className="p-2 rounded-lg bg-white shadow-sm">
            <ChevronLeft size={24} />
          </button>
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">📍 Safe Zones</h1>
          <p className="text-sm text-gray-500">Alert caregiver if senior leaves zone</p>
        </div>
      </div>

      {/* Current Status (for seniors) */}
      {userRole === 'senior' && (
        <div className={`rounded-2xl p-4 mb-6 ${isAtHome ? 'bg-green-100 border border-green-300' : 'bg-orange-100 border border-orange-300'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isAtHome ? 'bg-green-200' : 'bg-orange-200'}`}>
              {isAtHome ? <Home size={24} className="text-green-700" /> : <Navigation size={24} className="text-orange-700" />}
            </div>
            <div>
              <p className="font-bold text-gray-900">
                {isAtHome ? '🏠 You are at Home' : '📍 Outside Home'}
              </p>
              {distanceFromHome !== null && distanceFromHome > 0 && (
                <p className="text-sm text-gray-600">
                  {distanceFromHome < 1000 
                    ? `${Math.round(distanceFromHome)}m from home`
                    : `${(distanceFromHome / 1000).toFixed(1)}km from home`
                  }
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Setup Home Section */}
      {!homeGeofence && (
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6 text-center border-2 border-dashed border-green-300">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Home size={32} className="text-green-600" />
          </div>
          <h3 className="font-bold text-gray-900 mb-2">Set Your Home Location</h3>
          <p className="text-sm text-gray-500 mb-4">
            Caregiver will be notified when senior leaves home
          </p>
          <button
            onClick={handleSetupHome}
            disabled={isLoading}
            className="px-6 py-3 bg-green-500 text-white font-bold rounded-xl disabled:opacity-50"
          >
            {isLoading ? 'Setting up...' : '📍 Set Current Location as Home'}
          </button>
        </div>
      )}

      {/* Geofences List */}
      {geofences.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold text-gray-500 uppercase mb-3">Your Safe Zones</h2>
          <div className="space-y-3">
            {geofences.map(geofence => (
              <div 
                key={geofence.id} 
                className={`bg-white rounded-xl p-4 border ${geofence.enabled ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getTypeColor(geofence.type)}`}>
                      {getTypeIcon(geofence.type)}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{geofence.name}</p>
                      <p className="text-xs text-gray-500">
                        {geofence.radius}m radius • {geofence.alertOnExit ? 'Exit alerts' : ''} {geofence.alertOnEntry ? 'Entry alerts' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleGeofence(geofence.id, !geofence.enabled)}
                      className={`w-10 h-6 rounded-full transition-colors ${geofence.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${geofence.enabled ? 'translate-x-5' : 'translate-x-1'}`} />
                    </button>
                    {geofence.type !== 'home' && (
                      <button
                        onClick={() => handleDeleteGeofence(geofence.id)}
                        className="p-2 rounded-lg hover:bg-red-50"
                      >
                        <Trash2 size={18} className="text-red-400" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Zone Button */}
      <button
        onClick={() => setShowAddModal(true)}
        className="w-full py-4 border-2 border-dashed border-blue-300 rounded-xl text-blue-600 font-semibold flex items-center justify-center gap-2 hover:bg-blue-50"
      >
        <Plus size={20} />
        Add Safe Zone
      </button>

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
        <h4 className="font-bold text-blue-900 mb-2">ℹ️ How it works</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>Home Zone:</strong> Alert when senior leaves home</li>
          <li>• <strong>Safe Zones:</strong> No alert when senior is in these areas</li>
          <li>• <strong>Restricted:</strong> Alert when senior enters these areas</li>
        </ul>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Add Safe Zone</h2>
              <button onClick={() => { resetForm(); setShowAddModal(false); }} className="text-gray-400 text-2xl">&times;</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Zone Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Temple, Park, Grocery Store"
                  className="w-full p-3 border rounded-xl mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Zone Type</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  <button
                    onClick={() => setType('safe_zone')}
                    className={`py-3 rounded-xl flex flex-col items-center gap-1 ${
                      type === 'safe_zone' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    <Shield size={20} />
                    <span className="text-xs">Safe</span>
                  </button>
                  <button
                    onClick={() => setType('restricted')}
                    className={`py-3 rounded-xl flex flex-col items-center gap-1 ${
                      type === 'restricted' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    <AlertTriangle size={20} />
                    <span className="text-xs">Restricted</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Radius: {radius}m</label>
                <input
                  type="range"
                  min="50"
                  max="500"
                  step="25"
                  value={radius}
                  onChange={(e) => setRadius(parseInt(e.target.value))}
                  className="w-full mt-1"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>50m</span>
                  <span>500m</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center justify-between py-2">
                  <span className="text-sm font-medium text-gray-700">Alert on Exit</span>
                  <button
                    onClick={() => setAlertOnExit(!alertOnExit)}
                    className={`w-10 h-6 rounded-full transition-colors ${alertOnExit ? 'bg-blue-500' : 'bg-gray-300'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${alertOnExit ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </label>
                <label className="flex items-center justify-between py-2">
                  <span className="text-sm font-medium text-gray-700">Alert on Entry</span>
                  <button
                    onClick={() => setAlertOnEntry(!alertOnEntry)}
                    className={`w-10 h-6 rounded-full transition-colors ${alertOnEntry ? 'bg-blue-500' : 'bg-gray-300'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${alertOnEntry ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </label>
              </div>

              <div className="bg-gray-50 p-3 rounded-xl text-center text-sm text-gray-600">
                <MapPin size={16} className="inline mr-1" />
                Will use your current location as the center
              </div>
            </div>

            {/* Save Button */}
            <div className="mt-6 space-y-3">
              <button
                onClick={handleAddGeofence}
                disabled={!name || isLoading}
                className="w-full py-4 bg-blue-500 text-white font-bold rounded-xl disabled:opacity-50 shadow-lg"
              >
                {isLoading ? 'Adding...' : '✓ Save Zone'}
              </button>
              <button
                onClick={() => { resetForm(); setShowAddModal(false); }}
                className="w-full py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

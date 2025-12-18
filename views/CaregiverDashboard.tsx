import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Phone, Navigation, Battery, Heart, Layers, Plus, CheckCircle, XCircle, Clock, LogOut, Map as MapIcon, Pill, Activity, Calendar, Bell, Home, Settings, MapPin } from 'lucide-react';
import { SeniorStatus, ActivityItem, Reminder, HouseholdMember, UserRole } from '../types';
import { BottomNav } from '../components/BottomNav';

declare var L: any;

interface CaregiverDashboardProps {
  onBack: () => void;
  seniorStatus: SeniorStatus;
  stopAlert?: () => void;
  reminders: Reminder[];
  onAddReminder: (reminder: Reminder) => void;
  senior?: HouseholdMember;
    onSignOut?: () => void;
    onJoinAnotherHousehold?: () => void;
    householdId?: string;
    householdIds?: string[];
    onSwitchHousehold?: (householdId: string) => void;
    seniors?: { [householdId: string]: HouseholdMember };
}

export const CaregiverDashboard: React.FC<CaregiverDashboardProps> = ({ 
    onBack, 
    seniorStatus, 
    stopAlert,
    reminders,
    onAddReminder,
    senior,
    onSignOut,
    onJoinAnotherHousehold,
    householdId,
    householdIds = [],
    onSwitchHousehold,
    seniors = {}
}) => {
  useEffect(() => {
    console.log('[CaregiverDashboard] onSignOut:', typeof onSignOut);
  }, [onSignOut]);

  const [activeTab, setActiveTab] = useState<'home' | 'map' | 'schedule' | 'settings'>('home');
  const [showAddModal, setShowAddModal] = useState(false);
  const [mapType, setMapType] = useState<'street' | 'satellite'>('street');
  
  // New Reminder Form State
  const [newTitle, setNewTitle] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newInstructions, setNewInstructions] = useState('');

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  const isEmergency = seniorStatus.status !== 'Normal';

  const handleCallSenior = () => {
    if (stopAlert) stopAlert();
    if (!senior) return;
    window.open(`tel:${senior.phone.replace(/\D/g,'')}`, '_self');
  };

  const submitReminder = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newTitle || !newTime) return;

      const newReminder: Reminder = {
          id: Date.now().toString(),
          title: newTitle,
          time: newTime,
          instructions: newInstructions || 'No instructions',
          type: 'MEDICATION',
          status: 'PENDING'
      };
      
      onAddReminder(newReminder);
      setShowAddModal(false);
      setNewTitle('');
      setNewTime('');
      setNewInstructions('');
  };

  // --- MAP INIT LOGIC (Existing) ---
  useEffect(() => {
    if (activeTab === 'map' && mapContainerRef.current && typeof L !== 'undefined') {
        if (!mapInstanceRef.current) {
            const map = L.map(mapContainerRef.current, { zoomControl: false, attributionControl: false })
                .setView([seniorStatus.location.lat, seniorStatus.location.lng], 16);
            
            // Add both tile layers
            const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 });
            const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 });
            
            // Store layers on map object for switching
            (map as any).layers = { street: streetLayer, satellite: satelliteLayer };
            streetLayer.addTo(map);
            
            mapInstanceRef.current = map;
            markerRef.current = L.marker([seniorStatus.location.lat, seniorStatus.location.lng]).addTo(map);
        }
        
        // Force resize recalculation to ensure full fill
        setTimeout(() => {
            mapInstanceRef.current?.invalidateSize();
        }, 100);
    }
  }, [activeTab]);

  // Handle map type switching
  useEffect(() => {
    if (mapInstanceRef.current && (mapInstanceRef.current as any).layers) {
      const { street, satellite } = (mapInstanceRef.current as any).layers;
      if (mapType === 'street') {
        mapInstanceRef.current.removeLayer(satellite);
        mapInstanceRef.current.addLayer(street);
      } else {
        mapInstanceRef.current.removeLayer(street);
        mapInstanceRef.current.addLayer(satellite);
      }
    }
  }, [mapType]);

  // Update map when senior location changes
  useEffect(() => {
    if (mapInstanceRef.current && markerRef.current && seniorStatus.location) {
      const newLatLng = [seniorStatus.location.lat, seniorStatus.location.lng];
      mapInstanceRef.current.panTo(newLatLng);
      markerRef.current.setLatLng(newLatLng);
    }
  }, [seniorStatus.location]);

  return (
    <div className="flex flex-col h-full bg-gray-50 relative">
      
      {/* Header */}
            <div className={`shadow-sm px-4 py-4 flex items-center justify-between z-[50] bg-white flex-shrink-0`}>
            {/* Senior Name */}
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-500 uppercase">Monitoring</p>
              <p className="text-lg font-bold text-gray-900">{senior?.name || 'Senior'}</p>
            </div>
                <div className="flex items-center gap-2">
                        {onSignOut && (
                            <button 
                                onClick={onSignOut}
                                className="flex items-center gap-1 text-xs font-bold text-red-600 px-3 py-2 rounded-full bg-red-50 hover:bg-red-100 border border-red-100 shadow-sm transition-colors"
                            >
                                <LogOut size={16} />
                                Sign Out
                            </button>
                        )}
                </div>
      </div>

      {/* CONTENT: HOME VIEW */}
      {activeTab === 'home' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
              <p className="text-gray-600">Monitoring {householdIds.length} senior{householdIds.length !== 1 ? 's' : ''}</p>
            </div>

            {/* All Seniors Status Cards */}
            <div className="space-y-4">
              {householdIds.map(hId => {
                const seniorData = seniors[hId];
                if (!seniorData) return null;
                
                return (
                  <div key={hId} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <div className="mb-4">
                      <h2 className="text-lg font-bold text-gray-900">{seniorData.name}</h2>
                      <p className="text-xs text-gray-500 font-mono mt-1">Code: {hId}</p>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center">
                        <p className="text-sm text-gray-600 mb-1">Heart Rate</p>
                        <p className="text-2xl font-bold text-red-600">{seniorStatus?.heartRate || '--'}</p>
                        <p className="text-xs text-gray-500">bpm</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-gray-600 mb-1">O₂ Level</p>
                        <p className="text-2xl font-bold text-blue-600">{seniorStatus?.spo2 || '--'}%</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-gray-600 mb-1">Status</p>
                        <p className={`text-lg font-bold ${seniorStatus?.status === 'Normal' ? 'text-green-600' : 'text-red-600'}`}>
                          {seniorStatus?.status || 'Unknown'}
                        </p>
                      </div>
                    </div>

                    {/* Location Place */}
                    <div className="bg-gray-50 rounded-lg p-4 flex items-start gap-3">
                      <MapPin size={24} className="text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-gray-600 font-semibold">Location</p>
                        <p className="text-gray-900 font-semibold">{seniorStatus?.location?.address || 'Updating location...'}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Upcoming Medications */}
            {reminders.length > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-900 mb-3">Next Medications</h3>
                <div className="space-y-2">
                  {reminders.slice(0, 3).map((reminder) => (
                    <div key={reminder.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-semibold text-gray-900">{reminder.title}</p>
                        <p className="text-xs text-gray-500">{reminder.time}</p>
                      </div>
                      <Pill size={20} className="text-blue-600" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
      )}

      {/* CONTENT: MAP VIEW */}
      {activeTab === 'map' && (
          <div className="flex-1 relative overflow-hidden">
            <div ref={mapContainerRef} className="w-full h-full outline-none z-0" />
            
            {/* Map Type Toggle Buttons */}
            <div className="absolute top-4 right-4 z-20 flex gap-2">
              <button 
                onClick={() => setMapType('street')}
                className={`p-2 rounded-full shadow-md transition-colors ${mapType === 'street' ? 'bg-blue-500 text-white' : 'bg-white/90 backdrop-blur-sm text-gray-700 hover:bg-white'}`}
                title="Territorial Map"
              >
                <MapIcon size={20} />
              </button>

              <button 
                onClick={() => setMapType('satellite')}
                className={`p-2 rounded-full shadow-md transition-colors ${mapType === 'satellite' ? 'bg-blue-500 text-white' : 'bg-white/90 backdrop-blur-sm text-gray-700 hover:bg-white'}`}
                title="Satellite Map"
              >
                <Layers size={20} />
              </button>
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-[0_-5px_20px_rgba(0,0,0,0.1)] p-6 z-10">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-2 ${isEmergency ? 'bg-red-100 text-red-700' : 'bg-green-50 text-green-700'}`}>
                            <div className={`w-2 h-2 rounded-full ${isEmergency ? 'bg-red-600 animate-pulse' : 'bg-green-500'}`}></div>
                            {isEmergency ? seniorStatus.status : 'Safe at Home'}
                        </div>
                        <h2 className="text-xl font-bold text-gray-900">{seniorStatus.location.address}</h2>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1 text-gray-500 text-xs font-bold"><Battery size={14} /> {seniorStatus.batteryLevel}%</div>
                        <div className="flex items-center gap-1 text-gray-500 text-xs font-bold"><Heart size={14} /> {seniorStatus.heartRate} bpm</div>
                    </div>
                </div>
                {senior && (
                  <button onClick={handleCallSenior} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
                      <Phone size={20} /> Call {senior.name.split(' ')[0]}
                  </button>
                )}
            </div>
          </div>
      )}

      {/* CONTENT: SCHEDULE VIEW */}
      {activeTab === 'schedule' && (
          <div className="flex-1 p-6 overflow-y-auto">
             <div className="flex justify-between items-center mb-6">
                 <h2 className="text-2xl font-bold text-gray-900">Medication Schedule</h2>
                 <button 
                    onClick={() => setShowAddModal(true)}
                    className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition-colors"
                 >
                     <Plus size={24} />
                 </button>
             </div>

             <div className="space-y-4">
                 {reminders.length === 0 && <p className="text-gray-400 text-center py-8">No medications scheduled.</p>}
                 
                 {reminders.map((reminder) => (
                     <div key={reminder.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                         <div className="flex items-start gap-4">
                             <div className="text-lg font-bold text-blue-600 mt-1">{reminder.time}</div>
                             <div>
                                 <h3 className="font-bold text-gray-900">{reminder.title}</h3>
                                 <p className="text-xs text-gray-500">{reminder.instructions}</p>
                             </div>
                         </div>
                         <div>
                             {reminder.status === 'COMPLETED' && <div className="text-green-500 flex flex-col items-center"><CheckCircle size={20} /><span className="text-[10px] font-bold">Taken</span></div>}
                             {reminder.status === 'PENDING' && <div className="text-gray-300 flex flex-col items-center"><Clock size={20} /><span className="text-[10px] font-bold">Pending</span></div>}
                             {reminder.status === 'SNOOZED' && <div className="text-orange-400 flex flex-col items-center"><Clock size={20} /><span className="text-[10px] font-bold">Snoozed</span></div>}
                         </div>
                     </div>
                 ))}
             </div>
          </div>
      )}

      {/* ADD MEDICATION MODAL */}
      {showAddModal && (
          <div className="absolute inset-0 bg-black/50 z-[100] flex items-end sm:items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl">
                  <h3 className="text-xl font-bold mb-4">Add Medication</h3>
                  <form onSubmit={submitReminder} className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Medicine Name</label>
                          <input 
                            type="text" 
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 font-semibold"
                            placeholder="e.g., Lisinopril"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            required
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Time</label>
                          <input 
                            type="time" 
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 font-semibold"
                            value={newTime}
                            onChange={(e) => setNewTime(e.target.value)}
                            required
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Instructions (Optional)</label>
                          <input 
                            type="text" 
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm"
                            placeholder="e.g., Take with food"
                            value={newInstructions}
                            onChange={(e) => setNewInstructions(e.target.value)}
                          />
                      </div>
                      <div className="flex gap-3 pt-2">
                          <button 
                            type="button" 
                            onClick={() => setShowAddModal(false)}
                            className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-xl"
                          >
                              Cancel
                          </button>
                          <button 
                            type="submit" 
                            className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl"
                          >
                              Save Schedule
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* CONTENT: SETTINGS VIEW */}
      {activeTab === 'settings' && (
          <div className="flex-1 p-6 overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Settings</h2>
            
            <div className="space-y-4">
              {/* Monitored Seniors with Household Codes */}
              {householdIds.length > 0 && (
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                  <h3 className="font-bold text-gray-900 mb-3">Monitored Seniors</h3>
                  <div className="space-y-2">
                    {householdIds.map(hId => (
                      <button
                        key={hId}
                        onClick={() => onSwitchHousehold?.(hId)}
                        className={`w-full p-3 rounded-lg text-left transition-colors ${
                          hId === householdId
                            ? 'bg-blue-100 border-2 border-blue-400'
                            : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <p className="font-semibold text-gray-900">{seniors[hId]?.name || 'Unknown Senior'}</p>
                        <p className="text-xs text-gray-500 font-mono mt-1">Code: {hId}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Join Another Household */}
              {onJoinAnotherHousehold && (
                <button 
                  onClick={onJoinAnotherHousehold}
                  className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between hover:bg-blue-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <Plus size={20} className="text-blue-600" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-gray-900">Join Another Household</p>
                      <p className="text-xs text-gray-500">Monitor multiple seniors</p>
                    </div>
                  </div>
                  <Heart size={20} className="text-gray-400" />
                </button>
              )}
              
              {/* Sign Out */}
              <div className="pt-4">
                {onSignOut && (
                  <button 
                    onClick={onSignOut}
                    className="w-full flex items-center justify-center gap-2 text-red-600 font-bold px-4 py-3 rounded-xl bg-red-50 hover:bg-red-100 border border-red-100 transition-colors"
                  >
                    <LogOut size={20} />
                    Sign Out
                  </button>
                )}
              </div>
            </div>
          </div>
      )}

      {/* Bottom Navigation */}
      <div className="shrink-0 z-50 bg-white shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
        <BottomNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          customItems={[
            { id: 'home', icon: Home, label: 'Home' },
            { id: 'map', icon: MapIcon, label: 'Location' },
            { id: 'schedule', icon: Pill, label: 'Schedule' },
            { id: 'settings', icon: Settings, label: 'Settings' }
          ]}
        />
      </div>

    </div>
  );
};
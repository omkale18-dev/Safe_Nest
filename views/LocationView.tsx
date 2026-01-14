import React, { useState, useEffect, useRef } from 'react';
import { Settings, Phone, Navigation, Battery, Layers, Map as MapIcon, ChevronUp, ChevronDown } from 'lucide-react';
import { SeniorStatus, ActivityItem, HouseholdMember, UserRole } from '../types';
import { sanitizeForLog, sanitizeForHTML, isValidImageUrl } from '../utils/sanitize';
import { logger } from '../utils/logger';

// Declare Leaflet globally
declare var L: any;

interface LocationViewProps {
  status: SeniorStatus;
  seniorProfile?: HouseholdMember;
  caregivers?: HouseholdMember[];
  onBack?: () => void;
}

export const LocationView: React.FC<LocationViewProps> = ({ status, seniorProfile, caregivers = [], onBack }) => {
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);
  const [mapType, setMapType] = useState<'street' | 'satellite'>('street');
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  
  const isEmergency = status.status !== 'Normal';
  const primaryCaregiver = caregivers.find(c => c.role === UserRole.CAREGIVER);

  // Format the last update time (accept Date or ISO string)
  const timeAgo = (dateLike: Date | string | undefined) => {
    if (!dateLike) return 'N/A';
    const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
    if (isNaN(date.getTime())) return 'N/A';
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  };

  const togglePanel = () => setIsPanelExpanded(!isPanelExpanded);

  const handleCallCaregiver = () => {
    if (!primaryCaregiver) return;
    window.open(`tel:${primaryCaregiver.phone.replace(/\D/g,'')}`, '_self');
  };

  // Initialize Leaflet Map
  useEffect(() => {
    // Require valid location and Leaflet
    if (!status?.location || typeof status.location.lat !== 'number' || typeof status.location.lng !== 'number') {
      console.warn('[LocationView] No valid location found on status, skipping map init');
      return;
    }
    if (!mapContainerRef.current || typeof L === 'undefined') return;
    
    // Clear container and previous instance
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    }
    if (mapContainerRef.current) {
      const container = mapContainerRef.current;
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    }

    // Initialize with delay to ensure container has proper dimensions
    const timer = setTimeout(() => {
      if (!mapContainerRef.current) {
        console.warn('[LocationView] Map container ref is null');
        return;
      }

      try {
        const rect = mapContainerRef.current.getBoundingClientRect();
        const computed = window.getComputedStyle(mapContainerRef.current);
        console.log('[LocationView] Container rect:', {
          width: rect.width,
          height: rect.height,
          top: rect.top,
          left: rect.left
        });
        console.log('[LocationView] Container computed style:', {
          width: computed.width,
          height: computed.height,
          display: computed.display,
          position: computed.position
        });
        console.log('[LocationView] offsetWidth:', mapContainerRef.current.offsetWidth, 'offsetHeight:', mapContainerRef.current.offsetHeight);
        
        if (rect.width === 0 || rect.height === 0) {
          console.warn('[LocationView] Container has zero dimensions, retrying...');
          // Retry after another delay
          setTimeout(() => {
            if (!mapContainerRef.current) return;
            initMap();
          }, 200);
          return;
        }
        
        initMap();
      } catch (e) {
        console.error('[LocationView] Pre-init error:', e);
      }
    }, 200);

    const initMap = () => {
      if (!mapContainerRef.current) return;
      
      try {
        console.log('[LocationView] Initializing map with location:', sanitizeForLog(status.location.lat), sanitizeForLog(status.location.lng));
        
        // Create Map with light background
        const map = L.map(mapContainerRef.current, {
          zoomControl: false,
          attributionControl: false,
          preferCanvas: true
        }).setView([status.location.lat, status.location.lng], 16);

        // Add Tile Layer (OpenStreetMap) with error handling
        const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '',
          errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          crossOrigin: true
        });
        
        streetLayer.on('load', () => {
          console.log('[LocationView] Street layer loaded');
        });
        
        streetLayer.on('error', (e) => {
          console.error('[LocationView] Street layer error:', e);
        });
        
        streetLayer.addTo(map);
        
        // Satellite Layer
        const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 19,
          attribution: '',
          errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          crossOrigin: true
        });

        // Store layers to toggle later
        (map as any).layers = { street: streetLayer, satellite: satelliteLayer };

        mapInstanceRef.current = map;

        // Create Custom Avatar Icon
        const createIcon = (isAlert: boolean) => {
          const defaultAvatar = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiNFNUU3RUIiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjM1IiByPSIxNSIgZmlsbD0iIzlDQTNCNCIvPjxwYXRoIGQ9Ik0yMCA4NUMyMCA2NS4xMTggMzMuNDMxNSA1MCA1MCA1MEM2Ni41Njg1IDUwIDgwIDY1LjExOCA4MCA4NVYxMDBIMjBWODVaIiBmaWxsPSIjOUNBM0I0Ii8+PC9zdmc+';
          // Only use validated image URLs directly (do not escape slashes) so image loads correctly
          const avatarUrl = seniorProfile && isValidImageUrl(seniorProfile.avatar) ? seniorProfile.avatar : defaultAvatar;
          
          return L.divIcon({
            className: 'custom-pin',
            html: `
              <div class="relative flex items-center justify-center w-16 h-16 -translate-x-1/4 -translate-y-1/4">
                <div class="absolute w-full h-full rounded-full ${isAlert ? 'bg-red-500' : 'bg-blue-500'} opacity-30 animate-ping"></div>
                <div class="absolute w-12 h-12 rounded-full ${isAlert ? 'bg-red-500' : 'bg-blue-500'} opacity-20 animate-pulse"></div>
                <div class="relative w-10 h-10 bg-white rounded-full border-2 ${isAlert ? 'border-red-500' : 'border-white'} shadow-lg overflow-hidden">
                  <img src="${avatarUrl}" class="w-full h-full object-cover" />
                </div>
              </div>
            `,
            iconSize: [40, 40],
            iconAnchor: [20, 20]
          });
        };

        // Add Marker
        markerRef.current = L.marker([status.location.lat, status.location.lng], {
          icon: createIcon(isEmergency)
        }).addTo(map);

        // Force resize after a bit longer to ensure full layout
        setTimeout(() => {
          logger.debug('[LocationView] Calling invalidateSize');
          map.invalidateSize();
          logger.debug('[LocationView] invalidateSize complete, map size:', map.getSize());
        }, 200);

        console.log('[LocationView] Map initialized successfully');
      } catch (e) {
        console.error('[LocationView] Map initialization error:', e);
      }
    };

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, [status.location.lat, status.location.lng, isEmergency, seniorProfile?.avatar]);

  // Handle Map Type Toggle
  useEffect(() => {
      if (mapInstanceRef.current) {
          const map = mapInstanceRef.current;
          if (mapType === 'street') {
              map.removeLayer(map.layers.satellite);
              map.layers.street.addTo(map);
          } else {
              map.removeLayer(map.layers.street);
              map.layers.satellite.addTo(map);
          }
      }
  }, [mapType]);

  const renderActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
        case 'EMERGENCY':
            return <div className="w-5 h-5 bg-red-500 rounded-full border-2 border-white shadow-sm"></div>;
        case 'BATTERY':
            return <div className="w-4 h-4 bg-orange-500 rounded-sm"></div>;
        case 'LOCATION':
            return <div className="w-5 h-5 bg-blue-500 rounded-full border-2 border-white shadow-sm"></div>;
        default:
            return <div className="w-4 h-4 bg-gray-500 rounded-full"></div>;
    }
  };

  const renderActivityBg = (type: ActivityItem['type']) => {
    switch (type) {
        case 'EMERGENCY': return 'bg-red-100';
        case 'BATTERY': return 'bg-orange-100';
        case 'LOCATION': return 'bg-blue-100';
        default: return 'bg-gray-100';
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 w-full pt-[max(env(safe-area-inset-top),28px)]">
      {/* Top Navbar - Fixed height */}
      <div className="h-24 px-4 py-4 flex items-center justify-between bg-white border-b border-gray-100 shrink-0 z-50">
        <button 
           onClick={onBack}
           className="p-2 bg-gray-100 rounded-full shadow-sm hover:bg-gray-200 transition-colors"
        >
           <svg className="w-6 h-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        
        <div className="flex flex-col items-center">
             <span className="font-bold text-gray-900">My Location</span>
             {/* GPS Signal Indicator */}
             <div className="mt-1 flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded-full">
                <div className={`w-2 h-2 rounded-full ${status.location.address === 'GPS Signal Weak' ? 'bg-red-400' : 'bg-green-400 animate-pulse'}`}></div>
                <span className="text-[10px] text-gray-700 font-medium">{status.location.address === 'GPS Signal Weak' ? 'Weak Signal' : 'Live GPS'}</span>
             </div>
        </div>

        <div className="flex gap-2">
          <button 
              onClick={() => setMapType('street')}
              className={`p-2 rounded-full shadow-sm transition-colors ${mapType === 'street' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
              title="Territorial Map"
          >
            <MapIcon size={20} />
          </button>

          <button 
              onClick={() => setMapType('satellite')}
              className={`p-2 rounded-full shadow-sm transition-colors ${mapType === 'satellite' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
              title="Satellite Map"
          >
            <Layers size={20} />
          </button>
        </div>
      </div>

      {/* Map - Takes remaining space */}
      <div className="flex-1 relative w-full bg-white overflow-hidden">
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>

      {/* Bottom Information Card (Collapsible) */}
      <div 
        className={`bg-white border-t border-gray-100 transition-all duration-300 ease-in-out flex flex-col shrink-0 ${isPanelExpanded ? 'flex-1' : 'h-40'}`}
      >
          {/* Drag Handle Area */}
          <div 
            className="w-full pt-4 pb-2 cursor-pointer flex flex-col items-center justify-center shrink-0 hover:bg-gray-50 rounded-t-3xl"
            onClick={togglePanel}
          >
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mb-2"></div>
            {isPanelExpanded ? <ChevronDown size={16} className="text-gray-400"/> : <ChevronUp size={16} className="text-gray-400"/>}
          </div>

          <div className="px-6 flex flex-col h-full overflow-y-auto no-scrollbar">
            {/* Minimized View Content (Always Visible) */}
            <div className="flex justify-between items-start mb-2 shrink-0">
                <div className="flex-1">
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold mb-2 ${isEmergency ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        <div className={`w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm ${isEmergency ? 'bg-red-600 animate-pulse' : 'bg-green-500'}`}></div>
                        {isEmergency ? status.status : 'Safe at Home'}
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 leading-tight truncate pr-4">
                        {status.location.address}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center gap-1 text-gray-500 text-xs">
                            <ClockIcon /> {timeAgo(status.lastUpdate)}
                        </div>
                    </div>
                </div>
                
                <div className="flex flex-col items-end gap-2 shrink-0">
                    <button 
                        onClick={togglePanel}
                        className="bg-blue-50 p-2 rounded-full text-blue-600 mb-1 hover:bg-blue-100"
                    >
                        <Navigation size={20} />
                    </button>
                </div>
            </div>

            {/* Expanded Content */}
            <div className={`transition-opacity duration-300 ${isPanelExpanded ? 'opacity-100' : 'opacity-0 hidden'}`}>
                {/* Actions */}
                <div className="flex gap-3 mb-6 mt-4">
                    {primaryCaregiver && (
                      <button 
                          onClick={handleCallCaregiver}
                          className={`flex-1 text-white py-3.5 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95 ${isEmergency ? 'bg-red-600 shadow-red-200 hover:bg-red-700' : 'bg-blue-600 shadow-blue-200 hover:bg-blue-700'}`}
                      >
                          <Phone size={20} fill="currentColor" />
                          Call {primaryCaregiver.name.split(' ')[0]}
                      </button>
                    )}
                    <div className="flex flex-col items-center justify-center gap-1 bg-gray-50 px-4 rounded-xl border border-gray-100">
                         <Battery size={20} className={status.batteryLevel < 20 ? "text-red-500" : "text-green-500"} fill="currentColor" />
                         <span className="text-[10px] font-bold text-gray-600">{status.batteryLevel}%</span>
                    </div>
                </div>

                {/* Recent Activity */}
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-gray-900">Recent Activity</h3>
                        <button className="text-blue-600 text-sm font-semibold hover:text-blue-700">See All</button>
                    </div>
                    
                    {status.recentActivity.map((activity) => (
                        <div key={activity.id} className="flex gap-4 items-start p-3 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-colors cursor-pointer mb-2">
                            <div className={`w-10 h-10 rounded-full ${renderActivityBg(activity.type)} flex items-center justify-center shrink-0`}>
                                {renderActivityIcon(activity.type)}
                            </div>
                            <div>
                                <p className="font-bold text-gray-900 text-sm">{activity.title}</p>
                                <p className="text-xs text-gray-500">
                                    {timeAgo(activity.timestamp)} • {activity.details || ''}
                                </p>
                            </div>
                        </div>
                    ))}
                    
                    {status.recentActivity.length === 0 && (
                        <p className="text-center text-gray-400 text-sm py-4">No recent activity</p>
                    )}
                </div>
            </div>
          </div>
      </div>
    </div>
  );
};

// Simple Clock Icon component
const ClockIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
    </svg>
);
import React, { useEffect, useState } from 'react';
import { MapPin, AlertTriangle, Home, Clock, X, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { ref, onValue, set } from 'firebase/database';
import { db } from '../services/firebase';
import type { GeofenceEvent } from '../types';

interface GeofenceAlertsPanelProps {
  householdId: string;
  seniorName?: string;
}

export const GeofenceAlertsPanel: React.FC<GeofenceAlertsPanelProps> = ({ householdId, seniorName = 'Senior' }) => {
  const [events, setEvents] = useState<GeofenceEvent[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(`safenest_dismissed_geofence_${householdId}`);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    if (!householdId) return;

    const eventsRef = ref(db, `households/${householdId}/geofenceEvents`);
    const unsub = onValue(eventsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list: GeofenceEvent[] = Object.values(data).map((e: any) => ({
          ...e,
          timestamp: new Date(e.timestamp),
        }));
        // Sort by timestamp descending (newest first)
        list.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        setEvents(list);
      } else {
        setEvents([]);
      }
    });

    return () => unsub();
  }, [householdId]);

  // Persist dismissed IDs
  useEffect(() => {
    localStorage.setItem(`safenest_dismissed_geofence_${householdId}`, JSON.stringify([...dismissedIds]));
  }, [dismissedIds, householdId]);

  const dismissEvent = (eventId: string) => {
    setDismissedIds((prev) => new Set(prev).add(eventId));
  };

  const clearAllDismissed = () => {
    setDismissedIds(new Set());
  };

  // Filter out dismissed events for display, but keep track of count
  const activeEvents = events.filter((e) => !dismissedIds.has(e.id));
  const recentEvents = activeEvents.slice(0, 10); // Show max 10 recent

  // Get events from the last 24 hours for urgent alerts
  const now = new Date();
  const urgentEvents = activeEvents.filter((e) => {
    const ageMs = now.getTime() - e.timestamp.getTime();
    return ageMs < 24 * 60 * 60 * 1000 && e.eventType === 'EXIT';
  });

  const formatTime = (date: Date) => {
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isToday) return `Today at ${timeStr}`;
    if (isYesterday) return `Yesterday at ${timeStr}`;
    return `${date.toLocaleDateString()} at ${timeStr}`;
  };

  if (events.length === 0) {
    return null; // Don't show panel if no events
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-4">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-gradient-to-r from-orange-50 to-red-50 border-b border-orange-100"
      >
        <div className="flex items-center gap-2">
          <MapPin size={20} className="text-orange-600" />
          <span className="font-semibold text-gray-900">Location Alerts</span>
          {urgentEvents.length > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
              {urgentEvents.length} new
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={20} className="text-gray-500" /> : <ChevronDown size={20} className="text-gray-500" />}
      </button>

      {expanded && (
        <div className="p-4">
          {/* Urgent EXIT alerts */}
          {urgentEvents.length > 0 && (
            <div className="space-y-2 mb-4">
              {urgentEvents.slice(0, 3).map((event) => (
                <div
                  key={event.id}
                  className={`p-3 rounded-xl border-2 flex items-start gap-3 ${
                    event.eventType === 'EXIT'
                      ? 'bg-red-50 border-red-300'
                      : 'bg-blue-50 border-blue-300'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    event.eventType === 'EXIT' ? 'bg-red-100' : 'bg-blue-100'
                  }`}>
                    {event.eventType === 'EXIT' ? (
                      <AlertTriangle size={20} className="text-red-600" />
                    ) : (
                      <Home size={20} className="text-blue-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-sm ${
                      event.eventType === 'EXIT' ? 'text-red-800' : 'text-blue-800'
                    }`}>
                      {event.eventType === 'EXIT' ? '🚨 Left' : '📍 Entered'} {event.geofenceName}
                    </p>
                    <p className={`text-xs mt-0.5 ${
                      event.eventType === 'EXIT' ? 'text-red-600' : 'text-blue-600'
                    }`}>
                      {seniorName} {event.eventType === 'EXIT' ? 'has left' : 'has entered'} the {event.geofenceName} zone
                    </p>
                    <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                      <Clock size={12} />
                      <span>{formatTime(event.timestamp)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => dismissEvent(event.id)}
                    className="p-1.5 hover:bg-white/50 rounded-full transition-colors"
                    title="Dismiss"
                  >
                    <X size={16} className="text-gray-400" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Recent events list */}
          {recentEvents.length > urgentEvents.length && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recent Activity</p>
              <div className="space-y-1">
                {recentEvents.filter((e) => !urgentEvents.includes(e)).slice(0, 5).map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg text-sm"
                  >
                    {event.eventType === 'EXIT' ? (
                      <AlertTriangle size={14} className="text-orange-500" />
                    ) : (
                      <Check size={14} className="text-green-500" />
                    )}
                    <span className="flex-1 text-gray-700">
                      {event.eventType === 'EXIT' ? 'Left' : 'Returned to'} {event.geofenceName}
                    </span>
                    <span className="text-xs text-gray-400">{formatTime(event.timestamp)}</span>
                    <button
                      onClick={() => dismissEvent(event.id)}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                    >
                      <X size={12} className="text-gray-400" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No active events */}
          {activeEvents.length === 0 && events.length > 0 && (
            <div className="text-center py-4">
              <Check size={24} className="mx-auto text-green-500 mb-2" />
              <p className="text-sm text-gray-600">All alerts dismissed</p>
              <button
                onClick={clearAllDismissed}
                className="text-xs text-blue-600 hover:underline mt-1"
              >
                Show history
              </button>
            </div>
          )}

          {/* Status indicator */}
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>📍 Geofence monitoring active</span>
            <span>{events.length} total events</span>
          </div>
        </div>
      )}
    </div>
  );
};

package com.safenest.app.geofence

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofencingEvent
import org.json.JSONObject

class GeofenceBroadcastReceiver : BroadcastReceiver() {
    
    private val TAG = "GeofenceReceiver"
    
    override fun onReceive(context: Context, intent: Intent) {
        val geofencingEvent = GeofencingEvent.fromIntent(intent)
        
        if (geofencingEvent == null) {
            Log.e(TAG, "GeofencingEvent is null")
            return
        }
        
        if (geofencingEvent.hasError()) {
            Log.e(TAG, "Geofencing error: ${geofencingEvent.errorCode}")
            return
        }
        
        val transitionType = geofencingEvent.geofenceTransition
        val triggeringGeofences = geofencingEvent.triggeringGeofences
        
        if (triggeringGeofences == null || triggeringGeofences.isEmpty()) {
            Log.w(TAG, "No triggering geofences")
            return
        }
        
        val prefs = context.getSharedPreferences("safenest_geofences", Context.MODE_PRIVATE)
        
        for (geofence in triggeringGeofences) {
            val fenceId = geofence.requestId
            val storedData = prefs.getString("fence_$fenceId", null)
            val label = if (storedData != null) {
                try {
                    JSONObject(storedData).optString("label", "Safe Zone")
                } catch (e: Exception) {
                    "Safe Zone"
                }
            } else "Safe Zone"
            
            when (transitionType) {
                Geofence.GEOFENCE_TRANSITION_ENTER -> {
                    Log.d(TAG, "✓ ENTERED geofence: $label")
                    showNotification(context, "Entered Safe Zone", "$label - You have entered this area", fenceId, "enter")
                    GeofencePlugin.notifyGeofenceEvent("enter", fenceId, label)
                }
                Geofence.GEOFENCE_TRANSITION_EXIT -> {
                    Log.d(TAG, "⚠️ EXITED geofence: $label")
                    showNotification(context, "⚠️ Left Safe Zone", "$label - You have left this safe area. Caregiver has been notified.", fenceId, "exit")
                    GeofencePlugin.notifyGeofenceEvent("exit", fenceId, label)
                    // Also send alert to Firebase for caregiver notification
                    sendCaregiverAlert(context, fenceId, label)
                }
                else -> {
                    Log.w(TAG, "Unknown transition type: $transitionType")
                }
            }
        }
    }
    
    private fun showNotification(context: Context, title: String, message: String, fenceId: String, type: String) {
        val channelId = "geofence_alerts"
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        
        // Create notification channel
        val channel = NotificationChannel(
            channelId,
            "Geofence Alerts",
            if (type == "exit") NotificationManager.IMPORTANCE_HIGH else NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "Alerts when entering or leaving safe zones"
            enableVibration(type == "exit")
            if (type == "exit") {
                vibrationPattern = longArrayOf(500, 200, 500, 200, 500)
            }
        }
        nm.createNotificationChannel(channel)
        
        // Open app intent
        val openAppIntent = Intent(context, com.safenest.app.MainActivity::class.java).apply {
            putExtra("geofence_alert", true)
            putExtra("fence_id", fenceId)
            putExtra("transition_type", type)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            fenceId.hashCode(),
            openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        
        val notification = NotificationCompat.Builder(context, channelId)
            .setContentTitle(title)
            .setContentText(message)
            .setSmallIcon(if (type == "exit") android.R.drawable.stat_sys_warning else android.R.drawable.ic_menu_mylocation)
            .setPriority(if (type == "exit") NotificationCompat.PRIORITY_HIGH else NotificationCompat.PRIORITY_DEFAULT)
            .setCategory(if (type == "exit") NotificationCompat.CATEGORY_ALARM else NotificationCompat.CATEGORY_STATUS)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .build()
        
        nm.notify(fenceId.hashCode(), notification)
    }
    
    private fun sendCaregiverAlert(context: Context, fenceId: String, label: String) {
        // Store the exit event for the app to sync to Firebase when it opens
        val prefs = context.getSharedPreferences("safenest_geofence_events", Context.MODE_PRIVATE)
        val events = prefs.getString("pending_events", "[]")
        try {
            val eventsArray = org.json.JSONArray(events)
            eventsArray.put(JSONObject().apply {
                put("type", "exit")
                put("fenceId", fenceId)
                put("label", label)
                put("timestamp", System.currentTimeMillis())
            })
            prefs.edit().putString("pending_events", eventsArray.toString()).apply()
            Log.d(TAG, "Stored exit event for Firebase sync")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to store exit event", e)
        }
    }
}

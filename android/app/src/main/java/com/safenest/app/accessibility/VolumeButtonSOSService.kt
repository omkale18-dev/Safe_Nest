package com.safenest.app.accessibility

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.util.Log
import android.view.KeyEvent
import android.view.accessibility.AccessibilityEvent
import androidx.core.app.NotificationCompat

/**
 * Accessibility Service for detecting volume button presses for SOS.
 * Press volume UP or DOWN 3 times rapidly to trigger emergency SOS.
 * 
 * Note: User must manually enable this in Settings > Accessibility > SafeNest SOS
 */
class VolumeButtonSOSService : AccessibilityService() {
    
    private val TAG = "VolumeButtonSOS"
    
    // Track volume button presses
    private var volumePressCount = 0
    private var lastVolumePressTime = 0L
    private val PRESS_TIMEOUT_MS = 2000L // Must press 3 times within 2 seconds
    private val REQUIRED_PRESSES = 3
    
    // Cooldown to prevent repeated triggers
    private var lastSOSTriggerTime = 0L
    private val SOS_COOLDOWN_MS = 30000L // 30 second cooldown
    
    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.d(TAG, "✓ Volume Button SOS Service connected")
        
        val info = AccessibilityServiceInfo().apply {
            eventTypes = AccessibilityEvent.TYPES_ALL_MASK
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            flags = AccessibilityServiceInfo.FLAG_REQUEST_FILTER_KEY_EVENTS
            notificationTimeout = 100
        }
        serviceInfo = info
    }
    
    override fun onKeyEvent(event: KeyEvent): Boolean {
        // Only handle volume buttons
        if (event.keyCode != KeyEvent.KEYCODE_VOLUME_UP && 
            event.keyCode != KeyEvent.KEYCODE_VOLUME_DOWN) {
            return super.onKeyEvent(event)
        }
        
        // Only count key down events
        if (event.action != KeyEvent.ACTION_DOWN) {
            return super.onKeyEvent(event)
        }
        
        val now = System.currentTimeMillis()
        
        // Check cooldown
        if (now - lastSOSTriggerTime < SOS_COOLDOWN_MS) {
            return super.onKeyEvent(event)
        }
        
        // Check if within press window
        if (now - lastVolumePressTime > PRESS_TIMEOUT_MS) {
            volumePressCount = 0
        }
        
        volumePressCount++
        lastVolumePressTime = now
        
        Log.d(TAG, "Volume button press count: $volumePressCount")
        
        if (volumePressCount >= REQUIRED_PRESSES) {
            Log.d(TAG, "🆘 SOS TRIGGERED via volume buttons!")
            volumePressCount = 0
            lastSOSTriggerTime = now
            triggerSOS()
            return true // Consume the event
        }
        
        return super.onKeyEvent(event)
    }
    
    private fun triggerSOS() {
        // Launch the app with SOS intent
        val intent = Intent(this, com.safenest.app.MainActivity::class.java).apply {
            action = "com.safenest.app.PANIC_SOS"
            putExtra("triggerSOS", true)
            putExtra("source", "volume_button")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        startActivity(intent)
        
        // Also show a notification
        showSOSNotification()
    }
    
    private fun showSOSNotification() {
        val channelId = "sos_volume_button"
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        
        val channel = NotificationChannel(
            channelId,
            "Volume Button SOS",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Emergency SOS triggered by volume buttons"
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 500, 200, 500, 200, 500)
        }
        nm.createNotificationChannel(channel)
        
        val notification = NotificationCompat.Builder(this, channelId)
            .setContentTitle("🆘 Emergency SOS Activated")
            .setContentText("SOS triggered via volume buttons. Opening app...")
            .setSmallIcon(android.R.drawable.stat_sys_warning)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setAutoCancel(true)
            .build()
        
        nm.notify(8888, notification)
    }
    
    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Not used, we only care about key events
    }
    
    override fun onInterrupt() {
        Log.d(TAG, "Volume Button SOS Service interrupted")
    }
    
    override fun onDestroy() {
        Log.d(TAG, "Volume Button SOS Service destroyed")
        super.onDestroy()
    }
}

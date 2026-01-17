package com.safenest.app.falldetection

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.IBinder
import androidx.core.app.NotificationCompat
import kotlin.math.sqrt

// Fall detection using accelerometer only (simpler + more stable across devices)
class FallDetectionService : Service(), SensorEventListener {
    private lateinit var sensorManager: SensorManager
    private var accelSensor: Sensor? = null

    // Sensitivity levels: LOW, MEDIUM, HIGH
    private var sensitivityLevel = "MEDIUM"

    // Thresholds for real fall detection
    // Free fall: acceleration near 0 (phone falling through air)
    // Impact: sudden spike when hitting ground
    private var freeFallThreshold = 3.0f // m/s² - detect free fall (close to 0g) - lowered for better sensitivity
    private var impactThreshold = 20.0f // m/s² - detect impact after free fall - lowered for better sensitivity
    private var freeFallMinDuration = 150L // Minimum 150ms of free fall - lowered to catch shorter falls
    private var impactWindowMs = 2500L // Impact must occur within 2.5s of free fall - increased window

    // Sensor data buffers
    private val accelBuffer = FloatArray(3)

    private var freeFallStartTime = 0L
    private var lastImpactTime = 0L
    private var lastFallTime = 0L
    private val fallCooldownMs = 30000L // 30 second cooldown between falls to prevent infinite loop

    override fun onCreate() {
        super.onCreate()
        android.util.Log.d("FallDetection", "========================================")
        android.util.Log.d("FallDetection", "✓✓✓ SERVICE ONCREATE CALLED ✓✓✓")
        android.util.Log.d("FallDetection", "========================================")
        
        sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
        
        // Get all sensors
        accelSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
        android.util.Log.d("FallDetection", "Accelerometer sensor: ${if (accelSensor != null) "FOUND" else "NOT FOUND"}")

        // Load sensitivity preference
        loadSensitivityLevel()
        
        android.util.Log.d("FallDetection", "Starting foreground notification...")
        startForegroundWithNotification()
        android.util.Log.d("FallDetection", "✓ Foreground notification started")
        
        // Register accelerometer only
        accelSensor?.also {
            val registered = sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME)
            android.util.Log.d("FallDetection", "Sensor listener registered: $registered")
        }
        
        android.util.Log.d("FallDetection", "✓ SERVICE STARTED SUCCESSFULLY")
    }

    override fun onDestroy() {
        sensorManager.unregisterListener(this)
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onSensorChanged(event: SensorEvent) {
        when (event.sensor.type) {
            Sensor.TYPE_ACCELEROMETER -> {
                accelBuffer[0] = event.values[0]
                accelBuffer[1] = event.values[1]
                accelBuffer[2] = event.values[2]
                
                // Calculate acceleration magnitude
                val accelMag = sqrt(
                    accelBuffer[0] * accelBuffer[0] +
                    accelBuffer[1] * accelBuffer[1] +
                    accelBuffer[2] * accelBuffer[2]
                )

                val now = System.currentTimeMillis()
                
                // PHASE 1: Detect free fall (acceleration near 0 as phone falls through air)
                if (accelMag < freeFallThreshold) {
                    if (freeFallStartTime == 0L) {
                        freeFallStartTime = now
                        android.util.Log.d("FallDetection", "🪂 Free fall started: ${accelMag.toInt()} m/s²")
                    }
                } else {
                    // Reset free fall if acceleration returns to normal (not falling anymore)
                    if (freeFallStartTime != 0L && accelMag < impactThreshold) {
                        android.util.Log.d("FallDetection", "Free fall ended without impact")
                        freeFallStartTime = 0L
                    }
                }

                // PHASE 2: Detect impact after free fall
                if (accelMag > impactThreshold && freeFallStartTime != 0L) {
                    val freeFallDuration = now - freeFallStartTime
                    
                    android.util.Log.d("FallDetection", "⚠️ IMPACT: ${accelMag.toInt()} m/s² after ${freeFallDuration}ms free fall")
                    
                    // Must have free fall for minimum duration and within time window
                    if (freeFallDuration >= freeFallMinDuration && freeFallDuration <= impactWindowMs) {
                        // Only trigger if enough time passed since last fall (cooldown)
                        if ((now - lastFallTime) > fallCooldownMs) {
                            android.util.Log.d("FallDetection", "🚨 FALL DETECTED! Free fall: ${freeFallDuration}ms, Impact: ${accelMag.toInt()} m/s²")
                            lastFallTime = now
                            notifyFall()
                            FallDetectionPlugin.notifyFallToJs()
                        }
                    }
                    
                    // Reset free fall tracking
                    freeFallStartTime = 0L
                }
            }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
        // No-op
    }
    
    private fun loadSensitivityLevel() {
        // Try reading from Capacitor Preferences first (key: fall_detection_sensitivity)
        // Capacitor stores in "CapacitorStorage" shared preferences
        var prefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE)
        var storedValue = prefs.getString("fall_detection_sensitivity", null)
        
        // If not found, check old safenest_settings location
        if (storedValue == null) {
            prefs = getSharedPreferences("safenest_settings", Context.MODE_PRIVATE)
            storedValue = prefs.getString("fall_detection_sensitivity", null)
        }
        
        sensitivityLevel = storedValue ?: "LOW"
        
        // Update thresholds based on sensitivity
        // Free fall threshold stays constant (near 0g during free fall)
        // Impact threshold varies by sensitivity
        freeFallThreshold = 3.0f // Always detect free fall (< 3 m/s² is in free fall) - improved sensitivity
        
        impactThreshold = when (sensitivityLevel) {
            "HIGH" -> 15.0f // More sensitive - detects softer impacts
            "MEDIUM" -> 20.0f // Standard - requires moderate impact (improved)
            "LOW" -> 28.0f // Less sensitive - only hard impacts
            else -> 28.0f // Default to LOW sensitivity
        }
        
        android.util.Log.d("FallDetection", "✓ Loaded sensitivity: $sensitivityLevel, free fall: $freeFallThreshold m/s², impact: $impactThreshold m/s²")
    }

    private fun startForegroundWithNotification() {
        val channelId = "fall_detection_service"
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(
            NotificationChannel(
                channelId,
                "Fall Detection Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply { setSound(null, null) }
        )

        val notification = NotificationCompat.Builder(this, channelId)
            .setContentTitle("Safenest fall detection")
            .setContentText("Monitoring for falls")
            .setSmallIcon(android.R.drawable.stat_notify_more)
            .setOngoing(true)
            .build()

        startForeground(42, notification)
    }

    private fun notifyFall() {
        val channelId = "emergency_alerts_v2"
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(
            NotificationChannel(
                channelId,
                "Emergency Alerts",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                enableVibration(true)
                vibrationPattern = longArrayOf(500, 200, 500, 200, 500)
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            }
        )
        
        // Create EXPLICIT intents for action buttons - must specify component class
        val imOkIntent = Intent(this, FallActionReceiver::class.java).apply {
            action = "com.safenest.app.ACTION_IM_OK"
        }
        val imOkPendingIntent = PendingIntent.getBroadcast(
            this,
            100,
            imOkIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )
        
        val needHelpIntent = Intent(this, FallActionReceiver::class.java).apply {
            action = "com.safenest.app.ACTION_NEED_HELP"
        }
        val needHelpPendingIntent = PendingIntent.getBroadcast(
            this,
            101,
            needHelpIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )
        
        // Open app intent (when notification body is tapped)
        val openAppIntent = Intent(this, com.safenest.app.MainActivity::class.java).apply {
            putExtra("fall_detected", true)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        val openAppPendingIntent = PendingIntent.getActivity(
            this,
            102,
            openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        
        val notification = NotificationCompat.Builder(this, channelId)
            .setContentTitle("⚠️ Fall Detected - Are You Okay?")
            .setContentText("Tap to respond. Emergency alert in 15 seconds.")
            .setStyle(NotificationCompat.BigTextStyle()
                .bigText("A possible fall was detected. Please respond:\n\n• Tap 'I'm OK' if you're fine\n• Tap 'Need Help' for immediate assistance\n\nIf no response in 15 seconds, emergency contacts will be alerted."))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setSmallIcon(android.R.drawable.stat_sys_warning)
            .setAutoCancel(false)
            .setOngoing(true)
            .setContentIntent(openAppPendingIntent)
            .setFullScreenIntent(openAppPendingIntent, true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .addAction(
                android.R.drawable.ic_menu_close_clear_cancel,
                "✓ I'm OK",
                imOkPendingIntent
            )
            .addAction(
                android.R.drawable.ic_menu_call,
                "🆘 Need Help",
                needHelpPendingIntent
            )
            .build()
        nm.notify(1337, notification)
    }
}
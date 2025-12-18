package com.safenest.app.falldetection

import android.app.NotificationChannel
import android.app.NotificationManager
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

// Foreground service that keeps accelerometer sampling alive even when the app is backgrounded/locked.
class FallDetectionService : Service(), SensorEventListener {
    private lateinit var sensorManager: SensorManager
    private var accelSensor: Sensor? = null

    // Basic heuristic thresholds; tune per device after field testing.
    private val impactThreshold = 22.0f // m/s^2 (roughly 2.2g)
    private val inactivityWindowMs = 2500L
    private var lastImpactTime = 0L

    override fun onCreate() {
        super.onCreate()
        sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
        accelSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
        startForegroundWithNotification()
        accelSensor?.also {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME)
        }
    }

    override fun onDestroy() {
        sensorManager.unregisterListener(this)
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onSensorChanged(event: SensorEvent) {
        val ax = event.values[0]
        val ay = event.values[1]
        val az = event.values[2]
        val mag = sqrt(ax * ax + ay * ay + az * az)

        val now = System.currentTimeMillis()
        if (mag > impactThreshold) {
            lastImpactTime = now
        }

        // After an impact, look for inactivity suggesting a fall.
        if (lastImpactTime != 0L && (now - lastImpactTime) in 600..inactivityWindowMs) {
            lastImpactTime = 0L
            notifyFall()
            FallDetectionPlugin.notifyFallToJs()
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
        // No-op
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
            }
        )
        val notification = NotificationCompat.Builder(this, channelId)
            .setContentTitle("Possible fall detected")
            .setContentText("Tap to open Safenest")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setSmallIcon(android.R.drawable.stat_sys_warning)
            .setAutoCancel(true)
            .build()
        nm.notify(1337, notification)
    }
}
package com.safenest.app.falldetection;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

public class FallDetectionService extends Service implements SensorEventListener {
    private static final String TAG = "FallDetection";

    private static final float IMPACT_THRESHOLD = 40.0f;
    private static final float LOW_ACCELERATION_THRESHOLD = 5.0f;
    private static final long INACTIVITY_WINDOW_MS = 1000L;
    private static final long ESCALATION_DELAY_MS = 15_000L;
    private static final long COOLDOWN_MS = 5_000L; // 15 seconds
    private static final String ACTION_FALL_ACK = "com.safenest.app.ACTION_FALL_ACK";
    private static final int ALERT_NOTIFICATION_ID = 1337;

    private SensorManager sensorManager;
    private Sensor accelSensor;
    private PowerManager.WakeLock wakeLock;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private Runnable escalationTask;
    private long lastImpactTime = 0L;
    private long lastAlertTime = 0L;
    private boolean waitingForResponse = false;

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "onCreate");

        sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            accelSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
            if (accelSensor != null) {
                try {
                    // Use GAME sampling to avoid high-sampling-rate permission issues while staying responsive
                    sensorManager.registerListener(this, accelSensor, SensorManager.SENSOR_DELAY_GAME);
                    Log.d(TAG, "Accelerometer registered (GAME rate)");
                } catch (SecurityException se) {
                    Log.e(TAG, "Sensor registration failed; falling back to NORMAL", se);
                    try {
                        sensorManager.registerListener(this, accelSensor, SensorManager.SENSOR_DELAY_NORMAL);
                        Log.d(TAG, "Accelerometer registered (NORMAL rate fallback)");
                    } catch (Exception e) {
                        Log.e(TAG, "Accelerometer registration failed", e);
                    }
                }
            } else {
                Log.e(TAG, "Accelerometer not found");
            }
        }

        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "FallDetection::wakelock");
            wakeLock.acquire();
            Log.d(TAG, "WakeLock acquired");
        }

        startForegroundWithNotification();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_FALL_ACK.equals(intent.getAction())) {
            Log.d(TAG, "User acknowledged they're OK");
            waitingForResponse = false;
            cancelEscalation();
            cancelAlertNotification();
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        Log.d(TAG, "onDestroy");
        if (sensorManager != null) {
            sensorManager.unregisterListener(this);
        }
        cancelEscalation();
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
            Log.d(TAG, "WakeLock released");
        }
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        float ax = event.values[0];
        float ay = event.values[1];
        float az = event.values[2];
        float mag = (float) Math.sqrt(ax * ax + ay * ay + az * az);

        long now = System.currentTimeMillis();

        if (mag > IMPACT_THRESHOLD && !waitingForResponse) {
            // Enforce cooldown period to avoid repeated alerts
            if (now - lastAlertTime < COOLDOWN_MS) {
                Log.d(TAG, "Impact ignored (cooldown): " + mag);
                return;
            }
            lastImpactTime = now;
            lastAlertTime = now;
            waitingForResponse = true;
            Log.d(TAG, "Impact detected: " + mag);
            notifyFall();
            return;
        }

        if (waitingForResponse && lastImpactTime > 0) {
            long dt = now - lastImpactTime;
            if (dt <= INACTIVITY_WINDOW_MS && mag < LOW_ACCELERATION_THRESHOLD) {
                Log.d(TAG, "Low movement after impact: " + mag);
            }
            if (dt > INACTIVITY_WINDOW_MS) {
                lastImpactTime = 0L;
            }
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) { }

    private void startForegroundWithNotification() {
        String channelId = "fall_detection_service";
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            NotificationChannel channel = new NotificationChannel(
                channelId,
                "Fall Detection Service",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setSound(null, null);
            nm.createNotificationChannel(channel);
        }

        Notification notification = new NotificationCompat.Builder(this, channelId)
            .setContentTitle("SafeNest fall detection active")
            .setContentText("Monitoring for falls")
            .setSmallIcon(android.R.drawable.stat_notify_more)
            .setOngoing(true)
            .build();

        startForeground(42, notification);
    }

    private void notifyFall() {
        Log.d(TAG, "notifyFall: showing check-in");
        cancelEscalation();
        
        // Notify JavaScript immediately so app can show countdown screen
        FallDetectionPlugin.notifyFallToJs();
        Log.d(TAG, "JS event sent");
        
        showCheckInNotification();
        scheduleEscalation();
    }

    private void showCheckInNotification() {
        String channelId = "emergency_alerts_v2";
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) {
            Log.e(TAG, "NotificationManager is null");
            return;
        }

        NotificationChannel channel = new NotificationChannel(
            channelId,
            "Emergency Alerts",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[]{300, 150, 300});
        channel.setShowBadge(true);
        channel.setSound(null, null);
        nm.createNotificationChannel(channel);

        Intent ackIntent = new Intent(this, FallDetectionService.class).setAction(ACTION_FALL_ACK);
        PendingIntent ackPendingIntent = PendingIntent.getService(
            this,
            2001,
            ackIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification notification = new NotificationCompat.Builder(this, channelId)
            .setContentTitle("Are you okay?")
            .setContentText("Tap 'I'm OK' within 15 seconds to cancel")
            .setSmallIcon(android.R.drawable.stat_sys_warning)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setAutoCancel(true)
            .addAction(android.R.drawable.checkbox_on_background, "I'm OK", ackPendingIntent)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build();

        nm.notify(ALERT_NOTIFICATION_ID, notification);
        Log.d(TAG, "Check-in notification shown");
    }

    private void sendEmergencyNotification() {
        String channelId = "emergency_alerts_v2";
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) {
            Log.e(TAG, "NotificationManager is null");
            return;
        }

        NotificationChannel channel = new NotificationChannel(
            channelId,
            "Emergency Alerts",
            NotificationManager.IMPORTANCE_MAX
        );
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[]{500, 200, 500, 200, 500});
        channel.setShowBadge(true);
        channel.setSound(null, null);
        nm.createNotificationChannel(channel);

        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (launchIntent == null) {
            Log.e(TAG, "Launch intent null");
            return;
        }

        launchIntent.setFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK |
            Intent.FLAG_ACTIVITY_CLEAR_TOP |
            Intent.FLAG_ACTIVITY_SINGLE_TOP
        );
        launchIntent.putExtra("fall_detected", true);

        PendingIntent contentIntent = PendingIntent.getActivity(
            this,
            ALERT_NOTIFICATION_ID,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification notification = new NotificationCompat.Builder(this, channelId)
            .setContentTitle("⚠️ FALL DETECTED!")
            .setContentText("No response. Emergency alert sent.")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setSmallIcon(android.R.drawable.stat_sys_warning)
            .setAutoCancel(true)
            .setContentIntent(contentIntent)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setFullScreenIntent(contentIntent, true)
            .build();

        nm.notify(ALERT_NOTIFICATION_ID, notification);
        Log.d(TAG, "Emergency notification sent");
    }

    private void scheduleEscalation() {
        escalationTask = () -> {
            Log.d(TAG, "No response within window. Escalating.");
            waitingForResponse = false;
            FallDetectionPlugin.notifyFallToJs();
            launchApp();
            sendEmergencyNotification();
        };
        handler.postDelayed(escalationTask, ESCALATION_DELAY_MS);
    }

    private void cancelEscalation() {
        if (escalationTask != null) {
            handler.removeCallbacks(escalationTask);
            escalationTask = null;
        }
    }

    private void cancelAlertNotification() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.cancel(ALERT_NOTIFICATION_ID);
        }
    }

    private void launchApp() {
        try {
            Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
            if (launchIntent == null) {
                Log.e(TAG, "Launch intent null");
                return;
            }
            launchIntent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK |
                Intent.FLAG_ACTIVITY_CLEAR_TOP |
                Intent.FLAG_ACTIVITY_SINGLE_TOP |
                Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED
            );
            launchIntent.putExtra("fall_detected", true);
            startActivity(launchIntent);
            Log.d(TAG, "App launch intent sent");
        } catch (Exception e) {
            Log.e(TAG, "Error launching app", e);
        }
    }
}


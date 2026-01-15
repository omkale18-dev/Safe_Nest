package com.safenest.app.reminders;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.speech.tts.TextToSpeech;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.safenest.app.MainActivity;
import com.safenest.app.R;

import java.util.Locale;

/**
 * BroadcastReceiver that handles scheduled medicine reminders.
 * This works even when the app is in background or killed.
 */
public class MedicineReminderReceiver extends BroadcastReceiver {
    private static final String TAG = "MedicineReminder";
    
    public static final String CHANNEL_MEDICINE = "medicine_reminders";
    public static final String CHANNEL_CRITICAL = "critical_medicine";
    
    public static final String EXTRA_MEDICINE_ID = "medicine_id";
    public static final String EXTRA_MEDICINE_NAME = "medicine_name";
    public static final String EXTRA_DOSAGE = "dosage";
    public static final String EXTRA_SCHEDULED_TIME = "scheduled_time";
    public static final String EXTRA_IS_CRITICAL = "is_critical";
    public static final String EXTRA_INSTRUCTIONS = "instructions";
    public static final String EXTRA_VOICE_ENABLED = "voice_enabled";
    
    private TextToSpeech tts;

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.d(TAG, "========== Medicine reminder received ==========");
        
        // Acquire wake lock to ensure device stays awake during notification
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = pm.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
            "SafeNest:MedicineReminder"
        );
        wakeLock.acquire(60 * 1000L); // 1 minute max
        
        try {
            processReminder(context, intent);
        } finally {
            if (wakeLock.isHeld()) {
                wakeLock.release();
            }
        }
    }
    
    private void processReminder(Context context, Intent intent) {
        String medicineId = intent.getStringExtra(EXTRA_MEDICINE_ID);
        String medicineName = intent.getStringExtra(EXTRA_MEDICINE_NAME);
        String dosage = intent.getStringExtra(EXTRA_DOSAGE);
        String scheduledTime = intent.getStringExtra(EXTRA_SCHEDULED_TIME);
        boolean isCritical = intent.getBooleanExtra(EXTRA_IS_CRITICAL, false);
        String instructions = intent.getStringExtra(EXTRA_INSTRUCTIONS);
        boolean voiceEnabled = intent.getBooleanExtra(EXTRA_VOICE_ENABLED, true);
        
        Log.d(TAG, "Medicine: " + medicineName + ", Time: " + scheduledTime + ", Critical: " + isCritical);
        
        if (medicineName == null) {
            Log.e(TAG, "Medicine name is null, ignoring");
            return;
        }
        
        createNotificationChannels(context);
        showMedicineNotification(context, medicineId, medicineName, dosage, scheduledTime, isCritical, instructions);
        
        // Vibrate to get attention
        vibrateDevice(context, isCritical);
        
        // Speak the reminder if voice is enabled
        if (voiceEnabled) {
            speakReminder(context, medicineName, dosage, isCritical);
        }
        
        // Schedule follow-up check in 30 minutes (for missed medicine detection)
        MissedMedicineReceiver.scheduleFollowUp(context, medicineId, medicineName, dosage, 
                                                 scheduledTime, isCritical, voiceEnabled);
        
        // CRITICAL: Re-schedule this alarm for tomorrow (since setExact is one-time)
        rescheduleForTomorrow(context, medicineId, medicineName, dosage, scheduledTime, 
                              isCritical, instructions, voiceEnabled);
    }
    
    /**
     * Re-schedule the alarm for the next day (setExact alarms are one-time only)
     */
    private void rescheduleForTomorrow(Context context, String medicineId, String medicineName,
                                        String dosage, String scheduledTime, boolean isCritical,
                                        String instructions, boolean voiceEnabled) {
        try {
            MedicineReminderScheduler scheduler = new MedicineReminderScheduler(context);
            scheduler.scheduleReminder(medicineId, medicineName, dosage, scheduledTime, 
                                        isCritical, instructions, voiceEnabled);
            Log.d(TAG, "Re-scheduled alarm for tomorrow: " + medicineName + " at " + scheduledTime);
        } catch (Exception e) {
            Log.e(TAG, "Failed to re-schedule alarm for tomorrow", e);
        }
    }
    
    /**
     * Speak the medicine reminder using Text-to-Speech
     */
    private void speakReminder(Context context, String medicineName, String dosage, boolean isCritical) {
        tts = new TextToSpeech(context, status -> {
            if (status == TextToSpeech.SUCCESS) {
                int result = tts.setLanguage(Locale.US);
                if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                    // Try default locale
                    tts.setLanguage(Locale.getDefault());
                }
                
                // Build the speech text
                StringBuilder speechText = new StringBuilder();
                if (isCritical) {
                    speechText.append("Attention! Critical medication alert. ");
                } else {
                    speechText.append("Medicine reminder. ");
                }
                speechText.append("Time to take ").append(medicineName);
                if (dosage != null && !dosage.isEmpty()) {
                    speechText.append(", ").append(dosage);
                }
                speechText.append(".");
                
                Log.d(TAG, "Speaking: " + speechText.toString());
                
                // Speak with higher priority for critical medicines
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    tts.speak(speechText.toString(), TextToSpeech.QUEUE_FLUSH, null, "medicine_reminder");
                } else {
                    tts.speak(speechText.toString(), TextToSpeech.QUEUE_FLUSH, null);
                }
                
                // Shutdown TTS after speaking (delayed to allow speech to complete)
                new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                    if (tts != null) {
                        tts.stop();
                        tts.shutdown();
                        tts = null;
                    }
                }, 5000); // 5 seconds should be enough for the speech
            } else {
                Log.e(TAG, "TTS initialization failed");
            }
        });
    }
    
    private void createNotificationChannels(Context context) {
        createNotificationChannelsStatic(context);
    }
    
    /**
     * Public static method to create notification channels from MainActivity
     */
    public static void createNotificationChannelsStatic(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = context.getSystemService(NotificationManager.class);
            
            // Regular medicine channel with notification sound
            NotificationChannel medicineChannel = new NotificationChannel(
                CHANNEL_MEDICINE,
                "Medicine Reminders",
                NotificationManager.IMPORTANCE_HIGH
            );
            medicineChannel.setDescription("Daily medication reminders");
            medicineChannel.enableVibration(true);
            medicineChannel.setVibrationPattern(new long[]{0, 300, 200, 300});
            medicineChannel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
            // Use notification sound for regular reminders
            Uri notificationSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            AudioAttributes notifAudioAttr = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
            medicineChannel.setSound(notificationSound, notifAudioAttr);
            medicineChannel.enableLights(true);
            medicineChannel.setLightColor(0xFF00FF00); // Green light
            manager.createNotificationChannel(medicineChannel);
            
            // Critical medicine channel (louder)
            NotificationChannel criticalChannel = new NotificationChannel(
                CHANNEL_CRITICAL,
                "Critical Medicine Alerts",
                NotificationManager.IMPORTANCE_HIGH
            );
            criticalChannel.setDescription("Important medications that must not be missed");
            criticalChannel.enableVibration(true);
            criticalChannel.setVibrationPattern(new long[]{0, 500, 200, 500, 200, 500});
            criticalChannel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
            // Use alarm sound for critical
            Uri alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
            criticalChannel.setSound(alarmSound, audioAttributes);
            manager.createNotificationChannel(criticalChannel);
        }
    }
    
    private void showMedicineNotification(Context context, String medicineId, String medicineName, 
                                          String dosage, String scheduledTime, boolean isCritical,
                                          String instructions) {
        // Check notification permission on Android 13+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(context, android.Manifest.permission.POST_NOTIFICATIONS) 
                    != PackageManager.PERMISSION_GRANTED) {
                Log.e(TAG, "❌ POST_NOTIFICATIONS permission not granted! Cannot show notification.");
                return;
            }
        }
        
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        
        // Intent to open app when notification clicked
        Intent openIntent = new Intent(context, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        openIntent.putExtra("navigate_to", "medicine");
        openIntent.putExtra(EXTRA_MEDICINE_ID, medicineId);
        openIntent.putExtra(EXTRA_SCHEDULED_TIME, scheduledTime);
        
        PendingIntent openPendingIntent = PendingIntent.getActivity(
            context, 
            medicineId.hashCode(), 
            openIntent, 
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        
        // Action: Mark as Taken
        Intent takenIntent = new Intent(context, MedicineActionReceiver.class);
        takenIntent.setAction("ACTION_TAKEN");
        takenIntent.putExtra(EXTRA_MEDICINE_ID, medicineId);
        takenIntent.putExtra(EXTRA_SCHEDULED_TIME, scheduledTime);
        PendingIntent takenPendingIntent = PendingIntent.getBroadcast(
            context,
            ("taken_" + medicineId + scheduledTime).hashCode(),
            takenIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        
        // Action: Snooze 15min
        Intent snoozeIntent = new Intent(context, MedicineActionReceiver.class);
        snoozeIntent.setAction("ACTION_SNOOZE");
        snoozeIntent.putExtra(EXTRA_MEDICINE_ID, medicineId);
        snoozeIntent.putExtra(EXTRA_MEDICINE_NAME, medicineName);
        snoozeIntent.putExtra(EXTRA_DOSAGE, dosage);
        snoozeIntent.putExtra(EXTRA_SCHEDULED_TIME, scheduledTime);
        snoozeIntent.putExtra(EXTRA_IS_CRITICAL, isCritical);
        snoozeIntent.putExtra(EXTRA_INSTRUCTIONS, instructions);
        PendingIntent snoozePendingIntent = PendingIntent.getBroadcast(
            context,
            ("snooze_" + medicineId + scheduledTime).hashCode(),
            snoozeIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        
        // Action: Skip
        Intent skipIntent = new Intent(context, MedicineActionReceiver.class);
        skipIntent.setAction("ACTION_SKIP");
        skipIntent.putExtra(EXTRA_MEDICINE_ID, medicineId);
        skipIntent.putExtra(EXTRA_SCHEDULED_TIME, scheduledTime);
        PendingIntent skipPendingIntent = PendingIntent.getBroadcast(
            context,
            ("skip_" + medicineId + scheduledTime).hashCode(),
            skipIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        
        // Build notification
        String channel = isCritical ? CHANNEL_CRITICAL : CHANNEL_MEDICINE;
        String title = isCritical ? "🔴 CRITICAL: " + medicineName : "💊 " + medicineName;
        String body = dosage + " at " + scheduledTime;
        if (instructions != null && !instructions.isEmpty()) {
            body += "\n" + instructions;
        }
        
        // Get appropriate sound
        Uri soundUri = isCritical 
            ? RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            : RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channel)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(isCritical ? NotificationCompat.PRIORITY_MAX : NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setContentIntent(openPendingIntent)
            .addAction(android.R.drawable.ic_menu_view, "✓ Taken", takenPendingIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "✗ Skip", skipPendingIntent)
            .setSound(soundUri)
            .setDefaults(NotificationCompat.DEFAULT_LIGHTS)
            .setOngoing(false)
            .setShowWhen(true);
        
        if (isCritical) {
            builder.setFullScreenIntent(openPendingIntent, true);
        }
        
        // Unique notification ID based on medicine and time
        int notificationId = (medicineId + scheduledTime).hashCode();
        manager.notify(notificationId, builder.build());
        
        Log.d(TAG, "========== Notification Displayed ==========");
        Log.d(TAG, "Medicine: " + medicineName + " at " + scheduledTime);
        Log.d(TAG, "Critical: " + isCritical);
        Log.d(TAG, "Channel: " + channel);
        Log.d(TAG, "Notification ID: " + notificationId);
        Log.d(TAG, "Actions: ✓ Taken, ✗ Skip");
        Log.d(TAG, "==========================================");
    }
    
    private void vibrateDevice(Context context, boolean isCritical) {
        Vibrator vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
        if (vibrator == null || !vibrator.hasVibrator()) return;
        
        long[] pattern = isCritical 
            ? new long[]{0, 500, 200, 500, 200, 500, 200, 500} 
            : new long[]{0, 300, 200, 300};
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1));
        } else {
            vibrator.vibrate(pattern, -1);
        }
    }
}

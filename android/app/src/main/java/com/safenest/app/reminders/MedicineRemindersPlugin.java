package com.safenest.app.reminders;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Capacitor Plugin to schedule medicine reminders from JavaScript
 */
@CapacitorPlugin(name = "MedicineReminders")
public class MedicineRemindersPlugin extends Plugin {
    private static final String TAG = "MedicineRemindersPlugin";
    private MedicineReminderScheduler scheduler;
    
    @Override
    public void load() {
        scheduler = new MedicineReminderScheduler(getContext());
    }
    
    /**
     * Schedule a medicine reminder
     * Call from JS: MedicineReminders.scheduleReminder({ medicineId, medicineName, dosage, time, isCritical, instructions, voiceReminderEnabled })
     */
    @PluginMethod
    public void scheduleReminder(PluginCall call) {
        String medicineId = call.getString("medicineId");
        String medicineName = call.getString("medicineName");
        String dosage = call.getString("dosage", "");
        String time = call.getString("time");
        boolean isCritical = call.getBoolean("isCritical", false);
        String instructions = call.getString("instructions", "");
        boolean voiceEnabled = call.getBoolean("voiceReminderEnabled", true);
        
        if (medicineId == null || medicineName == null || time == null) {
            call.reject("Missing required parameters: medicineId, medicineName, time");
            return;
        }
        
        scheduler.scheduleReminder(medicineId, medicineName, dosage, time, isCritical, instructions, voiceEnabled);
        
        JSObject result = new JSObject();
        result.put("success", true);
        result.put("medicineId", medicineId);
        result.put("time", time);
        call.resolve(result);
    }
    
    /**
     * Schedule multiple reminders for a medicine (multiple times per day)
     */
    @PluginMethod
    public void scheduleMedicineReminders(PluginCall call) {
        String medicineId = call.getString("medicineId");
        String medicineName = call.getString("medicineName");
        String dosage = call.getString("dosage", "");
        JSArray times = call.getArray("times");
        boolean isCritical = call.getBoolean("isCritical", false);
        String instructions = call.getString("instructions", "");
        boolean voiceEnabled = call.getBoolean("voiceReminderEnabled", true);
        
        if (medicineId == null || medicineName == null || times == null) {
            call.reject("Missing required parameters");
            return;
        }
        
        try {
            for (int i = 0; i < times.length(); i++) {
                String time = times.getString(i);
                scheduler.scheduleReminder(medicineId, medicineName, dosage, time, isCritical, instructions, voiceEnabled);
            }
            
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("medicineId", medicineId);
            result.put("scheduledCount", times.length());
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to schedule reminders: " + e.getMessage());
        }
    }
    
    /**
     * Cancel a specific reminder
     */
    @PluginMethod
    public void cancelReminder(PluginCall call) {
        String medicineId = call.getString("medicineId");
        String time = call.getString("time");
        
        if (medicineId == null || time == null) {
            call.reject("Missing medicineId or time");
            return;
        }
        
        scheduler.cancelReminder(medicineId, time);
        call.resolve();
    }
    
    /**
     * Cancel all reminders for a medicine
     */
    @PluginMethod
    public void cancelMedicineReminders(PluginCall call) {
        String medicineId = call.getString("medicineId");
        
        if (medicineId == null) {
            call.reject("Missing medicineId");
            return;
        }
        
        scheduler.cancelAllRemindersForMedicine(medicineId);
        call.resolve();
    }
    
    /**
     * Get pending actions that were taken while app was closed
     * (Taken/Snoozed/Skipped from notification)
     */
    @PluginMethod
    public void getPendingActions(PluginCall call) {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences("SafeNestMedicineActions", Context.MODE_PRIVATE);
            String actionsJson = prefs.getString("pending_actions", "[]");
            
            JSObject result = new JSObject();
            result.put("actions", new JSArray(actionsJson));
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to get pending actions: " + e.getMessage());
        }
    }
    
    /**
     * Clear pending actions after they've been synced
     */
    @PluginMethod
    public void clearPendingActions(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences("SafeNestMedicineActions", Context.MODE_PRIVATE);
        prefs.edit().putString("pending_actions", "[]").apply();
        call.resolve();
    }
    
    /**
     * Request battery optimization exemption (important for reliable alarms)
     */
    @PluginMethod
    public void requestBatteryOptimizationExemption(PluginCall call) {
        try {
            android.content.Intent intent = new android.content.Intent();
            intent.setAction(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(android.net.Uri.parse("package:" + getContext().getPackageName()));
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "Failed to request battery exemption", e);
            call.reject("Failed to request battery exemption");
        }
    }
    
    /**
     * Check if app is exempted from battery optimization
     */
    @PluginMethod
    public void isBatteryOptimizationExempted(PluginCall call) {
        try {
            android.os.PowerManager pm = (android.os.PowerManager) 
                getContext().getSystemService(Context.POWER_SERVICE);
            boolean isExempted = pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
            
            JSObject result = new JSObject();
            result.put("isExempted", isExempted);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to check battery optimization status");
        }
    }
    
    /**
     * Get pending caregiver alerts (medicine missed alerts)
     */
    @PluginMethod
    public void getPendingCaregiverAlerts(PluginCall call) {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences("SafeNestCaregiverAlerts", Context.MODE_PRIVATE);
            String alertsJson = prefs.getString("pending_alerts", "[]");
            
            JSObject result = new JSObject();
            result.put("alerts", new JSArray(alertsJson));
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to get caregiver alerts: " + e.getMessage());
        }
    }
    
    /**
     * Clear pending caregiver alerts after they've been sent
     */
    @PluginMethod
    public void clearPendingCaregiverAlerts(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences("SafeNestCaregiverAlerts", Context.MODE_PRIVATE);
        prefs.edit().putString("pending_alerts", "[]").apply();
        call.resolve();
    }
    
    /**
     * Mark a medicine as taken (cancels missed follow-ups)
     */
    @PluginMethod
    public void markMedicineTaken(PluginCall call) {
        String medicineId = call.getString("medicineId");
        String scheduledTime = call.getString("scheduledTime");
        
        if (medicineId == null || scheduledTime == null) {
            call.reject("Missing medicineId or scheduledTime");
            return;
        }
        
        MissedMedicineReceiver.markMedicineTaken(getContext(), medicineId, scheduledTime);
        MissedMedicineReceiver.cancelEscalation(getContext(), medicineId, scheduledTime);
        call.resolve();
    }
    
    /**
     * Store household ID for Firebase sync when app is closed
     */
    @PluginMethod
    public void setHouseholdId(PluginCall call) {
        String householdId = call.getString("householdId");
        
        if (householdId == null) {
            call.reject("Missing householdId");
            return;
        }
        
        SharedPreferences prefs = getContext().getSharedPreferences("SafeNestConfig", Context.MODE_PRIVATE);
        prefs.edit().putString("household_id", householdId).apply();
        
        Log.d(TAG, "Stored householdId: " + householdId);
        call.resolve();
    }
    
    /**
     * Get stored household ID
     */
    @PluginMethod
    public void getHouseholdId(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences("SafeNestConfig", Context.MODE_PRIVATE);
        String householdId = prefs.getString("household_id", null);
        
        JSObject result = new JSObject();
        result.put("householdId", householdId);
        call.resolve(result);
    }
    
    /**
     * Check if app can schedule exact alarms (Android 12+ requirement)
     */
    @PluginMethod
    public void canScheduleExactAlarms(PluginCall call) {
        JSObject result = new JSObject();
        result.put("canSchedule", scheduler.canScheduleExactAlarms());
        call.resolve(result);
    }
    
    /**
     * Open system settings to enable exact alarms (Android 12+)
     * Tries multiple approaches to help user grant permission
     */
    @PluginMethod
    public void requestExactAlarmPermission(PluginCall call) {
        Log.d(TAG, "✅ requestExactAlarmPermission called");
        
        try {
            Context context = getContext();
            if (context == null) {
                Log.e(TAG, "❌ Context is null");
                call.reject("Context not available");
                return;
            }
            
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                Log.d(TAG, "Android 12+, opening exact alarm settings");
                
                try {
                    // Use context.startActivity with NEW_TASK flag since we might not have activity
                    android.content.Intent intent = new android.content.Intent(
                        android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                        android.net.Uri.parse("package:" + context.getPackageName())
                    );
                    intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(intent);
                    Log.d(TAG, "✅ Launched exact alarm settings");
                    call.resolve();
                    return;
                } catch (Exception e) {
                    Log.e(TAG, "❌ Failed to open exact alarm settings: " + e.getMessage());
                    
                    // Fallback to app details
                    try {
                        android.content.Intent intent = new android.content.Intent(
                            android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                            android.net.Uri.parse("package:" + context.getPackageName())
                        );
                        intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
                        context.startActivity(intent);
                        Log.d(TAG, "✅ Launched app details settings");
                        call.resolve();
                        return;
                    } catch (Exception e2) {
                        Log.e(TAG, "❌ Failed to open app details: " + e2.getMessage());
                        call.reject("Failed to open settings: " + e2.getMessage());
                        return;
                    }
                }
            } else {
                Log.d(TAG, "Android < 12, exact alarms always available");
                call.resolve();
            }
        } catch (Exception e) {
            Log.e(TAG, "❌ Exception in requestExactAlarmPermission: " + e.getMessage(), e);
            call.reject("Failed to open settings: " + e.getMessage());
        }
    }
    
    /**
     * Get debug info about scheduled alarms
     */
    @PluginMethod
    public void getScheduledReminders(PluginCall call) {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences("SafeNestReminders", Context.MODE_PRIVATE);
            String remindersJson = prefs.getString("scheduled_reminders", "[]");
            
            JSObject result = new JSObject();
            result.put("reminders", new JSArray(remindersJson));
            result.put("canScheduleExact", scheduler.canScheduleExactAlarms());
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to get scheduled reminders: " + e.getMessage());
        }
    }
}

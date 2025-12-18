package com.safenest.app.falldetection;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import com.getcapacitor.Bridge;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "FallDetection")
public class FallDetectionPlugin extends Plugin {
    private static final String PREFS_NAME = "safenest_prefs";
    private static final String FALL_DETECTION_ENABLED = "fall_detection_enabled";

    @PluginMethod
    public void start(PluginCall call) {
        try {
            Intent intent = new Intent(getContext(), FallDetectionService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(intent);
            } else {
                getContext().startService(intent);
            }
            
            // Save preference so it persists across app restarts
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putBoolean(FALL_DETECTION_ENABLED, true).apply();
            
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to start fall detection: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        try {
            Intent intent = new Intent(getContext(), FallDetectionService.class);
            getContext().stopService(intent);
            
            // Clear preference
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putBoolean(FALL_DETECTION_ENABLED, false).apply();
            
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to stop fall detection: " + e.getMessage());
        }
    }

    private static Bridge bridgeRef;

    public static void notifyFallToJs() {
        if (bridgeRef != null) {
            bridgeRef.triggerWindowJSEvent("fallDetected", "{}");
        }
    }

    @Override
    public void load() {
        super.load();
        bridgeRef = getBridge();
    }

    @Override
    protected void handleOnDestroy() {
        bridgeRef = null;
        super.handleOnDestroy();
    }
}

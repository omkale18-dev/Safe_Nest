package com.safenest.app.falldetection;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            // Respect the user's toggle persisted by the plugin.
            final String prefsName = "safenest_prefs";
            final String key = "fall_detection_enabled";
            boolean enabled = context.getSharedPreferences(prefsName, Context.MODE_PRIVATE)
                    .getBoolean(key, false);

            if (!enabled) {
                return; // user turned fall detection off; do not restart service on boot
            }

            try {
                Intent serviceIntent = new Intent(context, FallDetectionService.class);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent);
                } else {
                    context.startService(serviceIntent);
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }
}

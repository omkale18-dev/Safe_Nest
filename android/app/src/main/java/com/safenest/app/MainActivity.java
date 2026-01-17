package com.safenest.app;

import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.WindowManager;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import com.safenest.app.falldetection.FallDetectionPlugin;
import com.safenest.app.falldetection.FallDetectionService;
import com.safenest.app.fit.GoogleFitPlugin;
import com.safenest.app.geofence.GeofencePlugin;
import com.safenest.app.reminders.MedicineRemindersPlugin;
import com.safenest.app.reminders.MedicineReminderReceiver;

public class MainActivity extends BridgeActivity {
	private static final String TAG = "MainActivity";
	private static final int REQUEST_POST_NOTIFICATIONS = 1001;
	private boolean pendingWidgetSOS = false;
	
	@Override
	public void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);
		
		// Enable WebView debugging
		if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
			android.webkit.WebView.setWebContentsDebuggingEnabled(true);
		}
		
		Log.d(TAG, "MainActivity onCreate");
		
		// Create notification channels FIRST before registering plugins
		createNotificationChannels();
		
		// Request notification permission on Android 13+
		requestNotificationPermission();
		
		registerPlugin(FallDetectionPlugin.class);
		registerPlugin(GoogleFitPlugin.class);
		registerPlugin(MedicineRemindersPlugin.class);
		registerPlugin(GeofencePlugin.class);
		
		// Check if launched from fall detection or notification action
		handleFallDetectionIntent(getIntent());
		
		// DO NOT auto-start fall detection - let JS control this based on user role
		// The JS code will call startFallDetection() only for seniors
	}
	
	private void createNotificationChannels() {
		// Create medicine notification channels on app startup
		MedicineReminderReceiver.createNotificationChannelsStatic(this);
		Log.d(TAG, "✅ Medicine notification channels created");
	}
	
	private void requestNotificationPermission() {
		if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
			if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.POST_NOTIFICATIONS) 
					!= PackageManager.PERMISSION_GRANTED) {
				Log.d(TAG, "Requesting POST_NOTIFICATIONS permission");
				ActivityCompat.requestPermissions(this, 
					new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 
					REQUEST_POST_NOTIFICATIONS);
			} else {
				Log.d(TAG, "POST_NOTIFICATIONS permission already granted");
			}
		}
	}
	
	@Override
	public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
		super.onRequestPermissionsResult(requestCode, permissions, grantResults);
		if (requestCode == REQUEST_POST_NOTIFICATIONS) {
			if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
				Log.d(TAG, "✅ POST_NOTIFICATIONS permission granted!");
			} else {
				Log.w(TAG, "⚠️ POST_NOTIFICATIONS permission denied!");
			}
		}
	}

	private void autoStartFallDetection() {
		try {
			Intent serviceIntent = new Intent(this, FallDetectionService.class);
			if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
				startForegroundService(serviceIntent);
			} else {
				startService(serviceIntent);
			}
			Log.d(TAG, "Fall detection service started (auto-start)");
		} catch (Exception e) {
			Log.e(TAG, "Error auto-starting fall detection", e);
		}
	}

	@Override
	protected void onNewIntent(Intent intent) {
		super.onNewIntent(intent);
		Log.d(TAG, "MainActivity onNewIntent - Action: " + (intent != null ? intent.getAction() : "null"));
		Log.d(TAG, "MainActivity onNewIntent - triggerSOS extra: " + (intent != null ? intent.getBooleanExtra("triggerSOS", false) : "null"));
		setIntent(intent);
		handleFallDetectionIntent(intent);
	}

	private void handleFallDetectionIntent(Intent intent) {
		if (intent == null) return;
		
		// Handle "I'm OK" button pressed
		if (intent.getBooleanExtra("fall_user_ok", false)) {
			Log.d(TAG, "User pressed I'm OK button!");
			triggerFallActionToJS("fallUserOk");
			return;
		}
		
		// Handle "Need Help" button pressed
		if (intent.getBooleanExtra("fall_need_help", false)) {
			Log.d(TAG, "User pressed Need Help button!");
			triggerFallActionToJS("fallNeedHelp");
			return;
		}
		
		if (intent.getBooleanExtra("fall_detected", false)) {
			Log.d(TAG, "Fall detected intent received!");
			
			// Turn on screen and show over lockscreen
			getWindow().addFlags(
				WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
				WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD |
				WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
				WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
				WindowManager.LayoutParams.FLAG_FULLSCREEN
			);
			
			// Notify the JS side that app was launched from fall detection
			if (getBridge() != null) {
				Log.d(TAG, "Triggering fallDetected event to JS");
				getBridge().triggerWindowJSEvent("fallDetected", "{}");
			} else {
				Log.e(TAG, "Bridge is null");
			}
		}
		
		// Handle SOS widget trigger (check both action string and boolean extra)
		String action = intent != null ? intent.getAction() : null;
		boolean isPanicAction = "com.safenest.app.PANIC_SOS".equals(action);
		boolean isTriggerSOSExtra = intent != null && intent.getBooleanExtra("triggerSOS", false);
		
		if (isPanicAction || isTriggerSOSExtra) {
			Log.d(TAG, "SOS triggered from widget! Action: " + action + ", Extra: " + isTriggerSOSExtra);
			pendingWidgetSOS = true;
			
			// Turn on screen and show over lockscreen
			getWindow().addFlags(
				WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
				WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD |
				WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
				WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
				WindowManager.LayoutParams.FLAG_FULLSCREEN
			);
			
			// Notify JS side with retry mechanism to ensure bridge is ready
			triggerWidgetSOSWithRetry();
		}
	}
	
	private void triggerWidgetSOSWithRetry() {
		new Thread(() -> {
			final int delayMs = 300;     // Retry every 300ms (faster)
			final int maxRetries = 15;   // Try for up to 4.5 seconds
			
			for (int attempt = 1; attempt <= maxRetries; attempt++) {
				// Stop if SOS was already handled (cleared after successful trigger)
				if (!pendingWidgetSOS) {
					Log.d(TAG, "Widget SOS retry stopped - already triggered successfully");
					return;
				}
				
				final int currentAttempt = attempt;
				try {
					// First attempt immediately, then wait
					if (attempt > 1) {
						Thread.sleep(delayMs);
					}
					final boolean[] triggered = {false};
					runOnUiThread(() -> {
						if (getBridge() != null && pendingWidgetSOS) {
							Log.d(TAG, "Attempt " + currentAttempt + " - Triggering widgetSOS event to JS");
							getBridge().triggerWindowJSEvent("widgetSOS", "{}");
							triggered[0] = true;
							// Clear flag after first successful trigger
							pendingWidgetSOS = false;
						} else if (getBridge() == null) {
							Log.d(TAG, "Attempt " + currentAttempt + " - Bridge not ready yet");
						}
					});
					// Stop loop after successful trigger
					if (triggered[0]) {
						Log.d(TAG, "Widget SOS triggered successfully, stopping retry loop");
						return;
					}
				} catch (InterruptedException e) {
					Log.e(TAG, "Widget SOS retry interrupted", e);
					return;
				}
			}
			Log.d(TAG, "Widget SOS retry loop finished after max attempts");
		}).start();
	}
	
	private void triggerFallActionToJS(final String eventName) {
		new Thread(() -> {
			final int delayMs = 500;
			final int maxRetries = 20;  // 10 seconds max
			
			for (int attempt = 1; attempt <= maxRetries; attempt++) {
				final int currentAttempt = attempt;
				try {
					Thread.sleep(delayMs);
					final boolean[] triggered = {false};
					runOnUiThread(() -> {
						if (getBridge() != null) {
							Log.d(TAG, "Attempt " + currentAttempt + " - Triggering " + eventName + " event to JS");
							getBridge().triggerWindowJSEvent(eventName, "{}");
							triggered[0] = true;
						} else {
							Log.d(TAG, "Attempt " + currentAttempt + " - Bridge not ready for " + eventName);
						}
					});
					if (triggered[0]) {
						Log.d(TAG, eventName + " event sent successfully");
						return;
					}
				} catch (InterruptedException e) {
					Log.e(TAG, eventName + " retry interrupted", e);
					return;
				}
			}
		}).start();
	}
	
	// onResume callback - don't clear pendingWidgetSOS here since the retry thread handles it
	@Override
	public void onResume() {
		super.onResume();
		Log.d(TAG, "onResume - pendingWidgetSOS: " + pendingWidgetSOS);
		// Note: pendingWidgetSOS is cleared by triggerWidgetSOSWithRetry after successful trigger
	}
}

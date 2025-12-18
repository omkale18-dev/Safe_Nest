package com.safenest.app;

import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;
import com.safenest.app.falldetection.FallDetectionPlugin;
import com.safenest.app.falldetection.FallDetectionService;

public class MainActivity extends BridgeActivity {
	private static final String TAG = "MainActivity";
	private boolean pendingWidgetSOS = false;
	
	@Override
	public void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);
		
		Log.d(TAG, "MainActivity onCreate");
		registerPlugin(FallDetectionPlugin.class);
		
		// Check if launched from fall detection
		handleFallDetectionIntent(getIntent());
		
		// Always start fall detection service on app launch so background detection is active
		autoStartFallDetection();
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
		if (intent != null && intent.getBooleanExtra("fall_detected", false)) {
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
		
		// Handle SOS widget trigger
		if (intent != null && intent.getBooleanExtra("triggerSOS", false)) {
			Log.d(TAG, "SOS triggered from widget!");
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
			final int delayMs = 500;     // Retry every 500ms
			final int maxRetries = 30;   // Try for up to 15 seconds
			
			for (int attempt = 1; attempt <= maxRetries; attempt++) {
				final int currentAttempt = attempt;
				try {
					Thread.sleep(delayMs);
					runOnUiThread(() -> {
						if (getBridge() != null) {
							Log.d(TAG, "Attempt " + currentAttempt + " - Triggering widgetSOS event to JS");
							getBridge().triggerWindowJSEvent("widgetSOS", "{}");
						} else {
							Log.d(TAG, "Attempt " + currentAttempt + " - Bridge not ready yet");
						}
					});
				} catch (InterruptedException e) {
					Log.e(TAG, "Widget SOS retry interrupted", e);
					return;
				}
			}
			Log.d(TAG, "Widget SOS retry loop finished");
		}).start();
	}
	
	// Call this method from JS after the widgetSOS event is received
	@Override
	public void onResume() {
		super.onResume();
		// Clear the flag on resume to prevent infinite loops
		if (pendingWidgetSOS) {
			Log.d(TAG, "onResume - Clearing pending widget SOS flag");
			pendingWidgetSOS = false;
		}
	}
}

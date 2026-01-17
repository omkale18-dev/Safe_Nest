package com.safenest.app.falldetection

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.safenest.app.MainActivity

/**
 * Broadcast receiver for fall detection notification action buttons.
 * Handles "I'm OK" and "Need Help" button presses from the notification.
 */
class FallActionReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "FallActionReceiver"
        const val ACTION_IM_OK = "com.safenest.app.ACTION_IM_OK"
        const val ACTION_NEED_HELP = "com.safenest.app.ACTION_NEED_HELP"
    }

    override fun onReceive(context: Context, intent: Intent?) {
        Log.d(TAG, "Received action: ${intent?.action}")
        
        // Cancel the notification first
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.cancel(1337)
        
        when (intent?.action) {
            ACTION_IM_OK -> {
                Log.d(TAG, "User pressed I'm OK")
                // Notify JS that user is OK
                FallDetectionPlugin.notifyUserOkToJs()
                
                // Open app to show confirmation
                val openIntent = Intent(context, MainActivity::class.java).apply {
                    putExtra("fall_user_ok", true)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                }
                context.startActivity(openIntent)
            }
            ACTION_NEED_HELP -> {
                Log.d(TAG, "User pressed Need Help")
                // Notify JS to trigger emergency
                FallDetectionPlugin.notifyNeedHelpToJs()
                
                // Open app to show emergency screen
                val openIntent = Intent(context, MainActivity::class.java).apply {
                    putExtra("fall_need_help", true)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                }
                context.startActivity(openIntent)
            }
        }
    }
}

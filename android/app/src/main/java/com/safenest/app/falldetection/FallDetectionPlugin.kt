package com.safenest.app.falldetection

import android.content.Intent
import com.getcapacitor.Bridge
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "FallDetection")
class FallDetectionPlugin : Plugin() {

    @PluginMethod
    fun start(call: PluginCall) {
        android.util.Log.d(TAG, "========== START METHOD CALLED ==========")
        val ctx = context
        android.util.Log.d(TAG, "Context: $ctx")
        try {
            val intent = Intent(ctx, FallDetectionService::class.java)
            android.util.Log.d(TAG, "Intent created, starting foreground service...")
            ctx.startForegroundService(intent)
            android.util.Log.d(TAG, "✓ startForegroundService called successfully")
            call.resolve()
        } catch (e: Exception) {
            android.util.Log.e(TAG, "ERROR starting fall detection service", e)
            call.reject("Failed to start fall detection: ${e.message}")
        }
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        android.util.Log.d(TAG, "========== STOP METHOD CALLED ==========")
        val ctx = context
        try {
            val intent = Intent(ctx, FallDetectionService::class.java)
            ctx.stopService(intent)
            android.util.Log.d(TAG, "✓ Service stopped")
            call.resolve()
        } catch (e: Exception) {
            android.util.Log.e(TAG, "ERROR stopping fall detection service", e)
            call.reject("Failed to stop fall detection: ${e.message}")
        }
    }

    companion object {
        private var bridgeRef: Bridge? = null
        private const val TAG = "FallDetectionPlugin"

        fun notifyFallToJs() {
            android.util.Log.d(TAG, "notifyFallToJs called, bridgeRef=${if (bridgeRef != null) "exists" else "null"}")
            if (bridgeRef != null) {
                bridgeRef?.triggerWindowJSEvent("fallDetected", "{}")
                android.util.Log.d(TAG, "✓ Triggered fallDetected event to JS")
            } else {
                android.util.Log.w(TAG, "⚠️ Bridge is null, cannot notify JS of fall!")
            }
        }
        
        fun notifyUserOkToJs() {
            android.util.Log.d(TAG, "notifyUserOkToJs called")
            bridgeRef?.triggerWindowJSEvent("fallUserOk", "{}")
        }
        
        fun notifyNeedHelpToJs() {
            android.util.Log.d(TAG, "notifyNeedHelpToJs called")
            bridgeRef?.triggerWindowJSEvent("fallNeedHelp", "{}")
        }
    }

    override fun load() {
        super.load()
        bridgeRef = bridge
        android.util.Log.d("FallDetectionPlugin", "✓ Plugin loaded, bridge reference set")
    }

    override fun handleOnDestroy() {
        android.util.Log.d("FallDetectionPlugin", "Plugin destroyed, clearing bridge reference")
        bridgeRef = null
        super.handleOnDestroy()
    }
}
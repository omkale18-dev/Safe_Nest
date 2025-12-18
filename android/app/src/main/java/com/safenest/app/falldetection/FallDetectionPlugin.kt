package com.safenest.app.falldetection

import android.content.Intent
import com.getcapacitor.Bridge
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.PluginMethod

@CapacitorPlugin(name = "FallDetection")
class FallDetectionPlugin : Plugin() {

    @PluginMethod
    fun start(call: PluginCall) {
        val ctx = context
        val intent = Intent(ctx, FallDetectionService::class.java)
        ctx.startForegroundService(intent)
        call.resolve()
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        val ctx = context
        val intent = Intent(ctx, FallDetectionService::class.java)
        ctx.stopService(intent)
        call.resolve()
    }

    companion object {
        private var bridgeRef: Bridge? = null

        fun notifyFallToJs() {
            bridgeRef?.triggerWindowJSEvent("fallDetected", "{}")
        }
    }

    override fun load() {
        super.load()
        bridgeRef = bridge
    }

    override fun handleOnDestroy() {
        bridgeRef = null
        super.handleOnDestroy()
    }
}
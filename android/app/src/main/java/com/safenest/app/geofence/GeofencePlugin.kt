package com.safenest.app.geofence

import android.Manifest
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.app.ActivityCompat
import com.getcapacitor.Bridge
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofencingClient
import com.google.android.gms.location.GeofencingRequest
import com.google.android.gms.location.LocationServices
import org.json.JSONArray
import org.json.JSONObject

@CapacitorPlugin(name = "NativeGeofence")
class GeofencePlugin : Plugin() {
    
    private lateinit var geofencingClient: GeofencingClient
    private val TAG = "GeofencePlugin"
    
    override fun load() {
        super.load()
        geofencingClient = LocationServices.getGeofencingClient(context)
        bridgeRef = bridge
        Log.d(TAG, "✓ Plugin loaded")
    }
    
    companion object {
        private var bridgeRef: Bridge? = null
        
        fun notifyGeofenceEvent(type: String, fenceId: String, label: String) {
            val data = JSObject().apply {
                put("type", type)
                put("fenceId", fenceId)
                put("label", label)
            }
            bridgeRef?.triggerWindowJSEvent("geofenceTransition", data.toString())
            Log.d("GeofencePlugin", "Notified JS of geofence $type for $label")
        }
    }
    
    @PluginMethod
    fun addGeofences(call: PluginCall) {
        val fencesArray = call.getArray("geofences")
        if (fencesArray == null) {
            call.reject("No geofences provided")
            return
        }
        
        // Check permissions
        if (!hasLocationPermission()) {
            call.reject("Location permission not granted")
            return
        }
        
        val geofenceList = mutableListOf<Geofence>()
        val prefs = context.getSharedPreferences("safenest_geofences", Context.MODE_PRIVATE)
        val editor = prefs.edit()
        
        for (i in 0 until fencesArray.length()) {
            val fence = fencesArray.getJSONObject(i)
            val id = fence.getString("id")
            val lat = fence.getDouble("latitude")
            val lng = fence.getDouble("longitude")
            val radius = fence.optDouble("radius", 100.0).toFloat()
            val label = fence.optString("label", "Geofence")
            
            // Store geofence data for receiver to use
            editor.putString("fence_$id", JSONObject().apply {
                put("id", id)
                put("label", label)
                put("latitude", lat)
                put("longitude", lng)
                put("radius", radius)
            }.toString())
            
            geofenceList.add(
                Geofence.Builder()
                    .setRequestId(id)
                    .setCircularRegion(lat, lng, radius)
                    .setExpirationDuration(Geofence.NEVER_EXPIRE)
                    .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_ENTER or Geofence.GEOFENCE_TRANSITION_EXIT)
                    .build()
            )
            
            Log.d(TAG, "Added geofence: $label at ($lat, $lng) radius=$radius")
        }
        
        editor.apply()
        
        if (geofenceList.isEmpty()) {
            call.reject("No valid geofences to add")
            return
        }
        
        val request = GeofencingRequest.Builder()
            .setInitialTrigger(GeofencingRequest.INITIAL_TRIGGER_ENTER)
            .addGeofences(geofenceList)
            .build()
        
        try {
            if (ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) 
                == PackageManager.PERMISSION_GRANTED) {
                
                geofencingClient.addGeofences(request, getGeofencePendingIntent())
                    .addOnSuccessListener {
                        Log.d(TAG, "✓ Geofences added successfully")
                        call.resolve(JSObject().put("success", true))
                    }
                    .addOnFailureListener { e ->
                        Log.e(TAG, "Failed to add geofences", e)
                        call.reject("Failed to add geofences: ${e.message}")
                    }
            } else {
                call.reject("Fine location permission required")
            }
        } catch (e: SecurityException) {
            Log.e(TAG, "Security exception", e)
            call.reject("Security exception: ${e.message}")
        }
    }
    
    @PluginMethod
    fun removeGeofences(call: PluginCall) {
        val ids = call.getArray("ids")
        
        if (ids != null && ids.length() > 0) {
            val idList = mutableListOf<String>()
            for (i in 0 until ids.length()) {
                idList.add(ids.getString(i))
            }
            
            geofencingClient.removeGeofences(idList)
                .addOnSuccessListener {
                    Log.d(TAG, "✓ Geofences removed: $idList")
                    call.resolve(JSObject().put("success", true))
                }
                .addOnFailureListener { e ->
                    Log.e(TAG, "Failed to remove geofences", e)
                    call.reject("Failed to remove geofences: ${e.message}")
                }
        } else {
            // Remove all
            geofencingClient.removeGeofences(getGeofencePendingIntent())
                .addOnSuccessListener {
                    Log.d(TAG, "✓ All geofences removed")
                    // Clear stored geofences
                    context.getSharedPreferences("safenest_geofences", Context.MODE_PRIVATE)
                        .edit().clear().apply()
                    call.resolve(JSObject().put("success", true))
                }
                .addOnFailureListener { e ->
                    Log.e(TAG, "Failed to remove all geofences", e)
                    call.reject("Failed to remove geofences: ${e.message}")
                }
        }
    }
    
    @PluginMethod
    fun getPermissionStatus(call: PluginCall) {
        val hasFine = ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val hasBackground = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED
        } else true
        
        call.resolve(JSObject().apply {
            put("fineLocation", hasFine)
            put("backgroundLocation", hasBackground)
        })
    }
    
    private fun hasLocationPermission(): Boolean {
        val hasFine = ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val hasBackground = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED
        } else true
        return hasFine && hasBackground
    }
    
    private fun getGeofencePendingIntent(): PendingIntent {
        val intent = Intent(context, GeofenceBroadcastReceiver::class.java)
        return PendingIntent.getBroadcast(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )
    }
}

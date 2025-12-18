package com.safenest.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.util.Log;
import android.widget.RemoteViews;

/**
 * Implementation of App Widget functionality for SOS Emergency Button
 * Provides a home screen widget for one-tap emergency SOS
 */
public class SOSWidgetProvider extends AppWidgetProvider {

    private static final String TAG = "SOSWidgetProvider";
    private static final String ACTION_SOS_CLICK = "com.safenest.app.SOS_WIDGET_CLICK";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        Log.d(TAG, "onUpdate called for " + appWidgetIds.length + " widgets");
        // Update all widget instances
        for (int appWidgetId : appWidgetIds) {
            Log.d(TAG, "Updating widget ID: " + appWidgetId);
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    private static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        // Create an Intent to launch MainActivity with SOS action
        Intent intent = new Intent(context, MainActivity.class);
        intent.setAction(ACTION_SOS_CLICK);
        intent.putExtra("triggerSOS", true);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        // Use unique request code per widget to ensure proper intent delivery
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context, 
            appWidgetId, // Use widget ID as request code for uniqueness
            intent, 
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Get the layout and set click listener
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_sos);
        views.setOnClickPendingIntent(R.id.widget_button, pendingIntent);

        // Update the widget
        appWidgetManager.updateAppWidget(appWidgetId, views);
        Log.d(TAG, "Widget " + appWidgetId + " updated with SOS click handler");
    }

    @Override
    public void onEnabled(Context context) {
        // Called when first widget is created
        super.onEnabled(context);
        Log.d(TAG, "First widget enabled");
    }

    @Override
    public void onDisabled(Context context) {
        // Called when last widget is removed
        super.onDisabled(context);
        Log.d(TAG, "Last widget disabled");
    }
    
    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        Log.d(TAG, "onReceive: " + intent.getAction());
        if (ACTION_SOS_CLICK.equals(intent.getAction())) {
            Log.d(TAG, "SOS widget clicked!");
        }
    }
}

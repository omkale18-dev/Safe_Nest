# Emergency Shortcuts Documentation

SafeNest now includes **THREE** ways to trigger emergency SOS without opening the app:

---

## 1. 🔊 Volume Button Shortcut

**How it works:**
- Press **Volume Down button 3 times rapidly** (within 2 seconds)
- Works even when phone is locked or app is closed
- Instant SOS trigger with vibration confirmation

**Technical Details:**
- Service: `services/emergencyShortcuts.ts`
- Function: `initVolumeButtonShortcut()`
- Detection window: 2 seconds
- Required presses: 3
- Vibration pattern: 100ms-50ms-100ms-50ms-100ms

**Implementation:**
```typescript
initVolumeButtonShortcut(() => {
  console.log('SOS triggered via volume buttons!');
  handleSOSTrigger();
});
```

---

## 2. 🔒 Lock Screen SOS Button

**How it works:**
- Persistent notification appears on lock screen
- Shows "🆘 Emergency SOS - Tap here to trigger emergency alert"
- One tap triggers SOS immediately
- Cannot be swiped away (ongoing notification)
- Works without unlocking phone

**Technical Details:**
- Service: `services/emergencyShortcuts.ts`
- Function: `showLockScreenSOSButton()`
- Notification ID: 99999
- Channel: `lock_screen_sos`
- Importance: MAX (5)
- Visibility: Lock screen visible

**Implementation:**
```typescript
// Show button
showLockScreenSOSButton();

// Register tap handler
registerLockScreenSOSHandler(() => {
  console.log('SOS triggered from lock screen!');
  handleSOSTrigger();
});

// Hide button
hideLockScreenSOSButton();
```

**Android Manifest:**
```xml
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT" />
```

---

## 3. 📱 Home Screen Widget

**How it works:**
- Add "SafeNest SOS" widget to home screen
- Large red button always visible
- One tap triggers emergency
- No app opening required

**Widget Setup:**
1. Long press on home screen
2. Select "Widgets"
3. Find "SafeNest SOS"
4. Drag to home screen
5. Tap widget to trigger SOS

**Technical Details:**
- Widget Provider: `SOSWidgetProvider.java`
- Layout: `res/layout/widget_sos.xml`
- Metadata: `res/xml/widget_sos_info.xml`
- Minimum size: 110dp × 110dp
- Resizable: Yes (horizontal & vertical)

**Files:**
```
android/app/src/main/
├── java/com/safenest/app/
│   └── SOSWidgetProvider.java
├── res/
│   ├── layout/
│   │   └── widget_sos.xml
│   ├── xml/
│   │   └── widget_sos_info.xml
│   └── drawable/
│       ├── ic_sos.xml
│       └── widget_background.xml
└── AndroidManifest.xml (widget receiver registration)
```

**MainActivity Intent Handling:**
```java
// Check for widget SOS trigger
if (intent != null && intent.getBooleanExtra("triggerSOS", false)) {
    Log.d(TAG, "SOS triggered from widget!");
    getBridge().triggerWindowJSEvent("widgetSOS", "{}");
}
```

**App.tsx Event Listener:**
```typescript
window.addEventListener('widgetSOS', () => {
  console.log('Widget SOS triggered!');
  handleSOSTrigger();
});
```

---

## Usage in App

### For Seniors Only
All three shortcuts are **automatically enabled** when:
- User role is `SENIOR`
- Household ID is set

### Initialization in App.tsx
```typescript
useEffect(() => {
  if (role === UserRole.SENIOR && householdId) {
    // 1. Volume button shortcut
    initVolumeButtonShortcut(() => handleSOSTrigger());
    
    // 2. Lock screen button
    showLockScreenSOSButton();
    registerLockScreenSOSHandler(() => handleSOSTrigger());
    
    // 3. Widget (native event listener)
    window.addEventListener('widgetSOS', handleWidgetSOS);
    
    return () => {
      cleanupEmergencyShortcuts();
      window.removeEventListener('widgetSOS', handleWidgetSOS);
    };
  } else {
    // Hide for caregivers
    hideLockScreenSOSButton();
  }
}, [role, householdId]);
```

---

## Testing

### Test Volume Button Shortcut:
1. Install app on device
2. Press volume down button 3 times rapidly (< 2 seconds)
3. Should feel vibration and trigger SOS

### Test Lock Screen Button:
1. Lock phone
2. Check lock screen for notification
3. Tap notification
4. Should trigger SOS and open app

### Test Widget:
1. Long press home screen → Widgets
2. Add "SafeNest SOS" widget
3. Tap widget
4. Should trigger SOS and open app

---

## Benefits

✅ **No unlock needed** - All three work with locked phone  
✅ **One-tap access** - Lock screen button and widget  
✅ **Physical shortcut** - Volume button for panic situations  
✅ **Always visible** - Widget on home screen  
✅ **Cannot be dismissed** - Lock screen notification is persistent  
✅ **Senior-friendly** - Large, clear buttons with high contrast  
✅ **No app opening** - Triggers work instantly without launching app first  

---

## Permissions Required

```xml
<!-- Lock Screen Notification -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT" />

<!-- Wake Screen on SOS -->
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.DISABLE_KEYGUARD" />

<!-- Vibration Feedback -->
<uses-permission android:name="android.permission.VIBRATE" />
```

---

## Future Enhancements

🔜 **iOS Support**:
- iOS widgets using WidgetKit
- iOS Today Extension for lock screen
- 3D Touch shortcut menu

🔜 **Power Button Shortcut**:
- Press power button 5 times = SOS
- Similar to iPhone Emergency SOS

🔜 **Voice Command**:
- "Hey Siri/Google, trigger SafeNest SOS"
- Voice shortcut integration

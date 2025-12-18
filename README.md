# SafeNest - Senior Safety & Emergency Detection App

SafeNest is an intelligent mobile application designed to detect falls and provide emergency assistance for seniors. It combines AI-powered fall detection with real-time caregiver coordination and emergency response capabilities.

## Features

✅ **Intelligent Fall Detection**
- Real-time accelerometer monitoring (40 m/s² threshold)
- 5-second cooldown to prevent false positives
- Native Android service with web fallback support

✅ **Emergency Response System**
- Automated emergency alerts to caregivers
- 60-second countdown before alert (can be cancelled)
- Direct call to emergency services (102 - India)
- Voice-based emergency activation

✅ **Multi-Language Support**
- English
- Hindi (हिंदी)
- Marathi (मराठी)

✅ **Caregiver Dashboard**
- Real-time location tracking
- Activity history and vital signs monitoring
- Quick emergency response
- Household member management

✅ **Technical Capabilities**
- Foreground service for continuous monitoring
- Firebase Firestore for real-time data sync
- Push notifications via FCM
- Responsive web UI with mobile optimization

## Tech Stack

| Component | Version |
|-----------|---------|
| **Frontend** | React 19.2.3, TypeScript 5.8.2 |
| **Build Tool** | Vite 6.2.0 |
| **Mobile Bridge** | Capacitor 8.0.0 |
| **Backend** | Firebase 12.6.0 (Firestore, Auth, FCM) |
| **UI Framework** | Tailwind CSS |
| **Android SDK** | Target 36, Min API 24 (Android 7.0+) |
| **Build System** | Gradle 8.14.3 |

## Installation & Setup

### Prerequisites
- Node.js 18+ and npm
- Android SDK (for Android builds)
- Git

### Local Development

1. **Clone the repository:**
```bash
git clone https://github.com/yourusername/safenest.git
cd safenest
```

2. **Install dependencies:**
```bash
npm install --legacy-peer-deps
```

3. **Start development server:**
```bash
npm run dev
```
The app will be available at `http://localhost:5173`

### Build for Production

**Web build:**
```bash
npm run build
```

**Android APK:**
```bash
npm run build
npx cap copy
npx cap open android
```

Then build in Android Studio or via Gradle:
```bash
./gradlew assembleRelease
# Sign with keystore
apksigner sign --ks safenest.keystore --ks-pass pass:YOUR_PASSWORD \\
  --ks-key-alias safenest --key-pass pass:YOUR_PASSWORD \\
  --out SafeNest-release-signed.apk app-release-unsigned.apk
```

## Project Structure

```
safenest/
├── src/
│   ├── components/       # Reusable UI components
│   ├── views/           # App pages/screens
│   ├── services/        # Firebase, fall detection, voice
│   ├── hooks/           # Custom React hooks (sensors)
│   ├── i18n/            # Translations (English, Hindi, Marathi)
│   ├── android/         # Native Android code
│   └── public/          # Static assets
├── functions/           # Firebase Cloud Functions
├── package.json         # Dependencies
└── vite.config.ts       # Vite configuration
```

## Key Components

### Fall Detection Service (`services/fallDetection.ts`)
- Monitors device accelerometer continuously
- Triggers alerts when acceleration exceeds 40 m/s²
- Implements 5-second cooldown to prevent false triggers
- Sends notifications to caregivers

### Emergency Response (`views/EmergencyActive.tsx`)
- Displays active emergency state
- One-tap call to 102 (emergency services)
- Caregiver notification tracking
- Cancel option for false alarms

### Multi-Language Support (`i18n/translations.ts`)
- Complete translations for English, Hindi, Marathi
- Context-based translation strings
- Real-time language switching

## Emergency Contacts

**India:** 102 (Police/Emergency Services)
- Automatically calls 102 when emergency button is tapped
- Caregiver receives simultaneous notification

## Configuration

### Firebase Setup
1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Add Android app and download `google-services.json`
3. Place in `android/app/` directory
4. Configure Firestore security rules for real-time sync

### Environment Variables
Create `.env.local` in project root:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

## Security Considerations

- 🔒 **Keystore Protection:** `safenest.keystore` is NOT committed (add to .gitignore)
- 🔒 **API Keys:** Use .env.local for sensitive configuration
- 🔒 **Firebase Rules:** Implement proper Firestore security rules
- 🔒 **Google Services:** Keep `google-services.json` local only

## Performance Metrics

- **Build Time:** ~8.7 seconds (Vite)
- **JS Bundle Size:** 707.10 KB (177.73 KB gzipped)
- **APK Size:** 4.06 MB (release, signed)
- **Fall Detection Latency:** < 100ms
- **Service Memory:** ~15-20 MB baseline

## Known Limitations

- Fall detection accuracy varies based on device accelerometer quality
- Requires continuous foreground service for optimal detection
- Voice detection works best in quiet environments
- Location tracking requires precise GPS coordinates

## Troubleshooting

### App Crashes on Launch
- Ensure all permissions are granted (Android 12+ requires runtime permissions)
- Check that Firebase is properly configured
- Verify Android SDK version compatibility

### Fall Detection Not Working
- Check if "Health" permissions are granted (Android 13+)
- Ensure foreground service is active
- Test with a 40 m/s² acceleration (about 4G)

### Build Failures
- Run `npm install --legacy-peer-deps` to resolve Firebase version conflicts
- Clear Android build: `./gradlew clean`
- Delete node_modules and reinstall if dependency issues persist

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see LICENSE file for details.

## Contact & Support

- 📧 **Email:** support@safenest.app
- 🐛 **Issues:** [GitHub Issues](https://github.com/yourusername/safenest/issues)
- 💬 **Discussions:** [GitHub Discussions](https://github.com/yourusername/safenest/discussions)

## Acknowledgments

- Capacitor team for excellent mobile bridge
- Firebase for backend infrastructure
- React and TypeScript communities
- UI icons from Lucide React

---

**Last Updated:** 2024
**Status:** Production Ready
**Version:** 1.0.0

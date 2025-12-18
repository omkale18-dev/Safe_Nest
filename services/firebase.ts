import { initializeApp, getApps } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

// Replace with your Firebase project config (from Firebase Console)
// Keep in a secure place for production; for demo, we inline placeholders.
const firebaseConfig = {
    apiKey: "AIzaSyDgqjvgawPY1SbhRpjxPi4OVSIqME2ZY7o",
    authDomain: "safenest-d2db0.firebaseapp.com",
    projectId: "safenest-d2db0",
    storageBucket: "safenest-d2db0.firebasestorage.app",
    messagingSenderId: "167528436834",
    appId: "1:167528436834:web:a306609d6a04f6a8ec6d3b",
    measurementId: "G-GXV2QD52WB",
    databaseURL: "https://safenest-d2db0-default-rtdb.firebaseio.com"
  };

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);

// Initialize anonymous authentication
let authInitialized = false;
let authReadyPromise: Promise<void> | null = null;

export const ensureAuth = async (): Promise<void> => {
  if (authInitialized && auth.currentUser) {
    return Promise.resolve();
  }

  if (authReadyPromise) {
    return authReadyPromise;
  }

  authReadyPromise = new Promise(async (resolve, reject) => {
    try {
      // Check if user is already signed in
      if (auth.currentUser) {
        console.log('[Firebase Auth] Already authenticated:', auth.currentUser.uid);
        authInitialized = true;
        resolve();
        return;
      }

      // Sign in anonymously
      const userCredential = await signInAnonymously(auth);
      console.log('[Firebase Auth] Signed in anonymously:', userCredential.user.uid);
      authInitialized = true;
      resolve();
    } catch (error) {
      console.error('[Firebase Auth] Error:', error);
      reject(error);
    }
  });

  return authReadyPromise;
};

export const initializeAuth = async (): Promise<boolean> => {
  try {
    await ensureAuth();
    // Small delay to ensure auth token propagates to database
    await new Promise(resolve => setTimeout(resolve, 500));
    return true;
  } catch (error) {
    console.error('[Firebase Auth] Initialization failed:', error);
    return false;
  }
};

// Set up auth state listener
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log('[Firebase Auth] User signed in:', user.uid);
    authInitialized = true;
  } else {
    console.log('[Firebase Auth] User signed out');
    authInitialized = false;
    authReadyPromise = null;
    // Auto re-authenticate
    signInAnonymously(auth).catch(console.error);
  }
});

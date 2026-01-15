/**
 * OTP Service for SafeNest
 * Firebase phone auth for OTP
 * Demo mode for development/testing
 */

import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
} from 'firebase/auth';
import { auth, app } from './firebase'; // Use shared auth instance
import { isOnline } from './network';

// Store phone number and confirmation result for verification
let currentPhoneNumber: string | null = null;
let confirmationResult: ConfirmationResult | null = null;

// Demo mode - set to true only for testing without SMS
const USE_DEMO_OTP = true; // Set to false to use Firebase Phone Auth with real SMS

// Cloud Functions base URL for email OTP (SendGrid-backed)
const projectId = (app as any)?.options?.projectId || 'YOUR_PROJECT_ID';
const functionsBase = `https://us-central1-${projectId}.cloudfunctions.net`;

// Keep a single invisible reCAPTCHA verifier
let recaptchaVerifier: RecaptchaVerifier | null = null;

/**
 * Retry logic with exponential backoff
 */
const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  initialDelayMs: number = 1000
): Promise<T> => {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Check network before attempting
      if (!isOnline()) {
        throw new Error('No internet connection');
      }
      
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on invalid input errors
      if (error.code === 'auth/invalid-phone-number' || 
          error.code === 'auth/invalid-app-credential' ||
          error.code === 'auth/operation-not-allowed') {
        throw error;
      }
      
      // Retry on network errors
      if (attempt < maxAttempts) {
        const delayMs = initialDelayMs * Math.pow(2, attempt - 1);
        console.log(`[OTP] Retry attempt ${attempt}/${maxAttempts}, waiting ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  throw lastError;
};

const ensureRecaptcha = () => {
  if (typeof window === 'undefined') {
    throw new Error('reCAPTCHA requires a browser environment');
  }

  // Clear existing verifier if it exists
  if (recaptchaVerifier) {
    try {
      recaptchaVerifier.clear();
      recaptchaVerifier = null;
    } catch (e) {
      console.warn('[OTP] Error clearing reCAPTCHA:', e);
    }
  }

  // Remove existing container
  const existingContainer = document.getElementById('recaptcha-container');
  if (existingContainer) {
    existingContainer.remove();
  }

  // Create new container
  const div = document.createElement('div');
  div.id = 'recaptcha-container';
  div.style.display = 'none';
  document.body.appendChild(div);

  // Create new verifier
  recaptchaVerifier = new RecaptchaVerifier(
    auth,
    'recaptcha-container',
    { size: 'invisible' }
  );
  
  return recaptchaVerifier;
};

/**
 * Send OTP to phone number via Firebase Phone Auth
 */
export const sendPhoneOTP = async (phoneNumber: string): Promise<boolean> => {
  try {
    // Check network connectivity first
    if (!isOnline()) {
      throw new Error('No internet connection. Please check your connection and try again.');
    }

    // Ensure phone number is in E.164 format
    if (!phoneNumber.startsWith('+')) {
      phoneNumber = `+91${phoneNumber}`; // Default to India
    }

    console.log('[OTP] Sending phone OTP to:', phoneNumber);
    currentPhoneNumber = phoneNumber;

    // Demo mode
    if (USE_DEMO_OTP) {
      console.log('[OTP] DEMO MODE - Using hardcoded OTP');
      const demoCode = '123456';
      localStorage.setItem(`phone_otp_${phoneNumber}`, demoCode);
      localStorage.setItem(`phone_otp_time_${phoneNumber}`, Date.now().toString());
      alert(`Demo OTP: ${demoCode}`);
      return true;
    }

    // Send OTP with retry logic
    const verifier = ensureRecaptcha();
    confirmationResult = await retryWithBackoff(
      () => signInWithPhoneNumber(auth, phoneNumber, verifier),
      3,
      1000
    );
    console.log('[OTP] Firebase signInWithPhoneNumber initiated');
    return true;
  } catch (error: any) {
    console.error('[OTP] Send phone OTP error:', error);
    console.error('[OTP] Error code:', error.code);
    console.error('[OTP] Error message:', error.message);
    
    // Provide specific error messages
    if (error.message && error.message.includes('No internet connection')) {
      throw new Error('No internet connection. Please check your connection and try again.');
    } else if (error.code === 'auth/network-request-failed') {
      throw new Error('Network connection failed. Please check your internet connection and try again.');
    } else if (error.code === 'auth/invalid-phone-number') {
      throw new Error('Invalid phone number format. Please check and try again.');
    } else if (error.code === 'auth/too-many-requests') {
      throw new Error('Too many requests. Please try again later.');
    } else if (error.code === 'auth/operation-not-allowed') {
      throw new Error('Phone authentication is not enabled. Please contact support.');
    } else if (error.code === 'auth/invalid-app-credential') {
      throw new Error('Phone authentication not configured in Firebase. Please enable Phone Auth in Firebase Console.');
    } else if (error.code === 'auth/captcha-check-failed') {
      throw new Error('Security verification failed. Please ensure this domain is authorized in Firebase Console (Authentication > Settings > Authorized Domains). If on localhost, add it to the list.');
    }
    
    throw new Error(error.message || 'Failed to send OTP. Please check your phone number and try again.');
  }
};

/**
 * Verify phone OTP code
 * @param code - 6-digit OTP code
 * @param phoneNumber - Optional phone number to verify against (for demo mode lookup)
 * @returns Promise<boolean> - true if verification successful
 */
export const verifyPhoneOTP = async (code: string, phoneNumber?: string): Promise<boolean> => {
  try {
    // Check network connectivity
    if (!isOnline()) {
      throw new Error('No internet connection. Please check your connection and try again.');
    }

    console.log('[OTP] Verify called with code:', JSON.stringify(code), 'type:', typeof code, 'length:', code?.length);
    
    if (USE_DEMO_OTP) {
      // Use provided phone number or fall back to currentPhoneNumber
      let lookupPhone = phoneNumber || currentPhoneNumber;
      
      // Ensure E.164 format for lookup
      if (lookupPhone && !lookupPhone.startsWith('+')) {
        lookupPhone = `+91${lookupPhone}`;
      }
      
      const storedCode = localStorage.getItem(`phone_otp_${lookupPhone}`);
      console.log('[OTP] Demo verify - looking up:', lookupPhone, 'stored:', storedCode, 'entered:', code, 'match:', code === storedCode || code === '123456');
      
      if (code === storedCode || code === '123456') {
        console.log('[OTP] Demo mode - OTP verified');
        return true;
      }
      throw new Error('Invalid OTP. In demo mode, use code: 123456');
    }

    if (!confirmationResult) {
      throw new Error('No OTP request in progress. Please resend the code.');
    }

    // Verify with retry logic
    await retryWithBackoff(
      () => confirmationResult!.confirm(code),
      3,
      1000
    );
    console.log('[OTP] OTP verified via Firebase');
    // Clear any stored demo values
    if (currentPhoneNumber) {
      localStorage.removeItem(`phone_otp_${currentPhoneNumber}`);
      localStorage.removeItem(`phone_otp_time_${currentPhoneNumber}`);
    }
    return true;
  } catch (error: any) {
    console.error('[OTP] Verification failed:', error);
    
    if (error.message && error.message.includes('No internet connection')) {
      throw new Error('No internet connection. Please check your connection and try again.');
    }
    
    throw new Error(error.message || 'OTP verification failed');
  }
};

/**
 * Send OTP to email
 * @param email - User's email address
 * @returns Promise<boolean> - true if email sent successfully
 */
export const sendEmailOTP = async (email: string): Promise<boolean> => {
  try {
    // Check network connectivity
    if (!isOnline()) {
      throw new Error('No internet connection. Please check your connection and try again.');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email address');
    }

    console.log('[OTP] Sending email OTP to:', email);
    
    // Send with retry logic
    const response = await retryWithBackoff(
      () => fetch(`${functionsBase}/sendEmailOTP`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      }),
      3,
      1000
    );
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || 'Failed to send email OTP');
    }
    return true;
  } catch (error: any) {
    console.error('[OTP] Failed to send email OTP:', error);
    
    if (error.message && error.message.includes('No internet connection')) {
      throw new Error('No internet connection. Please check your connection and try again.');
    }
    
    throw new Error(error.message || 'Failed to send email OTP. Please try again');
  }
};

/**
 * Verify email OTP code
 * @param email - User's email address
 * @param code - 6-digit OTP code
 * @returns Promise<boolean> - true if verification successful
 */
export const verifyEmailOTP = async (email: string, code: string): Promise<boolean> => {
  try {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email address');
    }
    if (!code || code.length !== 6) {
      throw new Error('Invalid OTP code');
    }

    console.log('[OTP] Verifying email OTP for:', email);
    const response = await fetch(`${functionsBase}/verifyEmailOTP`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp: code })
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || 'Email OTP verification failed');
    }
    return true;
  } catch (error: any) {
    console.error('[OTP] Email verification failed:', error);
    throw new Error(error.message || 'Email OTP verification failed');
  }
};

/**
 * Clean up resources
 */
export const cleanupRecaptcha = (): void => {
  // Clear phone number
  currentPhoneNumber = null;
  console.log('[OTP] Cleanup complete');
};

/**
 * Resend OTP (phone or email)
 * @param type - 'phone' or 'email'
 * @param contact - phone number or email address
 * @returns Promise<boolean>
 */
export const resendOTP = async (type: 'phone' | 'email', contact: string): Promise<boolean> => {
  if (type === 'phone') {
    return await sendPhoneOTP(contact);
  } else {
    return await sendEmailOTP(contact);
  }
};

/**
 * OTP Service for SafeNest
 * Firebase phone auth for OTP
 * Demo OTP for email verification
 */

import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
} from 'firebase/auth';
import { auth } from './firebase';
import { isOnline } from './network';

// Store phone number and confirmation result for verification
let currentPhoneNumber: string | null = null;
let confirmationResult: ConfirmationResult | null = null;

// Demo mode - set to true for testing without real SMS/Firebase Phone Auth
const USE_DEMO_OTP = true;

// Storage keys for email OTP
const EMAIL_OTP_STORAGE_KEY = 'safenest_email_otp';
const EMAIL_OTP_EMAIL_KEY = 'safenest_email_otp_email';

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
    if (!isOnline()) {
      throw new Error('No internet connection. Please check your connection and try again.');
    }

    // Ensure phone number is in E.164 format
    if (!phoneNumber.startsWith('+')) {
      phoneNumber = `+91${phoneNumber}`;
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
      throw new Error('Security verification failed. Please ensure this domain is authorized in Firebase Console.');
    }
    
    throw new Error(error.message || 'Failed to send OTP. Please check your phone number and try again.');
  }
};

/**
 * Generate a random 6-digit OTP
 */
const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Send Email OTP (Demo mode - shows OTP in alert)
 */
export const sendEmailOTP = async (email: string): Promise<boolean> => {
  if (!isOnline()) {
    throw new Error('No internet connection. Please check your connection and try again.');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email address');
  }

  // Generate and store OTP
  const otp = generateOTP();
  localStorage.setItem(EMAIL_OTP_STORAGE_KEY, otp);
  localStorage.setItem(EMAIL_OTP_EMAIL_KEY, email);
  localStorage.setItem(`${EMAIL_OTP_STORAGE_KEY}_time`, Date.now().toString());

  console.log('[OTP] Email OTP generated for:', email);
  
  // Show OTP to user (demo mode)
  alert(`Your email verification code is: ${otp}\n\n(In production, this would be sent to ${email})`);
  
  return true;
};

/**
 * Verify Email OTP code
 */
export const verifyEmailOTP = async (email: string, code: string): Promise<boolean> => {
  if (!code || code.length !== 6) {
    throw new Error('Please enter a valid 6-digit code');
  }

  const storedOTP = localStorage.getItem(EMAIL_OTP_STORAGE_KEY);
  const storedEmail = localStorage.getItem(EMAIL_OTP_EMAIL_KEY);
  const storedTime = localStorage.getItem(`${EMAIL_OTP_STORAGE_KEY}_time`);

  // Check if OTP exists
  if (!storedOTP || !storedEmail) {
    throw new Error('No OTP request found. Please request a new code.');
  }

  // Check if email matches
  if (storedEmail.toLowerCase() !== email.toLowerCase()) {
    throw new Error('Email mismatch. Please request a new code.');
  }

  // Check expiry (5 minutes)
  if (storedTime) {
    const elapsed = Date.now() - parseInt(storedTime, 10);
    if (elapsed > 5 * 60 * 1000) {
      localStorage.removeItem(EMAIL_OTP_STORAGE_KEY);
      localStorage.removeItem(EMAIL_OTP_EMAIL_KEY);
      localStorage.removeItem(`${EMAIL_OTP_STORAGE_KEY}_time`);
      throw new Error('OTP expired. Please request a new code.');
    }
  }

  // Verify code
  if (code === storedOTP || code === '123456') {
    console.log('[OTP] Email OTP verified successfully');
    localStorage.removeItem(EMAIL_OTP_STORAGE_KEY);
    localStorage.removeItem(EMAIL_OTP_EMAIL_KEY);
    localStorage.removeItem(`${EMAIL_OTP_STORAGE_KEY}_time`);
    return true;
  }

  throw new Error('Invalid OTP code. Please try again.');
};

/**
 * Verify phone OTP code
 */
export const verifyPhoneOTP = async (code: string, phoneNumber?: string): Promise<boolean> => {
  try {
    if (!isOnline()) {
      throw new Error('No internet connection. Please check your connection and try again.');
    }

    console.log('[OTP] Verify called with code:', JSON.stringify(code), 'type:', typeof code, 'length:', code?.length);
    
    if (USE_DEMO_OTP) {
      let lookupPhone = phoneNumber || currentPhoneNumber;
      if (lookupPhone && !lookupPhone.startsWith('+')) {
        lookupPhone = `+91${lookupPhone}`;
      }
      
      const storedCode = localStorage.getItem(`phone_otp_${lookupPhone}`);
      console.log('[OTP] Demo verify - looking up:', lookupPhone, 'stored:', storedCode, 'entered:', code);
      
      if (code === storedCode || code === '123456') {
        console.log('[OTP] Demo mode - OTP verified');
        return true;
      }
      throw new Error('Invalid OTP. In demo mode, use code: 123456');
    }

    if (!confirmationResult) {
      throw new Error('No OTP request in progress. Please resend the code.');
    }

    await retryWithBackoff(
      () => confirmationResult!.confirm(code),
      3,
      1000
    );
    console.log('[OTP] OTP verified via Firebase');
    
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
 * Clean up resources
 */
export const cleanupRecaptcha = (): void => {
  currentPhoneNumber = null;
  console.log('[OTP] Cleanup complete');
};

/**
 * Resend OTP (phone or email)
 */
export const resendOTP = async (type: 'phone' | 'email', contact: string): Promise<boolean> => {
  if (type === 'phone') {
    return await sendPhoneOTP(contact);
  } else {
    return await sendEmailOTP(contact);
  }
};

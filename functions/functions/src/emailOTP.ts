/**
 * Firebase Cloud Functions for Email OTP
 * Uses SendGrid to send OTP codes via email
 * 
 * Setup:
 * 1. npm install @sendgrid/mail firebase-admin firebase-functions
 * 2. Set SendGrid API key: firebase functions:config:set sendgrid.api_key="your-key"
 * 3. Deploy: firebase deploy --only functions
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import sgMail from '@sendgrid/mail';

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@safenest.app';
const OTP_EXPIRY_MINUTES = 5;

/**
 * Generate random 6-digit OTP code
 */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Hash OTP for secure storage
 */
function hashOTP(otp: string): string {
  // Using a simple hash for demo; in production use bcrypt
  return require('crypto').createHash('sha256').update(otp).digest('hex');
}

/**
 * HTTP Cloud Function: Send OTP via email
 * POST /sendEmailOTP
 * Body: { email: "user@example.com" }
 */
export const sendEmailOTP = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { email } = req.body;

    // Validate email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Invalid email address' });
      return;
    }

    // Generate OTP
    const otp = generateOTP();
    const otpHash = hashOTP(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Store OTP hash in Firestore
    await db.collection('email_otps').doc(email).set({
      otp_hash: otpHash,
      expiresAt: expiresAt,
      attempts: 0,
      created_at: new Date()
    });

    // Send email via SendGrid
    const msg = {
      to: email,
      from: SENDGRID_FROM_EMAIL,
      subject: 'SafeNest - Your OTP Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">SafeNest</h2>
          <p>Your one-time password (OTP) for SafeNest is:</p>
          <h1 style="background-color: #f3f4f6; padding: 20px; text-align: center; letter-spacing: 10px; color: #000; font-weight: bold;">
            ${otp}
          </h1>
          <p style="color: #666;">This code will expire in <strong>${OTP_EXPIRY_MINUTES} minutes</strong>.</p>
          <p style="color: #999; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
        </div>
      `
    };

    await sgMail.send(msg);

    console.log(`[OTP] Email sent to ${email}`);
    res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      email: email
    });
  } catch (error: any) {
    console.error('[OTP] Error sending email:', error);

    // Check if it's a SendGrid API error
    if (error.response?.errors) {
      res.status(400).json({
        error: 'Failed to send email',
        details: error.response.errors
      });
      return;
    }

    res.status(500).json({
      error: 'Internal server error',
      message: error?.message || 'Unknown error'
    });
  }
});

/**
 * HTTP Cloud Function: Verify OTP code
 * POST /verifyEmailOTP
 * Body: { email: "user@example.com", otp: "123456" }
 */
export const verifyEmailOTP = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { email, otp } = req.body;

    // Validate inputs
    if (!email || !otp) {
      res.status(400).json({ error: 'Email and OTP are required' });
      return;
    }

    // Get OTP record from Firestore
    const otpDoc = await db.collection('email_otps').doc(email).get();

    if (!otpDoc.exists) {
      res.status(400).json({ error: 'No OTP found for this email' });
      return;
    }

    const otpData = otpDoc.data();

    // Check expiry
    if (!otpData || new Date() > otpData.expiresAt.toDate()) {
      await db.collection('email_otps').doc(email).delete();
      res.status(400).json({ error: 'OTP expired. Please request a new code' });
      return;
    }

    // Check attempts (prevent brute force)
    if ((otpData?.attempts || 0) >= 5) {
      await db.collection('email_otps').doc(email).delete();
      res.status(429).json({ error: 'Too many attempts. Please request a new code' });
      return;
    }

    // Verify OTP hash
    const otpHash = hashOTP(otp);
    if (otpHash !== otpData?.otp_hash) {
      // Increment attempts
      await db.collection('email_otps').doc(email).update({
        attempts: (otpData?.attempts || 0) + 1
      });

      res.status(400).json({ error: 'Invalid OTP code' });
      return;
    }

    // OTP is valid - delete the record
    await db.collection('email_otps').doc(email).delete();

    console.log(`[OTP] Email verified: ${email}`);
    res.status(200).json({
      success: true,
      message: 'Email verified successfully',
      email: email
    });
  } catch (error: any) {
    console.error('[OTP] Error verifying OTP:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error?.message || 'Unknown error'
    });
  }
});

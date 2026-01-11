# SendGrid Email OTP Setup Guide

## Overview

Your SafeNest app now sends **real email OTP codes** via SendGrid. No more alerts or localStorage.

- **Phone OTP**: Demo mode (123456) - ready for Firebase Blaze upgrade
- **Email OTP**: Real emails via SendGrid (100 emails/day free)

## Setup Steps

### Step 1: Create SendGrid Account (Free)

1. Go to [sendgrid.com](https://sendgrid.com)
2. Sign up → **Free Tier** (100 emails/day)
3. Verify your identity

### Step 2: Get SendGrid API Key

1. In SendGrid dashboard, go to **Settings** → **API Keys**
2. Click **Create API Key**
3. Name it: `SafeNest`
4. Select **Full Access**
5. Copy the key (looks like: `SG.xxx...`)
6. Save it somewhere secure!

### Step 3: Verify Sender Email

1. In SendGrid, go to **Settings** → **Sender Authentication**
2. Click **Verify a Sender** → **Create New Sender**
3. Enter:
   - **From Email**: Your email (e.g., `noreply@safenest.app` or `your-email@gmail.com`)
   - **From Name**: SafeNest
   - **Verify Email**: You'll get confirmation email
4. Click the link in the confirmation email

### Step 4: Deploy Cloud Functions

```bash
# Install Firebase CLI (if you don't have it)
npm install -g firebase-tools

# Login to Firebase
firebase login

# Navigate to functions directory
cd functions

# Install dependencies
npm install

# Set SendGrid API key
firebase functions:config:set sendgrid.api_key="SG_YOUR_KEY_HERE" sendgrid.from_email="noreply@safenest.app"

# Deploy functions
firebase deploy --only functions
```

After deployment, you'll see your function URLs:
```
✔  functions[sendEmailOTP]: https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/sendEmailOTP
✔  functions[verifyEmailOTP]: https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/verifyEmailOTP
```

### Step 5: Update Client Code

In [services/otpService.ts](../services/otpService.ts), replace `YOUR_PROJECT_ID` with your actual Firebase project ID:

```typescript
const response = await fetch(
  'https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/sendEmailOTP',
  //                         ^^^^^^^^^^^^^^^ Change this
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  }
);
```

**Find your Project ID:**
- Firebase Console → Project Settings → Project ID

### Step 6: Test

1. Run your app: `npm run dev`
2. Register as senior, enter email: `test@example.com`
3. Click "Send OTP"
4. Check your email inbox for the OTP code
5. Enter code in app → Should verify successfully ✅

## File Structure

```
safenest/
├── functions/
│   ├── package.json          ← Dependencies
│   └── emailOTP.js           ← Cloud Functions code
├── services/
│   └── otpService.ts         ← Updated to call Cloud Functions
└── ...
```

## How It Works

### Send Email Flow
```
1. User clicks "Send OTP" with email
   ↓
2. Client calls Cloud Function: POST /sendEmailOTP { email }
   ↓
3. Cloud Function generates 6-digit OTP
   ↓
4. Hash OTP, store in Firestore (email_otps collection)
   ↓
5. Send actual email via SendGrid
   ↓
6. User receives email with OTP code
```

### Verify Flow
```
1. User enters OTP code in app
   ↓
2. Client calls Cloud Function: POST /verifyEmailOTP { email, otp }
   ↓
3. Cloud Function retrieves hashed OTP from Firestore
   ↓
4. Compares hashes, checks expiry (5 minutes)
   ↓
5. If valid, deletes OTP record and returns success
   ↓
6. App marks isEmailVerified = true
```

## Cloud Function Details

**sendEmailOTP endpoint:**
- Input: `{ email: "user@example.com" }`
- Generates 6-digit code
- Stores hashed OTP in Firestore (expires in 5 min)
- Sends formatted email via SendGrid
- Output: `{ success: true, email: "user@example.com" }`

**verifyEmailOTP endpoint:**
- Input: `{ email: "user@example.com", otp: "123456" }`
- Validates OTP against stored hash
- Checks 5-minute expiry
- Prevents brute force (max 5 attempts)
- Deletes OTP on success
- Output: `{ success: true, email: "user@example.com" }`

## Troubleshooting

### "Failed to send email" error

**Cause**: SendGrid API key not set or invalid  
**Solution**: Run in functions directory:
```bash
firebase functions:config:set sendgrid.api_key="YOUR_KEY_HERE"
firebase deploy --only functions
```

### Email not received

**Cause**: Sender email not verified in SendGrid  
**Solution**: Go to SendGrid → Settings → Sender Authentication → Verify email

### Function URL not found (404)

**Cause**: Wrong project ID in otpService.ts  
**Solution**: Get correct Project ID from Firebase Console → Project Settings

### "Method not allowed" error

**Cause**: Using GET instead of POST  
**Solution**: Ensure all calls in otpService.ts use `method: 'POST'`

## Monitoring

View function logs:
```bash
firebase functions:log
```

View stored OTPs in Firestore:
- Firebase Console → Firestore Database → `email_otps` collection
- Each document shows email, hash, expiry, attempts

## Cost

- **SendGrid Free**: 100 emails/day (enough for testing)
- **Paid plan**: $29.95/month for 100k emails/month
- **Firebase Functions**: Free up to 2M invocations/month

## Upgrade to Real Phone SMS

Once you're ready for phone SMS:
1. Upgrade Firebase to Blaze plan
2. Enable Firebase Phone Authentication
3. Set `DEMO_MODE = false` in [services/otpService.ts](../services/otpService.ts)
4. Change phone OTP calls from demo to Firebase

---

**Status**: ✅ Email OTP via SendGrid ready!  
**Next**: Deploy Cloud Functions and test registration flow

import React, { useState, useEffect, useRef } from 'react';
import { Shield, Mail, Phone, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

interface OTPVerificationProps {
  phoneNumber?: string;
  email?: string;
  onVerifySuccess: () => void;
  onBack?: () => void;
  onSendOTP: (type: 'phone' | 'email', contact: string) => Promise<boolean>;
  onVerifyOTP: (type: 'phone' | 'email', contact: string, code: string) => Promise<boolean>;
  hideHeader?: boolean;
}

export const OTPVerification: React.FC<OTPVerificationProps> = ({
  phoneNumber,
  email,
  onVerifySuccess,
  onBack,
  onSendOTP,
  onVerifyOTP,
  hideHeader = false
}) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [activeMethod, setActiveMethod] = useState<'phone' | 'email'>('phone');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Start timer for resend
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendTimer]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    // Only allow single digit numbers
    const numericValue = value.replace(/[^0-9]/g, '').slice(-1);
    
    if (!numericValue) return; // Don't update if no valid digit

    const newOtp = [...otp];
    newOtp[index] = numericValue;
    setOtp(newOtp);
    setError('');

    // Auto-focus next input
    if (numericValue && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-verify when all 6 digits entered
    if (index === 5 && numericValue) {
      const code = [...newOtp.slice(0, 5), numericValue].join('');
      if (code.length === 6) {
        handleVerify(code);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = [...otp];
    
    for (let i = 0; i < pastedData.length; i++) {
      newOtp[i] = pastedData[i];
    }
    
    setOtp(newOtp);
    
    // Focus appropriate input
    if (pastedData.length < 6) {
      inputRefs.current[pastedData.length]?.focus();
    } else {
      // Auto-verify if full OTP pasted
      handleVerify(pastedData);
    }
  };

  const handleVerify = async (code?: string) => {
    const otpCode = code || otp.join('');
    
    if (otpCode.length !== 6) {
      setError('Please enter complete 6-digit OTP');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      const contact = activeMethod === 'phone' ? phoneNumber! : email!;
      const verified = await onVerifyOTP(activeMethod, contact, otpCode);
      
      if (verified) {
        setSuccess(true);
        setTimeout(() => {
          onVerifySuccess();
        }, 1000);
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Invalid OTP. Please try again';
      // Provide more helpful error messages
      if (errorMessage.includes('invalid-verification-code')) {
        setError('Incorrect OTP code. Please check the code in your SMS and try again.');
      } else if (errorMessage.includes('code-expired')) {
        setError('OTP code has expired. Please click "Resend OTP" to get a new code.');
      } else {
        setError(errorMessage);
      }
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;

    setCanResend(false);
    setResendTimer(60);
    setError('');
    setOtp(['', '', '', '', '', '']);

    try {
      const contact = activeMethod === 'phone' ? phoneNumber! : email!;
      await onSendOTP(activeMethod, contact);
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      setError(err.message || 'Failed to resend OTP');
      setCanResend(true);
    }
  };

  const switchMethod = async (method: 'phone' | 'email') => {
    if (method === activeMethod) return;

    setActiveMethod(method);
    setOtp(['', '', '', '', '', '']);
    setError('');
    setResendTimer(60);
    setCanResend(false);

    try {
      const contact = method === 'phone' ? phoneNumber! : email!;
      await onSendOTP(method, contact);
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 space-y-6">
        {/* Header - Optional */}
        {!hideHeader && (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <Shield className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Verify Your Account</h1>
            <p className="text-gray-600 text-sm">
              {activeMethod === 'phone' 
                ? `We sent a code to ${phoneNumber}`
                : `We sent a code to ${email}`
              }
            </p>
          </div>
        )}

        {/* OTP Input */}
        <div className="space-y-4">
          <label className="block text-sm font-semibold text-gray-700 text-center">
            Enter OTP
          </label>
          <div className="flex justify-center gap-1.5 sm:gap-2 max-w-full px-2">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={index === 0 ? handlePaste : undefined}
                disabled={isVerifying || success}
                className={`w-9 sm:w-12 h-11 sm:h-14 flex-shrink-0 text-center text-lg sm:text-2xl font-bold border-2 rounded-lg sm:rounded-xl 
                  ${success ? 'border-green-500 bg-green-50' : 
                    error ? 'border-red-500 bg-red-50' : 
                    'border-gray-300 focus:border-blue-500'} 
                  focus:outline-none transition-colors disabled:opacity-50`}
              />
            ))}
          </div>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-green-800 font-medium">Verified successfully!</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-red-800 text-sm">{error}</span>
          </div>
        )}

        {/* Verify Button */}
        {!success && (
          <button
            onClick={() => handleVerify()}
            disabled={isVerifying || otp.some(d => !d)}
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 
              transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isVerifying ? 'Verifying...' : 'Verify OTP'}
          </button>
        )}

        {/* Resend OTP */}
        <div className="text-center space-y-3">
          <button
            onClick={handleResend}
            disabled={!canResend || isVerifying}
            className={`inline-flex items-center gap-2 text-sm font-medium transition-colors
              ${canResend ? 'text-blue-600 hover:text-blue-700' : 'text-gray-400 cursor-not-allowed'}`}
          >
            <RefreshCw className={`w-4 h-4 ${!canResend ? 'animate-spin' : ''}`} />
            {canResend ? 'Resend OTP' : `Resend in ${resendTimer}s`}
          </button>

          {/* Switch Verification Method */}
          {email && phoneNumber && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <span className="text-sm text-gray-600">OR</span>
            </div>
          )}
          
          {email && activeMethod === 'phone' && (
            <button
              onClick={() => switchMethod('email')}
              disabled={isVerifying}
              className="inline-flex items-center gap-2 text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors disabled:opacity-50"
            >
              <Mail className="w-4 h-4" />
              Verify with Email instead
            </button>
          )}

          {phoneNumber && activeMethod === 'email' && (
            <button
              onClick={() => switchMethod('phone')}
              disabled={isVerifying}
              className="inline-flex items-center gap-2 text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors disabled:opacity-50"
            >
              <Phone className="w-4 h-4" />
              Verify with Phone instead
            </button>
          )}
        </div>

        {/* Back Button */}
        {onBack && !success && (
          <button
            onClick={onBack}
            className="w-full text-gray-600 hover:text-gray-900 font-medium py-2 transition-colors"
          >
            Back
          </button>
        )}

        {/* Security Note */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-600">
            🔒 OTP is valid for 5 minutes. Never share your OTP with anyone.
          </p>
        </div>
      </div>

      {/* Hidden reCAPTCHA container */}
      <div id="recaptcha-container"></div>
    </div>
  );
};

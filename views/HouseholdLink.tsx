import React, { useState } from 'react';
import { Home, Link2, RefreshCw, ShieldCheck } from 'lucide-react';
import { UserRole } from '../types';

interface HouseholdLinkProps {
  role: UserRole;
  onSubmit: (code: string) => void;
  existingCode?: string;
  errorMessage?: string;
  isValidating?: boolean;
}

const randomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
};

export const HouseholdLink: React.FC<HouseholdLinkProps> = ({ role, onSubmit, existingCode, errorMessage, isValidating }) => {
  const [code, setCode] = useState(existingCode || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (!clean || clean.length < 3) {
      alert('Enter a code (min 3 characters)');
      return;
    }
    onSubmit(clean);
  };

  const headline = role === UserRole.SENIOR ? 'Create or confirm your household code' : 'Join your senior household';
  const subline = role === UserRole.SENIOR
    ? 'Share this code with caregivers so they receive your status.'
    : 'Ask the senior for their code and enter it here to link.';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-6 sm:p-8 space-y-6">
        <div className="flex items-start gap-3">
          <div className="p-3 rounded-2xl bg-blue-100 text-blue-700 shrink-0">
            <Home className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 break-words">{headline}</h1>
            <p className="text-gray-600 text-sm break-words">{subline}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-semibold text-gray-700">Household code</label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 text-lg font-semibold tracking-wide focus:outline-none focus:border-blue-500"
              placeholder="e.g., HOME123"
              maxLength={12}
            />
            <button
              type="button"
              onClick={() => setCode(randomCode())}
              className=" border-gray-200 rounded-xl text-gray-700 hover:border-blue-500 hover:text-blue-600 flex items-center justify-center gap-2 font-semibold transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Generate Manually
            </button>
          </div>

          <button
            type="submit"
            disabled={isValidating}
            className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
          >
            <Link2 className="w-5 h-5" /> {isValidating ? 'Linking...' : 'Link Household'}
          </button>
        </form>

        {errorMessage && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-sm text-red-800">
            {errorMessage}
          </div>
        )}

        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3">
          <ShieldCheck className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-900">
            Use the same code on all caregiver devices to sync status in real time. You can change the code anytime; all devices must re-enter the new code.
          </div>
        </div>
      </div>
    </div>
  );
};

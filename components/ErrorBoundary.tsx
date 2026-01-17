import React, { ReactNode, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { logger } from '../utils/logger';

interface Props {
  children: ReactNode;
}
/**
 * Global Error Boundary (functional)
 * Catches window errors and unhandled promise rejections
 * Displays a friendly fallback UI instead of crashing
 */
export const ErrorBoundary: React.FC<Props> = ({ children }) => {
  const [error, setError] = useState<Error | null>(null);
  const [stack, setStack] = useState<string | null>(null);

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const err = event.error || new Error(event.message);
      setError(err);
      setStack(err?.stack || null);
      logger.error('Global error captured', { message: event.message, filename: event.filename, lineno: event.lineno, colno: event.colno });
    };
    const onUnhandled = (event: PromiseRejectionEvent) => {
      const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
      setError(reason);
      setStack(reason?.stack || null);
      logger.error('Unhandled promise rejection', reason);
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandled);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandled);
    };
  }, []);

  const handleReset = () => {
    setError(null);
    setStack(null);
  };

  if (error) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
          <div className="flex justify-center mb-6">
            <div className="bg-red-100 rounded-full p-4">
              <AlertTriangle size={48} className="text-red-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center text-gray-900 mb-4">Something Went Wrong</h1>
          <p className="text-center text-gray-600 mb-6">We're sorry, but SafeNest encountered an unexpected error. Please try again.</p>
          {(import.meta as any).env?.DEV && error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 max-h-40 overflow-auto">
              <div className="text-xs font-mono text-red-700">
                <strong>Error:</strong> {error.toString()}
              </div>
              {stack && (
                <div className="text-xs font-mono text-red-600 mt-2">
                  <strong>Stack:</strong>
                  <pre className="mt-1 whitespace-pre-wrap break-words">{stack}</pre>
                </div>
              )}
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={handleReset} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg transition">Try Again</button>
            <button onClick={() => (window.location.href = '/')} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-3 rounded-lg transition">Home</button>
          </div>
          <p className="text-center text-xs text-gray-500 mt-6">If this problem persists, please contact support.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

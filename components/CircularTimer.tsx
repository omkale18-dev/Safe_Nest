import React, { useEffect, useState } from 'react';

interface CircularTimerProps {
  seconds: number;
  onComplete: () => void;
  color?: string;
  label?: string;
  isActive: boolean;
}

export const CircularTimer: React.FC<CircularTimerProps> = ({ 
  seconds, 
  onComplete, 
  color = 'text-red-500', 
  label = 'SECONDS',
  isActive
}) => {
  const [timeLeft, setTimeLeft] = useState(seconds);
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (timeLeft / seconds) * circumference;

  useEffect(() => {
    if (!isActive) return;
    
    if (timeLeft <= 0) {
      onComplete();
      return;
    }

    const timerId = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timerId);
  }, [timeLeft, isActive]);

  return (
    <div className="relative flex items-center justify-center">
      {/* Background Circle */}
      <svg className="transform -rotate-90 w-48 h-48">
        <circle
          cx="96"
          cy="96"
          r={radius}
          stroke="currentColor"
          strokeWidth="12"
          fill="transparent"
          className="text-gray-200"
        />
        {/* Progress Circle */}
        <circle
          cx="96"
          cy="96"
          r={radius}
          stroke="currentColor"
          strokeWidth="12"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={`transition-all duration-1000 ease-linear ${color}`}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-5xl font-bold text-gray-800">{timeLeft}</span>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">{label}</span>
      </div>
    </div>
  );
};
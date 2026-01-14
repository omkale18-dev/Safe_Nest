import React, { useState } from 'react';
import { ChevronRight, Shield, Pill, Phone, Heart, Home } from 'lucide-react';

interface OnboardingScreenProps {
  onComplete: () => void;
}

interface SlideData {
  id: number;
  title: string;
  titleHighlight: string;
  description: string;
  icon: 'welcome' | 'sos' | 'medicine' | 'fall';
  bgGradient: string;
  accentColor: string;
}

const slides: SlideData[] = [
  {
    id: 0,
    title: 'Welcome to',
    titleHighlight: 'SafeNest',
    description: 'Compassionate care for your loved ones, right at your fingertips. Peace of mind starts here.',
    icon: 'welcome',
    bgGradient: 'from-sky-50 to-green-50',
    accentColor: 'sky'
  },
  {
    id: 1,
    title: 'Emergency',
    titleHighlight: 'SOS',
    description: 'Hold the red button for 3 seconds to instantly alert family members and emergency services.',
    icon: 'sos',
    bgGradient: 'from-orange-50 to-red-50',
    accentColor: 'red'
  },
  {
    id: 2,
    title: 'Never Miss a',
    titleHighlight: 'Dose',
    description: 'Set up personalized medicine schedules. We\'ll remind you exactly when it\'s time to take care of yourself.',
    icon: 'medicine',
    bgGradient: 'from-orange-50 to-amber-50',
    accentColor: 'orange'
  },
  {
    id: 3,
    title: '24/7 Fall',
    titleHighlight: 'Detection',
    description: 'Our advanced sensors instantly detect falls and automatically alert caregivers, ensuring help arrives when it matters most.',
    icon: 'fall',
    bgGradient: 'from-orange-50 to-yellow-50',
    accentColor: 'orange'
  }
];

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const isLastSlide = currentSlide === slides.length - 1;
  const slide = slides[currentSlide];

  const handleNext = () => {
    if (isLastSlide) {
      handleComplete();
    } else {
      setCurrentSlide(prev => prev + 1);
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    localStorage.setItem('safenest_onboarding_complete', 'true');
    onComplete();
  };

  // Swipe handling
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && currentSlide < slides.length - 1) {
      setCurrentSlide(prev => prev + 1);
    }
    if (isRightSwipe && currentSlide > 0) {
      setCurrentSlide(prev => prev - 1);
    }
  };

  const renderIcon = () => {
    switch (slide.icon) {
      case 'welcome':
        return (
          <div className="relative flex items-center justify-center">
            {/* App Logo - using the logo image */}
            <img 
              src="/logo.png" 
              alt="SafeNest" 
              className="w-64 h-64 object-contain drop-shadow-lg"
              onError={(e) => {
                // Hide image if not found
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        );

      case 'sos':
        return (
          <div className="relative flex items-center justify-center">
            {/* Ripple effects */}
            <div className="absolute w-32 h-32 bg-red-400 rounded-full opacity-20 animate-ping" style={{ animationDuration: '2s' }} />
            <div className="absolute w-40 h-40 bg-red-300 rounded-full opacity-15 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
            <div className="absolute w-48 h-48 bg-red-200 rounded-full opacity-10 animate-ping" style={{ animationDuration: '2s', animationDelay: '1s' }} />
            {/* Main SOS button */}
            <div className="relative w-32 h-32 bg-gradient-to-br from-red-500 to-red-600 rounded-full shadow-2xl shadow-red-500/40 flex flex-col items-center justify-center border-4 border-white transform hover:scale-105 transition-transform cursor-pointer">
              <span className="text-white text-3xl font-bold">SOS</span>
              <span className="text-white/80 text-[10px] font-semibold tracking-widest mt-1">PRESS</span>
            </div>
            {/* Check badge */}
            <div className="absolute -right-2 top-0 bg-white p-2 rounded-xl shadow-lg animate-bounce" style={{ animationDuration: '2s' }}>
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>
        );

      case 'medicine':
        return (
          <div className="relative animate-float">
            {/* Background circle */}
            <div className="absolute inset-0 bg-white rounded-full shadow-xl" />
            <div className="absolute inset-2 bg-gradient-to-br from-orange-50 to-orange-100 rounded-full" />
            {/* Main icon */}
            <div className="relative w-40 h-40 flex items-center justify-center">
              <Pill className="w-20 h-20 text-orange-500 drop-shadow-md" />
            </div>
            {/* Alarm badge */}
            <div className="absolute -top-2 right-2 bg-white p-2 rounded-xl shadow-lg transform rotate-12">
              <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            {/* Water drop badge */}
            <div className="absolute bottom-2 -left-2 bg-white p-2 rounded-xl shadow-lg transform -rotate-12">
              <svg className="w-6 h-6 text-sky-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
              </svg>
            </div>
          </div>
        );

      case 'fall':
        return (
          <div className="relative">
            {/* Pulsing circles */}
            <div className="absolute w-64 h-64 bg-white rounded-full shadow-lg opacity-40 animate-pulse" style={{ animationDuration: '3s' }} />
            <div className="absolute w-48 h-48 bg-white rounded-full shadow-lg opacity-70 left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2" />
            {/* Main shield */}
            <div className="relative w-32 h-32 bg-gradient-to-br from-orange-500 to-orange-600 rounded-3xl shadow-xl shadow-orange-500/30 flex items-center justify-center transform rotate-3 hover:rotate-0 transition-transform duration-500">
              <Shield className="w-16 h-16 text-white" />
              {/* Check badge */}
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-green-500 rounded-full border-4 border-white flex items-center justify-center shadow-md">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            {/* Alert badge */}
            <div className="absolute bottom-0 right-0 bg-white p-2 rounded-xl shadow-lg flex items-center gap-1 animate-bounce" style={{ animationDuration: '3s' }}>
              <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-xs font-bold text-gray-600 pr-1">Alert!</span>
            </div>
          </div>
        );
    }
  };

  const getButtonColor = () => {
    switch (slide.accentColor) {
      case 'sky': return 'bg-sky-500 hover:bg-sky-600 shadow-sky-500/25';
      case 'red': return 'bg-red-500 hover:bg-red-600 shadow-red-500/30';
      case 'orange': return 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/30';
      default: return 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/30';
    }
  };

  const getHighlightColor = () => {
    switch (slide.accentColor) {
      case 'sky': return 'text-sky-500';
      case 'red': return 'text-red-500';
      case 'orange': return 'text-orange-500';
      default: return 'text-orange-500';
    }
  };

  const getDotColor = () => {
    switch (slide.accentColor) {
      case 'sky': return 'bg-sky-500';
      case 'red': return 'bg-red-500';
      case 'orange': return 'bg-orange-500';
      default: return 'bg-orange-500';
    }
  };

  return (
    <div 
      className={`min-h-screen max-h-screen w-full max-w-full bg-gradient-to-br ${slide.bgGradient} flex flex-col transition-all duration-500 overflow-hidden`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-white/30 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-white/30 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 pointer-events-none" />

      {/* Header with Skip button */}
      <header className="flex justify-between items-center px-6 py-6 z-10">
        <div className="w-10" /> {/* Spacer */}
        <button 
          onClick={handleSkip}
          className="text-gray-500 font-medium text-sm hover:text-gray-700 transition-colors active:scale-95"
        >
          Skip
        </button>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-8 relative z-10">
        {/* Icon area */}
        <div className="relative w-64 h-64 flex items-center justify-center mb-2">
          {renderIcon()}
        </div>

        {/* Text content */}
        <div className="text-center max-w-sm mx-auto space-y-5">
          <h1 className="text-4xl font-bold text-gray-900 leading-tight">
            {slide.title}<br />
            <span className={`${getHighlightColor()} text-5xl`}>{slide.titleHighlight}</span>
          </h1>
          <p className="text-gray-500 text-lg leading-relaxed">
            {slide.description}
          </p>
        </div>
      </main>

      {/* Footer with dots and button */}
      <footer className="px-8 pb-10 pt-4 z-10">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === currentSlide 
                  ? `w-8 ${getDotColor()}` 
                  : 'w-2 bg-gray-300 hover:bg-gray-400'
              }`}
            />
          ))}
        </div>

        {/* Action button */}
        <button 
          onClick={handleNext}
          className={`w-full py-4 ${getButtonColor()} text-white font-semibold text-lg rounded-2xl shadow-lg transition-all duration-200 transform active:scale-[0.98] flex items-center justify-center gap-2 group`}
        >
          <span>{isLastSlide ? 'Get Started' : 'Continue'}</span>
          <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </button>
      </footer>

      {/* Custom animations */}
      <style>{`
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

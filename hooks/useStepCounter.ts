import { useState, useEffect } from 'react';
import { stepCounterService } from '../services/stepCounter';

interface UseStepCounterReturn {
  steps: number;
  isTracking: boolean;
  startTracking: () => void;
  stopTracking: () => void;
  resetSteps: () => void;
  setSensitivity: (threshold: number) => void;
  getSensitivity: () => number;
}

/**
 * React hook for step counter using device accelerometer
 * Automatically starts tracking on mount if available
 */
export const useStepCounter = (autoStart: boolean = true): UseStepCounterReturn => {
  const [steps, setSteps] = useState<number>(() => stepCounterService.getSteps());
  const [isTracking, setIsTracking] = useState<boolean>(() => stepCounterService.isTracking());

  useEffect(() => {
    // Subscribe to step changes
    const unsubscribe = stepCounterService.subscribe((newSteps) => {
      setSteps(newSteps);
    });

    // Auto-start if requested
    if (autoStart && stepCounterService.isSupported()) {
      stepCounterService.startTracking();
      setIsTracking(stepCounterService.isTracking());
    } else {
      setIsTracking(false);
    }

    // Cleanup - don't stop tracking on unmount to allow background operation
    return () => {
      unsubscribe();
      // Keep tracking active in background even when component unmounts
    };
  }, [autoStart]);

  const handleStartTracking = () => {
    if (!stepCounterService.isSupported()) {
      setIsTracking(false);
      return;
    }

    stepCounterService.startTracking();
    setIsTracking(stepCounterService.isTracking());
  };

  const handleStopTracking = () => {
    stepCounterService.stopTracking();
    setIsTracking(false);
  };

  const handleResetSteps = () => {
    stepCounterService.resetSteps();
    setSteps(0);
  };

  const handleSetSensitivity = (threshold: number) => {
    stepCounterService.setSensitivity(threshold);
  };

  const handleGetSensitivity = () => {
    return stepCounterService.getSensitivity();
  };

  return {
    steps,
    isTracking,
    startTracking: handleStartTracking,
    stopTracking: handleStopTracking,
    resetSteps: handleResetSteps,
    setSensitivity: handleSetSensitivity,
    getSensitivity: handleGetSensitivity,
  };
};

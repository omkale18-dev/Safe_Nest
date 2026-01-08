// Step Counter Service using Device Accelerometer
// Detects step patterns from phone motion sensors

interface StepData {
  steps: number;
  lastUpdate: Date;
  dailyDate: string; // YYYY-MM-DD format
}

class StepCounterService {
  private steps: number = 0;
  private lastMagnitude: number = 0;
  private lastPeakTime: number = 0;
  private isListening: boolean = false;
  private peakThreshold: number = 25; // Sensitivity threshold for step detection
  private minStepInterval: number = 300; // Minimum milliseconds between steps (3-4 steps per second max)
  private listeners: ((steps: number) => void)[] = [];

  constructor() {
    this.loadDailySteps();
  }

  /**
   * Load steps from localStorage for today
   */
  private loadDailySteps(): void {
    const today = new Date().toDateString();
    const stored = localStorage.getItem(`steps_${today}`);
    if (stored) {
      try {
        const data: StepData = JSON.parse(stored);
        this.steps = data.steps;
      } catch (e) {
        console.warn('Failed to load steps from storage', e);
        this.steps = 0;
      }
    } else {
      this.steps = 0;
    }
  }

  /**
   * Save steps to localStorage
   */
  private saveDailySteps(): void {
    const today = new Date().toDateString();
    const data: StepData = {
      steps: this.steps,
      lastUpdate: new Date(),
      dailyDate: today
    };
    localStorage.setItem(`steps_${today}`, JSON.stringify(data));
  }

  /**
   * Reset steps at midnight
   */
  private checkAndResetDaily(): void {
    const today = new Date().toDateString();
    const stored = localStorage.getItem(`steps_${today}`);
    if (!stored) {
      this.steps = 0;
      this.saveDailySteps();
    }
  }

  /**
   * Calculate magnitude of acceleration vector
   */
  private calculateMagnitude(x: number, y: number, z: number): number {
    return Math.sqrt(x * x + y * y + z * z);
  }

  /**
   * Detect step based on acceleration magnitude changes
   */
  private detectStep(magnitude: number): void {
    const now = Date.now();

    // Check if enough time has passed since last step (debouncing)
    if (now - this.lastPeakTime < this.minStepInterval) {
      return;
    }

    // Detect peak in acceleration (indicates footfall)
    if (magnitude > this.peakThreshold && magnitude > this.lastMagnitude) {
      this.lastPeakTime = now;
      this.steps++;
      this.saveDailySteps();
      this.notifyListeners();
    }

    this.lastMagnitude = magnitude;
  }

  /**
   * Notify all registered listeners of step count change
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.steps));
  }

  /**
   * Start listening to device motion/accelerometer
   */
  public startTracking(): void {
    if (this.isListening) return;

    this.checkAndResetDaily();

    // Check for DeviceMotionEvent support
    if (typeof DeviceMotionEvent === 'undefined') {
      console.warn('DeviceMotionEvent not supported on this device');
      return;
    }

    // Request permission for iOS 13+
    if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      (DeviceMotionEvent as any)
        .requestPermission()
        .then((permission: string) => {
          if (permission === 'granted') {
            this.attachMotionListener();
          } else {
            console.warn('Motion permission denied');
          }
        })
        .catch((error: Error) => {
          console.warn('Error requesting motion permission:', error);
        });
    } else {
      // For non-iOS devices
      this.attachMotionListener();
    }

    this.isListening = true;
  }

  /**
   * Attach the actual motion event listener
   */
  private attachMotionListener(): void {
    const handleMotion = (event: DeviceMotionEvent) => {
      const acceleration = event.acceleration;
      if (acceleration) {
        const magnitude = this.calculateMagnitude(
          acceleration.x || 0,
          acceleration.y || 0,
          acceleration.z || 0
        );
        this.detectStep(magnitude);
      }
    };

    window.addEventListener('devicemotion', handleMotion, false);
  }

  /**
   * Stop listening to device motion
   */
  public stopTracking(): void {
    if (!this.isListening) return;

    window.removeEventListener('devicemotion', () => {});
    this.isListening = false;
  }

  /**
   * Get current step count
   */
  public getSteps(): number {
    this.checkAndResetDaily();
    return this.steps;
  }

  /**
   * Manually add steps (for testing or manual entry)
   */
  public addSteps(count: number): void {
    this.steps += count;
    this.saveDailySteps();
    this.notifyListeners();
  }

  /**
   * Reset step count to 0
   */
  public resetSteps(): void {
    this.steps = 0;
    this.saveDailySteps();
    this.notifyListeners();
  }

  /**
   * Register a listener to be called when steps change
   */
  public subscribe(listener: (steps: number) => void): () => void {
    this.listeners.push(listener);
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Adjust sensitivity/threshold
   */
  public setSensitivity(threshold: number): void {
    this.peakThreshold = threshold;
  }

  /**
   * Get current sensitivity
   */
  public getSensitivity(): number {
    return this.peakThreshold;
  }
}

// Export singleton instance
export const stepCounterService = new StepCounterService();

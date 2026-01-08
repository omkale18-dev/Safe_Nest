// Service Worker for step counter background tracking
// This allows step counting to continue even when the app is closed

let stepCounter = 0;
let lastMagnitude = 0;
let lastPeakTime = 0;
const peakThreshold = 25;
const minStepInterval = 300;

// Initialize on service worker activation
self.addEventListener('activate', (event) => {
  console.log('[StepCounter Worker] Activated');
  event.waitUntil(
    self.clients.claim()
  );
});

// Listen for messages from the app
self.addEventListener('message', (event) => {
  const { type, data } = event.data;

  switch (type) {
    case 'START_TRACKING':
      console.log('[StepCounter Worker] Starting background tracking');
      startBackgroundTracking();
      break;
    case 'STOP_TRACKING':
      console.log('[StepCounter Worker] Stopping background tracking');
      stopBackgroundTracking();
      break;
    case 'GET_STEPS':
      getStepsFromStorage().then(steps => {
        event.ports[0].postMessage({ type: 'STEPS', steps });
      });
      break;
    case 'RESET_STEPS':
      resetStepsStorage();
      event.ports[0].postMessage({ type: 'RESET_DONE' });
      break;
  }
});

/**
 * Start background step tracking using accelerometer
 */
function startBackgroundTracking() {
  console.log('[StepCounter Worker] Requesting accelerometer access');
  
  // Use Generic Sensor API if available
  if ('sensors' in navigator && 'LinearAccelerationSensor' in window) {
    try {
        const sensor = new window.LinearAccelerationSensor({ frequency: 60 });
      
      sensor.addEventListener('reading', () => {
        const { x = 0, y = 0, z = 0 } = sensor;
        const magnitude = Math.sqrt(x * x + y * y + z * z);
        detectStep(magnitude);
      });

      sensor.addEventListener('error', (event) => {
        console.warn('[StepCounter Worker] Sensor error:', event.error);
      });

      sensor.start();
      console.log('[StepCounter Worker] Linear Acceleration Sensor started');
    } catch (e) {
      console.warn('[StepCounter Worker] Failed to start sensor:', e);
      fallbackTracking();
    }
  } else {
    fallbackTracking();
  }
}

/**
 * Fallback tracking method for devices without Generic Sensor API
 */
function fallbackTracking() {
  console.log('[StepCounter Worker] Using fallback tracking method');
  
  // This is a basic fallback - modern devices should use Generic Sensor API
  // For background tracking on service worker, we can also use periodic sync
  if ('periodicSync' in self.registration) {
    self.registration.periodicSync.register('step-counter-sync', {
      minInterval: 15 * 60 * 1000, // 15 minutes
    });
  }
}

/**
 * Stop background tracking
 */
function stopBackgroundTracking() {
  // Stop all active sensors
  console.log('[StepCounter Worker] Tracking stopped');
}

/**
 * Detect a single step from acceleration magnitude
 */
function detectStep(magnitude) {
  const now = Date.now();

  // Check if enough time has passed since last step (debouncing)
  if (now - lastPeakTime < minStepInterval) {
    lastMagnitude = magnitude;
    return;
  }

  // Detect peak in acceleration (indicates footfall)
  if (magnitude > peakThreshold && magnitude > lastMagnitude) {
    lastPeakTime = now;
    stepCounter++;
    saveDailySteps();
    notifyClients();
  }

  lastMagnitude = magnitude;
}

/**
 * Save steps to IndexedDB for persistence
 */
function saveDailySteps() {
  const today = new Date().toDateString();
  const data = {
    steps: stepCounter,
    lastUpdate: new Date().toISOString(),
    dailyDate: today,
  };

  // Try to save to IndexedDB for better persistence
  if ('indexedDB' in self) {
    const request = indexedDB.open('SafeNestDB', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['steps'], 'readwrite');
      const objectStore = transaction.objectStore('steps');
      objectStore.put(data, 'today');
    };

    request.onerror = () => {
      console.warn('[StepCounter Worker] IndexedDB error, falling back to localStorage');
      localStorage.setItem(`steps_${today}`, JSON.stringify(data));
    };
  } else {
    localStorage.setItem(`steps_${today}`, JSON.stringify(data));
  }
}

/**
 * Get steps from storage
 */
async function getStepsFromStorage() {
  const today = new Date().toDateString();

  // Try IndexedDB first
  if ('indexedDB' in self) {
    return new Promise((resolve) => {
      const request = indexedDB.open('SafeNestDB', 1);
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['steps'], 'readonly');
        const objectStore = transaction.objectStore('steps');
        const getRequest = objectStore.get('today');

        getRequest.onsuccess = () => {
          if (getRequest.result) {
            resolve(getRequest.result.steps);
          } else {
            resolve(stepCounter);
          }
        };

        getRequest.onerror = () => {
          const stored = localStorage.getItem(`steps_${today}`);
          if (stored) {
            try {
              const data = JSON.parse(stored);
              resolve(data.steps);
            } catch {
              resolve(stepCounter);
            }
          } else {
            resolve(stepCounter);
          }
        };
      };

      request.onerror = () => {
        const stored = localStorage.getItem(`steps_${today}`);
        if (stored) {
          try {
            const data = JSON.parse(stored);
            resolve(data.steps);
          } catch {
            resolve(stepCounter);
          }
        } else {
          resolve(stepCounter);
        }
      };
    });
  } else {
    const stored = localStorage.getItem(`steps_${today}`);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        return data.steps;
      } catch {
        return stepCounter;
      }
    }
    return stepCounter;
  }
}

/**
 * Reset steps storage
 */
function resetStepsStorage() {
  const today = new Date().toDateString();
  stepCounter = 0;
  
  localStorage.removeItem(`steps_${today}`);

  if ('indexedDB' in self) {
    const request = indexedDB.open('SafeNestDB', 1);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['steps'], 'readwrite');
      const objectStore = transaction.objectStore('steps');
      objectStore.delete('today');
    };
  }
}

/**
 * Notify all connected clients about step count changes
 */
function notifyClients() {
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: 'STEP_UPDATE',
        steps: stepCounter,
      });
    });
  });
}

// Handle periodic sync events for iOS compatibility
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'step-counter-sync') {
    event.waitUntil(
      getStepsFromStorage().then((steps) => {
        console.log('[StepCounter Worker] Periodic sync - current steps:', steps);
      })
    );
  }
});

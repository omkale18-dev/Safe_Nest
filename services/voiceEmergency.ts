interface VoiceEmergencyConfig {
  volumeThreshold: number; // dB threshold for "shouting"
  durationMs: number; // How long the shout must last
  onEmergencyDetected: () => void;
}

// Global flag to track if microphone permission was granted
let microphonePermissionGranted = false;
// Global stream to reuse (avoids multiple getUserMedia calls)
let globalMicrophoneStream: MediaStream | null = null;

class VoiceEmergencyDetector {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private isMonitoring = false;
  private config: VoiceEmergencyConfig;
  private checkInterval: any = null;
  private consecutiveHighVolumeCount = 0;

  constructor(config: VoiceEmergencyConfig) {
    this.config = config;
  }

  // Request microphone permission once and store the stream globally
  async requestPermission(): Promise<boolean> {
    // Check if existing stream is still active
    if (microphonePermissionGranted && globalMicrophoneStream && globalMicrophoneStream.active) {
      console.log('[VoiceEmergency] Permission already granted, reusing active stream');
      return true;
    }

    // Stream became inactive, need to request fresh
    if (globalMicrophoneStream && !globalMicrophoneStream.active) {
      console.log('[VoiceEmergency] Previous stream inactive, requesting fresh stream...');
      globalMicrophoneStream = null;
      microphonePermissionGranted = false;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('[VoiceEmergency] getUserMedia not available');
      return false;
    }

    try {
      console.log('[VoiceEmergency] Requesting microphone permission...');
      globalMicrophoneStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        } 
      });
      microphonePermissionGranted = true;
      console.log('[VoiceEmergency] ✓ Microphone permission granted and stream stored, active:', globalMicrophoneStream.active);
      return true;
    } catch (error: any) {
      console.error('[VoiceEmergency] Permission denied:', error?.name, error?.message);
      microphonePermissionGranted = false;
      globalMicrophoneStream = null;
      return false;
    }
  }

  async startMonitoring(): Promise<boolean> {
    if (this.isMonitoring) {
      console.log('[VoiceEmergency] Already monitoring');
      return true;
    }

    // Check if mediaDevices is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('[VoiceEmergency] getUserMedia not available');
      return false;
    }

    // Check if stream is still active, if not request fresh permission
    if (!globalMicrophoneStream || !globalMicrophoneStream.active) {
      console.log('[VoiceEmergency] No active stream, requesting permission...');
      const granted = await this.requestPermission();
      if (!granted) {
        console.error('[VoiceEmergency] Could not get microphone permission');
        return false;
      }
    }

    try {
      console.log('[VoiceEmergency] Starting monitoring with existing stream...');
      
      // Reuse the global stream (no additional getUserMedia call)
      this.stream = globalMicrophoneStream;
      
      console.log('[VoiceEmergency] ✓ Using stored microphone stream, active:', this.stream?.active);

      // Create audio context and analyser
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Resume audio context if suspended (required by some browsers/Capacitor)
      if (this.audioContext.state === 'suspended') {
        console.log('[VoiceEmergency] Resuming suspended audio context...');
        await this.audioContext.resume();
      }
      
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.8;

      // Connect microphone to analyser
      this.microphone = this.audioContext.createMediaStreamSource(this.stream);
      this.microphone.connect(this.analyser);

      this.isMonitoring = true;
      console.log('[VoiceEmergency] ✓ Started monitoring (threshold:', this.config.volumeThreshold, 'dB)');

      // Start checking audio levels
      this.checkInterval = setInterval(() => this.checkAudioLevel(), 100);

      return true;
    } catch (error: any) {
      console.error('[VoiceEmergency] Failed to start monitoring:', error?.name, error?.message);
      if (error?.name === 'NotAllowedError') {
        console.error('[VoiceEmergency] Microphone permission was denied');
      } else if (error?.name === 'NotFoundError') {
        console.error('[VoiceEmergency] No microphone found on this device');
      }
      return false;
    }
  }

  private checkAudioLevel() {
    if (!this.analyser) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);

    // Calculate RMS (Root Mean Square) volume
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / bufferLength);
    const volume = Math.round(rms);

    // Convert to approximate dB with adjusted scaling (matches 70-80 dB thresholds)
    const db = volume > 0 ? 20 * Math.log10(volume / 255) + 90 : 0;

    // Check if volume exceeds threshold (indicates shouting)
    if (db > this.config.volumeThreshold) {
      this.consecutiveHighVolumeCount++;
      console.log(`[VoiceEmergency] High volume detected: ${db.toFixed(1)} dB (count: ${this.consecutiveHighVolumeCount})`);

      // If sustained high volume (3+ checks = ~300ms of shouting)
      if (this.consecutiveHighVolumeCount >= 3) {
        console.log('[VoiceEmergency] EMERGENCY DETECTED - Sustained shouting/loud sound!');
        this.config.onEmergencyDetected();
        this.consecutiveHighVolumeCount = 0; // Reset to avoid multiple triggers
        
        // Add cooldown period
        this.stopMonitoring();
        setTimeout(() => {
          if (!this.isMonitoring) {
            this.startMonitoring();
          }
        }, 5000); // 5 second cooldown
      }
    } else {
      // Reset counter if volume drops
      if (this.consecutiveHighVolumeCount > 0) {
        this.consecutiveHighVolumeCount = 0;
      }
    }
  }

  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    if (this.microphone) {
      this.microphone.disconnect();
      this.microphone = null;
    }

    // DON'T stop the stream - keep it alive for reuse
    // Just disconnect from it
    this.stream = null;

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.analyser = null;
    this.isMonitoring = false;
    this.consecutiveHighVolumeCount = 0;
    console.log('[VoiceEmergency] Stopped monitoring (keeping stream alive for reuse)');
  }

  isActive(): boolean {
    return this.isMonitoring;
  }

  updateConfig(config: Partial<VoiceEmergencyConfig>) {
    this.config = { ...this.config, ...config };
  }
}

export default VoiceEmergencyDetector;
export type { VoiceEmergencyConfig };

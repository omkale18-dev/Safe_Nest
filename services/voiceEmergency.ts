interface VoiceEmergencyConfig {
  volumeThreshold: number; // dB threshold for "shouting"
  durationMs: number; // How long the shout must last
  onEmergencyDetected: () => void;
}

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

  async startMonitoring(): Promise<boolean> {
    if (this.isMonitoring) {
      console.log('[VoiceEmergency] Already monitoring');
      return true;
    }

    try {
      // Request microphone permission
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        } 
      });

      // Create audio context and analyser
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.8;

      // Connect microphone to analyser
      this.microphone = this.audioContext.createMediaStreamSource(this.stream);
      this.microphone.connect(this.analyser);

      this.isMonitoring = true;
      console.log('[VoiceEmergency] Started monitoring');

      // Start checking audio levels
      this.checkInterval = setInterval(() => this.checkAudioLevel(), 100);

      return true;
    } catch (error) {
      console.error('[VoiceEmergency] Failed to start monitoring:', error);
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

    // Convert to approximate dB (simplified)
    const db = volume > 0 ? 20 * Math.log10(volume / 255) + 60 : 0;

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

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.analyser = null;
    this.isMonitoring = false;
    this.consecutiveHighVolumeCount = 0;
    console.log('[VoiceEmergency] Stopped monitoring');
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

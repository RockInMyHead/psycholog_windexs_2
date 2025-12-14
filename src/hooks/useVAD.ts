import { useRef, useCallback, useState } from 'react';
import { DeviceProfile } from './useDeviceProfile';

export interface VADState {
  isVoiceActive: boolean;
  lastVoiceActivity: number;
  voiceDetectionStreak: number;
  lastSendTime: number;
}

export interface VADConfig {
  minVolumeThreshold: number;
  minSizeThreshold: number;
  minDurationMs: number;
  cooldownMs: number;
  volumeDetectionFrames: number;
}

export const useVAD = (deviceProfile: DeviceProfile) => {
  // Store deviceProfile in ref to prevent recreating callbacks
  const deviceProfileRef = useRef(deviceProfile);
  deviceProfileRef.current = deviceProfile;
  
  const [state, setState] = useState<VADState>({
    isVoiceActive: false,
    lastVoiceActivity: 0,
    voiceDetectionStreak: 0,
    lastSendTime: 0
  });

  const stateRef = useRef(state);
  const volumeMonitorRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Update ref when state changes
  stateRef.current = state;

  const getVADConfig = useCallback((): VADConfig => {
    const profile = deviceProfileRef.current;
    if (profile?.isIOS) {
      return {
        minVolumeThreshold: 2.5, // RMS percentage
        minSizeThreshold: 40000, // bytes
        minDurationMs: 1500, // minimum duration for voice
        cooldownMs: 2000, // cooldown between sends
        volumeDetectionFrames: 3 // frames to confirm voice
      };
    } else {
      return {
        minVolumeThreshold: 1.5,
        minSizeThreshold: 20000,
        minDurationMs: 1000,
        cooldownMs: 2000,
        volumeDetectionFrames: 2
      };
    }
  }, []);

  const estimateVolumeFromBlob = useCallback((audioBlob: Blob): number => {
    const size = audioBlob.size;
    if (size < 1000) return 0.001;       // Very small - likely silence
    if (size < 5000) return 0.5;         // Small chunks - could be voice
    if (size < 15000) return 1.0;        // Medium chunks - likely some voice
    if (size < 30000) return 3.0;        // Large chunks - normal voice (above iOS 2.5% threshold)
    return 5.0;                         // Very large - loud voice
  }, []);

  const checkAudioVolume = useCallback(async (audioBlob: Blob): Promise<number> => {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioContextClass();
      const arrayBuffer = await audioBlob.arrayBuffer();

      let audioBuffer: AudioBuffer;
      try {
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      } catch (decodeError) {
        // iOS/Safari often fails to decode audio/mp4 blobs; use size-based fallback
        audioContext.close();
        return estimateVolumeFromBlob(audioBlob);
      }

      // Calculate RMS volume across all channels
      let sumSquares = 0;
      let count = 0;

      for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
        const channelData = audioBuffer.getChannelData(channel);
        for (let i = 0; i < channelData.length; i++) {
          const sample = channelData[i];
          sumSquares += sample * sample;
          count++;
        }
      }

      const rms = Math.sqrt(sumSquares / count);
      const volumePercent = rms * 100;

      audioContext.close();
      return volumePercent;
    } catch (error) {
      console.warn('[VAD] Volume check error:', error);
      return estimateVolumeFromBlob(audioBlob);
    }
  }, [estimateVolumeFromBlob]);

  const shouldSendAudio = useCallback(async (audioBlob: Blob, durationMs: number): Promise<boolean> => {
    const config = getVADConfig();
    const now = Date.now();

    // Check cooldown
    if (now - stateRef.current.lastSendTime < config.cooldownMs) {
      return false;
    }

    // Check minimum duration
    if (durationMs < config.minDurationMs) {
      return false;
    }

    // Check size threshold
    if (audioBlob.size < config.minSizeThreshold) {
      return false;
    }

    // Check volume (try Web Audio API first, fallback to estimation)
    let volumeLevel: number;
    try {
      volumeLevel = await checkAudioVolume(audioBlob);
    } catch (error) {
      volumeLevel = estimateVolumeFromBlob(audioBlob);
    }

    return volumeLevel >= config.minVolumeThreshold;
  }, [getVADConfig, checkAudioVolume, estimateVolumeFromBlob]);

  const updateVoiceActivity = useCallback((hasVoice: boolean, timestamp: number = Date.now()) => {
    setState(prev => {
      const newStreak = hasVoice ? prev.voiceDetectionStreak + 1 : 0;
      const isActive = hasVoice || (prev.isVoiceActive && newStreak > 0);

      return {
        ...prev,
        isVoiceActive: isActive,
        lastVoiceActivity: hasVoice ? timestamp : prev.lastVoiceActivity,
        voiceDetectionStreak: newStreak
      };
    });
  }, []);

  const markSendTime = useCallback((timestamp: number = Date.now()) => {
    setState(prev => ({
      ...prev,
      lastSendTime: timestamp
    }));
  }, []);

  const resetVADState = useCallback(() => {
    setState({
      isVoiceActive: false,
      lastVoiceActivity: 0,
      voiceDetectionStreak: 0,
      lastSendTime: 0
    });
  }, []);

  // Volume monitoring for interruption detection
  const startVolumeMonitoring = useCallback((stream: MediaStream, onInterruption?: () => void) => {
    if (!onInterruption) return;

    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioContextClass();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      let detectionCount = 0;
      let lastSpeechTime = 0;

      const checkVolume = () => {
        if (!analyserRef.current) return;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

        const currentTime = Date.now();
        const isIOS = deviceProfile.isIOS;
        const threshold = isIOS ? 35 : (deviceProfile.isSafari ? 40 : 30);
        const debounceTime = isIOS ? 800 : 1000;
        const confirmationFrames = isIOS ? 3 : 2;

        if (average > threshold) {
          detectionCount++;
          if (detectionCount >= confirmationFrames) {
            const soundDuration = currentTime - lastSpeechTime;
            const minDurationForVoice = isIOS ? 1500 : debounceTime;

            if (soundDuration > minDurationForVoice) {
              onInterruption();
              lastSpeechTime = currentTime;
              detectionCount = 0;
            }
          }
        } else {
          detectionCount = 0;
        }

        volumeMonitorRef.current = requestAnimationFrame(checkVolume);
      };

      volumeMonitorRef.current = requestAnimationFrame(checkVolume);
    } catch (error) {
      console.warn('[VAD] Volume monitoring failed:', error);
    }
  }, [deviceProfile]);

  const stopVolumeMonitoring = useCallback(() => {
    if (volumeMonitorRef.current) {
      cancelAnimationFrame(volumeMonitorRef.current);
      volumeMonitorRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
  }, []);

  return {
    state,
    getVADConfig,
    shouldSendAudio,
    updateVoiceActivity,
    markSendTime,
    resetVADState,
    startVolumeMonitoring,
    stopVolumeMonitoring
  };
};
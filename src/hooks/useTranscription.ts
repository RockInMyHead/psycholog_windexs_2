import { useState, useRef, useEffect, useCallback } from 'react';
import { useDeviceProfile } from './useDeviceProfile';
import { useAudioCapture } from './useAudioCapture';
import { useVAD } from './useVAD';
import { useBrowserSTT } from './useBrowserSTT';
import { useOpenAISTT } from './useOpenAISTT';
import { useTTSEchoGuard } from './useTTSEchoGuard';
import { useSTTTextProcessor } from './useSTTTextProcessor';

interface UseTranscriptionProps {
  onTranscriptionComplete: (text: string, source: 'browser' | 'openai' | 'manual') => void;
  onSpeechStart?: () => void;
  onInterruption?: () => void; // Called when user interrupts via voice
  isTTSActiveRef: React.MutableRefObject<boolean>; // To check if TTS is playing for echo cancellation
  onError?: (error: string) => void;
}

export const useTranscription = ({
  onTranscriptionComplete,
  onSpeechStart,
  onInterruption,
  isTTSActiveRef,
  onError,
  addDebugLog = console.log
}: UseTranscriptionProps & { addDebugLog?: (message: string) => void }) => {
  // Device detection
  const { profile: deviceProfile, detectDevice, getTranscriptionStrategy, shouldForceOpenAI } = useDeviceProfile();

  // Initialize device profile
  useEffect(() => {
    detectDevice();
  }, [detectDevice]);

  const [transcriptionStatus, setTranscriptionStatus] = useState<string | null>(null);
  const [transcriptionMode, setTranscriptionMode] = useState<'browser' | 'openai'>('browser');
  const [microphoneAccessGranted, setMicrophoneAccessGranted] = useState(false);
  const [microphonePermissionStatus, setMicrophonePermissionStatus] = useState<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown');

  // TTS Echo Guard
  const ttsGuard = useTTSEchoGuard(deviceProfile);

  // Text processing
  const textProcessor = useSTTTextProcessor();

  // Audio capture
  const audioCapture = useAudioCapture(deviceProfile);

  // Voice Activity Detection
  const vad = useVAD(deviceProfile);

  // Browser STT
  const browserSTT = useBrowserSTT(
    deviceProfile!,
    (text, isFinal) => {
      if (isFinal) {
        const normalized = textProcessor.normalizeSTT(text);
        if (normalized) {
          addDebugLog(`[User] 🎤 Пользователь сказал: "${normalized}" (browser)`);
          onTranscriptionComplete(normalized, 'browser');
        }
      }
    },
    (error) => {
      addDebugLog(`[BrowserSTT] Error: ${error}`);
      onError?.(error);
    },
    onInterruption
  );

  // OpenAI STT
  const openaiSTT = useOpenAISTT(deviceProfile);

  // Mobile transcription timer
  const mobileTranscriptionTimerRef = useRef<number | null>(null);

  // --- Mobile Transcription Timer ---
  const startMobileTranscriptionTimer = useCallback(() => {
    if (mobileTranscriptionTimerRef.current) return;

    addDebugLog(`[Mobile] Starting transcription timer (2s check interval)`);

    mobileTranscriptionTimerRef.current = window.setInterval(async () => {
      const now = Date.now();

      // Don't process if TTS is active or in echo protection
      if (ttsGuard.shouldSuppressSTT(now)) {
        return;
      }

      try {
        // Stop recording to get current accumulated audio
        const blob = await audioCapture.stopRecording();
        addDebugLog(`[Timer] Got accumulated blob: ${blob?.size || 0} bytes`);

        // IMMEDIATELY restart recording for next segment
        if (audioCapture.state.audioStream) {
          await audioCapture.startRecording(audioCapture.state.audioStream);
        }

        // Check if we should send this audio
        if (blob && await vad.shouldSendAudio(blob, 2000)) { // 2s duration
          setTranscriptionStatus("Отправляю аудио на сервер...");
          const text = await openaiSTT.transcribeWithOpenAI(blob);

          if (text) {
            const normalized = textProcessor.normalizeSTT(text);
            if (normalized) {
              addDebugLog(`[Mobile] ✅ Transcribed: "${normalized}"`);
              vad.markSendTime(now);
              onTranscriptionComplete(normalized, 'openai');
            }
          }
          setTranscriptionStatus("");
        }
      } catch (error) {
        addDebugLog(`[Mobile] Error in timer: ${error}`);
        // Restart recording on error
        if (audioCapture.state.audioStream && !audioCapture.state.isRecording) {
          await audioCapture.startRecording(audioCapture.state.audioStream);
        }
      }
    }, 2000); // Check every 2 seconds
  }, [ttsGuard, audioCapture, vad, openaiSTT, textProcessor, onTranscriptionComplete, addDebugLog]);

  const stopMobileTranscriptionTimer = useCallback(() => {
    if (mobileTranscriptionTimerRef.current) {
      addDebugLog(`[Mobile] Stopping transcription timer`);
      clearInterval(mobileTranscriptionTimerRef.current);
      mobileTranscriptionTimerRef.current = null;
    }
  }, [addDebugLog]);

  // --- Initialization ---
  const initializeRecognition = useCallback(async () => {
    addDebugLog(`[Init] 🚀 Starting recognition initialization...`);

    // Check microphone permissions
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        setMicrophonePermissionStatus(result.state);
        result.addEventListener('change', () => {
          setMicrophonePermissionStatus(result.state);
        });
      } catch (error) {
        console.log("[Permissions] Could not query microphone permissions:", error);
      }
    }

    // Reset state
    textProcessor.clearDuplicates();
    vad.resetVADState();
    ttsGuard.setTTSActive(false, 0);

    // Get microphone stream
    try {
      const constraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: deviceProfile.isIOS ? { ideal: 16000 } : { ideal: 44100 },
        channelCount: { ideal: 1 }
      };

      addDebugLog(`[Mic] Requesting access...`);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
      addDebugLog(`[Mic] ✅ Access granted | Tracks: ${stream.getTracks().length}`);

      setMicrophoneAccessGranted(true);

      // Start audio capture
      await audioCapture.startRecording(stream);

      // Start volume monitoring for interruption detection
      vad.startVolumeMonitoring(stream, onInterruption);

      // Choose transcription strategy
      const strategy = getTranscriptionStrategy(deviceProfile);
      const forceOpenAI = shouldForceOpenAI(deviceProfile);

      addDebugLog(`[Strategy] ${strategy} | Force OpenAI: ${forceOpenAI}`);

      if (forceOpenAI) {
        // Android or forced OpenAI mode
        setTranscriptionMode('openai');
        startMobileTranscriptionTimer();
      } else {
        // iOS starts with browser mode, Android uses OpenAI
        if (deviceProfile.isIOS) {
          setTranscriptionMode('browser');
          browserSTT.start();
        } else {
          setTranscriptionMode('openai');
          startMobileTranscriptionTimer();
        }
      }

    } catch (error: any) {
      console.error('[Mic] ❌ Failed:', error);
      setMicrophoneAccessGranted(false);
      onError?.(`Ошибка доступа к микрофону: ${error.message}`);
    }
  }, [
    deviceProfile, getTranscriptionStrategy, shouldForceOpenAI,
    audioCapture, vad, browserSTT, textProcessor, ttsGuard,
    onError, onInterruption, addDebugLog, startMobileTranscriptionTimer
  ]);

  // --- TTS Control ---
  const pauseRecordingForTTS = useCallback(() => {
    addDebugLog(`[TTS] Pausing recording for TTS`);
    ttsGuard.setTTSActive(true, Date.now());

    // Pause audio capture
    audioCapture.pauseRecording();

    // Stop volume monitoring
    vad.stopVolumeMonitoring();

    // Stop browser STT if active
    if (transcriptionMode === 'browser') {
      browserSTT.pause();
    }
  }, [ttsGuard, audioCapture, vad, browserSTT, transcriptionMode, addDebugLog]);

  const resumeRecordingAfterTTS = useCallback(() => {
    const resumeDelay = ttsGuard.getResumeDelay();
    addDebugLog(`[TTS] Resuming after TTS with ${resumeDelay}ms delay`);

    setTimeout(() => {
      ttsGuard.setTTSActive(false, Date.now());

      // Resume audio capture
      if (audioCapture.state.audioStream && audioCapture.state.isPaused) {
        audioCapture.resumeRecording();
      }

      // Restart volume monitoring
      if (audioCapture.state.audioStream) {
        vad.startVolumeMonitoring(audioCapture.state.audioStream, onInterruption);
      }

      // Resume appropriate transcription
      if (transcriptionMode === 'browser') {
        browserSTT.resume();
      }
      // Mobile timer continues automatically
    }, resumeDelay);
  }, [ttsGuard, audioCapture, vad, browserSTT, transcriptionMode, onInterruption, addDebugLog]);

  // --- Cleanup ---
  const cleanup = useCallback(() => {
    addDebugLog('[Transcription] 🧹 Cleanup called');

    // Stop everything
    stopMobileTranscriptionTimer();
    browserSTT.stop();
    vad.stopVolumeMonitoring();
    audioCapture.cleanup();

    // Reset state
    textProcessor.clearDuplicates();
    vad.resetVADState();
    ttsGuard.setTTSActive(false, 0);

    setTranscriptionStatus(null);
    setTranscriptionMode('browser');
    setMicrophoneAccessGranted(false);
  }, [
    stopMobileTranscriptionTimer, browserSTT, vad, audioCapture,
    textProcessor, ttsGuard, addDebugLog
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    initializeRecognition,
    cleanup,
    transcriptionStatus,
    microphoneAccessGranted,
    microphonePermissionStatus,
    isIOS: deviceProfile.isIOS,
    forceOpenAI: shouldForceOpenAI(deviceProfile),
    transcriptionMode,
    stopRecognition: browserSTT.stop,
    startRecognition: browserSTT.start,
    pauseRecordingForTTS,
    resumeRecordingAfterTTS
  };
};

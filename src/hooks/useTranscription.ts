import { useState, useRef, useCallback, useEffect } from 'react';
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
  // Device detection (synchronously initialized, never null)
  const { profile: deviceProfile, getTranscriptionStrategy, shouldForceOpenAI } = useDeviceProfile();

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
    deviceProfile,
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
        addDebugLog(`[Permissions] Microphone permission status: ${result.state}`);

        result.addEventListener('change', () => {
          setMicrophonePermissionStatus(result.state);
          addDebugLog(`[Permissions] Microphone permission changed to: ${result.state}`);
        });
      } catch (error) {
        addDebugLog(`[Permissions] Could not query microphone permissions: ${error}`);
      }
    } else {
      addDebugLog(`[Permissions] Permissions API not available`);
    }

    // Additional iOS diagnostics
    if (deviceProfile.isIOS) {
      addDebugLog(`[iOS Diagnostics] HTTPS: ${location.protocol === 'https:'}, Permissions API: ${!!navigator.permissions}, Secure Context: ${window.isSecureContext}`);
    }

    // Reset state
    textProcessor.clearDuplicates();
    vad.resetVADState();
    ttsGuard.setTTSActive(false, 0);

    // Get microphone stream with progressive fallback
    try {
      let stream: MediaStream;

      if (deviceProfile.isIOS) {
        // iOS progressive approach: try simple constraints first, then advanced
        addDebugLog(`[Mic] iOS: Trying simple constraints first...`);

        try {
          // Step 1: Try minimal constraints
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
          });
          addDebugLog(`[Mic] ✅ iOS simple constraints worked | Tracks: ${stream.getTracks().length}`);
        } catch (simpleError) {
          addDebugLog(`[Mic] ❌ iOS simple constraints failed: ${simpleError.message}, trying advanced...`);

          // Step 2: Try advanced constraints
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: { ideal: 16000 },
              channelCount: { ideal: 1 }
            }
          });
          addDebugLog(`[Mic] ✅ iOS advanced constraints worked | Tracks: ${stream.getTracks().length}`);
        }
      } else {
        // Desktop: use full constraints directly
        const constraints = {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: { ideal: 44100 },
          channelCount: { ideal: 1 }
        };

        addDebugLog(`[Mic] Desktop: Requesting access with constraints...`);
        stream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
        addDebugLog(`[Mic] ✅ Desktop access granted | Tracks: ${stream.getTracks().length}`);
      }

      // Additional iOS diagnostics and track validation
      const audioTracks = stream.getAudioTracks();

      if (deviceProfile.isIOS) {
        addDebugLog(`[iOS] Validating ${audioTracks.length} audio tracks...`);

        audioTracks.forEach((track, index) => {
          addDebugLog(`[iOS Track ${index}] enabled: ${track.enabled}, muted: ${track.muted}, readyState: ${track.readyState}, label: ${track.label}`);

          // Check if track is actually working
          if (!track.enabled) {
            addDebugLog(`[iOS] ⚠️ Track ${index} is disabled, trying to enable...`);
            track.enabled = true;
          }

          // Monitor track state changes
          track.onended = () => addDebugLog(`[iOS] Track ${index} ended`);
          track.onmute = () => addDebugLog(`[iOS] Track ${index} muted`);
          track.onunmute = () => addDebugLog(`[iOS] Track ${index} unmuted`);
        });

        // iOS specific: wait a bit for tracks to stabilize
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Final validation
      const activeTracks = audioTracks.filter(track => track.enabled && !track.muted);
      if (activeTracks.length === 0) {
        throw new Error('No active audio tracks available');
      }

      addDebugLog(`[Mic] ✅ Final validation passed | Active tracks: ${activeTracks.length}`);
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

      // Enhanced error handling for iOS with detailed diagnostics
      let userFriendlyErrorMessage = "Ошибка доступа к микрофону";
      let diagnosticInfo = {
        errorName: error.name,
        errorMessage: error.message,
        isIOS: deviceProfile.isIOS,
        httpsEnabled: window.isSecureContext,
        permissionsAPISupported: !!navigator.permissions,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
      };

      addDebugLog(`[Mic Error] Detailed diagnostics: ${JSON.stringify(diagnosticInfo, null, 2)}`);

      if (deviceProfile.isIOS) {
        // iOS-specific error handling with progressive solutions
        if (error.name === 'NotAllowedError') {
          userFriendlyErrorMessage = "Доступ к микрофону запрещен. Следуйте инструкциям настройки выше. Если проблема persists, попробуйте: 1) Перезагрузить iPhone 2) Очистить кэш Safari 3) Использовать другой браузер.";
        } else if (error.name === 'NotFoundError') {
          userFriendlyErrorMessage = "Микрофон не найден или не работает. Проверьте: 1) Работает ли микрофон в других приложениях (Диктофон) 2) Нет ли физических повреждений 3) Подключен ли внешний микрофон.";
        } else if (error.name === 'NotReadableError') {
          userFriendlyErrorMessage = "Микрофон занят системой iOS. Попробуйте: 1) Перезагрузить iPhone 2) Закрыть все другие приложения 3) Перезапустить Safari 4) Временно отключить Siri и другие сервисы.";
        } else if (error.name === 'SecurityError') {
          userFriendlyErrorMessage = "Требуется защищенное соединение. Убедитесь что адрес начинается с 'https://' и сайт использует SSL-сертификат.";
        } else if (error.name === 'AbortError') {
          userFriendlyErrorMessage = "Запрос был прерван. Попробуйте еще раз. Если проблема повторяется - перезагрузите страницу.";
        } else if (error.name === 'NotSupportedError') {
          userFriendlyErrorMessage = "Ваш браузер не поддерживает доступ к микрофону. Обновите Safari до последней версии или используйте другой браузер.";
        } else {
          userFriendlyErrorMessage = `Неизвестная ошибка доступа к микрофону на iOS: ${error.message || 'Без описания'}. Рекомендуем: 1) Перезагрузить iPhone 2) Очистить данные Safari 3) Попробовать в приватном режиме.`;
        }
      } else {
        // Generic error handling for other platforms
        if (error.name === 'NotAllowedError') {
          userFriendlyErrorMessage = "Доступ к микрофону заблокирован браузером. В адресной строке браузера нажмите на 🔒 (замочек) и разрешите доступ к микрофону.";
        } else if (error.name === 'NotFoundError') {
          userFriendlyErrorMessage = "Микрофон не найден. Проверьте подключение микрофона и настройки звука.";
        } else if (error.name === 'NotReadableError') {
          userFriendlyErrorMessage = "Микрофон занят другим приложением или вкладкой. Закройте другие приложения.";
        } else if (error.name === 'SecurityError') {
          userFriendlyErrorMessage = "Требуется защищенное соединение (HTTPS) для доступа к микрофону.";
        } else {
          userFriendlyErrorMessage = `Ошибка доступа к микрофону: ${error.message || 'Неизвестная ошибка'}. Попробуйте перезагрузить страницу.`;
        }
      }

      onError?.(userFriendlyErrorMessage);
    }
  }, [
    deviceProfile, getTranscriptionStrategy, shouldForceOpenAI,
    audioCapture, vad, browserSTT, textProcessor, ttsGuard,
    onError, onInterruption, addDebugLog, startMobileTranscriptionTimer
  ]);

  // --- TTS Control ---
  const pauseRecordingForTTS = useCallback(() => {
    // Reduce logging frequency for common TTS pause events
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
    // Reduce logging frequency - only log important events
    if (resumeDelay > 1000) { // Only log if delay is significant
    addDebugLog(`[TTS] Resuming after TTS with ${resumeDelay}ms delay`);
    }

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
  const cleanup = useCallback((resetMicrophoneState: boolean = true) => {
    const callStack = new Error().stack;
    const caller = callStack?.split('\n')[2]?.trim() || 'unknown';
    addDebugLog(`[Transcription] 🧹 Cleanup called (resetMic: ${resetMicrophoneState}) - Called from: ${caller}`);

    try {
      // Safe cleanup - check if functions exist before calling
      if (mobileTranscriptionTimerRef.current) {
        clearInterval(mobileTranscriptionTimerRef.current);
        mobileTranscriptionTimerRef.current = null;
      }

      // Stop audio stream if it exists
      if (audioCapture?.state?.audioStream) {
        audioCapture.state.audioStream.getTracks().forEach(track => {
          try { track.stop(); } catch (e) { /* ignore */ }
        });
      }

      // Reset basic state
      setTranscriptionStatus(null);
      setTranscriptionMode('browser');

      // Only reset microphone access if explicitly requested
      if (resetMicrophoneState) {
        setMicrophoneAccessGranted(false);
      }

      addDebugLog(`[Transcription] 🧹 Cleanup completed successfully`);
    } catch (error) {
      addDebugLog(`[Transcription] Cleanup error (non-critical): ${error}`);
    }
  }, [addDebugLog]); // Only depend on addDebugLog

  // Cleanup on unmount - only when component actually unmounts
  useEffect(() => {
    return () => cleanup(true); // Full cleanup on unmount
  }, []); // Remove cleanup dependency to prevent excessive calls

  // Manual microphone access test for troubleshooting
  const testMicrophoneAccess = useCallback(async () => {
    try {
      addDebugLog(`[Mic Test] Manual microphone access test starting...`);

      const testStream = await navigator.mediaDevices.getUserMedia({
        audio: deviceProfile.isIOS ? { echoCancellation: false } : { echoCancellation: true }
      });

      const tracks = testStream.getAudioTracks();
      addDebugLog(`[Mic Test] ✅ Access successful | Tracks: ${tracks.length}`);

      // Log track details
      tracks.forEach((track, index) => {
        addDebugLog(`[Mic Test Track ${index}] label: ${track.label}, enabled: ${track.enabled}, muted: ${track.muted}`);
      });

      // Clean up test stream
      testStream.getTracks().forEach(track => track.stop());

      return { success: true, tracks: tracks.length };
    } catch (error: any) {
      addDebugLog(`[Mic Test] ❌ Access failed: ${error.name} - ${error.message}`);
      return { success: false, error: error.name, message: error.message };
    }
  }, [deviceProfile.isIOS, addDebugLog]);

  return {
    initializeRecognition,
    cleanup: (resetMicrophoneState = true) => cleanup(resetMicrophoneState),
    transcriptionStatus,
    microphoneAccessGranted,
    microphonePermissionStatus,
    isIOS: deviceProfile.isIOS,
    forceOpenAI: shouldForceOpenAI(deviceProfile),
    transcriptionMode,
    stopRecognition: browserSTT.stop,
    startRecognition: browserSTT.start,
    pauseRecordingForTTS,
    resumeRecordingAfterTTS,
    testMicrophoneAccess
  };
};

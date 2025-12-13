import { useState, useRef, useEffect, useCallback } from 'react';
import { psychologistAI } from '@/services/openai';

// Minimal SpeechRecognition type shims for browsers (Safari/Chrome)
type SpeechRecognitionErrorEvent = Event & { error: string };
type SpeechRecognitionEvent = Event & { results: SpeechRecognitionResultList; resultIndex: number };
type SpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onspeechstart?: () => void;
  onerror?: (event: SpeechRecognitionErrorEvent) => void;
  onend?: () => void;
};

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
  addDebugLog = console.log // Default to console.log if not provided
}: UseTranscriptionProps & { addDebugLog?: (message: string) => void }) => {
  const [transcriptionStatus, setTranscriptionStatus] = useState<string | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [forceOpenAI, setForceOpenAI] = useState(false);
  const [transcriptionMode, setTranscriptionMode] = useState<'browser' | 'openai'>('browser');
  const [microphoneAccessGranted, setMicrophoneAccessGranted] = useState(false);
  const [microphonePermissionStatus, setMicrophonePermissionStatus] = useState<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown');
  const mobileTranscriptionTimerRef = useRef<number | null>(null);
  
  // Refs
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const recognitionActiveRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const volumeMonitorRef = useRef<number | null>(null);
  const browserRetryCountRef = useRef(0);
  const justResumedAfterTTSRef = useRef(false);
  const ttsEndTimeRef = useRef(0); // Track when TTS ended
  const mobileVoiceDetectionStreakRef = useRef(0); // consecutive detections before sending

  // Constants
  const SAFARI_VOICE_DETECTION_THRESHOLD = 40;
  const SAFARI_SPEECH_CONFIRMATION_FRAMES = 3;
  const SAFARI_SPEECH_DEBOUNCE = 1000;

  // Filter out hallucinated text patterns
  const filterHallucinatedText = (text: string): string | null => {
    if (!text) return null;

    const lowerText = text.toLowerCase();

    // Common hallucinated patterns
    const hallucinationPatterns = [
      /продолжение следует/i,
      /с вами был/i,
      /до свидания/i,
      /до новых встреч/i,
      /спасибо за внимание/i,
      /конец/i,
      /закончили/i,
      /я мухаммад асад/i,
      /здравствуйте! я мухаммад асад/i,
      /я марк/i, // Filter out AI introducing itself
      /здравствуйте, я марк/i,
    ];

    // Check if text matches hallucination patterns
    for (const pattern of hallucinationPatterns) {
      if (pattern.test(lowerText)) {
        return null;
      }
    }

    // Filter out text that's too long (likely hallucination)
    if (text.length > 100) {
      return null;
    }

    // Filter out text with multiple sentences (likely not user speech)
    if (text.split(/[.!?]/).length > 2) {
      return null;
    }

    // Filter out very short text (likely noise/misinterpretation)
    if (text.length < 2) {
      return null;
    }

    // Filter out single characters or meaningless sounds
    const meaninglessPatterns = [
      /^[а-я]{1}$/i, // Single letter
      /^[эээ|ммм|ааа|ууу|ооо]+$/i, // Only filler sounds
      /^[а-я]{1,2}$/i, // 1-2 letters (likely noise)
    ];

    for (const pattern of meaninglessPatterns) {
      if (pattern.test(text)) {
        return null;
      }
    }

    return text;
  };

  // Safari Interruption State
  const [safariSpeechDetectionCount, setSafariSpeechDetectionCount] = useState(0);
  const [lastSafariSpeechTime, setLastSafariSpeechTime] = useState(0);

  // Voice Activity Detection (VAD) State
  const [lastVoiceActivityTime, setLastVoiceActivityTime] = useState(0);
  const lastVoiceActivityRef = useRef(0);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const isVoiceActiveRef = useRef(false);
  const lastSendTimeRef = useRef(0);

  // --- Browser Detection Helpers ---
  const isSafari = useCallback(() => {
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  }, []);

  const hasEchoProblems = useCallback(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    // Добавляем Yandex Browser к списку, т.к. он на Chromium и дает эхо TTS->STT
    return /chrome|chromium|edg\/|opera|brave|yabrowser|yaapp/.test(userAgent);
  }, []);

  const isIOSDevice = useCallback(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(userAgent) ||
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }, []);

  const isLegacyIOS = useCallback(() => {
    // Простая эвристика: старые iOS 10–12 чаще на iPhone 6/7 и дают сбои с аудио
    const match = navigator.userAgent.match(/OS (\d+)_/);
    if (!match) return false;
    const major = parseInt(match[1], 10);
    return major > 0 && major <= 12;
  }, []);

  const isAndroidDevice = useCallback(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    return /android/.test(userAgent);
  }, []);

  const isMobileDevice = useCallback(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    addDebugLog(`[Mobile] Device: ${isMobile ? 'Mobile' : 'Desktop'} | iOS: ${isIOSDevice()} | Android: ${isAndroidDevice()} | Platform: ${navigator.platform}`);
    return isMobile;
  }, [isIOSDevice]);

  // Check microphone permissions (for modern browsers)
  const checkMicrophonePermissions = useCallback(async () => {
    if (!navigator.permissions || !navigator.permissions.query) {
      console.log("[Permissions] Permissions API not available");
      return;
    }

    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      console.log("[Permissions] Microphone permission status:", result.state);
      setMicrophonePermissionStatus(result.state);

      result.addEventListener('change', () => {
        console.log("[Permissions] Microphone permission changed to:", result.state);
        setMicrophonePermissionStatus(result.state);
      });
    } catch (error) {
      console.log("[Permissions] Could not query microphone permissions:", error);
    }
  }, []);

  // Mobile-specific transcription timer (checks silence every 2s, sends only when voice detected)
  const startMobileTranscriptionTimer = useCallback(() => {
    if (mobileTranscriptionTimerRef.current) return;

    addDebugLog(`[Mobile] Starting transcription timer (2s check interval, 15s timeout, voice-triggered sending)`);

    // Ensure VAD baseline timestamps are fresh when timer starts
    const now = Date.now();
    lastVoiceActivityRef.current = now;
    setLastVoiceActivityTime(now);
    isVoiceActiveRef.current = false;
    setIsVoiceActive(false);

    mobileTranscriptionTimerRef.current = window.setInterval(async () => {
      const now = Date.now();
      const timeSinceLastVoice = now - lastVoiceActivityRef.current;

      addDebugLog(`[Timer] ⏰ Check: timeSinceLastVoice=${(timeSinceLastVoice/1000).toFixed(1)}s, isVoiceActive=${isVoiceActiveRef.current}`);

      // Voice Activity Detection: stop timer if no voice activity for 45 seconds (less aggressive on iOS)
      const vadTimeout = 45000; // 45 seconds total timeout
      if (timeSinceLastVoice > vadTimeout && !isVoiceActiveRef.current) {
        addDebugLog(`[VAD] No voice activity for ${vadTimeout/1000}s, stopping timer`);
        stopMobileTranscriptionTimer();
        return;
      }

      if (!mediaRecorderRef.current) {
        addDebugLog(`[Timer] ❌ No media recorder active`);
        return;
      }

      // Only process audio if we haven't sent recently (prevent spam)
      // Wait at least 2 seconds after last successful send
      const timeSinceLastSend = now - (lastSendTimeRef.current || 0);
      if (timeSinceLastSend < 2000) {
        addDebugLog(`[Timer] ⏸️ Too soon since last send (${timeSinceLastSend}ms), skipping`);
        return;
      }

      const isAndroid = isAndroidDevice();
      const isIOS = isIOSDevice();
      addDebugLog(`[Timer] ✅ Checking audio (iOS=${isIOS}, Android=${isAndroid})...`);

      try {
        // Stop recording to get current accumulated audio
        const blob = await stopMediaRecording();
        addDebugLog(`[Timer] Got accumulated blob: ${blob?.size || 0} bytes`);

        // IMMEDIATELY restart recording for next segment
        if (audioStreamRef.current) {
          startMediaRecording(audioStreamRef.current);
        }

        // Only process if we have meaningful audio data
        if (blob && blob.size > 5000) { // Higher threshold for accumulated audio to ensure quality
          const volumeLevel = await checkAudioVolume(blob);
          addDebugLog(`[Mobile] Accumulated audio volume: ${volumeLevel.toFixed(4)}% (RMS calculation)`);

          const volumeThreshold = isIOS ? 2.5 : 1.5; // Stricter thresholds to avoid noise-triggered sends
          const sizeThreshold = isIOS ? 40000 : 20000;
          const hasVoiceLevel = volumeLevel >= volumeThreshold;
          const hasEnoughSize = blob.size >= sizeThreshold;
          const shouldSend = hasVoiceLevel && hasEnoughSize; // Require both volume and size everywhere to prevent silent sends

          if (shouldSend) {
            mobileVoiceDetectionStreakRef.current += 1;
            const streak = mobileVoiceDetectionStreakRef.current;

            if (streak >= 2) {
            // Voice detected in accumulated audio - send it!
            addDebugLog(`[Mobile] 🎤 Voice detected (volume=${volumeLevel.toFixed(4)}%, size=${blob.size}b; thr=${volumeThreshold.toFixed(2)}%, sizeThr=${sizeThreshold}), sending to OpenAI...`);
            mobileVoiceDetectionStreakRef.current = 0; // reset after confirmed detection

            // Update VAD state - voice is active
            lastVoiceActivityRef.current = now;
          setLastVoiceActivityTime(now);
            isVoiceActiveRef.current = true;
          setIsVoiceActive(true);
            lastSendTimeRef.current = now;

            // If TTS is playing and user speaks — barge-in but do not send this noisy chunk
          if (isTTSActiveRef.current) {
              addDebugLog(`[Mobile] 🛑 TTS active but voice detected — interrupting and skipping send`);
            isTTSActiveRef.current = false;
            onInterruption?.();
              recordedChunksRef.current = [];
              return;
          }

            // Send to OpenAI
          const transcriptionPromise = transcribeWithOpenAI(blob);
            const timeoutMs = isIOS ? 25000 : 8000; // Longer timeout for iOS
          const timeoutPromise = new Promise<null>((resolve) => {
            setTimeout(() => {
              addDebugLog(`[Mobile] ⏱️ OpenAI timeout (${timeoutMs}ms), skipping`);
              resolve(null);
            }, timeoutMs);
          });

          const text = await Promise.race([transcriptionPromise, timeoutPromise]);

          if (text && text.trim()) {
            const filteredText = filterHallucinatedText(text.trim());
            if (filteredText) {
              addDebugLog(`[Mobile] ✅ Transcribed: "${filteredText}"`);
              onTranscriptionComplete(filteredText, 'openai');
            } else {
              addDebugLog(`[Mobile] ⚠️ Filtered hallucination: "${text}"`);
            }
            }
            } else {
              addDebugLog(`[Mobile] ⏳ Voice candidate but waiting for confirmation (streak ${streak}/2)`);
            }
          } else {
            // Silence detected - update VAD but don't send
            mobileVoiceDetectionStreakRef.current = 0;
            isVoiceActiveRef.current = false;
            setIsVoiceActive(false);
            addDebugLog(`[Mobile] 🔇 Low volume in accumulated audio (${volumeLevel.toFixed(4)}% < ${volumeThreshold.toFixed(4)}% or size=${blob.size}b < ${sizeThreshold}), not sending`);
            recordedChunksRef.current = []; // Drop accumulated silence to avoid size-based triggers
          }
        } else {
          addDebugLog(`[Mobile] Audio too small: ${blob?.size || 0} bytes, skipping`);
        }
      } catch (error) {
        addDebugLog(`[Mobile] Error in timer: ${error}`);
        // Restart recording on error
        if (audioStreamRef.current && !mediaRecorderRef.current) {
          startMediaRecording(audioStreamRef.current);
        }
      }
    }, 2000); // Check every 2 seconds for voice activity
  }, [isIOSDevice]);

  const stopMobileTranscriptionTimer = useCallback(() => {
    if (mobileTranscriptionTimerRef.current) {
      addDebugLog(`[Mobile] Stopping transcription timer`);
      clearInterval(mobileTranscriptionTimerRef.current);
      mobileTranscriptionTimerRef.current = null;

      // Ensure recorder and stream are stopped when timer stops
      stopMediaRecording();
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
        audioStreamRef.current = null;
        addDebugLog(`[Mobile] Audio stream stopped after timer stop`);
      }
    }
  }, []);

  // Restart timer if voice is detected after silence
  const restartTimerIfNeeded = useCallback(() => {
    if (!mobileTranscriptionTimerRef.current) {
      addDebugLog(`[VAD] Voice detected after silence, restarting timer`);
      startMobileTranscriptionTimer();
    }
  }, [startMobileTranscriptionTimer]);

  // Check audio volume level to filter out silence/noise
  const checkAudioVolume = async (audioBlob: Blob): Promise<number> => {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioContextClass();
      const arrayBuffer = await audioBlob.arrayBuffer();
      let audioBuffer: AudioBuffer;
      try {
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      } catch (decodeError) {
        // iOS/Safari often fails to decode audio/mp4 blobs; use size-based fallback
        addDebugLog(`[VolumeCheck] decodeAudioData failed: ${decodeError}`);
        audioContext.close();
        return estimateVolumeFromBlob(audioBlob);
      }
      
      // Calculate RMS (Root Mean Square) volume across all channels for better accuracy
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
      const volumePercent = rms * 100; // Convert to percentage
      
      audioContext.close();
      return volumePercent;
    } catch (error) {
      addDebugLog(`[VolumeCheck] Error checking volume: ${error}`);
      return estimateVolumeFromBlob(audioBlob);
    }
  };

  // Fallback volume estimation when Web Audio decoding fails (common on iOS audio/mp4)
  const estimateVolumeFromBlob = (audioBlob: Blob): number => {
    const size = audioBlob.size;
    if (size < 1000) return 0.001;       // Very small - likely silence
    if (size < 5000) return 0.002;       // Small chunks - quiet
    if (size < 15000) return 0.01;       // Medium chunks - some voice
    if (size < 30000) return 0.03;       // Large chunks - normal voice
    return 0.06;                         // Very large - loud voice
  };

  // --- OpenAI Fallback Logic (via server API) ---
  const transcribeWithOpenAI = async (audioBlob: Blob, retryCount = 0): Promise<string | null> => {
    const isIOS = isIOSDevice();
    const maxRetries = isIOS ? 2 : 1; // More retries for iOS due to connection issues

    try {
      addDebugLog(`[OpenAI] Starting transcription via server: ${audioBlob.size} bytes (attempt ${retryCount + 1}/${maxRetries + 1})`);
      setTranscriptionStatus("Отправляю аудио на сервер...");

      const formData = new FormData();
      formData.append('file', audioBlob, 'voice.webm');
      formData.append('model', 'whisper-1');
      formData.append('language', 'ru');
      formData.append('response_format', 'text');
      formData.append('prompt', 'Разговор с психологом. Короткие фразы: Привет, Да, Нет, Хорошо, Понял.');

      const response = await fetch('/api/audio/transcriptions', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData?.error?.message) {
            errorMessage = `${errorMessage}: ${errorData.error.message}`;
          }
        } catch {
          // ignore JSON parse errors
        }
        throw new Error(errorMessage);
      }

      const transcription = await response.json();
      const text = (transcription.text || transcription).toString().trim();
      
      if (text && text.trim()) {
        addDebugLog(`[OpenAI] ✅ Server transcription success: "${text.substring(0, 50)}..."`);
        return text.trim();
      }
      addDebugLog(`[OpenAI] ⚠️ Empty transcription result from server`);
      return null;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addDebugLog(`[OpenAI] ❌ Failed (attempt ${retryCount + 1}): ${errorMessage}`);

      // Retry on connection / transient errors
      if (
        retryCount < maxRetries &&
        (
          errorMessage.includes('Connection') ||
          errorMessage.includes('Network') ||
          errorMessage.includes('timeout') ||
          errorMessage.includes('fetch') ||
          errorMessage.includes('HTTP 429') ||
          errorMessage.includes('HTTP 500') ||
          errorMessage.includes('HTTP 502') ||
          errorMessage.includes('HTTP 503')
        )
      ) {
        addDebugLog(`[OpenAI] 🔄 Retrying in 1s... (${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return transcribeWithOpenAI(audioBlob, retryCount + 1);
      }

      return null;
    } finally {
      setTranscriptionStatus("");
    }
  };

  // --- Media Recorder Logic ---
  const startMediaRecording = (stream: MediaStream) => {
    if (mediaRecorderRef.current) return;

    try {
      const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/wav'];
      const supportedTypes = mimeTypes.filter(type => MediaRecorder.isTypeSupported(type));

      addDebugLog(`[MediaRec] Supported types: ${supportedTypes.join(', ')}`);

      const selectedMimeType = supportedTypes[0];

      if (!selectedMimeType) {
        addDebugLog(`[MediaRec] ❌ No supported MediaRecorder format found`);
        return;
      }

      addDebugLog(`[MediaRec] Using format: ${selectedMimeType}`);

      const recorder = new MediaRecorder(stream, { mimeType: selectedMimeType });
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];

      recorder.ondataavailable = async (e) => {
        // Во время TTS глушим запись (кроме Safari, где оставляем старое поведение)
        if (!isSafari() && isTTSActiveRef.current) {
          return;
        }
        if (e.data.size > 0) {
          const isIOS = isIOSDevice();

          if (isIOS && e.data.size > 15000) { // iOS: отправлять большие чанки сразу (realtime)
            addDebugLog(`[MediaRec] 📱 iOS realtime chunk: ${e.data.size} bytes - sending immediately`);

            // Создать blob из текущего чанка
            const chunkBlob = new Blob([e.data], { type: e.data.type });

            // Отправить на транскрибацию сразу (не ждать таймера)
            transcribeWithOpenAI(chunkBlob).then(text => {
              if (text && text.trim()) {
                const filteredText = filterHallucinatedText(text.trim());
                if (filteredText) {
                  addDebugLog(`[Mobile] ✅ iOS Realtime transcribed: "${filteredText}"`);
                  onTranscriptionComplete(filteredText, 'openai');
                }
              }
            }).catch(error => {
              addDebugLog(`[Mobile] ❌ iOS realtime transcription error: ${error}`);
            });

            // Не накапливать для таймера на iOS
          } else {
            // Android/Desktop: накопление для таймера
            recordedChunksRef.current.push(e.data);
            addDebugLog(`[MediaRec] Recorded chunk: ${e.data.size} bytes`);
          }

          // Real-time volume monitoring for voice interruption (use estimate for iOS)
          if (e.data.size > 1000) {
            try {
              // Use Web Audio API for desktop, estimate for iOS
              const isIOS = isIOSDevice();
              let volumeLevel: number;

              if (isIOS) {
                // iOS audio/mp4 often fails with Web Audio API, use size-based estimate
                volumeLevel = estimateVolumeFromBlob(e.data);
              } else {
                // Try Web Audio API for better accuracy on desktop
                try {
                  volumeLevel = await checkAudioVolume(e.data);
                } catch (error) {
                  // Fallback to estimation if Web Audio fails
                  volumeLevel = estimateVolumeFromBlob(e.data);
                }
              }

              const interruptionThreshold = isIOS ? 0.8 : 0.5; // Lower threshold for iOS interruption to detect user speaking

              if (volumeLevel >= interruptionThreshold) {
                addDebugLog(`[VoiceInterrupt] 🎤 Voice interruption detected (${volumeLevel.toFixed(4)}% > ${interruptionThreshold.toFixed(4)}%)`);
                onInterruption?.();
              }
            } catch (error) {
              // Ignore volume monitoring errors
              addDebugLog(`[VoiceInterrupt] ⚠️ Volume monitoring failed: ${error}`);
            }
          }
        }
      };

      recorder.onstart = () => {
        addDebugLog(`[MediaRec] ✅ Recording started (${selectedMimeType})`);
      };

      recorder.onstop = () => {
        addDebugLog(`[MediaRec] 🛑 Recording stopped`);
      };

      recorder.onerror = (event) => {
        addDebugLog(`[MediaRec] ❌ Recording error: ${event.error?.message || 'Unknown error'}`);
      };

      recorder.start(1000);
      addDebugLog(`[MediaRec] Starting recording with 1s chunks`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorName = error instanceof Error ? error.name : 'Unknown';
      addDebugLog(`[MediaRec] ❌ Start failed: ${errorMessage} | Name: ${errorName}`);
    }
  };

  const stopMediaRecording = async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current) {
        addDebugLog(`[MediaRec] No active recorder to stop`);
        resolve(null);
        return;
      }

      addDebugLog(`[MediaRec] Stopping recording...`);

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: mediaRecorderRef.current?.mimeType || 'audio/webm'
        });
        addDebugLog(`[MediaRec] Created blob: ${blob.size} bytes, type: ${blob.type}`);
        recordedChunksRef.current = [];
        mediaRecorderRef.current = null;
        resolve(blob);
      };

      mediaRecorderRef.current.stop();
    });
  };

  // --- Volume Monitoring (Interruption) ---
  const startVolumeMonitoring = async (stream: MediaStream) => {
    try {
      addDebugLog(`[Volume] Starting audio analysis...`);
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioContextClass();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioAnalyserRef.current = analyser;
      addDebugLog(`[Volume] ✅ Audio context created`);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkVolume = () => {
        if (!recognitionActiveRef.current || !audioAnalyserRef.current) return;
        
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

        // Safari Optimization Logic
        if (!hasEchoProblems()) {
          const isAssistantActive = isTTSActiveRef.current;
          const threshold = isAssistantActive ? SAFARI_VOICE_DETECTION_THRESHOLD + 15 : SAFARI_VOICE_DETECTION_THRESHOLD;
          const currentTime = Date.now();

          if (average > threshold) {
             setSafariSpeechDetectionCount(prev => {
               const newCount = prev + 1;
               if (newCount >= SAFARI_SPEECH_CONFIRMATION_FRAMES) {
                 if (currentTime - lastSafariSpeechTime > SAFARI_SPEECH_DEBOUNCE) {
                   addDebugLog(`[Volume] 🎤 Voice interruption (vol: ${average.toFixed(1)})`);
                   setLastSafariSpeechTime(currentTime);
                   onInterruption?.();
                   return 0;
                 }
               }
               return newCount;
             });
          } else {
            setSafariSpeechDetectionCount(0);
          }
        }
        volumeMonitorRef.current = requestAnimationFrame(checkVolume);
      };
      volumeMonitorRef.current = requestAnimationFrame(checkVolume);
    } catch (error) {
      console.warn("[Transcription] Volume monitoring failed:", error);
    }
  };

  const stopVolumeMonitoring = () => {
    if (volumeMonitorRef.current) {
      cancelAnimationFrame(volumeMonitorRef.current);
      volumeMonitorRef.current = null;
    }
    if (audioAnalyserRef.current) {
      audioAnalyserRef.current.disconnect();
      audioAnalyserRef.current = null;
    }
  };

    // Track last processed text to prevent duplicates
  const lastProcessedTextRef = useRef<string>('');

  // --- Speech Recognition Setup ---
  const initializeRecognition = useCallback(async () => {
    console.log("[Transcription] 🚀 Starting recognition initialization...");

    // Check microphone permissions first
    await checkMicrophonePermissions();

    // Reset processed text on initialization
    lastProcessedTextRef.current = '';

    // Device Checks
    const ios = isIOSDevice();
    const mobile = isMobileDevice();
    setIsIOS(ios);

    // API Support Check
    const speechRecognitionSupport = !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition;
    const mediaDevicesSupport = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    const mediaRecorderSupport = typeof MediaRecorder !== 'undefined';

    addDebugLog(`[API] SpeechRec: ${speechRecognitionSupport ? '✅' : '❌'} | MediaDev: ${mediaDevicesSupport ? '✅' : '❌'} | MediaRec: ${mediaRecorderSupport ? '✅' : '❌'}`);
    addDebugLog(`[Device] iOS: ${ios} | Mobile: ${mobile} | HTTPS: ${location.protocol === 'https:'} | Touch: ${navigator.maxTouchPoints > 0}`);

    // Check Support
    const hasSupport = speechRecognitionSupport;
    const android = isAndroidDevice();

    // Desktop работает в Browser Mode для лучшей отзывчивости
    // iOS и Android ВСЕГДА используют OpenAI STT для надежности и качества
    // OpenAI-режим для остальных случаев без поддержки
    const shouldForceOpenAI = !hasSupport || ios || android;

    addDebugLog(
      `[Strategy] ${shouldForceOpenAI ? 'OpenAI Mode' : 'Browser Mode'} | Reason: ` +
      (ios ? 'iOS device (OpenAI STT)' :
       android ? 'Android device (OpenAI STT)' :
       !hasSupport ? 'No SpeechRecognition Support' : 'Desktop browser SpeechRecognition')
    );

    setForceOpenAI(shouldForceOpenAI);

    if (shouldForceOpenAI) {
      setTranscriptionMode('openai');
    }

    // Get Microphone Stream
    try {
      const isMobile = isMobileDevice();
      const isAndroid = isAndroidDevice();

      // Try different constraint sets for Android devices
      let constraints;
      let attemptNumber = 0;

      const tryGetMicrophone = async (audioConstraints: any): Promise<MediaStream> => {
        try {
          addDebugLog(`[Mic] Attempt ${attemptNumber + 1}: ${JSON.stringify(audioConstraints).substring(0, 100)}...`);
          const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
          addDebugLog(`[Mic] ✅ Success on attempt ${attemptNumber + 1}`);
          return stream;
        } catch (error: any) {
          if (error.name === 'NotReadableError' && attemptNumber < 2) {
            attemptNumber++;
            addDebugLog(`[Mic] ⚠️ NotReadableError on attempt ${attemptNumber}, trying simpler constraints...`);

            // Try simpler constraints
            const fallbackConstraints = attemptNumber === 1 ?
              { echoCancellation: false, noiseSuppression: false, autoGainControl: false } :
              {}; // Last attempt: minimal constraints

            return tryGetMicrophone(fallbackConstraints);
          }
          throw error;
        }
      };

      if (isAndroid) {
        // Android-specific constraints with fallbacks
        constraints = {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: { ideal: 16000 }, // Lower sample rate for Android compatibility
          channelCount: { ideal: 1 }
        };
      } else if (isMobile) {
        const legacyIOS = isIOSDevice() && isLegacyIOS();
        // iOS constraints (legacy iPhone 6/7: lower sample rate, simpler setup)
        constraints = {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: legacyIOS ? { ideal: 16000 } : { ideal: 44100 },
          channelCount: { ideal: 1 },
          ...(legacyIOS ? {} : { volume: { ideal: 1.0, min: 0.5 } })
        };
      } else {
        // Desktop constraints
        constraints = {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          volume: { ideal: 1.0, min: 0.5 }
        };
      }

      addDebugLog(`[Mic] Requesting access | Mobile: ${isMobile} | Android: ${isAndroid} | Constraints: ${JSON.stringify(constraints).substring(0, 50)}...`);

      const stream = await tryGetMicrophone(constraints);
      addDebugLog(`[Mic] ✅ Access granted | Tracks: ${stream.getTracks().length} | Audio: ${stream.getAudioTracks().length}`);

      // Log track details
      stream.getAudioTracks().forEach((track, index) => {
        console.log(`[Transcription] 🎵 Audio track ${index}:`, {
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
          kind: track.kind,
          label: track.label,
          id: track.id.substring(0, 8) + '...'
        });
      });

      audioStreamRef.current = stream;
      setMicrophoneAccessGranted(true);

      // Start Fallback Recording & Monitoring
      startMediaRecording(stream);
      startVolumeMonitoring(stream);

      // Таймер и кусочное отправление аудио включаем только когда нет SpeechRecognition (fallback режим)
      const android = isAndroidDevice();
      addDebugLog(`[Init] Checking mobile timer: iOS=${ios}, Android=${android}, hasSpeechRec=${hasSupport}`);

      if (shouldForceOpenAI && isMobile && !ios) {
        // Android: использовать таймер с накоплением аудио
        const now = Date.now();
        lastVoiceActivityRef.current = now;
        setLastVoiceActivityTime(now);
        isVoiceActiveRef.current = false;
        setIsVoiceActive(false);

        addDebugLog(`[Init] Starting mobile transcription timer (fallback OpenAI mode on Android)`);
        startMobileTranscriptionTimer();
      } else if (shouldForceOpenAI && ios) {
        // iOS: realtime отправка без таймера
        addDebugLog(`[Init] iOS realtime mode - sending audio chunks immediately without timer`);
      } else {
        addDebugLog(`[Init] Not starting mobile timer (using browser SpeechRecognition)`);
      }

      // If forcing OpenAI, don't start browser recognition
      if (shouldForceOpenAI) return;

      // Setup Browser Recognition
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = "ru-RU";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        // Echo Prevention for Chrome
        if (hasEchoProblems() && isTTSActiveRef.current) {
          console.log("[Transcription] Ignoring input during TTS (Echo Prevention)");
          return;
        }

        let finalTranscript = "";
        let interimTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) finalTranscript += result[0].transcript;
          else interimTranscript += result[0].transcript;
        }

        if (finalTranscript.trim()) {
          console.log(`[Transcription] Final transcript: "${finalTranscript}"`);

          // Prevent duplicate processing - check if this is just an extension of previous text
          const trimmedText = finalTranscript.trim();
          const lastText = lastProcessedTextRef.current;

          // If new text starts with previous text and is significantly longer, it's a continuation
          // Allow small differences (up to 20% length difference) to account for corrections
          const isExtension = lastText &&
                             trimmedText.startsWith(lastText) &&
                             (trimmedText.length - lastText.length) > 5; // At least 5 characters added

          // If it's a minor correction (less than 20% difference), skip it
          const lengthDiff = Math.abs(trimmedText.length - (lastText?.length || 0));
          const maxLength = Math.max(trimmedText.length, lastText?.length || 0);
          const isMinorCorrection = lastText && (lengthDiff / maxLength) < 0.2 && lengthDiff < 50;

          if (isExtension) {
            console.log(`[Transcription] Text is extension of previous (${lastText?.length} -> ${trimmedText.length} chars), skipping`);
            lastProcessedTextRef.current = trimmedText;
            return;
          } else if (isMinorCorrection) {
            console.log(`[Transcription] Text is minor correction of previous (${lengthDiff} chars diff), skipping`);
            lastProcessedTextRef.current = trimmedText;
            return;
          } else if (lastProcessedTextRef.current === trimmedText) {
            console.log(`[Transcription] Skipping exact duplicate text: "${trimmedText}"`);
            return;
          }

          console.log(`[Transcription] Processing new final transcript`);
          lastProcessedTextRef.current = trimmedText;

          console.log(`[Transcription] Calling onTranscriptionComplete with final transcript`);
          onTranscriptionComplete(trimmedText, 'browser');
        } else if (interimTranscript.trim()) {
           // Interim transcripts are ignored to prevent premature LLM calls
           // Except right after TTS resumption - send first interim immediately
           console.log(`[Transcription] Interim transcript: "${interimTranscript.trim()}"`);

           // Check if we're still in echo protection period (ignore interim for 2 seconds after TTS)
           const timeSinceTTSEnd = Date.now() - ttsEndTimeRef.current;
           const echoProtectionMs = hasEchoProblems() ? 2000 : 1000; // 2s for Chrome, 1s for others

           if (timeSinceTTSEnd < echoProtectionMs) {
             console.log(`[Transcription] Ignoring interim during echo protection (${timeSinceTTSEnd}ms < ${echoProtectionMs}ms)`);
               return;
             }

           if (justResumedAfterTTSRef.current) {
             // Send first interim immediately after TTS resumption and echo protection
             const trimmedInterim = interimTranscript.trim();
             if (trimmedInterim.length >= 2) { // Minimum length check
               console.log(`[Transcription] Sending post-TTS interim after echo protection: "${trimmedInterim}"`);
               onTranscriptionComplete(trimmedInterim, 'browser');
               justResumedAfterTTSRef.current = false; // Reset flag after sending
             }
           } else {
             console.log(`[Transcription] Interim ignored (waiting for final)`);
           }
        }
      };

      recognition.onspeechstart = () => {
        addDebugLog(`[Speech] 🎤 Speech started - resetting processed text`);
        lastProcessedTextRef.current = ''; // Reset for new speech
        onSpeechStart?.();
        // Safari Optimizations for Interruption
        if (!hasEchoProblems() && isTTSActiveRef.current) {
           const currentTime = Date.now();
           if (currentTime - lastSafariSpeechTime > SAFARI_SPEECH_DEBOUNCE) {
             addDebugLog(`[Speech] 🎤 Safari voice interruption`);
             setLastSafariSpeechTime(currentTime);
             onInterruption?.();
           }
        }
      };

      recognition.onerror = async (event: SpeechRecognitionErrorEvent) => {
        if (event.error === 'no-speech' || event.error === 'aborted') return;
        console.error("[Transcription] Error:", event.error);

        const retryable = ['network', 'audio-capture', 'not-allowed'];
        if (retryable.includes(event.error) && browserRetryCountRef.current < 3) {
          browserRetryCountRef.current++;
          setTimeout(() => {
            if (recognitionActiveRef.current) {
               try {
                 recognition.start();
               } catch (e) {
                 // Ignore start errors during retry
               }
            }
          }, 1000 * browserRetryCountRef.current);
          return;
        }

        // Switch to OpenAI Fallback
        if (browserRetryCountRef.current >= 3 || ['network', 'audio-capture'].includes(event.error)) {
           addDebugLog(`[Fallback] Switching to OpenAI (error: ${event.error})`);
           setTranscriptionMode('openai');

           const blob = await stopMediaRecording();
           addDebugLog(`[Fallback] Recorded blob: ${blob?.size || 0} bytes`);

           if (blob && blob.size > 1000) {
             const text = await transcribeWithOpenAI(blob);
             if (text) {
               addDebugLog(`[Fallback] ✅ Transcribed: "${text}"`);
               onTranscriptionComplete(text, 'openai');
             } else {
               addDebugLog(`[Fallback] ❌ Transcription failed`);
               onError?.("Не удалось распознать речь (OpenAI)");
             }
           } else {
             addDebugLog(`[Fallback] ⚠️ Blob too small: ${blob?.size || 0} bytes`);
           }
           // Resume browser mode attempt later
           setTranscriptionMode('browser');
           browserRetryCountRef.current = 0;
        }
      };

      recognition.onend = () => {
        if (recognitionActiveRef.current && !isTTSActiveRef.current) {
          try {
            recognition.start();
          } catch (e) {
            // Ignore start errors on end
          }
        }
      };

      recognitionRef.current = recognition;
      recognitionActiveRef.current = true;
      recognition.start();

    } catch (error: unknown) {
      const errorName = error instanceof Error ? error.name : 'Unknown';
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addDebugLog(`[Mic] ❌ Failed: ${errorName} - ${errorMessage}`);

      // Enhanced error handling for Android devices
      let userFriendlyErrorMessage = "Ошибка доступа к микрофону";
      if (errorName === 'NotAllowedError') {
        userFriendlyErrorMessage = "Доступ к микрофону запрещен. Разрешите доступ в настройках браузера и приложения.";
      } else if (errorName === 'NotFoundError') {
        userFriendlyErrorMessage = "Микрофон не найден. Проверьте подключение микрофона или используйте встроенный микрофон.";
      } else if (errorName === 'NotReadableError') {
        if (isAndroidDevice()) {
          userFriendlyErrorMessage = "Микрофон занят или недоступен. Закройте другие приложения, использующие микрофон, и попробуйте перезагрузить страницу. Если проблема persists, попробуйте другой браузер (Chrome, Firefox).";
        } else {
          userFriendlyErrorMessage = "Микрофон занят другим приложением.";
        }
      } else if (errorName === 'OverconstrainedError') {
        userFriendlyErrorMessage = "Настройки микрофона не поддерживаются устройством. Попробуйте другой браузер.";
      } else if (errorName === 'SecurityError') {
        userFriendlyErrorMessage = "Требуется HTTPS для доступа к микрофону.";
      } else if (errorName === 'AbortError') {
        userFriendlyErrorMessage = "Доступ к микрофону был прерван.";
      }

      console.error(`[Transcription] 📱 Mobile-specific error analysis:`, {
        errorType: errorName,
        isMobile: isMobileDevice(),
        isIOS: isIOSDevice(),
        isAndroid: isAndroidDevice(),
        httpsRequired: !window.isSecureContext,
        suggestedAction: isAndroidDevice() ?
          "На Android: Закройте другие аудио-приложения, перезагрузите браузер, попробуйте другой браузер" :
          isIOSDevice() ?
          "На iOS: Убедитесь что Safari имеет доступ к микрофону в настройках" :
          "На десктопе: Проверьте разрешения браузера и подключение микрофона"
      });

      onError?.(userFriendlyErrorMessage);
      setMicrophoneAccessGranted(false);
    }
  }, []); // Dependencies intentionally empty for init

  // Cleanup
  const cleanup = useCallback(() => {
    console.log('[Transcription] 🧹 Cleanup called - stopping all processes');

    // Reset all state
    lastProcessedTextRef.current = ''; // Reset processed text
    recognitionActiveRef.current = false;
    justResumedAfterTTSRef.current = false; // Reset TTS resumption flag
    browserRetryCountRef.current = 0;

    // Stop recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        recognitionRef.current = null; // Clear reference
      } catch (e) {
        console.log('[Transcription] Ignoring stop error during cleanup:', e.message);
      }
    }

    // Stop all monitoring and recording
    stopVolumeMonitoring();
    stopMobileTranscriptionTimer(); // Stop mobile transcription timer
    stopMediaRecording(); // Just stop, don't return blob

    // Stop audio stream
    if (audioStreamRef.current) {
      try {
        audioStreamRef.current.getTracks().forEach(t => {
          t.stop();
          console.log('[Transcription] Stopped audio track:', t.label);
        });
      audioStreamRef.current = null;
      } catch (e) {
        console.log('[Transcription] Error stopping audio tracks:', e.message);
    }
    }

    console.log('[Transcription] 🧹 Cleanup completed');
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    initializeRecognition,
    cleanup,
    transcriptionStatus,
    microphoneAccessGranted,
    microphonePermissionStatus,
    isIOS,
    forceOpenAI,
    transcriptionMode,
    stopRecognition: () => {
      recognitionActiveRef.current = false;
      recognitionRef.current?.stop();
    },
    startRecognition: () => {
      recognitionActiveRef.current = true;
      try {
        recognitionRef.current?.start();
      } catch (e) {
        // Ignore start errors
      }
    },
    pauseRecordingForTTS: () => {
      if (isSafari()) return; // Safari оставляем как раньше
      recognitionActiveRef.current = false;
      recognitionRef.current?.stop();
      stopMediaRecording();
      recordedChunksRef.current = [];
    },
    resumeRecordingAfterTTS: () => {
      if (isSafari()) return; // Safari оставляем как раньше
      // Longer delay for browsers with echo problems (Chrome)
      const resumeDelay = hasEchoProblems() ? 1200 : 400; // 1.2s for Chrome, 0.4s for others

      console.log(`[Transcription] Resuming after TTS with ${resumeDelay}ms delay (echo protection)`);

      setTimeout(() => {
        if (audioStreamRef.current) {
          startMediaRecording(audioStreamRef.current);
        }
        recognitionActiveRef.current = true;
        justResumedAfterTTSRef.current = true; // Mark that we just resumed after TTS
        ttsEndTimeRef.current = Date.now() + resumeDelay; // Mark TTS end time
        try {
          recognitionRef.current?.start();
          console.log(`[Transcription] Recognition resumed after TTS (delay: ${resumeDelay}ms)`);
        } catch (e) {
          console.log(`[Transcription] Error resuming recognition: ${e.message}`);
        }
      }, resumeDelay);
    }
  };
};


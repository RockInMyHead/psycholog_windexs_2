import { useState, useRef, useEffect, useCallback } from 'react';
import { psychologistAI } from '@/services/openai';

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
  onError
}: UseTranscriptionProps) => {
  const [transcriptionStatus, setTranscriptionStatus] = useState<string | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [forceOpenAI, setForceOpenAI] = useState(false);
  const [transcriptionMode, setTranscriptionMode] = useState<'browser' | 'openai'>('browser');
  const [microphoneAccessGranted, setMicrophoneAccessGranted] = useState(false);
  
  // Refs
  const recognitionRef = useRef<any>(null);
  const recognitionActiveRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const volumeMonitorRef = useRef<number | null>(null);
  const speechTimeoutRef = useRef<number | null>(null);
  const browserRetryCountRef = useRef(0);

  // Constants
  const SAFARI_VOICE_DETECTION_THRESHOLD = 60;
  const SAFARI_SPEECH_CONFIRMATION_FRAMES = 3;
  const SAFARI_SPEECH_DEBOUNCE = 1000;

  // Safari Interruption State
  const [safariSpeechDetectionCount, setSafariSpeechDetectionCount] = useState(0);
  const [lastSafariSpeechTime, setLastSafariSpeechTime] = useState(0);

  // --- Browser Detection Helpers ---
  const isSafari = useCallback(() => {
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  }, []);

  const hasEchoProblems = useCallback(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    return /chrome|chromium|edg\/|opera|brave/.test(userAgent);
  }, []);

  const isIOSDevice = useCallback(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(userAgent) || 
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }, []);

  const isMobileDevice = useCallback(() => {
    return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent.toLowerCase());
  }, []);

  // --- OpenAI Fallback Logic ---
  const transcribeWithOpenAI = async (audioBlob: Blob): Promise<string | null> => {
    try {
      console.log("[Transcription] Starting OpenAI fallback", audioBlob.size, "bytes");
      setTranscriptionStatus("Отправляю аудио в OpenAI...");
      
      const text = await psychologistAI.transcribeAudio(audioBlob);
      
      if (text && text.trim()) {
        console.log("[Transcription] OpenAI success:", text);
        return text.trim();
      }
      return null;
    } catch (error) {
      console.error("[Transcription] OpenAI fallback failed:", error);
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
      const selectedMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));

      if (!selectedMimeType) {
        console.warn("[Transcription] No supported MediaRecorder format");
        return;
      }

      const recorder = new MediaRecorder(stream, { mimeType: selectedMimeType });
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      recorder.start(1000);
      console.log(`[Transcription] MediaRecorder started (${selectedMimeType})`);
    } catch (error) {
      console.error("[Transcription] MediaRecorder start failed:", error);
    }
  };

  const stopMediaRecording = async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current) {
        resolve(null);
        return;
      }

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { 
          type: mediaRecorderRef.current?.mimeType || 'audio/webm' 
        });
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
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioAnalyserRef.current = analyser;

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
                   console.log(`[Transcription] Voice interruption detected (vol: ${average.toFixed(1)})`);
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
    // Reset processed text on initialization
    lastProcessedTextRef.current = '';
    // Device Checks
    const ios = isIOSDevice();
    setIsIOS(ios);
    
    // Check Support
    const hasSupport = !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition;
    const shouldForceOpenAI = ios || !hasSupport;
    setForceOpenAI(shouldForceOpenAI);

    if (shouldForceOpenAI) {
      setTranscriptionMode('openai');
    }

    // Get Microphone Stream
    try {
      const constraints = isMobileDevice() ? {
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      } : { audio: true };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      audioStreamRef.current = stream;
      setMicrophoneAccessGranted(true);

      // Start Fallback Recording & Monitoring
      startMediaRecording(stream);
      startVolumeMonitoring(stream);

      // If forcing OpenAI, don't start browser recognition
      if (shouldForceOpenAI) return;

      // Setup Browser Recognition
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = "ru-RU";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
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

          if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
          browserRetryCountRef.current = 0;
          console.log(`[Transcription] Calling onTranscriptionComplete with final transcript`);
          onTranscriptionComplete(trimmedText, 'browser');
        } else if (interimTranscript.trim()) {
           console.log(`[Transcription] Interim transcript: "${interimTranscript}"`);

           if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
           speechTimeoutRef.current = window.setTimeout(() => {
             if (hasEchoProblems() && isTTSActiveRef.current) {
               console.log(`[Transcription] Skipping interim due to TTS activity`);
               return;
             }

             // Check if we already processed this interim text as final or as a better version
             const trimmedInterim = interimTranscript.trim();
             const lastProcessed = lastProcessedTextRef.current;

             // Skip if interim is already contained in processed text
             if (lastProcessed && lastProcessed.includes(trimmedInterim) && lastProcessed.length > trimmedInterim.length) {
               console.log(`[Transcription] Skipping interim already contained in processed text: "${trimmedInterim}"`);
               return;
             }

             // Skip if interim is just a prefix of processed text (user continued speaking)
             if (lastProcessed && lastProcessed.startsWith(trimmedInterim) && lastProcessed.length > trimmedInterim.length) {
               console.log(`[Transcription] Skipping interim that became final: "${trimmedInterim}"`);
               return;
             }

             console.log(`[Transcription] Calling onTranscriptionComplete with interim transcript`);
             onTranscriptionComplete(trimmedInterim, 'browser');
           }, 1500);
        }
      };

      recognition.onspeechstart = () => {
        console.log("[Transcription] Speech started - resetting processed text");
        lastProcessedTextRef.current = ''; // Reset for new speech
        onSpeechStart?.();
        // Safari Optimizations for Interruption
        if (!hasEchoProblems() && isTTSActiveRef.current) {
           const currentTime = Date.now();
           if (currentTime - lastSafariSpeechTime > SAFARI_SPEECH_DEBOUNCE) {
             console.log("[Transcription] onspeechstart interruption");
             setLastSafariSpeechTime(currentTime);
             onInterruption?.();
           }
        }
      };

      recognition.onerror = async (event: any) => {
        if (event.error === 'no-speech' || event.error === 'aborted') return;
        console.error("[Transcription] Error:", event.error);

        const retryable = ['network', 'audio-capture', 'not-allowed'];
        if (retryable.includes(event.error) && browserRetryCountRef.current < 3) {
          browserRetryCountRef.current++;
          setTimeout(() => {
            if (recognitionActiveRef.current) {
               try { recognition.start(); } catch(e) {}
            }
          }, 1000 * browserRetryCountRef.current);
          return;
        }

        // Switch to OpenAI Fallback
        if (browserRetryCountRef.current >= 3 || ['network', 'audio-capture'].includes(event.error)) {
           console.log("[Transcription] Switching to OpenAI Fallback");
           setTranscriptionMode('openai');
           
           const blob = await stopMediaRecording();
           if (blob && blob.size > 1000) {
             const text = await transcribeWithOpenAI(blob);
             if (text) onTranscriptionComplete(text, 'openai');
             else onError?.("Не удалось распознать речь (OpenAI)");
           }
           // Resume browser mode attempt later
           setTranscriptionMode('browser');
           browserRetryCountRef.current = 0;
        }
      };

      recognition.onend = () => {
        if (recognitionActiveRef.current && !isTTSActiveRef.current) {
          try { recognition.start(); } catch (e) {}
        }
      };

      recognitionRef.current = recognition;
      recognitionActiveRef.current = true;
      recognition.start();

    } catch (error: any) {
      console.error("[Transcription] Init failed:", error);
      onError?.(error.message || "Ошибка микрофона");
      setMicrophoneAccessGranted(false);
    }
  }, []); // Dependencies intentionally empty for init

  // Cleanup
  const cleanup = useCallback(() => {
    lastProcessedTextRef.current = ''; // Reset processed text
    recognitionActiveRef.current = false;
    if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e){}
    stopVolumeMonitoring();
    stopMediaRecording(); // Just stop, don't return blob
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(t => t.stop());
      audioStreamRef.current = null;
    }
    if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current);
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    initializeRecognition,
    cleanup,
    transcriptionStatus,
    microphoneAccessGranted,
    isIOS,
    forceOpenAI,
    transcriptionMode,
    stopRecognition: () => {
      recognitionActiveRef.current = false;
      recognitionRef.current?.stop();
    },
    startRecognition: () => {
      recognitionActiveRef.current = true;
      try { recognitionRef.current?.start(); } catch(e){}
    }
  };
};


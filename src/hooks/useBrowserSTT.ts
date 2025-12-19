import { useRef, useCallback, useState } from 'react';
import { DeviceProfile } from './useDeviceProfile';

// Minimal SpeechRecognition type shims for browsers (Safari/Chrome)
type SpeechRecognitionErrorEvent = Event & { error: string; message?: string };
type SpeechRecognitionEvent = Event & { results: SpeechRecognitionResultList; resultIndex: number };
type SpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onstart?: (() => void) | null;
  onaudiostart?: (() => void) | null;
  onsoundstart?: (() => void) | null;
  onspeechstart?: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror?: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend?: (() => void) | null;
};

export interface BrowserSTTState {
  isActive: boolean;
  isListening: boolean;
  error: string | null;
  retryCount: number;
}

export const useBrowserSTT = (
  deviceProfile: DeviceProfile,
  onTranscription: (text: string, isFinal: boolean) => void,
  onError: (error: string) => void,
  onInterruption?: () => void,
  addDebugLog?: (message: string) => void
) => {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [state, setState] = useState<BrowserSTTState>({
    isActive: false,
    isListening: false,
    error: null,
    retryCount: 0
  });

  // P0-5: Refs для избежания stale closures
  const isActiveRef = useRef(false);
  const retryCountRef = useRef(0);

  const lastProcessedTextRef = useRef<string>('');
  const recentlyProcessedTextsRef = useRef<Set<string>>(new Set());

  const createRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      throw new Error('SpeechRecognition not supported');
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "ru-RU";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    return recognition;
  }, []);

  const shouldProcessText = useCallback((text: string): boolean => {
    if (!text.trim()) return false;

    const trimmedText = text.trim();

    // Skip if this exact text was processed recently
    if (recentlyProcessedTextsRef.current.has(trimmedText)) {
      return false;
    }

    const lastText = lastProcessedTextRef.current;

    // If new text starts with previous text and is significantly longer, it's a continuation
    const isExtension = lastText &&
                       trimmedText.startsWith(lastText) &&
                       (trimmedText.length - lastText.length) > 5;

    // If it's a minor correction (less than 20% difference), skip it
    const lengthDiff = Math.abs(trimmedText.length - (lastText?.length || 0));
    const maxLength = Math.max(trimmedText.length, lastText?.length || 0);
    const isMinorCorrection = lastText && (lengthDiff / maxLength) < 0.2 && lengthDiff < 50;

    if (isExtension) {
      return false;
    }

    if (isMinorCorrection) {
      return false;
    }

    if (lastProcessedTextRef.current === trimmedText) {
      return false;
    }

    return true;
  }, []);

  const processRecognitionResult = useCallback((event: SpeechRecognitionEvent) => {
    let finalTranscript = "";
    let interimTranscript = "";

    for (let i = 0; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0].transcript;

      if (result.isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    // Process final results
    if (finalTranscript.trim() && shouldProcessText(finalTranscript)) {
      lastProcessedTextRef.current = finalTranscript.trim();

      // Add to recently processed texts
      recentlyProcessedTextsRef.current.add(finalTranscript.trim());
      setTimeout(() => {
        recentlyProcessedTextsRef.current.delete(finalTranscript.trim());
      }, 10000);

      onTranscription(finalTranscript.trim(), true);
    }

    // Process interim results (only after TTS resumption)
    if (interimTranscript.trim() && shouldProcessText(interimTranscript)) {
      // Interim processing logic here if needed
    }
  }, [shouldProcessText, onTranscription]);

  const handleError = useCallback((event: SpeechRecognitionErrorEvent) => {
    const error = event.error;

    if (error === 'aborted') {
      // Aborted is normal when TTS interrupts speech recognition on iOS/Safari
      addDebugLog?.('[BrowserSTT] Speech recognition aborted (normal during TTS on iOS)');
      console.log('[BrowserSTT] Speech recognition aborted (normal during TTS on iOS)');
      setState(prev => ({ ...prev, isListening: false, error: null }));
      return;
    }

    addDebugLog?.(`[BrowserSTT] Recognition error: ${error}`);
    console.error('[BrowserSTT] Recognition error:', error);
    setState(prev => ({ ...prev, error }));

    // P0-5: Handle retriable errors (используем ref вместо state)
    const retriableErrors = ['network', 'audio-capture', 'not-allowed'];
    if (retriableErrors.includes(error) && retryCountRef.current < 3) {
      retryCountRef.current += 1;
      const attempt = retryCountRef.current;
      addDebugLog?.(`[BrowserSTT] Retriable error '${error}', attempt ${attempt}/3`);
      console.log(`[BrowserSTT] Retriable error '${error}', attempt ${attempt}/3`);
      setState(prev => ({ ...prev, retryCount: attempt }));

      setTimeout(() => {
        if (isActiveRef.current && recognitionRef.current) {
          try {
            addDebugLog?.(`[BrowserSTT] Retrying start after error`);
            recognitionRef.current.start();
          } catch (e) {
            addDebugLog?.(`[BrowserSTT] Retry start failed: ${e}`);
            console.log(`[BrowserSTT] Retry start failed: ${e}`);
          }
        }
      }, 1000 * attempt);
      return;
    }

    // For iOS, switch to OpenAI fallback for serious errors
    if (deviceProfile.isIOS && ['network', 'audio-capture'].includes(error)) {
      onError(`Browser STT failed (${error}), switching to OpenAI mode`);
      return;
    }

    onError(`Speech recognition error: ${error}`);
  }, [deviceProfile.isIOS, onError, addDebugLog]);

  const start = useCallback(() => {
    addDebugLog?.("[STT] start() called");
    try {
      if (!recognitionRef.current) {
        recognitionRef.current = createRecognition();
        addDebugLog?.("[STT] created new recognition instance");
      }

      const recognition = recognitionRef.current;

      // ВСЕ события с логированием
      recognition.onstart = () => addDebugLog?.("[STT] onstart");
      recognition.onaudiostart = () => addDebugLog?.("[STT] onaudiostart");
      recognition.onsoundstart = () => addDebugLog?.("[STT] onsoundstart");
      recognition.onspeechstart = () => {
        addDebugLog?.("[STT] onspeechstart");
        // Voice interruption logic for Safari
        if (onInterruption && deviceProfile.isSafari) {
          onInterruption();
        }
      };
      recognition.onresult = (e: SpeechRecognitionEvent) => {
        const transcript = e.results?.[0]?.[0]?.transcript ?? "";
        addDebugLog?.(`[STT] onresult: "${transcript}"`);
        processRecognitionResult(e);
      };
      recognition.onend = () => {
        addDebugLog?.("[STT] onend");
        setState(prev => ({ ...prev, isListening: false }));
        // Auto-restart if still active
        if (isActiveRef.current) {
          try {
            addDebugLog?.("[STT] auto-restarting after onend");
            recognition.start();
          } catch (e) {
            addDebugLog?.(`[STT] auto-restart failed: ${e}`);
            // Ignore restart errors
          }
        }
      };
      recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
        addDebugLog?.(`[STT] onerror: ${e.error || "unknown"} ${e.message || ""}`);
        handleError(e);
      };

      addDebugLog?.("[STT] calling recognition.start()");
      recognition.start();

      // P0-5: Обновляем refs
      isActiveRef.current = true;
      retryCountRef.current = 0;

      setState(prev => ({
        ...prev,
        isActive: true,
        isListening: true,
        error: null,
        retryCount: 0
      }));

    } catch (error) {
      addDebugLog?.(`[STT] start() failed: ${error}`);
      console.error('[BrowserSTT] Start failed:', error);
      onError(`Failed to start speech recognition: ${error}`);
    }
  }, [createRecognition, processRecognitionResult, handleError, deviceProfile.isSafari, onInterruption, onError, addDebugLog]);

  const stop = useCallback(() => {
    addDebugLog?.("[STT] stop() called");
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        addDebugLog?.("[STT] recognition.stop() called from stop");
      } catch (e) {
        addDebugLog?.(`[STT] stop error: ${e}`);
        // Ignore stop errors
      }
      recognitionRef.current = null;
    }

    // P0-5: Сбрасываем refs
    isActiveRef.current = false;
    retryCountRef.current = 0;

    setState({
      isActive: false,
      isListening: false,
      error: null,
      retryCount: 0
    });

    // Clear processed texts
    lastProcessedTextRef.current = '';
    recentlyProcessedTextsRef.current.clear();
    addDebugLog?.("[STT] stopped and cleaned up");
  }, [addDebugLog]);

  const pause = useCallback(() => {
    addDebugLog?.("[STT] pause() called");
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        addDebugLog?.("[STT] recognition.stop() called");
      } catch (e) {
        addDebugLog?.(`[STT] pause error: ${e}`);
        // Ignore stop errors
      }
    }
    setState(prev => ({ ...prev, isListening: false }));
  }, [addDebugLog]);

  const resume = useCallback(() => {
    addDebugLog?.(`[STT] resume() called, active=${state.isActive}, listening=${state.isListening}`);
    if (state.isActive && !state.isListening) {
      try {
        recognitionRef.current?.start();
        addDebugLog?.("[STT] recognition.start() called from resume");
        setState(prev => ({ ...prev, isListening: true }));
      } catch (e) {
        addDebugLog?.(`[STT] resume error: ${e}`);
        // Ignore resume errors
      }
    } else {
      addDebugLog?.(`[STT] resume skipped: not active or already listening`);
    }
  }, [state.isActive, state.isListening, addDebugLog]);

  return {
    state,
    start,
    stop,
    pause,
    resume
  };
};
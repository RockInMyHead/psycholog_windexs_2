import { useRef, useCallback, useState } from 'react';
import { DeviceProfile } from './useDeviceProfile';

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
  onspeechstart?: (() => void) | null;
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
  onInterruption?: () => void
) => {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [state, setState] = useState<BrowserSTTState>({
    isActive: false,
    isListening: false,
    error: null,
    retryCount: 0
  });

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
      console.log('[BrowserSTT] Speech recognition aborted (normal during TTS on iOS)');
      setState(prev => ({ ...prev, isListening: false, error: null }));
      return;
    }

    console.error('[BrowserSTT] Recognition error:', error);
    setState(prev => ({ ...prev, error }));

    // Handle retriable errors
    const retriableErrors = ['network', 'audio-capture', 'not-allowed'];
    if (retriableErrors.includes(error) && state.retryCount < 3) {
      console.log(`[BrowserSTT] Retriable error '${error}', attempt ${state.retryCount + 1}/3`);
      setState(prev => ({ ...prev, retryCount: prev.retryCount + 1 }));

      setTimeout(() => {
        if (state.isActive) {
          start();
        }
      }, 1000 * (state.retryCount + 1));
      return;
    }

    // For iOS, switch to OpenAI fallback for serious errors
    if (deviceProfile.isIOS && ['network', 'audio-capture'].includes(error)) {
      onError(`Browser STT failed (${error}), switching to OpenAI mode`);
      return;
    }

    onError(`Speech recognition error: ${error}`);
  }, [state.retryCount, state.isActive, deviceProfile.isIOS, onError]);

  const start = useCallback(() => {
    try {
      if (!recognitionRef.current) {
        recognitionRef.current = createRecognition();
      }

      const recognition = recognitionRef.current;

      recognition.onresult = processRecognitionResult;
      recognition.onerror = handleError;
      recognition.onend = () => {
        setState(prev => ({ ...prev, isListening: false }));
        // Auto-restart if still active
        if (state.isActive) {
          try {
            recognition.start();
          } catch (e) {
            // Ignore restart errors
          }
        }
      };

      recognition.onspeechstart = () => {
        // Voice interruption logic for Safari
        if (onInterruption && deviceProfile.isSafari) {
          onInterruption();
        }
      };

      recognition.start();
      setState(prev => ({
        ...prev,
        isActive: true,
        isListening: true,
        error: null
      }));

    } catch (error) {
      console.error('[BrowserSTT] Start failed:', error);
      onError(`Failed to start speech recognition: ${error}`);
    }
  }, [createRecognition, processRecognitionResult, handleError, state.isActive, deviceProfile.isSafari, onInterruption, onError]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore stop errors
      }
      recognitionRef.current = null;
    }

    setState({
      isActive: false,
      isListening: false,
      error: null,
      retryCount: 0
    });

    // Clear processed texts
    lastProcessedTextRef.current = '';
    recentlyProcessedTextsRef.current.clear();
  }, []);

  const pause = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore stop errors
      }
    }
    setState(prev => ({ ...prev, isListening: false }));
  }, []);

  const resume = useCallback(() => {
    if (state.isActive && !state.isListening) {
      try {
        recognitionRef.current?.start();
        setState(prev => ({ ...prev, isListening: true }));
      } catch (e) {
        // Ignore resume errors
      }
    }
  }, [state.isActive, state.isListening]);

  return {
    state,
    start,
    stop,
    pause,
    resume
  };
};
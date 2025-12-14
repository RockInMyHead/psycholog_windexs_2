import { useState, useCallback } from 'react';

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

export interface DeviceProfile {
  isIOS: boolean;
  isAndroid: boolean;
  isMobile: boolean;
  isSafari: boolean;
  hasEchoProblems: boolean;
  hasSpeechRecognitionSupport: boolean;
  hasMediaDevicesSupport: boolean;
  hasMediaRecorderSupport: boolean;
  platform: string;
  userAgent: string;
}

const detectDeviceSync = (): DeviceProfile => {
  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform;

  // Device detection
  const isIOS = /iphone|ipad|ipod/.test(userAgent) ||
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /android/.test(userAgent);
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);

  // Browser detection
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  // API support detection
  const hasSpeechRecognitionSupport = !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition;
  const hasMediaDevicesSupport = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const hasMediaRecorderSupport = typeof MediaRecorder !== 'undefined';

  // Echo problems (Chrome-based browsers)
  const hasEchoProblems = /chrome|chromium|edg\/|opera|brave|yabrowser|yaapp/.test(userAgent);

  return {
    isIOS,
    isAndroid,
    isMobile,
    isSafari,
    hasEchoProblems,
    hasSpeechRecognitionSupport,
    hasMediaDevicesSupport,
    hasMediaRecorderSupport,
    platform,
    userAgent
  };
};

export const useDeviceProfile = () => {
  // Always initialize synchronously so profile is NEVER null
  const [profile] = useState<DeviceProfile>(() => detectDeviceSync());

  const detectDevice = useCallback((): DeviceProfile => {
    // Return current profile (already detected synchronously)
    return profile;
  }, [profile]);

  const getTranscriptionStrategy = useCallback((deviceProfile: DeviceProfile) => {
    // Android always uses OpenAI for reliability
    if (deviceProfile.isAndroid) {
      return 'openai';
    }

    // iOS starts with browser mode, falls back to OpenAI
    if (deviceProfile.isIOS) {
      return 'browser_with_openai_fallback';
    }

    // Desktop uses browser mode with simple OpenAI fallback
    return 'browser_with_simple_fallback';
  }, []);

  const shouldForceOpenAI = useCallback((deviceProfile: DeviceProfile) => {
    return !deviceProfile.hasSpeechRecognitionSupport || deviceProfile.isAndroid;
  }, []);

  return {
    profile,
    detectDevice,
    getTranscriptionStrategy,
    shouldForceOpenAI
  };
};
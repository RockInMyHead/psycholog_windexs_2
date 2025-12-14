import { useRef, useCallback } from 'react';
import { DeviceProfile } from './useDeviceProfile';

export interface TTSEchoGuardState {
  isTTSActive: boolean;
  ttsStartTime: number;
  ttsEndTime: number;
  echoProtectionMs: number;
}

export const useTTSEchoGuard = (deviceProfile: DeviceProfile) => {
  // Store deviceProfile in ref to prevent recreating callbacks
  const deviceProfileRef = useRef(deviceProfile);
  
  // Update ref when deviceProfile changes (shouldn't happen after initial render)
  deviceProfileRef.current = deviceProfile;
  
  const stateRef = useRef<TTSEchoGuardState>({
    isTTSActive: false,
    ttsStartTime: 0,
    ttsEndTime: 0,
    echoProtectionMs: deviceProfile?.hasEchoProblems ? 2000 : 1000
  });

  const setTTSActive = useCallback((active: boolean, timestamp: number = Date.now()) => {
    stateRef.current.isTTSActive = active;
    if (active) {
      stateRef.current.ttsStartTime = timestamp;
    } else {
      stateRef.current.ttsEndTime = timestamp;
    }
  }, []);

  const isEchoProtectionActive = useCallback((currentTime: number = Date.now()): boolean => {
    if (!stateRef.current.isTTSActive) {
      const timeSinceTTSEnd = currentTime - stateRef.current.ttsEndTime;
      return timeSinceTTSEnd < stateRef.current.echoProtectionMs;
    }
    return false;
  }, []);

  const shouldSuppressSTT = useCallback((currentTime: number = Date.now()): boolean => {
    return stateRef.current.isTTSActive || isEchoProtectionActive(currentTime);
  }, [isEchoProtectionActive]);

  const getResumeDelay = useCallback((): number => {
    const profile = deviceProfileRef.current;
    return profile?.hasEchoProblems && !profile?.isIOS ? 1200 : 400;
  }, []);

  const canResumeSTT = useCallback((currentTime: number = Date.now()): boolean => {
    const timeSinceTTSEnd = currentTime - stateRef.current.ttsEndTime;
    return timeSinceTTSEnd >= getResumeDelay();
  }, [getResumeDelay]);

  const getState = useCallback((): TTSEchoGuardState => {
    return { ...stateRef.current };
  }, []);

  return {
    setTTSActive,
    isEchoProtectionActive,
    shouldSuppressSTT,
    canResumeSTT,
    getResumeDelay,
    getState
  };
};
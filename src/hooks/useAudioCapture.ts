import { useRef, useCallback, useState } from 'react';
import { DeviceProfile } from './useDeviceProfile';

export interface AudioCaptureState {
  isRecording: boolean;
  isPaused: boolean;
  recordedChunks: Blob[];
  audioStream: MediaStream | null;
  mimeType: string | null;
}

export const useAudioCapture = (deviceProfile: DeviceProfile) => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const [state, setState] = useState<AudioCaptureState>({
    isRecording: false,
    isPaused: false,
    recordedChunks: [],
    audioStream: null,
    mimeType: null
  });

  const getSupportedMimeTypes = useCallback(() => {
    const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/wav'];
    return mimeTypes.filter(type => MediaRecorder.isTypeSupported(type));
  }, []);

  const startRecording = useCallback(async (stream: MediaStream) => {
    // Allow restart if previous recorder exists and is actively recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      console.log('[AudioCapture] Already recording, skipping start');
      return;
    }

    // Clean up previous recorder if exists and is not already stopped/inactive
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
        console.log(`[AudioCapture] Stopped previous recorder (state: ${mediaRecorderRef.current.state})`);
      } catch (e) {
        console.log(`[AudioCapture] Stop error (expected): ${e.message}`);
      }
      mediaRecorderRef.current = null;
    }

    try {
      // Verify stream is still active
      if (!stream.active) {
        throw new Error('MediaStream is not active');
      }

      const supportedTypes = getSupportedMimeTypes();
      const selectedMimeType = supportedTypes[0];

      if (!selectedMimeType) {
        throw new Error('No supported MediaRecorder format found');
      }

      console.log(`[AudioCapture] Creating MediaRecorder with mimeType: ${selectedMimeType}`);
      const recorder = new MediaRecorder(stream, { mimeType: selectedMimeType });
      mediaRecorderRef.current = recorder;
      audioStreamRef.current = stream;
      recordedChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          const beforeCount = recordedChunksRef.current.length;
          console.log(`[AudioCapture] Data available: ${e.data.size} bytes, chunks before: ${beforeCount}, after: ${beforeCount + 1}`);
          recordedChunksRef.current.push(e.data);
          console.log(`[AudioCapture] Chunk added, array now has ${recordedChunksRef.current.length} chunks`);

          setState(prev => ({
            ...prev,
            recordedChunks: [...recordedChunksRef.current]
          }));
          console.log(`[AudioCapture] State updated with ${recordedChunksRef.current.length} chunks`);
        } else {
          console.log(`[AudioCapture] Data available but empty (0 bytes)`);
        }
      };

      recorder.onstart = () => {
        setState(prev => ({
          ...prev,
          isRecording: true,
          isPaused: false,
          mimeType: selectedMimeType,
          audioStream: stream
        }));
        console.log(`[AudioCapture] Recording started successfully`);
      };

      recorder.onstop = () => {
        setState(prev => ({
          ...prev,
          isRecording: false,
          isPaused: false
        }));
      };

      recorder.onerror = (event) => {
        console.error('[AudioCapture] Recording error:', event.error?.message || 'Unknown error');
        setState(prev => ({
          ...prev,
          isRecording: false,
          isPaused: false
        }));
      };

      // Platform-specific chunk durations for optimal performance:
      // - iOS: 2s (Safari requires longer chunks for stability)
      // - Android: 1s (standard duration)
      // - Desktop (Mac/Windows Chrome/Firefox): 500ms (faster response)
      // Platform-specific chunk durations for optimal performance:
      // - iOS: 3000ms (Safari requires longer chunks for stability)
      // - Android: 1500ms (standard duration)
      // - Desktop (Mac/Windows Chrome/Firefox): 1000ms (faster response)
      const chunkDuration = deviceProfile.isIOS ? 3000 : (deviceProfile.isAndroid ? 1500 : 1000);
      console.log(`[AudioCapture] Starting recording with ${chunkDuration}ms chunks for ${deviceProfile.isIOS ? 'iOS' : deviceProfile.isAndroid ? 'Android' : 'Desktop'}`);
      recorder.start(chunkDuration);

    } catch (error) {
      console.error('[AudioCapture] Start failed:', error);
      throw error;
    }
  }, [deviceProfile.isIOS, getSupportedMimeTypes]);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
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
        setState(prev => ({
          ...prev,
          recordedChunks: [],
          isRecording: false,
          isPaused: false
        }));
        mediaRecorderRef.current = null;
        console.log(`[AudioCapture] Recording stopped, blob size: ${blob.size} bytes`);
        resolve(blob);
      };

      mediaRecorderRef.current.stop();
    });
  }, []);

  const pauseRecording = useCallback(() => {
    console.log(`[AudioCapture] Pause requested, current state: ${mediaRecorderRef.current?.state}`);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setState(prev => ({ ...prev, isPaused: true }));
      console.log(`[AudioCapture] Recording paused successfully`);
    } else {
      console.log(`[AudioCapture] Cannot pause: recorder=${!!mediaRecorderRef.current}, state=${mediaRecorderRef.current?.state}`);
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      console.log(`[AudioCapture] Resuming recording, state: ${mediaRecorderRef.current.state}`);
      mediaRecorderRef.current.resume();
      setState(prev => ({ ...prev, isPaused: false }));
      console.log(`[AudioCapture] Recording resumed successfully`);
    } else {
      console.log(`[AudioCapture] Cannot resume: recorder=${!!mediaRecorderRef.current}, state=${mediaRecorderRef.current?.state}`);
    }
  }, []);

  const requestData = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.requestData();
    }
  }, []);

  const getAndClearChunks = useCallback((): Blob | null => {
    const chunkCount = recordedChunksRef.current.length;
    console.log(`[AudioCapture] getAndClearChunks called, chunks in array: ${chunkCount}`);

    if (chunkCount === 0) {
      console.log(`[AudioCapture] No chunks available, returning null`);
      return null;
    }

    // Calculate total size before creating blob
    const totalSize = recordedChunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0);
    console.log(`[AudioCapture] Creating blob from ${chunkCount} chunks, total size: ${totalSize} bytes`);

    // Get MIME type from MediaRecorder, fallback to audio/webm
    const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
    console.log(`[AudioCapture] Using MIME type: ${mimeType}`);

    const blob = new Blob(recordedChunksRef.current, {
      type: mimeType
    });

    console.log(`[AudioCapture] ✅ Blob created: ${blob.size} bytes, type: "${blob.type}", chunks: ${chunkCount}`);

    // Validate blob
    if (blob.size === 0) {
      console.log(`[AudioCapture] ⚠️ Warning: blob size is 0 despite having ${chunkCount} chunks`);
    }

    // Clear chunks for next segment
    recordedChunksRef.current = [];
    setState(prev => ({
      ...prev,
      recordedChunks: []
    }));

    console.log(`[AudioCapture] Chunks cleared, ready for next segment`);
    return blob;
  }, []);

  const clearRecordedChunks = useCallback(() => {
    recordedChunksRef.current = [];
    setState(prev => ({ ...prev, recordedChunks: [] }));
  }, []);

  const cleanup = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }

    recordedChunksRef.current = [];
    setState({
      isRecording: false,
      isPaused: false,
      recordedChunks: [],
      audioStream: null,
      mimeType: null
    });
  }, []);

  const getAudioStream = useCallback(() => {
    return audioStreamRef.current;
  }, []);

  return {
    state,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearRecordedChunks,
    cleanup,
    requestData,
    getAndClearChunks,
    getAudioStream
  };
};
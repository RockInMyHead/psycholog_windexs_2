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
    if (mediaRecorderRef.current) return;

    try {
      const supportedTypes = getSupportedMimeTypes();
      const selectedMimeType = supportedTypes[0];

      if (!selectedMimeType) {
        throw new Error('No supported MediaRecorder format found');
      }

      const recorder = new MediaRecorder(stream, { mimeType: selectedMimeType });
      mediaRecorderRef.current = recorder;
      audioStreamRef.current = stream;
      recordedChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
          setState(prev => ({
            ...prev,
            recordedChunks: [...recordedChunksRef.current]
          }));
        }
      };

      recorder.onstart = () => {
        setState(prev => ({
          ...prev,
          isRecording: true,
          isPaused: false,
          mimeType: selectedMimeType
        }));
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

      // iOS: 2s chunks, others: 1s
      const chunkDuration = deviceProfile.isIOS ? 2000 : 1000;
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
          recordedChunks: []
        }));
        mediaRecorderRef.current = null;
        resolve(blob);
      };

      mediaRecorderRef.current.stop();
    });
  }, []);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setState(prev => ({ ...prev, isPaused: true }));
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setState(prev => ({ ...prev, isPaused: false }));
    }
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

  return {
    state,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearRecordedChunks,
    cleanup
  };
};
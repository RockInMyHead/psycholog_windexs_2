import { useCallback, useRef } from 'react';
import { DeviceProfile } from './useDeviceProfile';

export interface OpenAISTTConfig {
  maxRetries: number;
  timeoutMs: number;
  prompt: string;
}

export const useOpenAISTT = (deviceProfile: DeviceProfile) => {
  // Store deviceProfile in ref to prevent recreating callbacks
  const deviceProfileRef = useRef(deviceProfile);
  deviceProfileRef.current = deviceProfile;
  
  const getConfig = useCallback((): OpenAISTTConfig => {
    const profile = deviceProfileRef.current;
    return {
      maxRetries: profile?.isIOS ? 2 : 1,
      timeoutMs: 30000, // 30 seconds
      prompt: 'Разговор с психологом. Короткие фразы: Привет, Да, Нет, Хорошо, Понял.'
    };
  }, []);

  const transcribeWithOpenAI = useCallback(async (
    audioBlob: Blob,
    retryCount: number = 0
  ): Promise<string | null> => {
    const config = getConfig();

    try {
      console.log(`[OpenAI] Starting transcription via server: ${audioBlob.size} bytes (attempt ${retryCount + 1}/${config.maxRetries + 1})`);

      const formData = new FormData();
      formData.append('file', audioBlob, 'voice.webm');
      formData.append('model', 'whisper-1');
      formData.append('language', 'ru');
      formData.append('response_format', 'text');
      formData.append('prompt', config.prompt);

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
        console.log(`[OpenAI] ✅ Server transcription success: "${text.substring(0, 50)}..."`);
        return text.trim();
      }
      console.log(`[OpenAI] ⚠️ Empty transcription result from server`);
      return null;

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log(`[OpenAI] ❌ Failed (attempt ${retryCount + 1}): ${errorMessage}`);

      // Retry on connection/transient errors
      if (
        retryCount < config.maxRetries &&
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
        console.log(`[OpenAI] 🔄 Retrying in 1s... (${retryCount + 1}/${config.maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return transcribeWithOpenAI(audioBlob, retryCount + 1);
      }

      return null;
    }
  }, [getConfig]);

  return {
    transcribeWithOpenAI,
    getConfig
  };
};
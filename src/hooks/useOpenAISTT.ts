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
      console.log(`[OpenAI] Starting transcription via server: ${audioBlob.size} bytes, type: ${audioBlob.type} (attempt ${retryCount + 1}/${config.maxRetries + 1})`);

      // Validate blob
      if (audioBlob.size === 0) {
        console.log(`[OpenAI] ❌ Audio blob is empty (0 bytes), skipping transcription`);
        return null;
      }

      if (audioBlob.size < 1000) {
        console.log(`[OpenAI] ⚠️ Audio blob too small (${audioBlob.size} bytes), might not contain valid audio`);
      }

      // Determine file extension based on MIME type
      let filename = 'voice.webm';
      if (audioBlob.type.includes('mp4')) {
        filename = 'voice.mp4';
      } else if (audioBlob.type.includes('wav')) {
        filename = 'voice.wav';
      } else if (audioBlob.type.includes('mpeg') || audioBlob.type.includes('mp3')) {
        filename = 'voice.mp3';
      } else if (audioBlob.type.includes('ogg')) {
        filename = 'voice.ogg';
      }

      console.log(`[OpenAI] Using filename: ${filename} for MIME type: ${audioBlob.type}`);

      const formData = new FormData();
      formData.append('file', audioBlob, filename);
      formData.append('model', 'whisper-1');
      formData.append('language', 'ru');
      formData.append('response_format', 'text');
      formData.append('prompt', config.prompt);

      console.log(`[OpenAI] Sending request to /api/audio/transcriptions`);

      const response = await fetch('/api/audio/transcriptions', {
        method: 'POST',
        body: formData,
      });

      console.log(`[OpenAI] Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        let errorDetails = null;
        try {
          const errorData = await response.json();
          errorDetails = errorData;
          if (errorData?.error?.message) {
            errorMessage = `${errorMessage}: ${errorData.error.message}`;
          }
          console.log(`[OpenAI] Error response data:`, errorData);
        } catch (parseError) {
          // Try to get text response
          try {
            const textError = await response.text();
            console.log(`[OpenAI] Error response text:`, textError);
            if (textError) {
              errorMessage = `${errorMessage}: ${textError}`;
            }
          } catch {
            console.log(`[OpenAI] Could not parse error response`);
          }
        }
        
        console.log(`[OpenAI] ❌ Full error details:`, {
          status: response.status,
          statusText: response.statusText,
          blobSize: audioBlob.size,
          blobType: audioBlob.type,
          filename,
          errorDetails
        });
        
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
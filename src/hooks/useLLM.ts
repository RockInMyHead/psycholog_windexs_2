import { useState, useRef, useCallback } from 'react';
import { psychologistAI, type ChatMessage } from '@/services/openai';
import { memoryApi } from '@/services/api';

interface UseLLMProps {
  userId?: string;
  callId?: string | null;
  onResponseGenerated?: (text: string) => Promise<void>;
  onError?: (error: string) => void;
}

export const useLLM = ({ userId, callId, onResponseGenerated, onError }: UseLLMProps) => {
  const conversationRef = useRef<ChatMessage[]>([]);
  const memoryRef = useRef<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  const loadMemory = useCallback(async () => {
    if (!userId) return;
    try {
      const loadedMemory = await memoryApi.getMemory(userId, "audio");
      memoryRef.current = loadedMemory;
      console.log("[LLM] Memory loaded");
    } catch (error) {
      console.error("[LLM] Error loading memory:", error);
    }
  }, [userId]);

  const updateMemory = useCallback(async (userText: string, assistantText: string) => {
    if (!userId || !callId) return;
    try {
      const updatedMemory = await memoryApi.appendMemory(
        userId, 
        "audio", 
        callId, 
        userText, 
        assistantText
      );
      memoryRef.current = updatedMemory;
    } catch (error) {
      console.error("[LLM] Error updating memory:", error);
    }
  }, [userId, callId]);

  // Track current processing text to prevent duplicate processing
  const currentProcessingTextRef = useRef<string>('');

  const processUserMessage = useCallback(async (text: string) => {
    const callId = Date.now();
    console.log(`[LLM] processUserMessage called (ID: ${callId}) with: "${text}"`);
    if (!text.trim()) return;

    // Prevent concurrent processing of user messages
    if (isProcessing) {
      console.log(`[LLM] Skipping call (ID: ${callId}) - already processing a message`);
      return;
    }

    // Prevent processing the same text twice
    const trimmedText = text.trim();
    console.log(`[LLM] Current processing text: "${currentProcessingTextRef.current}"`);
    console.log(`[LLM] New text to process: "${trimmedText}"`);
    if (currentProcessingTextRef.current === trimmedText) {
      console.log(`[LLM] Skipping call (ID: ${callId}) - same text already being processed: "${trimmedText}"`);
      return;
    }

    setIsProcessing(true);
    currentProcessingTextRef.current = trimmedText;
    console.log(`[LLM] Started processing call (ID: ${callId}) for text: "${trimmedText}"`);
    conversationRef.current.push({ role: "user", content: text });
    console.log(`[LLM] Added user message to conversation`);

    try {
      // Generate response
      console.log(`[LLM] Calling getVoiceResponse...`);
      const assistantReply = await psychologistAI.getVoiceResponse(
        conversationRef.current,
        memoryRef.current,
        false
      );
      console.log(`[LLM] Got response: "${assistantReply?.substring(0, 50)}..."`);

      conversationRef.current.push({ role: "assistant", content: assistantReply });

      // Callback to play audio
      if (onResponseGenerated) {
        console.log(`[LLM] Calling onResponseGenerated callback`);
        await onResponseGenerated(assistantReply);
        console.log(`[LLM] onResponseGenerated completed`);
      }

      // Update memory in background
      void updateMemory(text, assistantReply);

    } catch (error) {
      console.error("[LLM] Error generating response:", error);
      onError?.("Не удалось сгенерировать ответ");
    } finally {
      console.log(`[LLM] Finished processing call (ID: ${callId})`);
      currentProcessingTextRef.current = '';
      setIsProcessing(false);
    }
  }, [onResponseGenerated, onError, updateMemory]);

  const addToConversation = useCallback((role: 'user' | 'assistant' | 'system', content: string) => {
    conversationRef.current.push({ role, content });
  }, []);

  const clearConversation = useCallback(() => {
    conversationRef.current = [];
  }, []);

  return {
    processUserMessage,
    loadMemory,
    addToConversation,
    clearConversation,
    isProcessing,
    memoryRef,
    conversationRef
  };
};


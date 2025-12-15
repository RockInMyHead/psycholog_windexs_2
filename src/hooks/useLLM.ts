import { useState, useRef, useCallback } from 'react';
import { psychologistAI, type ChatMessage } from '@/services/openai';
import { memoryApi, userProfileApi, type UserProfile, audioCallApi } from '@/services/api';

interface UseLLMProps {
  userId?: string;
  callId?: string | null;
  onResponseGenerated?: (text: string) => Promise<void>;
  onError?: (error: string) => void;
}

export const useLLM = ({ userId, callId, onResponseGenerated, onError }: UseLLMProps) => {
  const conversationRef = useRef<ChatMessage[]>([]);
  const memoryRef = useRef<string>("");
  const userProfileRef = useRef<UserProfile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const loadUserProfile = useCallback(async () => {
    if (!userId) return;
    try {
      // Load user profile
      const profile = await userProfileApi.getUserProfile(userId);
      userProfileRef.current = profile;

      // Load conversation memory from database (like in regular chat)
      const existingMemory = await memoryApi.getMemory(userId, "voice");
      const profileMemory = buildProfileMemory(profile);

      // Combine profile memory with conversation history
      memoryRef.current = existingMemory
        ? `${profileMemory}\n\nИстория предыдущих разговоров:\n${existingMemory}`
        : profileMemory;

      console.log("[LLM] User profile and conversation memory loaded");
    } catch (error) {
      console.error("[LLM] Error loading user profile and memory:", error);
      // Fallback to empty profile
      memoryRef.current = "";
    }
  }, [userId]);

  // Функция для создания структурированной памяти из профиля
  const buildProfileMemory = useCallback((profile: UserProfile): string => {
    const parts: string[] = [];

    if (profile.personalityTraits) {
      parts.push(`Черты характера: ${profile.personalityTraits}`);
    }
    if (profile.communicationStyle) {
      parts.push(`Стиль общения: ${profile.communicationStyle}`);
    }
    if (profile.currentConcerns) {
      parts.push(`Текущие тревоги/проблемы: ${profile.currentConcerns}`);
    }
    if (profile.emotionalState) {
      parts.push(`Эмоциональное состояние: ${profile.emotionalState}`);
    }
    if (profile.stressTriggers) {
      parts.push(`Триггеры стресса: ${profile.stressTriggers}`);
    }
    if (profile.interests) {
      parts.push(`Интересы: ${profile.interests}`);
    }
    if (profile.dislikes) {
      parts.push(`Не нравится: ${profile.dislikes}`);
    }
    if (profile.values) {
      parts.push(`Ценности: ${profile.values}`);
    }
    if (profile.workLife) {
      parts.push(`Работа и карьера: ${profile.workLife}`);
    }
    if (profile.relationships) {
      parts.push(`Отношения: ${profile.relationships}`);
    }
    if (profile.family) {
      parts.push(`Семья: ${profile.family}`);
    }
    if (profile.health) {
      parts.push(`Здоровье: ${profile.health}`);
    }
    if (profile.discussedTopics) {
      try {
        const topics = JSON.parse(profile.discussedTopics);
        if (topics.length > 0) {
          parts.push(`Обсужденные темы: ${topics.join(', ')}`);
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }
    if (profile.recurringThemes) {
      parts.push(`Повторяющиеся темы: ${profile.recurringThemes}`);
    }

    return parts.join('\n');
  }, []);

  const updateUserProfile = useCallback(async (userText: string, assistantText: string) => {
    if (!userId || !callId) return;
    try {
      // Анализируем разговор и обновляем профиль
      await analyzeAndUpdateProfile(userText, assistantText);

      // Обновляем память для следующего использования
      if (userProfileRef.current) {
        memoryRef.current = buildProfileMemory(userProfileRef.current);
      }

      console.log("[LLM] User profile updated");
    } catch (error) {
      console.error("[LLM] Error updating user profile:", error);
    }
  }, [userId, callId, buildProfileMemory]);

  // Функция для анализа разговора и обновления профиля
  const analyzeAndUpdateProfile = useCallback(async (userText: string, assistantText: string) => {
    if (!userProfileRef.current) return;

    const updates: Partial<UserProfile> = {};

    // Простой анализ текста для извлечения информации
    const lowerUserText = userText.toLowerCase();
    const lowerAssistantText = assistantText.toLowerCase();

    // Анализ эмоционального состояния
    if (lowerUserText.includes('тревож') || lowerUserText.includes('волнуюсь') || lowerUserText.includes('боюсь')) {
      updates.emotionalState = 'тревожное';
    } else if (lowerUserText.includes('груст') || lowerUserText.includes('печаль') || lowerUserText.includes('депрессия')) {
      updates.emotionalState = 'грустное';
    } else if (lowerUserText.includes('злюсь') || lowerUserText.includes('раздражен') || lowerUserText.includes('нервничаю')) {
      updates.emotionalState = 'раздраженное';
    }

    // Анализ текущих проблем
    if (lowerUserText.includes('работа') || lowerUserText.includes('работаю')) {
      if (!updates.currentConcerns) updates.currentConcerns = '';
      if (!updates.currentConcerns.includes('работа')) {
        updates.currentConcerns += (updates.currentConcerns ? ', ' : '') + 'проблемы на работе';
      }
    }

    if (lowerUserText.includes('отношения') || lowerUserText.includes('партнер') || lowerUserText.includes('любовь')) {
      if (!updates.currentConcerns) updates.currentConcerns = '';
      if (!updates.currentConcerns.includes('отношения')) {
        updates.currentConcerns += (updates.currentConcerns ? ', ' : '') + 'проблемы в отношениях';
      }
    }

    // Анализ интересов
    if (lowerUserText.includes('люблю') || lowerUserText.includes('интересует') || lowerUserText.includes('увлекаюсь')) {
      // Здесь можно добавить логику извлечения интересов
    }

    // Добавляем тему разговора
    const topics = extractTopics(userText);
    for (const topic of topics) {
      await userProfileApi.addDiscussedTopic(userId!, topic);
    }

    // Обновляем профиль, если есть изменения
    if (Object.keys(updates).length > 0) {
      const updatedProfile = await userProfileApi.updateUserProfile(userId!, updates);
      userProfileRef.current = updatedProfile;
    }
  }, [userId]);

  // Update conversation memory (like in regular chat)
  const updateConversationMemory = useCallback(async (userText: string, assistantText: string) => {
    if (!userId || !callId) return;

    try {
      // Save to database with callId and update local memory
      const updatedMemory = await memoryApi.appendMemory(
        userId,
        "voice",
        callId,
        userText,
        assistantText
      );

      // Update local memory reference
      const profileMemory = userProfileRef.current ? buildProfileMemory(userProfileRef.current) : "";
      memoryRef.current = `${profileMemory}\n\nИстория предыдущих разговоров:\n${updatedMemory}`;

      console.log("[LLM] Voice conversation memory updated and saved to DB");
    } catch (error) {
      console.error('[LLM] Error updating voice conversation memory:', error);
    }
  }, [userId, callId]);

  // Функция для извлечения тем из текста
  const extractTopics = useCallback((text: string): string[] => {
    const topics: string[] = [];
    const lowerText = text.toLowerCase();

    if (lowerText.includes('работа') || lowerText.includes('карьера') || lowerText.includes('бизнес')) {
      topics.push('работа');
    }
    if (lowerText.includes('отношения') || lowerText.includes('любовь') || lowerText.includes('партнер')) {
      topics.push('отношения');
    }
    if (lowerText.includes('семья') || lowerText.includes('родители') || lowerText.includes('дети')) {
      topics.push('семья');
    }
    if (lowerText.includes('здоровье') || lowerText.includes('болезнь') || lowerText.includes('врач')) {
      topics.push('здоровье');
    }
    if (lowerText.includes('деньги') || lowerText.includes('финансы') || lowerText.includes('заработок')) {
      topics.push('финансы');
    }
    if (lowerText.includes('стресс') || lowerText.includes('тревога') || lowerText.includes('депрессия')) {
      topics.push('психическое здоровье');
    }

    return [...new Set(topics)]; // Убираем дубликаты
  }, []);

  // Track current processing text to prevent duplicate processing
  const currentProcessingTextRef = useRef<string>('');

  const processUserMessage = useCallback(async (text: string) => {
    const callId = Date.now();
    console.log(`[LLM] processUserMessage called (ID: ${callId}) with: "${text}"`);
    if (!text.trim()) return;

    // iOS-specific safety check
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      console.log(`[LLM] Processing on iOS device`);
    }

    // Prevent concurrent processing of user messages
    if (isProcessing) {
      console.log(`[LLM] Skipping call (ID: ${callId}) - already processing a message`);
      return;
    }

    // Prevent processing the same text twice or similar text
    const trimmedText = text.trim();
    const currentText = currentProcessingTextRef.current;
    console.log(`[LLM] Current processing text: "${currentText}"`);
    console.log(`[LLM] New text to process: "${trimmedText}"`);

    // Skip exact duplicates
    if (currentText === trimmedText) {
      console.log(`[LLM] Skipping call (ID: ${callId}) - same text already being processed: "${trimmedText}"`);
      return;
    }

    // Skip if new text is just an extension of currently processing text (common on iOS)
    if (currentText && trimmedText.startsWith(currentText) && trimmedText.length > currentText.length) {
      console.log(`[LLM] Skipping call (ID: ${callId}) - new text "${trimmedText}" is extension of processing text "${currentText}"`);
      return;
    }

    // Skip if new text is contained within currently processing text (rare but possible)
    if (currentText && currentText.includes(trimmedText) && currentText.length > trimmedText.length) {
      console.log(`[LLM] Skipping call (ID: ${callId}) - new text "${trimmedText}" is contained in processing text "${currentText}"`);
      return;
    }

    try {
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

        // iOS-specific: Add delay before TTS to prevent conflicts
        if (isIOS) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }

      // Callback to play audio
      if (onResponseGenerated) {
        console.log(`[LLM] Calling onResponseGenerated callback`);
        await onResponseGenerated(assistantReply);
        console.log(`[LLM] onResponseGenerated completed`);
      }

      // Update user profile and conversation memory
      void updateUserProfile(text, assistantReply);
      void updateConversationMemory(text, assistantReply);

    } catch (error) {
      console.error("[LLM] Error generating response:", error);
        // On iOS, provide more specific error message
        if (isIOS) {
          onError?.("Ошибка на iOS. Попробуйте перезагрузить страницу.");
        } else {
      onError?.("Не удалось сгенерировать ответ");
        }
      }
    } catch (outerError) {
      console.error("[LLM] Critical error in processUserMessage:", outerError);
      // Prevent app crash on iOS
      if (isIOS) {
        onError?.("Критическая ошибка. Перезагрузите страницу.");
      }
    } finally {
      console.log(`[LLM] Finished processing call (ID: ${callId})`);
      currentProcessingTextRef.current = '';
      setIsProcessing(false);
    }
  }, [onResponseGenerated, onError, updateUserProfile]);

  const addToConversation = useCallback((role: 'user' | 'assistant' | 'system', content: string) => {
    conversationRef.current.push({ role, content });
  }, []);

  const clearConversation = useCallback(() => {
    conversationRef.current = [];
  }, []);

  return {
    processUserMessage,
    loadUserProfile,
    updateUserProfile,
    updateConversationMemory,
    addToConversation,
    clearConversation,
    isProcessing,
    memoryRef,
    conversationRef,
    userProfileRef
  };
};


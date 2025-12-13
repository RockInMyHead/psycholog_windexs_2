import { useRef, useCallback } from 'react';

export interface STTTextProcessorConfig {
  maxLength: number;
  minLength: number;
  dedupeWindowMs: number;
  maxSentences: number;
}

export const useSTTTextProcessor = (config: STTTextProcessorConfig = {
  maxLength: 100,
  minLength: 2,
  dedupeWindowMs: 10000,
  maxSentences: 2
}) => {
  const recentlyProcessedTextsRef = useRef<Set<string>>(new Set());

  const filterHallucinatedText = useCallback((text: string): string | null => {
    if (!text) return null;

    const lowerText = text.toLowerCase();

    // Common hallucinated patterns
    const hallucinationPatterns = [
      /продолжение следует/i,
      /с вами был/i,
      /до свидания/i,
      /до новых встреч/i,
      /спасибо за внимание/i,
      /конец/i,
      /закончили/i,
      /я мухаммад асад/i,
      /здравствуйте! я мухаммад асад/i,
      /я марк/i, // Filter out AI introducing itself
      /здравствуйте, я марк/i,
    ];

    // Check if text matches hallucination patterns
    for (const pattern of hallucinationPatterns) {
      if (pattern.test(lowerText)) {
        return null;
      }
    }

    // Filter out text that's too long (likely hallucination)
    if (text.length > config.maxLength) {
      return null;
    }

    // Filter out text with multiple sentences (likely not user speech)
    if (text.split(/[.!?]/).length > config.maxSentences) {
      return null;
    }

    // Filter out very short text (likely noise/misinterpretation)
    if (text.length < config.minLength) {
      return null;
    }

    // Filter out single characters or meaningless sounds
    const meaninglessPatterns = [
      /^[а-я]{1}$/i, // Single letter
      /^[эээ|ммм|ааа|ууу|ооо]+$/i, // Only filler sounds
      /^[а-я]{1,2}$/i, // 1-2 letters (likely noise)
    ];

    for (const pattern of meaninglessPatterns) {
      if (pattern.test(text)) {
        return null;
      }
    }

    return text;
  }, [config]);

  const normalizeSTT = useCallback((text: string): string | null => {
    if (!text) return null;

    // Trim whitespace
    const trimmed = text.trim();
    if (!trimmed) return null;

    // Apply hallucination filtering
    const filtered = filterHallucinatedText(trimmed);
    if (!filtered) return null;

    // Check for duplicates (within dedupe window)
    if (recentlyProcessedTextsRef.current.has(filtered)) {
      return null;
    }

    // Add to recently processed texts
    recentlyProcessedTextsRef.current.add(filtered);

    // Clean up old entries after dedupe window
    setTimeout(() => {
      recentlyProcessedTextsRef.current.delete(filtered);
    }, config.dedupeWindowMs);

    return filtered;
  }, [filterHallucinatedText, config.dedupeWindowMs]);

  const isDuplicate = useCallback((text: string): boolean => {
    return recentlyProcessedTextsRef.current.has(text);
  }, []);

  const clearDuplicates = useCallback(() => {
    recentlyProcessedTextsRef.current.clear();
  }, []);

  return {
    normalizeSTT,
    isDuplicate,
    clearDuplicates
  };
};
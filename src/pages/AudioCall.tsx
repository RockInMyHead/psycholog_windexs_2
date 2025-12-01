import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Phone, PhoneOff, Mic, MicOff, Music, Square } from "lucide-react";
import Navigation from "@/components/Navigation";
import { userApi, audioCallApi, memoryApi, subscriptionApi } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { psychologistAI, type ChatMessage } from "@/services/openai";

const AudioCall = () => {
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  const [isCallActive, setIsCallActive] = useState(false);

  // Детекция Safari браузера
  const isSafari = () => {
    const userAgent = navigator.userAgent;
    const isSafariBrowser = /^((?!chrome|android).)*safari/i.test(userAgent);
    return isSafariBrowser;
  };

  // Детекция браузеров с проблемами эхо (Chromium-based)
  const hasEchoProblems = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    return userAgent.includes('chrome') ||
           userAgent.includes('chromium') ||
           userAgent.includes('edg/') || // Edge
           userAgent.includes('opera') ||
           userAgent.includes('brave');
  };

  // Функции аналитики и мониторинга
  const updateAnalytics = (updates: Partial<typeof analytics>) => {
    setAnalytics(prev => ({ ...prev, ...updates }));
  };

  const logTranscriptionEvent = (event: keyof typeof analytics.transcriptionEvents, details?: any) => {
    console.log(`[ANALYTICS] Transcription event: ${event}`, details);
    updateAnalytics({
      transcriptionEvents: {
        ...analytics.transcriptionEvents,
        [event]: analytics.transcriptionEvents[event] + 1
      }
    });

    // Сохраняем детальную информацию в localStorage для отчета
    try {
      const logEntry = {
        timestamp: Date.now(),
        event,
        details,
        sessionId: currentCallId,
        browserInfo: analytics.browserInfo
      };

      const existingLogs = JSON.parse(localStorage.getItem('transcriptionLogs') || '[]');
      existingLogs.push(logEntry);

      // Ограничиваем размер логов (последние 100 записей)
      if (existingLogs.length > 100) {
        existingLogs.splice(0, existingLogs.length - 100);
      }

      localStorage.setItem('transcriptionLogs', JSON.stringify(existingLogs));
    } catch (error) {
      console.warn('[ANALYTICS] Failed to save transcription log:', error);
    }
  };

  const logNetworkEvent = (event: keyof typeof analytics.networkStats, details?: any) => {
    console.log(`[ANALYTICS] Network event: ${event}`, details);
    updateAnalytics({
      networkStats: {
        ...analytics.networkStats,
        [event]: analytics.networkStats[event] + 1
      }
    });
  };

  const logAudioQuality = (metric: keyof typeof analytics.audioQuality, value?: number) => {
    updateAnalytics({
      audioQuality: {
        ...analytics.audioQuality,
        [metric]: typeof value === 'number' ? value :
          (metric === 'interruptions' || metric === 'speechDetections') ?
          analytics.audioQuality[metric] + 1 : analytics.audioQuality[metric]
      }
    });
  };

  const generateAnalyticsReport = () => {
    const sessionDuration = (Date.now() - analytics.sessionStartTime) / 1000; // в секундах

    const report = {
      sessionInfo: {
        duration: sessionDuration,
        startTime: new Date(analytics.sessionStartTime).toISOString(),
        callId: currentCallId,
      },
      transcriptionStats: {
        totalAttempts: analytics.transcriptionEvents.browserSuccess +
                      analytics.transcriptionEvents.browserErrors +
                      analytics.transcriptionEvents.openaiFallbackSuccess +
                      analytics.transcriptionEvents.openaiFallbackErrors,
        browserSuccessRate: analytics.transcriptionEvents.browserErrors > 0 ?
          (analytics.transcriptionEvents.browserSuccess /
           (analytics.transcriptionEvents.browserSuccess + analytics.transcriptionEvents.browserErrors) * 100).toFixed(1) + '%' : '100%',
        openaiFallbackUsage: analytics.transcriptionEvents.openaiFallbackUsed,
        openaiFallbackSuccessRate: analytics.transcriptionEvents.openaiFallbackUsed > 0 ?
          (analytics.transcriptionEvents.openaiFallbackSuccess /
           analytics.transcriptionEvents.openaiFallbackUsed * 100).toFixed(1) + '%' : '0%',
        manualInputs: analytics.transcriptionEvents.manualInputUsed,
        ...analytics.transcriptionEvents
      },
      audioQuality: {
        interruptionsCount: analytics.audioQuality.interruptions,
        speechDetections: analytics.audioQuality.speechDetections,
        averageVolume: analytics.audioQuality.volumeReadings > 0 ?
          (analytics.audioQuality.averageVolume / analytics.audioQuality.volumeReadings).toFixed(1) : '0',
        ...analytics.audioQuality
      },
      networkPerformance: {
        openaiRequests: analytics.networkStats.openaiRequests,
        retryRate: analytics.networkStats.openaiRequests > 0 ?
          (analytics.networkStats.openaiRetries / analytics.networkStats.openaiRequests * 100).toFixed(1) + '%' : '0%',
        errorRate: analytics.networkStats.openaiRequests > 0 ?
          ((analytics.networkStats.openaiTimeouts + analytics.networkStats.networkErrors) /
           analytics.networkStats.openaiRequests * 100).toFixed(1) + '%' : '0%',
        ...analytics.networkStats
      },
      browserCompatibility: {
        ...analytics.browserInfo,
        compatibility: getBrowserCompatibilityScore()
      }
    };

    console.log('[ANALYTICS] Session Report:', report);
    return report;
  };

  const getBrowserCompatibilityScore = () => {
    let score = 100;
    const issues = [];

    if (analytics.browserInfo.isIOS) {
      score -= 20;
      issues.push('iOS device - forced OpenAI usage');
    }

    if (analytics.browserInfo.forceOpenAI) {
      score -= 15;
      issues.push('Forced OpenAI mode');
    }

    if (analytics.transcriptionEvents.browserErrors > 0) {
      score -= Math.min(analytics.transcriptionEvents.browserErrors * 5, 30);
      issues.push(`${analytics.transcriptionEvents.browserErrors} browser transcription errors`);
    }

    if (analytics.networkStats.networkErrors > 0) {
      score -= Math.min(analytics.networkStats.networkErrors * 10, 20);
      issues.push(`${analytics.networkStats.networkErrors} network errors`);
    }

    return {
      score: Math.max(score, 0),
      issues,
      rating: score >= 90 ? 'Excellent' :
              score >= 80 ? 'Good' :
              score >= 70 ? 'Fair' :
              score >= 60 ? 'Poor' : 'Critical'
    };
  };

  // Функция для получения агрегированной статистики из всех сессий
  const getAggregatedAnalytics = () => {
    try {
      const sessionReports = JSON.parse(localStorage.getItem('sessionReports') || '[]');
      const transcriptionLogs = JSON.parse(localStorage.getItem('transcriptionLogs') || '[]');

      if (sessionReports.length === 0) {
        return {
          totalSessions: 0,
          averageSessionDuration: 0,
          totalTranscriptionAttempts: 0,
          browserSuccessRate: 0,
          openaiFallbackUsage: 0,
          networkErrorRate: 0,
          browserCompatibility: {},
          recentIssues: []
        };
      }

      // Агрегируем данные из всех сессий
      const aggregated = sessionReports.reduce((acc: any, session: any) => {
        const report = session.report;

        acc.totalSessions++;
        acc.totalSessionDuration += report.sessionInfo.duration;
        acc.totalTranscriptionAttempts += report.transcriptionStats.totalAttempts;
        acc.totalBrowserSuccess += report.transcriptionStats.browserSuccess;
        acc.totalBrowserErrors += report.transcriptionStats.browserErrors;
        acc.totalOpenaiFallbacks += report.transcriptionStats.openaiFallbackUsage;
        acc.totalNetworkErrors += report.networkPerformance.networkErrors;

        // Собираем браузерную статистику
        const browserKey = `${report.browserCompatibility.isIOS ? 'iOS' : 'Non-iOS'}-${report.browserCompatibility.isMobile ? 'Mobile' : 'Desktop'}`;
        if (!acc.browserStats[browserKey]) {
          acc.browserStats[browserKey] = { count: 0, totalScore: 0 };
        }
        acc.browserStats[browserKey].count++;
        acc.browserStats[browserKey].totalScore += report.browserCompatibility.score;

        return acc;
      }, {
        totalSessions: 0,
        totalSessionDuration: 0,
        totalTranscriptionAttempts: 0,
        totalBrowserSuccess: 0,
        totalBrowserErrors: 0,
        totalOpenaiFallbacks: 0,
        totalNetworkErrors: 0,
        browserStats: {}
      });

      // Вычисляем средние значения
      const avgSessionDuration = aggregated.totalSessionDuration / aggregated.totalSessions;
      const browserSuccessRate = aggregated.totalBrowserErrors > 0 ?
        (aggregated.totalBrowserSuccess / (aggregated.totalBrowserSuccess + aggregated.totalBrowserErrors) * 100) : 100;
      const networkErrorRate = aggregated.totalTranscriptionAttempts > 0 ?
        (aggregated.totalNetworkErrors / aggregated.totalTranscriptionAttempts * 100) : 0;

      // Получаем последние проблемы
      const recentIssues = transcriptionLogs
        .filter((log: any) => log.event === 'browserErrors' || log.event === 'openaiFallbackErrors')
        .slice(-10)
        .map((log: any) => ({
          timestamp: new Date(log.timestamp).toLocaleString(),
          type: log.event,
          error: log.details?.error || 'Unknown',
          browser: log.browserInfo?.userAgent?.substring(0, 50) + '...'
        }));

      return {
        totalSessions: aggregated.totalSessions,
        averageSessionDuration: Math.round(avgSessionDuration),
        totalTranscriptionAttempts: aggregated.totalTranscriptionAttempts,
        browserSuccessRate: Math.round(browserSuccessRate * 10) / 10,
        openaiFallbackUsage: aggregated.totalOpenaiFallbacks,
        networkErrorRate: Math.round(networkErrorRate * 10) / 10,
        browserCompatibility: Object.entries(aggregated.browserStats).map(([browser, stats]: [string, any]) => ({
          browser,
          sessions: stats.count,
          averageScore: Math.round(stats.totalScore / stats.count)
        })),
        recentIssues
      };
    } catch (error) {
      console.error('[ANALYTICS] Failed to aggregate analytics:', error);
      return null;
    }
  };

  // Экспортируем функции аналитики для внешнего использования
  useEffect(() => {
    (window as any).getTranscriptionAnalytics = getAggregatedAnalytics;
    (window as any).getCurrentSessionReport = generateAnalyticsReport;
  }, []);

  // Детекция iOS устройств
  const isIOSDevice = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(userAgent) ||
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPad with desktop mode
  };

  // Детекция мобильных устройств
  const isMobileDevice = () => {
    return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent.toLowerCase()) ||
           (window.innerWidth <= 768 && window.innerHeight <= 1024);
  };

  // Проверка поддержки Speech Recognition API на мобильных устройствах
  const checkSpeechRecognitionSupport = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isIOS = isIOSDevice();
    const isMobile = isMobileDevice();

    // iOS Safari имеет ограниченную поддержку Speech Recognition
    if (isIOS) {
      console.log("[Mobile] iOS device detected - Speech Recognition may have limitations");
      return 'limited'; // Ограниченная поддержка
    }

    // Android устройства обычно хорошо поддерживают Speech Recognition
    if (isMobile && userAgent.includes('android')) {
      console.log("[Mobile] Android device detected - good Speech Recognition support expected");
      return 'full'; // Полная поддержка
    }

    // Другие мобильные устройства - проверяем наличие API
    if (isMobile) {
      const hasAPI = !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition;
      console.log(`[Mobile] Mobile device detected - Speech Recognition API: ${hasAPI ? 'available' : 'not available'}`);
      return hasAPI ? 'full' : 'none';
    }

    // Desktop устройства
    return 'full';
  };

  // Управление микрофоном во время TTS для не-Safari браузеров
  const updateMicDuringTTS = () => {
    // Сначала управляем транскрибацией для браузеров с проблемами эхо
    updateTranscriptionDuringTTS();

    if (isSafariBrowser || !audioStreamRef.current) return;

    const shouldMuteDuringTTS = isPlayingAudioRef.current || isSynthesizingRef.current;
    const userMuted = isMutedRef.current; // Пользователь вручную отключил микрофон

    if (shouldMuteDuringTTS && !userMuted) {
      // Отключаем микрофон во время TTS (только если пользователь не отключил его вручную)
      audioStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
      console.log("[AudioCall] Микрофон отключен во время TTS");
    } else if (!shouldMuteDuringTTS && !userMuted) {
      // Включаем микрофон после окончания TTS (только если пользователь не отключил его вручную)
      audioStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });
      console.log("[AudioCall] Микрофон включен после TTS");
    }
  };
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [user, setUser] = useState<any | null>(null);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const currentCallIdRef = useRef<string | null>(null);
  const [transcriptionStatus, setTranscriptionStatus] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscriptionInfo, setSubscriptionInfo] = useState<{ plan: 'premium' | 'free' | 'none'; remaining: number; limit: number; status: 'active' | 'inactive' | 'cancelled' | 'none' } | null>(null);
  const [isMusicOn, setIsMusicOn] = useState(false); // Управление фоновой музыкой
  const [isVideoPlaying, setIsVideoPlaying] = useState(false); // Управление видео Марка
  const [isSafariBrowser, setIsSafariBrowser] = useState(false); // Детекция Safari браузера
  const [isInitializingCall, setIsInitializingCall] = useState(false); // Промежуточное состояние при запуске звонка
  const [transcriptionDisabledByTTS, setTranscriptionDisabledByTTS] = useState(false); // Отключена ли транскрибация из-за TTS
  const [transcriptionMode, setTranscriptionMode] = useState<'browser' | 'openai'>('browser'); // Режим транскрибации
  const [isRecordingForFallback, setIsRecordingForFallback] = useState(false); // Запись аудио для fallback
  const [browserRetryCount, setBrowserRetryCount] = useState(0); // Счетчик повторных попыток браузерной транскрибации
  const [safariSpeechDetectionCount, setSafariSpeechDetectionCount] = useState(0); // Счетчик кадров с речью для Safari
  const [lastSafariSpeechTime, setLastSafariSpeechTime] = useState(0); // Время последнего обнаружения речи в Safari

  // Аналитика и мониторинг
  const [analytics, setAnalytics] = useState({
    sessionStartTime: Date.now(),
    transcriptionEvents: {
      browserSuccess: 0,
      browserErrors: 0,
      openaiFallbackUsed: 0,
      openaiFallbackSuccess: 0,
      openaiFallbackErrors: 0,
      manualInputUsed: 0,
    },
    audioQuality: {
      interruptions: 0,
      speechDetections: 0,
      averageVolume: 0,
      volumeReadings: 0,
    },
    browserInfo: {
      userAgent: navigator.userAgent,
      isIOS: false,
      isMobile: false,
      speechRecognitionSupport: 'unknown',
      forceOpenAI: false,
    },
    networkStats: {
      openaiRequests: 0,
      openaiRetries: 0,
      openaiTimeouts: 0,
      networkErrors: 0,
    }
  });
  const [isIOS, setIsIOS] = useState(false); // Определение iOS устройств
  const [isMobile, setIsMobile] = useState(false); // Определение мобильных устройств
  const [microphoneAccessGranted, setMicrophoneAccessGranted] = useState(false); // Статус доступа к микрофону
  const [forceOpenAI, setForceOpenAI] = useState(false); // Принудительное использование OpenAI транскрибации

  const audioStreamRef = useRef<MediaStream | null>(null);
  const callTimerRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const recognitionActiveRef = useRef(false);
  const isMutedRef = useRef(false);
  const isSpeakerOnRef = useRef(true);
  const conversationRef = useRef<ChatMessage[]>([]);
  const responseQueueRef = useRef<Promise<void>>(Promise.resolve());
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingAudioRef = useRef(false);
  const currentSpeechSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const processingSoundIntervalRef = useRef<number | null>(null);
  const generationIdRef = useRef(0); // Для отмены генерации речи при прерывании
  const audioContextRef = useRef<AudioContext | null>(null);
  const speakerGainRef = useRef<GainNode | null>(null);
  const callLimitReachedRef = useRef(false);
  const callLimitWarningSentRef = useRef(false);
  const callGoodbyeSentRef = useRef(false);
  const memoryRef = useRef<string>("");
  const isStartingCallRef = useRef(false); // Флаг для предотвращения повторных вызовов startCall
  const speechTimeoutRef = useRef<number | null>(null); // Таймер для обработки промежуточных результатов
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const volumeMonitorRef = useRef<number | null>(null);
  const backgroundMusicRef = useRef<HTMLAudioElement | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);
  const isSynthesizingRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null); // MediaRecorder для fallback транскрибации
  const recordedChunksRef = useRef<Blob[]>([]); // Записанные аудио чанки для fallback

  const SESSION_DURATION_SECONDS = 30 * 60; // 30 минут на сессию
  const SESSION_WARNING_SECONDS = SESSION_DURATION_SECONDS - 5 * 60; // Предупреждение за 5 минут
  const SESSION_GOODBYE_SECONDS = SESSION_DURATION_SECONDS - 1 * 60; // Прощание за 1 минуту
  const MAX_CALL_DURATION_SECONDS = 40 * 60; // Абсолютный максимум (для подстраховки)
  const VOICE_DETECTION_THRESHOLD = 80; // Увеличили порог до 80 для лучшей защиты от шума и ложных срабатываний

  // Оптимизация для Safari голосового прерывания
  const SAFARI_VOICE_DETECTION_THRESHOLD = 60; // Более низкий порог для Safari (более чувствительный)
  const SAFARI_SPEECH_CONFIRMATION_FRAMES = 3; // Нужно 3 подряд кадра с речью для подтверждения
  const SAFARI_SPEECH_TIMEOUT = 2000; // Максимальное время ожидания подтверждения речи (мс)
  const SAFARI_SPEECH_DEBOUNCE = 1000; // Минимальный интервал между прерываниями (мс)

  const createAudioContext = () => {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
    }
    return audioContextRef.current;
  };

  const initializeAudioContext = async () => {
    const audioContext = createAudioContext();

    if (!speakerGainRef.current && audioContext) {
      const gainNode = audioContext.createGain();
      gainNode.gain.value = isSpeakerOnRef.current ? 1 : 0;
      gainNode.connect(audioContext.destination);
      speakerGainRef.current = gainNode;
    }

    // На мобильных устройствах AudioContext может быть suspended
    if (audioContext && audioContext.state === 'suspended') {
      console.log("[AudioCall] AudioContext is suspended, attempting to resume...");
      try {
        await audioContext.resume();
        console.log("[AudioCall] AudioContext resumed successfully");
      } catch (error) {
        console.warn("[AudioCall] Failed to resume AudioContext:", error);
      }
    }

    return audioContext;
  };

  const getAudioOutputNode = () => {
    const audioContext = createAudioContext();
    if (!audioContext) {
      return null;
    }
    if (!speakerGainRef.current) {
      const gainNode = audioContext.createGain();
      gainNode.gain.value = isSpeakerOnRef.current ? 1 : 0;
      gainNode.connect(audioContext.destination);
      speakerGainRef.current = gainNode;
    }
    return speakerGainRef.current;
  };

  const playBeepSound = async (frequency: number = 800, duration: number = 200) => {
    try {
      const audioContext = await initializeAudioContext();
      const outputNode = getAudioOutputNode();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(outputNode ?? audioContext.destination);

      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration / 1000);
    } catch (error) {
      console.warn('Could not play beep sound:', error);
    }
  };

  const startProcessingSound = () => {
    if (processingSoundIntervalRef.current) {
      clearInterval(processingSoundIntervalRef.current);
    }

    // Первый сигнал сразу
    playBeepSound(800, 150);

    // Затем повторять каждые 3 секунды
    processingSoundIntervalRef.current = window.setInterval(() => {
      playBeepSound(800, 150);
    }, 3000);
  };

  const stopProcessingSound = () => {
    if (processingSoundIntervalRef.current) {
      clearInterval(processingSoundIntervalRef.current);
      processingSoundIntervalRef.current = null;
    }
  };

  const splitIntoSentences = (text: string): string[] => {
    return text
      .split(/(?<=[.!?])\s+/u)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 0);
  };

  const resetAudioPlayback = () => {
    audioQueueRef.current = [];
    isPlayingAudioRef.current = false;
    if (audioContextRef.current) {
      audioContextRef.current.close().catch((error) => {
        console.warn("Error closing AudioContext:", error);
      });
      audioContextRef.current = null;
    }
    speakerGainRef.current = null;
  };

  const playQueuedAudio = async () => {
    if (!Array.isArray(audioQueueRef.current)) {
      console.error("[AudioCall] audioQueueRef.current is not an array, resetting");
      audioQueueRef.current = [];
    }

    if (isPlayingAudioRef.current) {
      return;
    }

    if (audioQueueRef.current.length === 0) {
      return;
    }

    // Проверяем, не было ли прерывание во время подготовки
    const startGenId = generationIdRef.current;

    const audioContext = await initializeAudioContext();
    if (!audioContext) {
      console.warn("[AudioCall] AudioContext unavailable.");
      audioQueueRef.current = [];
      return;
    }

    const outputNode = getAudioOutputNode();
    isPlayingAudioRef.current = true;

    // Обновляем состояние видео - запускаем если нужно
    updateVideoBasedOnTTS();

    // Отключаем микрофон во время TTS для не-Safari браузеров
    updateMicDuringTTS();

    // Увеличиваем порог чувствительности во время TTS чтобы избежать прерывания собственным звуком
    // Порог динамически увеличивается на +20 когда Марк говорит

    try {
      while (audioQueueRef.current.length > 0) {
        // Проверяем, не было ли прерывание перед каждым аудио буфером
        if (generationIdRef.current !== startGenId) {
          console.log("[AudioCall] Playback cancelled due to generation change");
          break;
        }

        const buffer = audioQueueRef.current.shift();
        if (!buffer || !(buffer instanceof ArrayBuffer) || buffer.byteLength === 0) continue;

        let decoded: AudioBuffer;
        try {
          decoded = await audioContext.decodeAudioData(buffer.slice(0));
        } catch (decodeError) {
          console.error("[AudioCall] Failed to decode audio data:", decodeError);
          continue;
        }

        await new Promise<void>((resolve) => {
          // Проверяем generationId перед каждым воспроизведением
          if (generationIdRef.current !== startGenId) {
            console.log("[AudioCall] Audio playback cancelled due to generation change");
            resolve();
            return;
          }

          const source = audioContext.createBufferSource();
          source.buffer = decoded;
          source.connect(outputNode ?? audioContext.destination);
          currentSpeechSourceRef.current = source;

          source.onended = () => {
            currentSpeechSourceRef.current = null;
            resolve();
          };

          source.start(0);
        });
      }
    } catch (error) {
      console.error("[AudioCall] Error during audio playback:", error);
      audioQueueRef.current = [];
      // Обновляем состояние видео при ошибке
      updateVideoBasedOnTTS();
    } finally {
      isPlayingAudioRef.current = false;

      // Обновляем состояние видео
      updateVideoBasedOnTTS();

      if (audioQueueRef.current.length > 0) {
        void playQueuedAudio();
      } else {
        // Включаем микрофон после окончания TTS для не-Safari браузеров
        updateMicDuringTTS();
      }
    }
  };

  const enqueueSpeechPlayback = async (text: string) => {
    console.log("[AudioCall] enqueueSpeechPlayback called with text:", text);
    const sentences = splitIntoSentences(text);
    if (sentences.length === 0) return;

    const myGenId = generationIdRef.current;
    isSynthesizingRef.current = true;

    // Обновляем состояние видео - запускаем если нужно
    updateVideoBasedOnTTS();

    try {
      for (const sentence of sentences) {
        if (generationIdRef.current !== myGenId) {
          console.log("[AudioCall] Generation cancelled");
          break;
        }

        try {
          const audioBuffer = await psychologistAI.synthesizeSpeech(sentence);

          // Дополнительная проверка после синтеза
          if (generationIdRef.current !== myGenId) {
            console.log("[AudioCall] Generation cancelled after synthesis");
            break;
          }

          if (audioBuffer && audioBuffer.byteLength > 0) {
            audioQueueRef.current.push(audioBuffer);
            if (!isPlayingAudioRef.current) {
              void playQueuedAudio();
            }
          }
        } catch (error) {
          console.warn("[AudioCall] Failed to synthesize sentence:", sentence, error);
        }
      }
    } finally {
      isSynthesizingRef.current = false;

      // Обновляем состояние видео - возможно нужно остановить если синтез завершен и аудио не играет
      updateVideoBasedOnTTS();
    }
  };

  const stopAssistantSpeech = () => {
    const newGenerationId = generationIdRef.current + 1;
    generationIdRef.current = newGenerationId;

    // Агрессивная очистка всех аудио ресурсов
    audioQueueRef.current = [];

    // Немедленное прерывание текущего воспроизведения
    if (currentSpeechSourceRef.current) {
      try {
        currentSpeechSourceRef.current.stop();
        currentSpeechSourceRef.current.disconnect();
      } catch (error) {
        console.warn("Error stopping speech source:", error);
      }
      currentSpeechSourceRef.current = null;
    }

    // Сбрасываем все флаги состояния
    isPlayingAudioRef.current = false;
    isSynthesizingRef.current = false;

    console.log(`[AudioCall] Speech stopped aggressively (generationId: ${newGenerationId})`);

    // Сбрасываем счетчики обнаружения речи Safari при остановке TTS
    setSafariSpeechDetectionCount(0);

    // Обновляем состояние видео - останавливаем если нужно
    updateVideoBasedOnTTS();

    // Включаем микрофон после остановки TTS для не-Safari браузеров
    updateMicDuringTTS();
  };

  const initializeBackgroundMusic = async () => {
    if (!backgroundMusicRef.current) {
      try {
        // Используем спокойную музыку из public папки
        const musicUrl = '/de144d31b1f3b3f.mp3'; // Файл из public папки

        backgroundMusicRef.current = new Audio(musicUrl);
        backgroundMusicRef.current.loop = true;
        backgroundMusicRef.current.volume = 0.1; // Очень тихая музыка (10% громкости)

        // Подключаем к Web Audio API для дополнительного контроля громкости
        const audioContext = await initializeAudioContext();
        if (audioContext && backgroundMusicRef.current) {
          const source = audioContext.createMediaElementSource(backgroundMusicRef.current);
          const gainNode = audioContext.createGain();
          gainNode.gain.value = 0.05; // Дополнительное понижение громкости

          source.connect(gainNode);
          gainNode.connect(audioContext.destination);

          musicGainRef.current = gainNode;
        }
      } catch (error) {
        console.warn('Error initializing background music:', error);
      }
    }
  };

  const playBackgroundMusic = async () => {
    if (backgroundMusicRef.current) {
      try {
        await backgroundMusicRef.current.play();
        if (musicGainRef.current) {
          musicGainRef.current.gain.setValueAtTime(0.05, musicGainRef.current.context.currentTime);
        }
      } catch (error) {
        console.warn('Error playing background music:', error);
      }
    }
  };

  const pauseBackgroundMusic = () => {
    if (backgroundMusicRef.current) {
      backgroundMusicRef.current.pause();
      if (musicGainRef.current) {
        musicGainRef.current.gain.setValueAtTime(0, musicGainRef.current.context.currentTime);
      }
    }
  };

  const toggleBackgroundMusic = async () => {
    if (!backgroundMusicRef.current) {
      await initializeBackgroundMusic();
    }

    if (isMusicOn) {
      pauseBackgroundMusic();
      setIsMusicOn(false);
    } else {
      await playBackgroundMusic();
      setIsMusicOn(true);
    }
  };

  const playVideo = async () => {
    // СТРОГОЕ воспроизведение видео ТОЛЬКО когда TTS активен
    if (videoRef.current && (isPlayingAudioRef.current || isSynthesizingRef.current)) {
      try {
        // Минимальная задержка перед запуском видео, чтобы синхронизировать с началом аудио
        // Задержка нужна потому что синтез TTS занимает время, а видео запускается мгновенно
        if (isSynthesizingRef.current && !isPlayingAudioRef.current) {
          // Когда только синтезируем, но еще не играем - добавляем небольшую задержку
          await new Promise(resolve => setTimeout(resolve, 300)); // 300ms задержка для синхронизации
        }

        // Проверяем еще раз, что TTS все еще активен после задержки
        if (isPlayingAudioRef.current || isSynthesizingRef.current) {
          await videoRef.current.play();
          setIsVideoPlaying(true);
          console.log("[AudioCall] Video started with proper timing - TTS active");
        }
      } catch (error) {
        console.warn('Error playing video:', error);
        // Даже при ошибке сбрасываем состояние
        setIsVideoPlaying(false);
      }
    } else {
      // Если TTS не активен, принудительно останавливаем видео
      stopVideoImmediately();
    }
  };

  const stopVideoImmediately = () => {
    // СТРОГАЯ остановка видео НЕЗАВИСИМО от состояния
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.currentTime = 0; // Сбрасываем на начало РЕЗКО
        setIsVideoPlaying(false);
        console.log("[AudioCall] Video stopped IMMEDIATELY - TTS inactive");
      } catch (error) {
        console.warn('Error stopping video:', error);
      }
    }
  };

  // Управление видео состоянием на основе TTS - СТРОГОЕ И МГНОВЕННОЕ
  const updateVideoBasedOnTTS = () => {
    const isTTSActive = isPlayingAudioRef.current || isSynthesizingRef.current;

    if (isTTSActive) {
      // Мгновенный запуск видео когда TTS активен - БЕЗ ЗАДЕРЖЕК
      void playVideo();
    } else {
      // Мгновенная остановка видео когда TTS неактивен - РЕЗКО И СТРОГО
      stopVideoImmediately();
    }
  };

  // Старая функция pauseVideo заменена на stopVideoImmediately для более строгого контроля

  // Инициализируем видео только после пользовательского взаимодействия (для мобильной совместимости)
  const initializeVideoForMobile = async () => {
    if (videoRef.current) {
      try {
        // На мобильных устройствах предварительно загружаем видео
        videoRef.current.load();
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
        setIsVideoPlaying(false);
        console.log("[AudioCall] Video initialized for mobile compatibility");
      } catch (error) {
        console.warn("[AudioCall] Error initializing video:", error);
      }
    }
  };

  const startVolumeMonitoring = async (stream: MediaStream) => {
    try {
      const audioContext = await initializeAudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioAnalyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const checkVolume = () => {
        if (!recognitionActiveRef.current || !audioAnalyserRef.current) {
          return;
        }
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;

        // Оптимизированная логика для Safari
        if (!hasEchoProblems()) {
          const isAssistantActive = isPlayingAudioRef.current || isSynthesizingRef.current;
          const safariThreshold = isAssistantActive ?
            SAFARI_VOICE_DETECTION_THRESHOLD + 15 : SAFARI_VOICE_DETECTION_THRESHOLD;

          const currentTime = Date.now();

          // Проверяем уровень громкости
          if (average > safariThreshold) {
            // Речь обнаружена - увеличиваем счетчик
            setSafariSpeechDetectionCount(prev => {
              const newCount = prev + 1;
              console.debug(`[AudioCall] Safari speech detection: frame ${newCount}/${SAFARI_SPEECH_CONFIRMATION_FRAMES}, volume: ${average.toFixed(1)}`);

              // Проверяем подтверждение речи
              if (newCount >= SAFARI_SPEECH_CONFIRMATION_FRAMES) {
                // Проверяем debounce (не прерывать слишком часто)
                if (currentTime - lastSafariSpeechTime > SAFARI_SPEECH_DEBOUNCE) {
            console.log(`[AudioCall] Safari: Confirmed user speech (volume: ${average.toFixed(1)}), interrupting TTS`);
            setLastSafariSpeechTime(currentTime);
            logAudioQuality('interruptions');
            logAudioQuality('speechDetections');
            stopAssistantSpeech();
            return 0; // Сбрасываем счетчик после успешного прерывания
                } else {
                  console.debug(`[AudioCall] Safari: Speech detected but debouncing (${currentTime - lastSafariSpeechTime}ms < ${SAFARI_SPEECH_DEBOUNCE}ms)`);
                }
              }

              return newCount;
            });
          } else {
            // Речь не обнаружена - сбрасываем счетчик
            setSafariSpeechDetectionCount(0);
          }

          // Проверяем таймаут подтверждения речи
          setSafariSpeechDetectionCount(prev => {
            if (prev > 0 && currentTime - lastSafariSpeechTime > SAFARI_SPEECH_TIMEOUT) {
              console.debug(`[AudioCall] Safari: Speech confirmation timeout, resetting counter`);
              return 0;
            }
            return prev;
          });
        }

        volumeMonitorRef.current = window.requestAnimationFrame(checkVolume);
      };
      volumeMonitorRef.current = window.requestAnimationFrame(checkVolume);
    } catch (error) {
      console.warn("Error starting volume monitoring:", error);
    }
  };

  const stopVolumeMonitoring = () => {
    if (volumeMonitorRef.current) {
      cancelAnimationFrame(volumeMonitorRef.current);
      volumeMonitorRef.current = null;
    }
    if (audioAnalyserRef.current) {
      audioAnalyserRef.current.disconnect();
      audioAnalyserRef.current = null;
    }
  };

  // MediaRecorder для fallback транскрибации через OpenAI
  const startMediaRecording = (stream: MediaStream) => {
    if (mediaRecorderRef.current) {
      console.warn("[AudioCall] MediaRecorder already active");
      return;
    }

    try {
      // Проверяем поддержку форматов записи
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/wav'
      ];

      let selectedMimeType = '';
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }

      if (!selectedMimeType) {
        console.warn("[AudioCall] No supported audio format for MediaRecorder");
        return;
      }

      console.log(`[AudioCall] Starting MediaRecorder with format: ${selectedMimeType}`);
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: selectedMimeType
      });

      recordedChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        console.log(`[AudioCall] MediaRecorder stopped, recorded ${recordedChunksRef.current.length} chunks`);
      };

      mediaRecorderRef.current.start(1000); // Записываем чанки каждую секунду
      setIsRecordingForFallback(true);

    } catch (error) {
      console.error("[AudioCall] Failed to start MediaRecorder:", error);
    }
  };

  const stopMediaRecording = (): Promise<Blob | null> => {
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
        setIsRecordingForFallback(false);
        console.log(`[AudioCall] MediaRecorder stopped, created blob of ${blob.size} bytes`);
        resolve(blob);
      };

      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    });
  };

  const stopRecognition = () => {
    recognitionActiveRef.current = false;
    if (recognitionRef.current) {
      try {
        // Не очищаем обработчики событий - они могут понадобиться для перезапуска
        recognitionRef.current.stop();
      } catch (error) {
        console.warn("Error stopping speech recognition:", error);
      }
      // Не устанавливаем recognitionRef.current = null - объект нужен для перезапуска
    }
  };

  const startRecognition = () => {
    if (!recognitionRef.current || recognitionActiveRef.current) return;

    recognitionActiveRef.current = true;
    try {
      recognitionRef.current.start();
      console.log("[AudioCall] Speech recognition restarted");
    } catch (error) {
      console.warn("Failed to restart speech recognition:", error);
    }
  };

  // Управление транскрибацией во время TTS для браузеров с проблемами эхо
  const updateTranscriptionDuringTTS = () => {
    if (!hasEchoProblems()) return; // Только для браузеров с проблемами эхо

    const shouldDisableTranscription = isPlayingAudioRef.current || isSynthesizingRef.current;

    if (shouldDisableTranscription && recognitionActiveRef.current) {
      // Отключаем транскрибацию во время TTS
      stopRecognition();
      setTranscriptionDisabledByTTS(true);
      console.log("[AudioCall] Транскрибация отключена во время TTS (из-за проблем эхо)");
      
      // Очищаем pending timeout чтобы не обработать эхо
      if (speechTimeoutRef.current) {
        clearTimeout(speechTimeoutRef.current);
        speechTimeoutRef.current = null;
        console.log("[AudioCall] Cleared speech timeout to prevent echo processing");
      }
    } else if (!shouldDisableTranscription && !recognitionActiveRef.current && isCallActive) {
      // Включаем транскрибацию после окончания TTS, если звонок активен
      startRecognition();
      setTranscriptionDisabledByTTS(false);
      console.log("[AudioCall] Транскрибация включена после TTS");
    }
  };

  // Функция прерывания TTS и включения микрофона/транскрибации
  const interruptTTS = () => {
    console.log("[AudioCall] Пользователь прервал TTS");
    stopAssistantSpeech();

    // Для браузеров с проблемами эхо - сразу включаем транскрибацию
    if (hasEchoProblems() && transcriptionDisabledByTTS) {
      startRecognition();
      setTranscriptionDisabledByTTS(false);
      console.log("[AudioCall] Транскрибация включена после прерывания TTS");
    }

    // Включаем микрофон если он был отключен
    if (!isSafariBrowser && audioStreamRef.current && isMutedRef.current === false) {
      const micEnabled = !audioStreamRef.current.getAudioTracks().some(track => !track.enabled);
      if (!micEnabled) {
        audioStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = true;
        });
        console.log("[AudioCall] Микрофон включен после прерывания TTS");
      }
    }

    setTranscriptionStatus("Говорите...");
  };

  const cleanupRecording = () => {
    stopRecognition();
    stopVolumeMonitoring();
    resetAudioPlayback();
    conversationRef.current = [];
    responseQueueRef.current = Promise.resolve();

    // Останавливаем MediaRecorder для fallback
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    recordedChunksRef.current = [];
    setIsRecordingForFallback(false);
    setTranscriptionMode('browser');

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }

    setTranscriptionStatus(null);
  };

  // Fallback транскрибация через OpenAI (упрощенная версия, повторные попытки в сервисе)
  const transcribeWithOpenAI = async (audioBlob: Blob): Promise<string | null> => {
    try {
      console.log("[AudioCall] Starting OpenAI fallback transcription for", audioBlob.size, "bytes");
      setTranscriptionStatus("Отправляю аудио в OpenAI...");

      const transcription = await psychologistAI.transcribeAudio(audioBlob);

      if (transcription && transcription.trim()) {
        console.log("[AudioCall] OpenAI fallback successful:", transcription);
        console.info("[AudioCall] OpenAI fallback successful:", transcription.substring(0, 50) + (transcription.length > 50 ? '...' : ''));
        return transcription.trim();
      } else {
        console.warn("[AudioCall] OpenAI fallback returned empty result");
        return null;
      }
    } catch (error) {
      console.error("[AudioCall] OpenAI fallback failed:", error);
      return null;
    } finally {
      setTranscriptionStatus("");
    }
  };

  const processRecognizedText = async (rawText: string) => {
    console.log("[AudioCall] processRecognizedText вызвана с текстом:", rawText);

    if (!user) {
      console.warn("[AudioCall] Пользователь не найден, пропускаем обработку");
      return;
    }

    const text = rawText.trim();
    if (!text) {
      console.info("[AudioCall] Распознанный текст пустой — возможно, тишина или неразборчивая речь.");
      return;
    }

    // Capture generation ID before async ops to detect interruptions
    const startGenId = generationIdRef.current;

    console.info("[AudioCall] Распознанный текст пользователя:", text);
    setTranscriptionStatus("Марк обдумывает ответ...");

    conversationRef.current.push({ role: "user", content: text });

    try {
      startProcessingSound();

      const assistantReply = await psychologistAI.getVoiceResponse(conversationRef.current, memoryRef.current, false);

      // Check if interrupted
      if (generationIdRef.current !== startGenId) {
        console.log("[AudioCall] Response generation interrupted/cancelled");
        stopProcessingSound();
        return;
      }

      conversationRef.current.push({ role: "assistant", content: assistantReply });

      stopProcessingSound();
      setTranscriptionStatus("Озвучиваю ответ...");

      await enqueueSpeechPlayback(assistantReply);
      setTranscriptionStatus("");
      await updateConversationMemory(text, assistantReply);
    } catch (error) {
      console.error("Error generating assistant response:", error);
      stopProcessingSound();
      setAudioError("Не удалось озвучить ответ. Попробуйте ещё раз.");
      setTranscriptionStatus("");
    }
  };


  const handleRecognizedText = async (rawText: string, source: 'browser' | 'openai' | 'manual' = 'browser') => {
    console.log(`[AudioCall] handleRecognizedText called with (${source}):`, rawText);
    const segment = rawText.trim();
    if (!segment) {
      console.log("[AudioCall] Empty segment, skipping");
      return;
    }

    // Для ручного ввода не останавливаем речь, позволяем пользователю прервать
    if (source !== 'manual') {
      console.log("[AudioCall] Stopping assistant speech before processing");
      stopAssistantSpeech();

      // Для браузеров с проблемами эхо - включаем транскрибацию если она была отключена
      if (hasEchoProblems() && transcriptionDisabledByTTS) {
        startRecognition();
        setTranscriptionDisabledByTTS(false);
        console.log("[AudioCall] Транскрибация включена после голосового прерывания TTS");
      }
    }

    // Если это результат OpenAI транскрибации, возвращаемся к браузерной
    if (source === 'openai') {
      setTranscriptionMode('browser');
      console.log("[AudioCall] Switched back to browser transcription after OpenAI fallback");
    }

    // Немедленная обработка финального результата
    console.log("[AudioCall] Processing recognized text immediately:", segment);

    // Логируем успешную транскрибацию
    if (source === 'browser') {
      logTranscriptionEvent('browserSuccess', { length: segment.length });
    } else if (source === 'openai') {
      logTranscriptionEvent('openaiFallbackSuccess', { length: segment.length });
    } else if (source === 'manual') {
      logTranscriptionEvent('manualInputUsed', { length: segment.length });
    }

    await processRecognizedText(segment);

    // Перезапускаем recognition для очистки буфера (только для браузерной транскрибации)
    if (source === 'browser' && recognitionRef.current && recognitionActiveRef.current) {
      try {
        recognitionRef.current.stop();
        console.log("[AudioCall] Recognition stopped to clear buffer");

        // Небольшая задержка перед перезапуском
        setTimeout(() => {
          if (recognitionRef.current && isCallActive && !transcriptionDisabledByTTS) {
            try {
              recognitionRef.current.start();
              console.log("[AudioCall] Recognition restarted with clean buffer");
            } catch (error) {
              console.warn("[AudioCall] Failed to restart recognition:", error);
            }
          }
        }, 100);
      } catch (error) {
        console.warn("[AudioCall] Failed to stop recognition:", error);
      }
    }
  };

  const updateConversationMemory = async (userText: string, assistantText: string) => {
    const callId = currentCallIdRef.current || currentCallId;
    
    if (!user || !callId) {
      console.warn("[AudioCall] Cannot update memory - missing user or callId", { 
        user: !!user, 
        currentCallId,
        currentCallIdRef: currentCallIdRef.current 
      });
      return;
    }

    try {
      console.log("[AudioCall] Updating memory:", { 
        userId: user.id, 
        callId,
        userTextLength: userText.length,
        assistantTextLength: assistantText.length
      });
      
      const updatedMemory = await memoryApi.appendMemory(
        user.id,
        "audio",
        callId,
        userText,
        assistantText
      );
      memoryRef.current = updatedMemory;
      console.log("[AudioCall] Memory updated and saved to DB. New memory length:", updatedMemory.length);
    } catch (error) {
      console.error("Error updating audio memory:", error);
    }
  };

  const getUserCredentials = () => {
    const fallbackEmail = 'user@zenmindmate.com';
    const email = authUser?.email ?? fallbackEmail;
    const name = authUser?.name ?? authUser?.email ?? 'Пользователь';
    return { email, name };
  };

  useEffect(() => {
    initializeUser();
  }, [authUser]);

  useEffect(() => {
    // Детекция Safari браузера при монтировании компонента
    setIsSafariBrowser(isSafari());

    // Детекция мобильных устройств и iOS
    const ios = isIOSDevice();
    const mobile = isMobileDevice();
    const speechSupport = checkSpeechRecognitionSupport();

    setIsIOS(ios);
    setIsMobile(mobile);

    // Инициализация аналитики
    updateAnalytics({
      browserInfo: {
        userAgent: navigator.userAgent,
        isIOS: ios,
        isMobile: mobile,
        speechRecognitionSupport: speechSupport,
        forceOpenAI: false, // будет обновлено позже
      }
    });

    // Делаем аналитику доступной глобально для openai.ts
    (window as any).transcriptionAnalytics = {
      logNetworkEvent: logNetworkEvent,
      generateReport: generateAnalyticsReport
    };

    console.log(`[Mobile] Device detection: iOS=${ios}, Mobile=${mobile}`);
    console.log(`[Mobile] Speech Recognition support: ${speechSupport}`);
  }, []);

  useEffect(() => {
    isMutedRef.current = isMuted;

    const stream = audioStreamRef.current;
    if (!stream) {
      if (isMuted) {
        setTranscriptionStatus("Микрофон выключен");
      }
      return;
    }

    // Для не-Safari браузеров учитываем состояние TTS
    const shouldBeEnabled = isSafariBrowser ? !isMuted : (!isMuted && !(isPlayingAudioRef.current || isSynthesizingRef.current));

    stream.getAudioTracks().forEach((track) => {
      track.enabled = shouldBeEnabled;
    });

    if (isMuted) {
      setTranscriptionStatus("Микрофон выключен");
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          console.warn("Ошибка при остановке распознавания:", error);
        }
      }
    } else if (recognitionActiveRef.current && recognitionRef.current) {
      setTranscriptionStatus("");
      try {
        recognitionRef.current.start();
      } catch (error) {
        if (error instanceof DOMException && error.name === "InvalidStateError") {
          return;
        }
        console.warn("Не удалось возобновить распознавание речи:", error);
      }
    }
  }, [isMuted]);

  useEffect(() => {
    isSpeakerOnRef.current = isSpeakerOn;

    if (speakerGainRef.current && audioContextRef.current) {
      const gain = speakerGainRef.current.gain;
      gain.setValueAtTime(isSpeakerOn ? 1 : 0, audioContextRef.current.currentTime ?? 0);
    }
  }, [isSpeakerOn]);

  useEffect(() => {
    return () => {
      cleanupRecording();
      stopProcessingSound();
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
      if (speechTimeoutRef.current) {
        clearTimeout(speechTimeoutRef.current);
        speechTimeoutRef.current = null;
      }
    };
  }, []);

  // Обработка событий видимости страницы для возобновления распознавания речи
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && isCallActive && !isPlayingAudioRef.current && !isSynthesizingRef.current) {
        // Страница снова стала видимой, пытаемся возобновить распознавание
        console.log("[AudioCall] Page became visible, attempting to resume speech recognition");
        if (hasEchoProblems() && !recognitionActiveRef.current) {
          startRecognition();
          setTranscriptionDisabledByTTS(false);
        }
        // Очищаем ошибку видимости страницы
        if (audioError && audioError.includes("страница не в фокусе")) {
          setAudioError(null);
        }
      } else if (document.hidden && recognitionActiveRef.current) {
        // Страница стала невидимой, приостанавливаем распознавание
        console.log("[AudioCall] Page became hidden, pausing speech recognition");
        stopRecognition();
        setTranscriptionDisabledByTTS(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isCallActive, audioError]);

  const initializeUser = async () => {
    try {
      const { email, name } = getUserCredentials();
      const userData = await userApi.getOrCreateUser(email, name);
      setUser(userData);
      const info = await subscriptionApi.getAudioSessionInfo(userData.id);
      setSubscriptionInfo(info);
    } catch (error) {
      console.error('Error initializing user:', error);
    } finally {
      setLoading(false);
    }
  };

  const startCall = async () => {
    console.log("[AudioCall] Начинаем запуск звонка...");

    if (!user || isCallActive || isStartingCallRef.current) {
      console.log("[AudioCall] Звонок уже активен или пользователь не найден");
      return;
    }

    isStartingCallRef.current = true;
    setIsInitializingCall(true);

    try {
      const accessCheck = await subscriptionApi.checkAudioAccess(user.id);
      console.log("[AudioCall] Access check result:", accessCheck);

      if (!accessCheck.hasAccess) {
        isStartingCallRef.current = false;
        setIsInitializingCall(false);
        if (accessCheck.reason === 'no_subscription') {
          setAudioError("У вас нет активной подписки. Оформите подписку для доступа к аудио сессиям.");
        } else if (accessCheck.reason === 'no_sessions_left') {
          // Перенаправляем на страницу подписок вместо показа ошибки
          navigate('/subscription');
          return;
        } else {
          setAudioError("Доступ к аудио сессиям ограничен.");
        }
        return;
      }

      const sessionUsed = await subscriptionApi.useAudioSession(user.id);
      if (!sessionUsed) {
        isStartingCallRef.current = false;
        setAudioError("Не удалось активировать аудио сессию. Попробуйте еще раз.");
        return;
      }

      console.log("[AudioCall] Audio session activated successfully");

    } catch (error) {
      console.error("[AudioCall] Error checking access:", error);
      isStartingCallRef.current = false;
      setAudioError("Ошибка при проверке доступа к аудио сессиям.");
      return;
    }

    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      console.error("[AudioCall] Браузер не поддерживает mediaDevices");
      isStartingCallRef.current = false;
      setAudioError("Ваш браузер не поддерживает запись аудио.");
      return;
    }

    console.log("[AudioCall] Проверяем поддержку Speech Recognition...");

    try {
      setAudioError(null);
      setIsMuted(false);
      isMutedRef.current = false;
      setIsSpeakerOn(true);
      setCallDuration(0);
      callLimitReachedRef.current = false;
      callLimitWarningSentRef.current = false;
      callGoodbyeSentRef.current = false;
      setBrowserRetryCount(0); // Сбрасываем счетчик повторных попыток
      setSafariSpeechDetectionCount(0); // Сбрасываем счетчик обнаружения речи Safari
      setLastSafariSpeechTime(0); // Сбрасываем время последнего обнаружения речи
      setIsInitializingCall(false); // Сбрасываем на всякий случай
      
      // Загружаем память из базы данных
      const loadedMemory = await memoryApi.getMemory(user.id, "audio");
      memoryRef.current = loadedMemory;
      console.log("[AudioCall] Memory loaded from DB:", loadedMemory ? `${loadedMemory.substring(0, 100)}...` : "No memory found");

      const sessionInfo = await subscriptionApi.getAudioSessionInfo(user.id);
      setSubscriptionInfo(sessionInfo);

      // Проверяем только статус подписки, не количество оставшихся сессий
      // (количество уже проверено до активации сессии через checkAudioAccess)
      if (sessionInfo.plan === 'premium') {
        if (sessionInfo.status !== 'active') {
          isStartingCallRef.current = false;
          setAudioError('Ваша премиум подписка не активна. Продлите подписку, чтобы делать звонки.');
          setIsCallActive(false);
          return;
        }
      }

      // Проверяем поддержку Speech Recognition для мобильных устройств
      const speechSupport = checkSpeechRecognitionSupport();
      const shouldForceOpenAI = isIOSDevice() || speechSupport === 'none';
      setForceOpenAI(shouldForceOpenAI);

      console.log(`[Mobile] Speech support level: ${speechSupport}, force OpenAI: ${shouldForceOpenAI}`);

      const SpeechRecognitionConstructor = shouldForceOpenAI ? null : (
        typeof window !== "undefined"
          ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
          : null
      );

      console.log("[AudioCall] SpeechRecognition constructor:", SpeechRecognitionConstructor);

      // Для iOS и устройств без поддержки используем только OpenAI
      if (shouldForceOpenAI) {
        console.log("[Mobile] Using OpenAI transcription as primary method for mobile/iOS device");
        setTranscriptionMode('openai');

        // Обновляем аналитику
        updateAnalytics({
          browserInfo: { ...analytics.browserInfo, forceOpenAI: true }
        });
        logTranscriptionEvent('openaiFallbackUsed', { reason: 'forced_by_device' });
      } else if (!SpeechRecognitionConstructor) {
        console.error("[AudioCall] Speech Recognition API не поддерживается");
        isStartingCallRef.current = false;
        setAudioError("Ваш браузер не поддерживает системное распознавание речи.");
        return;
      }

      console.log("[AudioCall] Создаем аудио сессию в БД...");

      const call = await audioCallApi.createAudioCall(user.id);
      setCurrentCallId(call.id);
      currentCallIdRef.current = call.id;
      console.log("[AudioCall] Аудио сессия создана, ID:", call.id);
      console.log("[AudioCall] Аудио сессия создана, ID:", call.id);

      console.log("[AudioCall] Запрашиваем доступ к микрофону...");

      let stream: MediaStream;
      try {
        // Для мобильных устройств может потребоваться дополнительное время
        const constraints = isMobileDevice() ? {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 16000, // Оптимальная частота для речи
            channelCount: 1
          }
        } : { audio: true };

        stream = await navigator.mediaDevices.getUserMedia(constraints);
        audioStreamRef.current = stream;
        setMicrophoneAccessGranted(true);
        console.log("[AudioCall] Микрофон доступен, инициализируем видео для мобильных устройств...");
      } catch (micError: any) {
        console.error("[AudioCall] Microphone access error:", micError);

        // Обработка различных типов ошибок доступа к микрофону
        if (micError.name === 'NotAllowedError') {
          setAudioError("Доступ к микрофону запрещен. Разрешите доступ в настройках браузера.");
        } else if (micError.name === 'NotFoundError') {
          setAudioError("Микрофон не найден. Подключите микрофон и попробуйте снова.");
        } else if (micError.name === 'NotReadableError') {
          setAudioError("Микрофон занят другим приложением. Закройте другие приложения и попробуйте снова.");
        } else if (micError.name === 'OverconstrainedError') {
          // Для мобильных устройств пробуем с базовыми настройками
          if (isMobileDevice()) {
            console.log("[Mobile] Retrying microphone access with basic constraints...");
            try {
              stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              audioStreamRef.current = stream;
              setMicrophoneAccessGranted(true);
              console.log("[AudioCall] Микрофон доступен после повторной попытки");
            } catch (retryError) {
              console.error("[Mobile] Microphone access failed on retry:", retryError);
              setAudioError("Не удалось получить доступ к микрофону. Проверьте настройки устройства.");
              isStartingCallRef.current = false;
              return;
            }
          } else {
            setAudioError("Микрофон не соответствует требованиям. Попробуйте другой микрофон.");
          }
        } else {
          setAudioError(`Ошибка доступа к микрофону: ${micError.message}`);
        }

        // Если микрофон недоступен, но у нас есть OpenAI fallback - продолжаем
        if (shouldForceOpenAI) {
          console.log("[Mobile] Continuing without microphone - using OpenAI transcription only");
          setMicrophoneAccessGranted(false);
          // Продолжаем без микрофона для OpenAI-only режима
        } else {
          isStartingCallRef.current = false;
          return;
        }
      }

      // Инициализируем видео после получения доступа к микрофону (пользовательское взаимодействие)
      await initializeVideoForMobile();

      const recognition = new SpeechRecognitionConstructor();
      recognition.lang = "ru-RU";
      recognition.continuous = true;
      recognition.interimResults = true; // Включаем промежуточные результаты для быстрой обработки
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        console.log("[AudioCall] Recognition result event:", event);
        
        // Только для Chromium: блокируем обработку во время TTS (защита от эхо)
        if (hasEchoProblems() && (isPlayingAudioRef.current || isSynthesizingRef.current)) {
          console.log("[AudioCall] Ignoring recognition during TTS (Chrome echo prevention)");
          return;
        }
        
        let finalTranscript = "";
        let interimTranscript = "";
        
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const transcript = result?.[0]?.transcript ?? "";
          
          if (result.isFinal) {
            finalTranscript += transcript;
            console.log(`[AudioCall] Final result: "${transcript}"`);
          } else {
            interimTranscript += transcript;
            console.log(`[AudioCall] Interim result: "${transcript}"`);
          }
        }
        
        // Если есть финальный результат - обрабатываем сразу
        if (finalTranscript.trim()) {
          console.log("[AudioCall] Processing final transcript immediately:", finalTranscript);
          if (speechTimeoutRef.current) {
            clearTimeout(speechTimeoutRef.current);
            speechTimeoutRef.current = null;
          }
          setBrowserRetryCount(0); // Сбрасываем счетчик при успешной транскрибации
          setSafariSpeechDetectionCount(0); // Сбрасываем счетчик обнаружения речи Safari
          handleRecognizedText(finalTranscript);
        } 
        // Если есть только промежуточный результат - ждем паузу 1.5 сек
        else if (interimTranscript.trim()) {
          if (speechTimeoutRef.current) {
            clearTimeout(speechTimeoutRef.current);
          }
          const capturedTranscript = interimTranscript;
          speechTimeoutRef.current = window.setTimeout(() => {
            // Только для Chromium: проверка перед обработкой
            if (hasEchoProblems() && (isPlayingAudioRef.current || isSynthesizingRef.current)) {
              console.log("[AudioCall] Cancelled interim processing - TTS is active (Chrome)");
              return;
            }
            console.log("[AudioCall] Pause detected after interim result, processing:", capturedTranscript);
            handleRecognizedText(capturedTranscript);
            speechTimeoutRef.current = null;
          }, 1500);
        }
      };

      recognition.onspeechstart = () => {
        console.log("[AudioCall] Speech started event (browser detection)");

        // Оптимизированная логика прерывания для Safari
        if (!hasEchoProblems() && (isPlayingAudioRef.current || isSynthesizingRef.current)) {
          const currentTime = Date.now();

          // Проверяем debounce перед мгновенным прерыванием
          if (currentTime - lastSafariSpeechTime > SAFARI_SPEECH_DEBOUNCE) {
            console.log("[AudioCall] Safari: Instant voice interruption (onspeechstart), stopping TTS");
            setLastSafariSpeechTime(currentTime);
            setSafariSpeechDetectionCount(0); // Сбрасываем счетчик volume monitoring
            stopAssistantSpeech();
          } else {
            console.debug("[AudioCall] Safari: onspeechstart detected but debouncing active");
          }
        }
        // Chrome: используем только volume monitoring для точности
      };

      // Счетчик повторных попыток для браузерной транскрибации
      let browserRetryCount = 0;
      const maxBrowserRetries = 3;
      const maxOpenAIRetries = 2; // Меньше попыток для OpenAI чтобы не задерживать разговор

      recognition.onerror = async (event: any) => {
        // Игнорируем "no-speech" ошибки - это нормально для периодов тишины
        if (event?.error === "no-speech") {
          console.debug("[AudioCall] No speech detected - normal silence period");
          browserRetryCount = 0; // Сбрасываем счетчик при нормальной работе
          return;
        }

        // Игнорируем "aborted" ошибки - это нормально при перезапуске recognition
        if (event?.error === "aborted") {
          console.debug("[AudioCall] Recognition aborted - normal during restart");
          return;
        }

        console.error("[AudioCall] Speech recognition error:", event);
        logTranscriptionEvent('browserErrors', { error: event.error, message: event.message });
        browserRetryCount++;

        // Повторные попытки при временных ошибках (до maxBrowserRetries раз)
        const retryableErrors = ["network", "audio-capture", "not-allowed"];
        if (retryableErrors.includes(event?.error) && browserRetryCount < maxBrowserRetries) {
          console.log(`[AudioCall] Browser transcription error (${event.error}), attempt ${browserRetryCount + 1}/${maxBrowserRetries}`);

          // Ждем перед повторной попыткой
          const delay = Math.min(1000 * (browserRetryCount + 1), 3000); // 1s, 2s, 3s
          setTranscriptionStatus(`Повторная попытка браузерного распознавания (${browserRetryCount + 1}/${maxBrowserRetries})...`);
          console.log(`[AudioCall] Will retry browser recognition in ${delay}ms`);

          setTimeout(() => {
            if (isCallActive && !transcriptionDisabledByTTS) {
              try {
                console.log(`[AudioCall] Restarting browser recognition (attempt ${browserRetryCount + 1})`);
                recognition.start();
                setTranscriptionStatus("");
              } catch (restartError) {
                console.error("[AudioCall] Failed to restart recognition after error:", restartError);
                setTranscriptionStatus("");
                browserRetryCount = maxBrowserRetries; // Предотвращаем дальнейшие попытки
              }
            }
          }, delay);
          return;
        }

        // При критичных ошибках или превышении лимита попыток - переходим к OpenAI fallback
        if (event?.error === "network" || event?.error === "service-not-allowed" ||
            event?.error === "audio-capture" || event?.error === "language-not-supported" ||
            browserRetryCount >= maxBrowserRetries) {

          console.log(`[AudioCall] Browser transcription failed after ${browserRetryCount} retries, attempting OpenAI fallback`);
          console.log(`[AudioCall] Final error: ${event?.error}`);
          logTranscriptionEvent('openaiFallbackUsed', { reason: 'browser_failed', error: event?.error, retries: browserRetryCount });
          browserRetryCount = 0; // Сбрасываем счетчик

          try {
            setTranscriptionMode('openai');
            setTranscriptionStatus("Использую OpenAI для распознавания...");

            // Останавливаем запись и получаем аудио blob
            const audioBlob = await stopMediaRecording();
            if (audioBlob && audioBlob.size > 1000) { // Минимум 1KB аудио
              const transcription = await transcribeWithOpenAI(audioBlob);

              if (transcription) {
                console.log("[AudioCall] OpenAI fallback successful, processing:", transcription);
                await handleRecognizedText(transcription, 'openai');
                setTranscriptionStatus("");
                return;
              } else {
                console.warn("[AudioCall] OpenAI fallback returned no result");
                setTranscriptionStatus("");
              }
            } else {
              console.warn("[AudioCall] No audio data available for OpenAI fallback");
              setTranscriptionStatus("");
            }
          } catch (fallbackError) {
            console.error("[AudioCall] OpenAI fallback failed:", fallbackError);
            logTranscriptionEvent('openaiFallbackErrors', { error: fallbackError.message });
            setTranscriptionStatus("");

            // Graceful degradation: если OpenAI тоже не работает
            console.warn("[AudioCall] All transcription methods failed, showing user message");
            logTranscriptionEvent('browserErrors', { reason: 'all_methods_failed', finalError: fallbackError.message });
            setAudioError("Не удалось распознать речь. Попробуйте перезагрузить страницу или проверьте интернет-соединение.");
          } finally {
            setTranscriptionMode('browser');
          }
        }

        // Обработка других ошибок
        if (event?.error === "not-allowed") {
          if (event?.message?.includes("Page is not visible") || event?.message?.includes("not visible to user")) {
            setAudioError("Распознавание приостановлено - страница не в фокусе. Кликните на страницу и продолжайте разговор.");
            setTranscriptionStatus("⏸️ Страница не в фокусе - кликните для возобновления");
            console.log("[AudioCall] Recognition paused due to page not being visible");
          } else {
            setAudioError("Доступ к микрофону запрещён. Проверьте настройки браузера.");
          }
        } else if (event?.error === "service-not-allowed") {
          setAudioError("Служба распознавания речи недоступна. Попробуйте обновить страницу.");
        } else {
          setAudioError("Ошибка распознавания речи. Попробуйте ещё раз.");
        }

        browserRetryCount = 0; // Сбрасываем счетчик при окончательной ошибке
      };

      recognition.onend = () => {
        if (!recognitionActiveRef.current) {
          return;
        }

        if (isMutedRef.current) {
          setTranscriptionStatus("Микрофон выключен");
          return;
        }

        // Для браузеров с проблемами эхо - не перезапускаем автоматически если транскрибация отключена из-за TTS
        if (hasEchoProblems() && transcriptionDisabledByTTS) {
          console.log("[AudioCall] Recognition ended but TTS is active - not restarting");
          return;
        }

        try {
          recognition.start();
        } catch (error) {
          console.warn("Не удалось перезапустить распознавание речи:", error);
        }
      };

      recognitionRef.current = recognition;
      recognitionActiveRef.current = true;
      console.log("[AudioCall] Recognition создан и настроен");

      await startVolumeMonitoring(stream);
      console.log("[AudioCall] Мониторинг громкости запущен");

      // Запускаем MediaRecorder для fallback транскрибации (только если есть микрофон)
      if (stream) {
        startMediaRecording(stream);
        console.log("[AudioCall] MediaRecorder для fallback запущен");
      } else {
        console.log("[Mobile] MediaRecorder not started - no microphone available");
      }

      // Уведомляем пользователя о важности держать страницу в фокусе
      console.log("[AudioCall] Уведомление: Держите страницу в фокусе для корректной работы распознавания речи");
      if (!isSafari()) {
        setTranscriptionStatus("💡 Держите страницу в фокусе для быстрого распознавания речи");
        setTimeout(() => {
          setTranscriptionStatus("Говорите...");
        }, 3000);
      }

      try {
        setTimeout(() => {
          console.log("[AudioCall] Запускаем speech recognition...");
          try {
            recognition.start();
            console.log("[AudioCall] Speech recognition запущен успешно");
          } catch (recognitionError) {
            console.error("[AudioCall] Failed to start speech recognition:", recognitionError);
            setAudioError("Не удалось запустить распознавание речи.");
            stopRecognition();
            cleanupRecording();
          }
        }, 500);
      } catch (error) {
        console.error("[AudioCall] Failed to start speech recognition:", error);
        setAudioError("Не удалось запустить распознавание речи.");
        stopRecognition();
        cleanupRecording();
        await audioCallApi.endAudioCall(call.id, 0);
        setCurrentCallId(null);
      currentCallIdRef.current = null;
        currentCallIdRef.current = null;
        return;
      }

      // Переключаем интерфейс на активный звонок сразу после инициализации устройств
      setIsCallActive(true);
      setTranscriptionStatus("Готовлюсь к разговору...");

      // Небольшая задержка, чтобы интерфейс звонка успел отрисоваться
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log("[AudioCall] Проигрываем приветствие...");
      
      // Формируем приветствие с учетом истории общения
      let greeting = "Здравствуйте. Я Марк, психолог.";
      
      if (memoryRef.current && memoryRef.current.trim().length > 0) {
        // Если есть история общения, добавляем контекст
        greeting += " Рад продолжить нашу работу. Как у вас дела после прошлой сессии? Что изменилось или что сейчас беспокоит?";
      } else {
        // Первая сессия - стандартное приветствие
        greeting += " Расскажите, что вас сейчас больше всего беспокоит?";
      }
      
      conversationRef.current.push({ role: "assistant", content: greeting });
      await enqueueSpeechPlayback(greeting);
      console.log("[AudioCall] Приветствие проиграно");

      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }

      callTimerRef.current = window.setInterval(() => {
        setCallDuration((prev) => {
          const next = prev + 1;

          if (!callLimitWarningSentRef.current && next >= SESSION_WARNING_SECONDS && next < SESSION_DURATION_SECONDS) {
            callLimitWarningSentRef.current = true;

            responseQueueRef.current = responseQueueRef.current
              .catch((error) => console.error("Previous voice response error:", error))
              .then(async () => {
                try {
                  setTranscriptionStatus("Марк подводит итоги сессии...");

                  const summaryPrompt = `У нас осталось около пяти минут до конца нашей тридцатиминутной сессии.

Задача:
1. Кратко подведи итоги: что мы обсудили, какие важные моменты всплыли
2. Отметь, что важного клиент для себя понял или осознал
3. Предложи конкретную тему для следующей встречи, основываясь на том, что осталось недообсужденным или требует более глубокой проработки

Говори от первого лица, естественно и по-человечески. Максимум три-четыре предложения.`;

                  const conversationForSummary = [
                    ...conversationRef.current,
                    { role: "user" as const, content: summaryPrompt }
                  ];

                  const summaryResponse = await psychologistAI.getVoiceResponse(
                    conversationForSummary,
                    memoryRef.current,
                    false
                  );

                  conversationRef.current.push({ role: "assistant", content: summaryResponse });
                  await enqueueSpeechPlayback(summaryResponse);

                } catch (error) {
                  console.error("Error generating session summary:", error);
                  const fallbackMessage = "У нас осталось около пяти минут. Давайте коротко подведем итоги нашей беседы и я предложу тему для следующей встречи";
                  conversationRef.current.push({ role: "assistant", content: fallbackMessage });
                  await enqueueSpeechPlayback(fallbackMessage);
                } finally {
                  setTranscriptionStatus("");
                }
              });
          }

          // Прощание за 1 минуту до конца сессии
          if (!callGoodbyeSentRef.current && next >= SESSION_GOODBYE_SECONDS && next < SESSION_DURATION_SECONDS) {
            callGoodbyeSentRef.current = true;

            responseQueueRef.current = responseQueueRef.current
              .catch((error) => console.error("Previous voice response error:", error))
              .then(async () => {
                try {
                  setTranscriptionStatus("Марк прощается...");

                  const goodbyePrompt = `Наша сессия подходит к концу. Попрощайся с клиентом тепло и поддерживающе, пожелай успехов до следующей встречи и напомни о важности продолжать работу над собой между сессиями.

Говори от первого лица, естественно и по-человечески. Будь краток - максимум два-три предложения.`;

                  const conversationForGoodbye = [
                    ...conversationRef.current,
                    { role: "user" as const, content: goodbyePrompt }
                  ];

                  const goodbyeResponse = await psychologistAI.getVoiceResponse(
                    conversationForGoodbye,
                    memoryRef.current,
                    false
                  );

                  conversationRef.current.push({ role: "assistant", content: goodbyeResponse });
                  await enqueueSpeechPlayback(goodbyeResponse);

                } catch (error) {
                  console.error("Error generating session goodbye:", error);
                  const fallbackGoodbye = "Спасибо за нашу работу сегодня. До скорой встречи — продолжайте заботиться о себе между сессиями.";
                  conversationRef.current.push({ role: "assistant", content: fallbackGoodbye });
                  await enqueueSpeechPlayback(fallbackGoodbye);
                } finally {
                  setTranscriptionStatus("");
                }
              });
          }

          if (next >= SESSION_DURATION_SECONDS && !callLimitReachedRef.current) {
            callLimitReachedRef.current = true;
            window.setTimeout(() => {
              setAudioError("Сессия завершена: прошло 30 минут. Спасибо за доверие!");
              endCall(next).catch((error) => console.error("Error auto-ending call", error));
            }, 0);
            return SESSION_DURATION_SECONDS;
          }

          if (next >= MAX_CALL_DURATION_SECONDS) {
            return MAX_CALL_DURATION_SECONDS;
          }

          return next;
        });
      }, 1000);

      setTranscriptionStatus("");
      isStartingCallRef.current = false; // Сбрасываем флаг после успешного запуска
      setIsInitializingCall(false);
    } catch (error) {
      console.error("Error starting call:", error);
      isStartingCallRef.current = false; // Сбрасываем флаг при ошибке
      setIsInitializingCall(false);
      setAudioError("Не удалось получить доступ к микрофону. Проверьте настройки и попробуйте снова.");
      cleanupRecording();
      setCurrentCallId(null);
      currentCallIdRef.current = null;
    }
  };

  const endCall = async (overrideDuration?: number) => {
    if (!currentCallId) {
      return;
    }

    try {
      cleanupRecording();
      stopProcessingSound();

      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }

      const durationToSave = overrideDuration ?? callDuration;
      console.log(`[AudioCall] Ending call ${currentCallId} with duration ${durationToSave} seconds`);

      const cleanDuration = typeof durationToSave === 'number' ? durationToSave : Number(durationToSave) || 0;
      console.log(`[AudioCall] Using clean duration: ${cleanDuration}`);

      await audioCallApi.endAudioCall(currentCallId, cleanDuration);

      if (user && durationToSave > 0 && subscriptionInfo?.plan === 'premium' && subscriptionInfo.status === 'active') {
        const result = await subscriptionApi.recordAudioSession(user.id);
        if (!result.success && result.message) {
          setAudioError(result.message);
        }
        const latestInfo = await subscriptionApi.getAudioSessionInfo(user.id);
        setSubscriptionInfo(latestInfo);
      }
    } catch (error) {
      console.error("Error ending call:", error);
      setAudioError("Не удалось корректно завершить звонок.");
    } finally {
      // Генерируем финальный отчет аналитики перед завершением звонка
      const finalReport = generateAnalyticsReport();
      console.log('[ANALYTICS] Final session report:', finalReport);

      // Сохраняем отчет в localStorage для последующего анализа
      try {
        const reports = JSON.parse(localStorage.getItem('sessionReports') || '[]');
        reports.push({
          timestamp: Date.now(),
          callId: currentCallId,
          report: finalReport
        });

        // Храним последние 10 отчетов
        if (reports.length > 10) {
          reports.splice(0, reports.length - 10);
        }

        localStorage.setItem('sessionReports', JSON.stringify(reports));
      } catch (error) {
        console.warn('[ANALYTICS] Failed to save session report:', error);
      }

      stopAssistantSpeech();
      pauseBackgroundMusic(); // Останавливаем фоновую музыку
      setIsMusicOn(false); // Сбрасываем состояние музыки
      stopVideoImmediately(); // Останавливаем видео СТРОГО
      setIsVideoPlaying(false); // Сбрасываем состояние видео

      // Финальная очистка speech recognition
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onresult = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onend = null;
          recognitionRef.current.stop();
        } catch (error) {
          // Игнорируем ошибки при финальной очистке
        }
        recognitionRef.current = null;
      }
      recognitionActiveRef.current = false;
      setTranscriptionDisabledByTTS(false);

      setIsCallActive(false);
      setIsInitializingCall(false);
      setCallDuration(0);
      setIsMuted(false);
      isMutedRef.current = false;
      setCurrentCallId(null);
      currentCallIdRef.current = null;
      setTranscriptionStatus(null);
      callLimitReachedRef.current = false;
      callLimitWarningSentRef.current = false;
      callGoodbyeSentRef.current = false;
      memoryRef.current = "";

      if (audioStreamRef.current) {
        audioStreamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current = null;
      }
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-calm-gradient">
      <Navigation />

      <div className="pt-24 pb-8 px-4">
        <div className="container mx-auto max-w-2xl">
          <div className="text-center mb-8 animate-fade-in">
            <h1 className="text-4xl font-bold text-foreground mb-3">Аудио звонок</h1>
            <p className="text-muted-foreground">Голосовая сессия с ИИ-психологом</p>
          </div>

          <Card className="bg-card-gradient border-2 border-border shadow-strong p-8 md:p-12 text-center animate-scale-in">
            {isInitializingCall ? (
              <div className="space-y-8">
                <div className="w-[180px] h-[180px] sm:w-[260px] sm:h-[260px] md:w-[320px] md:h-[320px] mx-auto rounded-full overflow-hidden shadow-strong">
                  <video
                    ref={videoRef}
                    src="/Untitled Video.mp4"
                    className="w-full h-full object-cover pointer-events-none"
                    style={{
                      transform: 'translateX(5px) scale(1.05)',
                      objectPosition: '50% 50%'
                    }}
                    muted
                    playsInline
                    loop
                  />
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">
                    Инициализация звонка
                  </h2>
                  <p className="text-muted-foreground">
                    Подготавливаю все необходимое для разговора...
                  </p>
                  <div className="mt-6">
                    <div className="w-16 h-16 mx-auto rounded-full bg-hero-gradient flex items-center justify-center animate-pulse">
                      <Phone className="w-8 h-8 text-white animate-bounce" />
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-primary animate-pulse">
                    {transcriptionStatus || "Пожалуйста, подождите..."}
                  </p>
                </div>
              </div>
            ) : !isCallActive ? (
              <div className="space-y-8">
                <div className="w-[180px] h-[180px] sm:w-[260px] sm:h-[260px] md:w-[320px] md:h-[320px] mx-auto rounded-full overflow-hidden shadow-strong">
                  <video
                    ref={videoRef}
                    src="/Untitled Video.mp4"
                    className="w-full h-full object-cover pointer-events-none"
                    style={{
                      transform: 'translateX(5px) scale(1.05)',
                      objectPosition: '50% 50%'
                    }}
                    muted
                    playsInline
                    loop
                  />
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">
                    Начать звонок с психологом
                  </h2>
                  <p className="text-muted-foreground">
                    Нажмите кнопку ниже, чтобы начать голосовую сессию
                  </p>

                  {/* Информация для мобильных устройств */}
                  {isMobile && (
                    <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        📱 <strong>Мобильное устройство обнаружено</strong>
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                        {isIOS
                          ? "Используется облачная транскрибация для лучшей совместимости с iOS"
                          : "Оптимизированные настройки для мобильного устройства"
                        }
                      </p>
                    </div>
                  )}

                  {subscriptionInfo && subscriptionInfo.plan === 'premium' ? (
                    <p className="mt-3 text-sm text-primary font-medium">
                      Осталось аудио сессий: {subscriptionInfo.remaining} из {subscriptionInfo.limit}
                    </p>
                  ) : subscriptionInfo ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Осталось аудио сессий: {subscriptionInfo.remaining} из {subscriptionInfo.limit}
                    </p>
                  ) : null}
                </div>

                <Button
                  onClick={startCall}
                  size="lg"
                  className="bg-hero-gradient text-white hover:shadow-lg  shadow-medium text-lg px-12 py-6"
                  disabled={loading}
                >
                  <Phone className="w-6 h-6 mr-2" />
                  {loading ? "Загрузка..." : "Позвонить"}
                </Button>

                <div className="pt-8 border-t border-border">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Советы для продуктивного звонка:</h3>
                  <ul className="text-left text-muted-foreground space-y-2 max-w-md mx-auto">
                    <li>• Найдите тихое место, где вас никто не побеспокоит</li>
                    <li>• Подготовьте темы, которые хотите обсудить</li>
                    <li>• Говорите открыто и честно</li>
                    <li>• Не торопитесь, дайте себе время подумать</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                <div className="w-[220px] h-[220px] sm:w-[320px] sm:h-[320px] md:w-[400px] md:h-[400px] mx-auto rounded-full overflow-hidden shadow-strong">
                  <video
                    ref={videoRef}
                    src="/Untitled Video.mp4"
                    className="w-full h-full object-cover pointer-events-none"
                    style={{
                      transform: 'translateX(5px) scale(1.05)',
                      objectPosition: '50% 50%'
                    }}
                    muted
                    playsInline
                    loop
                  />
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">
                    Звонок идет
                  </h2>
                  <div className="text-center mt-4">
                    <div className="text-lg font-medium text-primary">
                      {formatDuration(callDuration)}
                    </div>
                    {callDuration >= SESSION_WARNING_SECONDS && callDuration < SESSION_DURATION_SECONDS && (
                      <div className="mt-2 text-sm text-orange-500 animate-pulse font-medium">
                        Осталось ~{Math.ceil((SESSION_DURATION_SECONDS - callDuration) / 60)} минут
                      </div>
                    )}
                    <div className="mt-3 w-48 mx-auto h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-1000 ${callDuration >= SESSION_WARNING_SECONDS
                          ? 'bg-orange-500'
                          : 'bg-blue-500'
                          }`}
                        style={{ width: `${Math.min((callDuration / SESSION_DURATION_SECONDS) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-center gap-4">
                  <Button
                    onClick={() => setIsMuted(!isMuted)}
                    size="lg"
                    variant={isMuted ? "destructive" : "outline"}
                    className="rounded-full w-16 h-16 p-0"
                  >
                    {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                  </Button>

                  {/* Кнопка прерывания TTS - показывается только в Chromium браузерах когда TTS активен */}
                  {hasEchoProblems() && (isPlayingAudioRef.current || isSynthesizingRef.current) && (
                    <Button
                      onClick={interruptTTS}
                      size="lg"
                      variant="destructive"
                      className="rounded-full w-16 h-16 p-0 animate-pulse"
                      title="Прервать речь Марка"
                    >
                      <Square className="w-6 h-6" />
                    </Button>
                  )}



                  <Button
                    onClick={() => endCall()}
                    size="lg"
                    variant="destructive"
                    className="rounded-full w-16 h-16 p-0 shadow-medium"
                  >
                    <PhoneOff className="w-6 h-6" />
                  </Button>
                </div>

                {/* Текстовый интерфейс для устройств без микрофона */}
                {!microphoneAccessGranted && forceOpenAI && (
                  <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
                      💬 Текстовый режим
                    </h3>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          const message = prompt("Введите ваше сообщение:");
                          if (message && message.trim()) {
                            handleRecognizedText(message.trim(), 'manual');
                          }
                        }}
                        size="sm"
                        variant="outline"
                        className="flex-1"
                      >
                        Отправить сообщение
                      </Button>
                      <Button
                        onClick={() => {
                          const responses = [
                            "Расскажите подробнее",
                            "Что вы чувствуете по этому поводу?",
                            "Как это влияет на вашу жизнь?",
                            "Что вы хотели бы изменить?"
                          ];
                          const randomResponse = responses[Math.floor(Math.random() * responses.length)];
                          handleRecognizedText(randomResponse, 'manual');
                        }}
                        size="sm"
                        variant="outline"
                      >
                        Случайный вопрос
                      </Button>
                    </div>
                  </div>
                )}


                {subscriptionInfo && (
                  <p className="text-xs text-muted-foreground">
                    Осталось сессий в этом месяце: {subscriptionInfo.remaining} из {subscriptionInfo.limit}
                  </p>
                )}

                {/* Специальное уведомление для устройств без микрофона */}
                {!microphoneAccessGranted && forceOpenAI && (
                  <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                    <p className="text-sm text-orange-800 dark:text-orange-200">
                      🎤 <strong>Микрофон недоступен</strong>
                    </p>
                    <p className="text-xs text-orange-600 dark:text-orange-300 mt-1">
                      Работа в текстовом режиме. Используйте кнопки для отправки сообщений.
                    </p>
                  </div>
                )}

                {transcriptionStatus && (
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-primary/80">{transcriptionStatus}</p>
                    {transcriptionStatus.includes("обдумывает") && (
                      <Button
                        onClick={() => {
                          // Прерываем ожидание и очищаем статус
                          if (speechTimeoutRef.current) {
                            window.clearTimeout(speechTimeoutRef.current);
                            speechTimeoutRef.current = null;
                          }
                          setTranscriptionStatus("");
                          console.log("[AudioCall] User skipped waiting for response");
                        }}
                        size="sm"
                        variant="outline"
                        className="text-xs px-2 py-1"
                      >
                        Пропустить
                      </Button>
                    )}
                    {(transcriptionStatus.includes("Озвучиваю") || transcriptionStatus.includes("Марк подводит")) && (
                      <Button
                        onClick={() => {
                          // Останавливаем TTS и сразу включаем транскрибацию
                          stopAssistantSpeech();
                          setTranscriptionStatus("Говорите...");
                          console.log("[AudioCall] User interrupted TTS and started transcription");
                        }}
                        size="sm"
                        variant="outline"
                        className="text-xs px-2 py-1"
                      >
                        Прервать
                      </Button>
                    )}
                  </div>
                )}

                {audioError && (
                  <p className="text-sm text-destructive">{audioError}</p>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AudioCall;

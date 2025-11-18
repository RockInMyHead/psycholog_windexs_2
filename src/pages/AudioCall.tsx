import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import Navigation from "@/components/Navigation";
import { userApi, audioCallApi, memoryApi, subscriptionApi } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { psychologistAI, type ChatMessage } from "@/services/openai";

const AudioCall = () => {
  const { user: authUser } = useAuth();
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [user, setUser] = useState<UserType | null>(null);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [transcriptionStatus, setTranscriptionStatus] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fastMode, setFastMode] = useState(false); // Быстрый режим для ускорения
  const [subscriptionInfo, setSubscriptionInfo] = useState<{ plan: 'premium' | 'free' | 'none'; remaining: number; limit: number; status: 'active' | 'inactive' | 'cancelled' | 'none' } | null>(null);

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
  const audioContextRef = useRef<AudioContext | null>(null);
  const speakerGainRef = useRef<GainNode | null>(null);
  const backgroundMusicRef = useRef<{
    audioElement?: HTMLAudioElement;
    isPlaying: boolean;
    oscillators?: OscillatorNode[];
    gainNode?: GainNode;
  }>({ isPlaying: false });
  const callLimitReachedRef = useRef(false);
  const callLimitWarningSentRef = useRef(false);
  const memoryRef = useRef<string>("");
  const pendingTranscriptRef = useRef<string>("");
  const pendingProcessTimeoutRef = useRef<number | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const volumeMonitorRef = useRef<number | null>(null);

  const SESSION_DURATION_SECONDS = 30 * 60; // 30 минут на сессию
  const SESSION_WARNING_SECONDS = SESSION_DURATION_SECONDS - 5 * 60; // Предупреждение за 5 минут
  const MAX_CALL_DURATION_SECONDS = 40 * 60; // Абсолютный максимум (для подстраховки)
  const VOICE_DETECTION_THRESHOLD = 35; // Увеличили порог до 35, чтобы TTS не прерывалось собственным звуком

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

  const startBackgroundMusic = async () => {
    if (backgroundMusicRef.current.isPlaying) {
      return; // Уже играет
    }

    try {
      const audioElement = new Audio('/de144d31b1f3b3f.mp3');

      // Настраиваем аудио
      audioElement.loop = true; // Зацикливаем музыку
      audioElement.volume = 0.1; // Тихая громкость (10%)
      audioElement.muted = !isSpeakerOnRef.current;
      audioElement.preload = 'auto';

      // Обработчики событий
      audioElement.addEventListener('canplaythrough', () => {
        console.log('[AudioCall] Background music loaded successfully, starting playback');
        audioElement.play().catch(error => {
          console.warn('[AudioCall] Could not play background music:', error);
          backgroundMusicRef.current.isPlaying = false;
        });
      });

      audioElement.addEventListener('error', (error) => {
        console.warn('[AudioCall] Background music loading error:', error);
        backgroundMusicRef.current.isPlaying = false;
        // Попробуем создать генеративную фоновую музыку
        startGenerativeBackgroundMusic();
      });

      audioElement.addEventListener('play', () => {
        console.log('[AudioCall] Background music started playing');
      });

      backgroundMusicRef.current = {
        audioElement,
        isPlaying: true,
      };

      console.log('[AudioCall] Background music element created, waiting for load...');

    } catch (error) {
      console.warn('[AudioCall] Could not start background music:', error);
      // Попробуем создать генеративную фоновую музыку как fallback
      startGenerativeBackgroundMusic();
    }
  };

  const startGenerativeBackgroundMusic = async () => {
    if (backgroundMusicRef.current.isPlaying) {
      return; // Уже играет
    }

    try {
      console.log('[AudioCall] Starting generative background music as fallback');
      const audioContext = await initializeAudioContext();
      if (!audioContext) {
        console.warn('[AudioCall] Cannot start generative music - no AudioContext');
        return;
      }

      const outputNode = getAudioOutputNode();

      // Создаем простую атмосферную музыку с помощью генераторов
      const createAmbientSound = () => {
        const oscillator1 = audioContext.createOscillator();
        const oscillator2 = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();

        // Настраиваем фильтр для мягкого звучания
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, audioContext.currentTime);
        filter.Q.setValueAtTime(1, audioContext.currentTime);

        // Первый осциллятор - основной тон
        oscillator1.frequency.setValueAtTime(220, audioContext.currentTime); // A3
        oscillator1.type = 'sine';

        // Второй осциллятор - гармоника
        oscillator2.frequency.setValueAtTime(330, audioContext.currentTime); // E4
        oscillator2.type = 'sine';

        // Подключаем цепочку
        oscillator1.connect(filter);
        oscillator2.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(outputNode ?? audioContext.destination);

        // Тихая громкость
        gainNode.gain.setValueAtTime(0.02, audioContext.currentTime);

        // Запускаем осцилляторы
        oscillator1.start(audioContext.currentTime);
        oscillator2.start(audioContext.currentTime);

        // Медленно меняем частоты для создания атмосферы
        const changeFrequency = () => {
          if (!backgroundMusicRef.current.isPlaying) {
            oscillator1.stop();
            oscillator2.stop();
            return;
          }

          const time = audioContext.currentTime;
          const baseFreq1 = 200 + Math.sin(time * 0.1) * 50; // Медленное изменение
          const baseFreq2 = 300 + Math.sin(time * 0.15) * 75;

          oscillator1.frequency.setValueAtTime(baseFreq1, time);
          oscillator2.frequency.setValueAtTime(baseFreq2, time);

          setTimeout(changeFrequency, 2000); // Меняем каждые 2 секунды
        };
        changeFrequency();

        backgroundMusicRef.current = {
          audioElement: null,
          isPlaying: true,
          oscillators: [oscillator1, oscillator2],
          gainNode,
        };
      };

      createAmbientSound();
      console.log('[AudioCall] Generative background music started');

    } catch (error) {
      console.warn('[AudioCall] Could not start generative background music:', error);
    }
  };

  const stopBackgroundMusic = () => {
    if (!backgroundMusicRef.current.isPlaying) {
      return;
    }

    try {
      const { audioElement, oscillators, gainNode } = backgroundMusicRef.current;

      if (audioElement) {
        // Останавливаем обычную музыку
        const fadeOut = () => {
          if (audioElement.volume > 0.01) {
            audioElement.volume -= 0.01;
            setTimeout(fadeOut, 50);
          } else {
            audioElement.pause();
            audioElement.currentTime = 0;
            backgroundMusicRef.current.isPlaying = false;
          }
        };
        fadeOut();
      } else if (oscillators && gainNode) {
        // Останавливаем генеративную музыку
        const fadeOutGenerative = () => {
          if (gainNode.gain.value > 0.001) {
            gainNode.gain.value *= 0.95; // Экспоненциальное затухание
            setTimeout(fadeOutGenerative, 50);
          } else {
            oscillators.forEach(osc => {
              try {
                osc.stop();
              } catch (error) {
                console.warn('Error stopping oscillator:', error);
              }
            });
            backgroundMusicRef.current.isPlaying = false;
            backgroundMusicRef.current.oscillators = undefined;
            backgroundMusicRef.current.gainNode = undefined;
          }
        };
        fadeOutGenerative();
      } else {
        backgroundMusicRef.current.isPlaying = false;
      }

    } catch (error) {
      console.warn('[AudioCall] Could not stop background music:', error);
      backgroundMusicRef.current.isPlaying = false;
      backgroundMusicRef.current.oscillators = undefined;
      backgroundMusicRef.current.gainNode = undefined;
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
    // Защита от конкурентного доступа и поврежденных данных
    if (!Array.isArray(audioQueueRef.current)) {
      console.error("[AudioCall] audioQueueRef.current is not an array, resetting:", audioQueueRef.current);
      audioQueueRef.current = [];
    }

    const currentQueue = [...audioQueueRef.current]; // Создаем копию для безопасной работы
    console.log("[AudioCall] playQueuedAudio called, queue length:", currentQueue.length);

    if (isPlayingAudioRef.current || currentQueue.length === 0) {
      console.log("[AudioCall] Already playing or queue empty, skipping");
      return;
    }

    const audioContext = await initializeAudioContext();
    if (!audioContext) {
      console.warn("[AudioCall] AudioContext unavailable.");
      audioQueueRef.current = [];
      return;
    }

    const outputNode = getAudioOutputNode();
    console.log("[AudioCall] Output node:", outputNode);

    isPlayingAudioRef.current = true;
    console.log("[AudioCall] Starting audio playback, queue has", currentQueue.length, "items");

    try {
      // Очищаем оригинальную очередь, так как мы работаем с копией
      audioQueueRef.current = [];

      while (currentQueue.length > 0) {
        const buffer = currentQueue.shift();
        console.log("[AudioCall] Processing buffer, remaining in current batch:", currentQueue.length);
        if (!buffer || !(buffer instanceof ArrayBuffer)) {
          console.warn("[AudioCall] Invalid buffer received, skipping:", typeof buffer, buffer);
          continue;
        }

        console.log("[AudioCall] Decoding audio data...");
        const bufferCopy = buffer.slice(0);
        console.log("[AudioCall] Buffer size:", bufferCopy.byteLength, "bytes");

        if (bufferCopy.byteLength === 0) {
          console.warn("[AudioCall] Empty buffer received, skipping");
          continue;
        }

        let decoded: AudioBuffer;
        try {
          decoded = await audioContext.decodeAudioData(bufferCopy);
          console.log("[AudioCall] Audio decoded successfully, duration:", decoded.duration, "sampleRate:", decoded.sampleRate);

          if (decoded.duration === 0) {
            console.warn("[AudioCall] Decoded audio has zero duration, skipping");
            continue;
          }
        } catch (decodeError) {
          console.error("[AudioCall] Failed to decode audio data:", decodeError);
          continue; // Пропускаем этот буфер и переходим к следующему
        }

        await new Promise<void>((resolve) => {
          console.log("[AudioCall] Creating and starting audio source");
          const source = audioContext.createBufferSource();
          source.buffer = decoded;
          source.connect(outputNode ?? audioContext.destination);
          currentSpeechSourceRef.current = source;
          source.onended = () => {
            console.log("[AudioCall] Audio source ended");
            currentSpeechSourceRef.current = null;
            resolve();
          };
          source.start(0);
        });
      }
    } catch (error) {
      console.error("[AudioCall] Error during audio playback:", error);
      // В случае ошибки очищаем очередь
      audioQueueRef.current = [];
    } finally {
      isPlayingAudioRef.current = false;
      console.log("[AudioCall] Audio playback finished");
    }
  };

  const enqueueSpeechPlayback = async (text: string) => {
    console.log("[AudioCall] enqueueSpeechPlayback called with text:", text);
    const sentences = splitIntoSentences(text);
    console.log("[AudioCall] Split into sentences:", sentences);
    if (sentences.length === 0) {
      console.log("[AudioCall] No sentences to speak");
      return;
    }

    try {
      console.log("[AudioCall] Starting parallel TTS synthesis for", sentences.length, "sentences");

      // Определяем настройки TTS в зависимости от устройства
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const ttsOptions = isMobile ? {
        model: "tts-1", // На мобильных используем базовую модель
        voice: "onyx",
        format: "mp3"
      } : {
        model: "tts-1-hd", // На десктопе используем HD модель
        voice: "onyx",
        format: "wav"
      };

      console.log("[AudioCall] TTS options for device:", isMobile ? "mobile" : "desktop", ttsOptions);

      // Параллельная обработка TTS для ускорения
      const audioBuffers = await Promise.all(
        sentences.map(async (sentence) => {
          try {
            return await psychologistAI.synthesizeSpeech(sentence, ttsOptions);
          } catch (error) {
            console.warn("[AudioCall] Failed to synthesize sentence:", sentence, error);
            return null; // Пропускаем неудачные синтезы
          }
        })
      );

      // Фильтруем и валидируем буферы
      const validBuffers = audioBuffers.filter(buffer => {
        if (buffer === null) return false;
        if (!(buffer instanceof ArrayBuffer)) {
          console.warn("[AudioCall] Invalid buffer type:", typeof buffer, buffer);
          return false;
        }
        if (buffer.byteLength === 0) {
          console.warn("[AudioCall] Empty buffer received from TTS");
          return false;
        }
        return true;
      });

      console.log("[AudioCall] TTS completed, enqueuing", validBuffers.length, "valid audio buffers");

      if (validBuffers.length > 0) {
        // Защищаем от конкурентного доступа
        if (!Array.isArray(audioQueueRef.current)) {
          console.error("[AudioCall] audioQueueRef.current corrupted, resetting");
          audioQueueRef.current = [];
        }

        audioQueueRef.current.push(...validBuffers);
        console.log("[AudioCall] Total queue length after enqueue:", audioQueueRef.current.length);
        void playQueuedAudio();
        console.log("[AudioCall] Audio queued and playback started");
      }
    } catch (error) {
      console.error("[AudioCall] Error synthesizing speech:", error);
      setAudioError("Не удалось озвучить ответ. Попробуйте ещё раз.");
    }
  };

  const stopAssistantSpeech = () => {
    audioQueueRef.current = [];
    if (currentSpeechSourceRef.current) {
      try {
        currentSpeechSourceRef.current.stop();
      } catch (error) {
        console.warn("Error stopping speech source:", error);
      }
      currentSpeechSourceRef.current.disconnect();
      currentSpeechSourceRef.current = null;
    }
    isPlayingAudioRef.current = false;
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
        
        // Если обнаружен звук и Марк говорит - прерываем его
        if (average > VOICE_DETECTION_THRESHOLD && isPlayingAudioRef.current) {
          console.debug(`[AudioCall] Обнаружен голос пользователя (громкость: ${average.toFixed(1)}), прерываем Марка`);
          stopAssistantSpeech();
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

  const stopRecognition = () => {
    recognitionActiveRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch (error) {
        console.warn("Error stopping speech recognition:", error);
      }
      recognitionRef.current = null;
    }
  };

  const cleanupRecording = () => {
    stopRecognition();
    stopVolumeMonitoring();
    resetAudioPlayback();
    conversationRef.current = [];
    responseQueueRef.current = Promise.resolve();
    pendingTranscriptRef.current = "";
    if (pendingProcessTimeoutRef.current) {
      window.clearTimeout(pendingProcessTimeoutRef.current);
      pendingProcessTimeoutRef.current = null;
    }

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }

    setTranscriptionStatus(null);
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

    console.info("[AudioCall] Распознанный текст пользователя:", text);
    setTranscriptionStatus("Марк обдумывает ответ...");

    conversationRef.current.push({ role: "user", content: text });

    try {
      // Начинаем звуковые сигналы во время генерации ответа
      startProcessingSound();

      const assistantReply = await psychologistAI.getVoiceResponse(conversationRef.current, memoryRef.current, fastMode);
      conversationRef.current.push({ role: "assistant", content: assistantReply });

      // Останавливаем сигналы и начинаем TTS
      stopProcessingSound();
      setTranscriptionStatus("Озвучиваю ответ...");

      await enqueueSpeechPlayback(assistantReply);
      setTranscriptionStatus("");
      await updateConversationMemory(text, assistantReply);
    } catch (error) {
      console.error("Error generating assistant response:", error);
      stopProcessingSound(); // Останавливаем сигналы при ошибке
      setAudioError("Не удалось озвучить ответ. Попробуйте ещё раз.");
      setTranscriptionStatus("");
    }
  };

  const flushPendingTranscript = () => {
    const text = pendingTranscriptRef.current.trim();
    pendingTranscriptRef.current = "";
    if (!text) {
      return;
    }

    stopAssistantSpeech();

    responseQueueRef.current = responseQueueRef.current
      .catch((error) => console.error("Previous voice response error:", error))
      .then(() => processRecognizedText(text));
  };

  const handleRecognizedText = (rawText: string) => {
    console.log("[AudioCall] handleRecognizedText called with:", rawText);
    const segment = rawText.trim();
    if (!segment) {
      console.log("[AudioCall] Empty segment, skipping");
      return;
    }

    console.log("[AudioCall] Stopping assistant speech before processing");
    stopAssistantSpeech();

    pendingTranscriptRef.current = [pendingTranscriptRef.current, segment].filter(Boolean).join(" ");
    console.log("[AudioCall] Updated pending transcript:", pendingTranscriptRef.current);

    if (pendingProcessTimeoutRef.current) {
      window.clearTimeout(pendingProcessTimeoutRef.current);
    }

    // 5 секунд задержки перед отправкой в LLM (пользователь может продолжить говорить)
    const timeoutDelay = 5000; // 5 секунд
    pendingProcessTimeoutRef.current = window.setTimeout(() => {
      pendingProcessTimeoutRef.current = null;
      console.log("[AudioCall] Timeout reached (5 seconds), flushing pending transcript");
      flushPendingTranscript();
    }, timeoutDelay);
  };

  const updateConversationMemory = async (userText: string, assistantText: string) => {
    if (!user || !currentCallId) {
      return;
    }

    try {
      // Сохраняем в БД с sessionId и обновляем локальную память
      const updatedMemory = await memoryApi.appendMemory(
        user.id, 
        "audio", 
        currentCallId, 
        userText, 
        assistantText
      );
      memoryRef.current = updatedMemory;
      console.log("[AudioCall] Memory updated and saved to DB");
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

  // Default user ID for demo purposes
  useEffect(() => {
    initializeUser();
  }, [authUser]);

  useEffect(() => {
    isMutedRef.current = isMuted;

    const stream = audioStreamRef.current;
    if (!stream) {
      if (isMuted) {
        setTranscriptionStatus("Микрофон выключен");
      }
      return;
    }

    stream.getAudioTracks().forEach((track) => {
      track.enabled = !isMuted;
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
        // Распознавание могло уже работать – игнорируем ошибку состояния
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

    if (backgroundMusicRef.current.audioElement) {
      backgroundMusicRef.current.audioElement.muted = !isSpeakerOn;
    } else if (backgroundMusicRef.current.gainNode) {
      // Управляем громкостью генеративной музыки
      backgroundMusicRef.current.gainNode.gain.setValueAtTime(
        isSpeakerOn ? 0.02 : 0,
        audioContextRef.current?.currentTime ?? 0
      );
    }
  }, [isSpeakerOn]);

  useEffect(() => {
    return () => {
      cleanupRecording();
      stopProcessingSound(); // Останавливаем звуковые сигналы при размонтировании
      // Останавливаем фоновую музыку при размонтировании
      stopBackgroundMusic();
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
      if (pendingProcessTimeoutRef.current) {
        window.clearTimeout(pendingProcessTimeoutRef.current);
        pendingProcessTimeoutRef.current = null;
      }
    };
  }, []);

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

    if (!user || isCallActive) {
      console.log("[AudioCall] Звонок уже активен или пользователь не найден");
      return;
    }

    // Проверяем доступ к аудио сессиям
    try {
      const accessCheck = await subscriptionApi.checkAudioAccess(user.id);
      console.log("[AudioCall] Access check result:", accessCheck);

      if (!accessCheck.hasAccess) {
        if (accessCheck.reason === 'no_subscription') {
          setAudioError("У вас нет активной подписки. Оформите подписку для доступа к аудио сессиям.");
        } else if (accessCheck.reason === 'no_sessions_left') {
          setAudioError("У вас закончились аудио сессии. Оформите дополнительную подписку.");
        } else {
          setAudioError("Доступ к аудио сессиям ограничен.");
        }
        return;
      }

      // Используем сессию
      const sessionUsed = await subscriptionApi.useAudioSession(user.id);
      if (!sessionUsed) {
        setAudioError("Не удалось активировать аудио сессию. Попробуйте еще раз.");
        return;
      }

      console.log("[AudioCall] Audio session activated successfully");

    } catch (error) {
      console.error("[AudioCall] Error checking access:", error);
      setAudioError("Ошибка при проверке доступа к аудио сессиям.");
      return;
    }

    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      console.error("[AudioCall] Браузер не поддерживает mediaDevices");
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
      memoryRef.current = await memoryApi.getMemory(user.id, "audio");

      const sessionInfo = await subscriptionApi.getAudioSessionInfo(user.id);
      setSubscriptionInfo(sessionInfo);

      if (sessionInfo.plan === 'premium') {
        if (sessionInfo.status !== 'active') {
          setAudioError('Ваша премиум подписка не активна. Продлите подписку, чтобы делать звонки.');
          setIsCallActive(false);
          return;
        }

        if (sessionInfo.remaining <= 0) {
          setAudioError('Лимит аудио сессий на этот месяц исчерпан.');
          setIsCallActive(false);
          return;
        }
      }

      const SpeechRecognitionConstructor =
        typeof window !== "undefined"
          ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
          : null;

      console.log("[AudioCall] SpeechRecognition constructor:", SpeechRecognitionConstructor);

      if (!SpeechRecognitionConstructor) {
        console.error("[AudioCall] Speech Recognition API не поддерживается");
        setAudioError("Ваш браузер не поддерживает системное распознавание речи.");
        return;
      }

      console.log("[AudioCall] Создаем аудио сессию в БД...");

      const call = await audioCallApi.createAudioCall(user.id);
      setCurrentCallId(call.id);
      console.log("[AudioCall] Аудио сессия создана, ID:", call.id);

      console.log("[AudioCall] Запрашиваем доступ к микрофону...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      console.log("[AudioCall] Микрофон доступен, создаем recognition...");

      const recognition = new SpeechRecognitionConstructor();
      recognition.lang = "ru-RU";
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        console.log("[AudioCall] Recognition result event:", event);
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const transcript = result?.[0]?.transcript ?? "";
          console.log(`[AudioCall] Result ${i}: final=${result.isFinal}, transcript="${transcript}"`);
          if (result.isFinal && transcript) {
            console.log("[AudioCall] Финальный результат, передаем на обработку");
            handleRecognizedText(transcript);
          }
        }
      };

      recognition.onspeechstart = () => {
        console.log("[AudioCall] Speech started - stopping assistant speech");
        stopAssistantSpeech();
      };

      // Убрали onaudiostart, так как он срабатывает на любой звук, включая TTS

      recognition.onerror = (event: any) => {
        console.error("[AudioCall] Speech recognition error:", event);
        if (event?.error === "not-allowed" || event?.error === "service-not-allowed") {
          setAudioError("Доступ к микрофону запрещён. Проверьте настройки браузера.");
        } else if (event?.error !== "aborted") {
          setAudioError("Ошибка распознавания речи. Попробуйте ещё раз.");
        }
      };

      recognition.onend = () => {
        if (!recognitionActiveRef.current) {
          return;
        }

        if (isMutedRef.current) {
          setTranscriptionStatus("Микрофон выключен");
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

      // Запускаем мониторинг громкости для прерывания Марка
      await startVolumeMonitoring(stream);
      console.log("[AudioCall] Мониторинг громкости запущен");

      try {
        // Небольшая задержка перед запуском speech recognition, чтобы TTS успел начать
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
        }, 500); // 500ms задержка
      } catch (error) {
        console.error("[AudioCall] Failed to start speech recognition:", error);
        setAudioError("Не удалось запустить распознавание речи.");
        stopRecognition();
        cleanupRecording();
        await audioCallApi.endAudioCall(call.id, 0);
        setCurrentCallId(null);
        return;
      }

      console.log("[AudioCall] Проигрываем приветствие...");
      const greeting = "Здравствуйте. Я Марк, психолог. Расскажите, что вас сейчас больше всего беспокоит?";
      conversationRef.current.push({ role: "assistant", content: greeting });
      await enqueueSpeechPlayback(greeting);
      console.log("[AudioCall] Приветствие проиграно");

      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }

      callTimerRef.current = window.setInterval(() => {
        setCallDuration((prev) => {
          const next = prev + 1;
          
          // Предупреждение за 5 минут до конца 30-минутной сессии
          if (!callLimitWarningSentRef.current && next >= SESSION_WARNING_SECONDS && next < SESSION_DURATION_SECONDS) {
            callLimitWarningSentRef.current = true;
            
            // Генерируем сообщение с подведением итогов и предложением темы на следующую встречу
            responseQueueRef.current = responseQueueRef.current
              .catch((error) => console.error("Previous voice response error:", error))
              .then(async () => {
                try {
                  setTranscriptionStatus("Марк подводит итоги сессии...");
                  
                  // Формируем контекст для генерации итогов
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
                  // Fallback сообщение
                  const fallbackMessage = "У нас осталось около пяти минут. Давайте коротко подведем итоги нашей беседы и я предложу тему для следующей встречи";
                  conversationRef.current.push({ role: "assistant", content: fallbackMessage });
                  await enqueueSpeechPlayback(fallbackMessage);
                } finally {
                  setTranscriptionStatus("");
                }
              });
          }
          
          // Автоматическое завершение через 30 минут
          if (next >= SESSION_DURATION_SECONDS && !callLimitReachedRef.current) {
            callLimitReachedRef.current = true;
            window.setTimeout(() => {
              setAudioError("Сессия завершена: прошло 30 минут. Спасибо за доверие!");
              endCall(next).catch((error) => console.error("Error auto-ending call", error));
            }, 0);
            return SESSION_DURATION_SECONDS;
          }
          
          // Абсолютный максимум (подстраховка)
          if (next >= MAX_CALL_DURATION_SECONDS) {
            return MAX_CALL_DURATION_SECONDS;
          }
          
          return next;
        });
      }, 1000);

      setTranscriptionStatus("");
      setIsCallActive(true);

      // Запускаем фоновую музыку из файла
      startBackgroundMusic();
    } catch (error) {
      console.error("Error starting call:", error);
      setAudioError("Не удалось получить доступ к микрофону. Проверьте настройки и попробуйте снова.");
      cleanupRecording();
      setCurrentCallId(null);
    }
  };

  const endCall = async (overrideDuration?: number) => {
    if (!currentCallId) {
      return;
    }

    try {
      cleanupRecording();
      stopProcessingSound(); // Останавливаем звуковые сигналы

      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }

      const durationToSave = overrideDuration ?? callDuration;
      console.log(`[AudioCall] Ending call ${currentCallId} with duration ${durationToSave} seconds`);

      // Ensure duration is a plain number, not an object with circular refs
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
      // Останавливаем фоновую музыку
      stopBackgroundMusic();
      stopAssistantSpeech();
      setIsCallActive(false);
      setCallDuration(0);
      setIsMuted(false);
      isMutedRef.current = false;
      setCurrentCallId(null);
      setTranscriptionStatus(null);
      callLimitReachedRef.current = false;
      callLimitWarningSentRef.current = false;
      memoryRef.current = "";

      // Clear any remaining refs
      if (mediaStreamRef.current) {
        mediaStreamRef.current = null;
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
            {!isCallActive ? (
              <div className="space-y-8">
                <div className="w-32 h-32 mx-auto rounded-full bg-hero-gradient text-white flex items-center justify-center shadow-strong animate-pulse-soft">
                  <Phone className="w-16 h-16 " />
                </div>
                
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">
                    Начать звонок с психологом
                  </h2>
                  <p className="text-muted-foreground">
                    Нажмите кнопку ниже, чтобы начать голосовую сессию
                  </p>
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
                <div className="w-40 h-40 mx-auto rounded-full bg-hero-gradient text-white flex items-center justify-center shadow-strong animate-float">
                  <Volume2 className="w-20 h-20  animate-pulse" />
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
                        className={`h-full transition-all duration-1000 ${
                          callDuration >= SESSION_WARNING_SECONDS 
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

                  <Button
                    onClick={() => setIsSpeakerOn(!isSpeakerOn)}
                    size="lg"
                    variant={!isSpeakerOn ? "destructive" : "outline"}
                    className="rounded-full w-16 h-16 p-0"
                  >
                    {isSpeakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
                  </Button>

                  <Button
                    onClick={() => setFastMode(!fastMode)}
                    size="lg"
                    variant={fastMode ? "default" : "outline"}
                    className="rounded-full w-16 h-16 p-0"
                    title={fastMode ? "Выключить быстрый режим" : "Включить быстрый режим"}
                  >
                    ⚡
                  </Button>

                  <Button
                    onClick={endCall}
                    size="lg"
                    variant="destructive"
                    className="rounded-full w-16 h-16 p-0 shadow-medium"
                  >
                    <PhoneOff className="w-6 h-6" />
                  </Button>
                </div>

                <div className="text-center text-sm text-muted-foreground">
                  {!isSpeakerOn && <p>Звук выключен</p>}
                  {fastMode && <p className="text-primary font-medium">⚡ Быстрый режим активен</p>}
                </div>

                {subscriptionInfo && (
                  <p className="text-xs text-muted-foreground">
                    Осталось сессий в этом месяце: {subscriptionInfo.remaining} из {subscriptionInfo.limit}
                  </p>
                )}

                {transcriptionStatus && (
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-primary/80">{transcriptionStatus}</p>
                    {transcriptionStatus.includes("обдумывает") && (
                      <Button
                        onClick={() => {
                          // Прерываем ожидание и очищаем статус
                          if (pendingProcessTimeoutRef.current) {
                            window.clearTimeout(pendingProcessTimeoutRef.current);
                            pendingProcessTimeoutRef.current = null;
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

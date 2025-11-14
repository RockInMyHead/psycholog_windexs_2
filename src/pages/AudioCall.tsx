import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import Navigation from "@/components/Navigation";
import { userService, audioCallService, memoryService, subscriptionService } from "@/services/database";
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
  }>({ isPlaying: false });
  const callLimitReachedRef = useRef(false);
  const callLimitWarningSentRef = useRef(false);
  const memoryRef = useRef<string>("");
  const pendingTranscriptRef = useRef<string>("");
  const pendingProcessTimeoutRef = useRef<number | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const volumeMonitorRef = useRef<number | null>(null);

  const MAX_CALL_DURATION_SECONDS = 40 * 60;
  const CALL_LIMIT_WARNING_SECONDS = MAX_CALL_DURATION_SECONDS - 5 * 60;
  const VOICE_DETECTION_THRESHOLD = 30;

  const initializeAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    if (!speakerGainRef.current && audioContextRef.current) {
      const gainNode = audioContextRef.current.createGain();
      gainNode.gain.value = isSpeakerOnRef.current ? 1 : 0;
      gainNode.connect(audioContextRef.current.destination);
      speakerGainRef.current = gainNode;
    }
    return audioContextRef.current;
  };

  const getAudioOutputNode = () => {
    const audioContext = initializeAudioContext();
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
      const audioContext = initializeAudioContext();
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
        audioElement.play().catch(error => {
          console.warn('Could not play background music:', error);
        });
      });

      audioElement.addEventListener('error', (error) => {
        console.warn('Background music loading error:', error);
      });

      backgroundMusicRef.current = {
        audioElement,
        isPlaying: true,
      };

    } catch (error) {
      console.warn('Could not start background music:', error);
    }
  };

  const stopBackgroundMusic = () => {
    if (!backgroundMusicRef.current.isPlaying) {
      return;
    }

    try {
      const { audioElement } = backgroundMusicRef.current;

      if (audioElement) {
        // Плавное затухание
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
      } else {
        backgroundMusicRef.current.isPlaying = false;
      }

    } catch (error) {
      console.warn('Could not stop background music:', error);
      backgroundMusicRef.current.isPlaying = false;
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
    if (isPlayingAudioRef.current || audioQueueRef.current.length === 0) {
      return;
    }

    if (!audioContextRef.current) {
      const AudioContextConstructor = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextConstructor();
    }

    const audioContext = audioContextRef.current;
    if (!audioContext) {
      console.warn("AudioContext unavailable.");
      audioQueueRef.current = [];
      return;
    }

    const outputNode = getAudioOutputNode();

    isPlayingAudioRef.current = true;

    try {
      while (audioQueueRef.current.length > 0) {
        const buffer = audioQueueRef.current.shift();
        if (!buffer) continue;

        const decoded = await audioContext.decodeAudioData(buffer.slice(0));

        await new Promise<void>((resolve) => {
          const source = audioContext.createBufferSource();
          source.buffer = decoded;
          source.connect(outputNode ?? audioContext.destination);
          currentSpeechSourceRef.current = source;
          source.onended = () => resolve();
          source.start(0);
        });
        currentSpeechSourceRef.current = null;
      }
    } catch (error) {
      console.error("Error during audio playback:", error);
    } finally {
      isPlayingAudioRef.current = false;
    }
  };

  const enqueueSpeechPlayback = async (text: string) => {
    const sentences = splitIntoSentences(text);
    if (sentences.length === 0) {
      return;
    }

    try {
      const audioBuffers = await Promise.all(
        sentences.map((sentence) => psychologistAI.synthesizeSpeech(sentence))
      );
      audioQueueRef.current.push(...audioBuffers);
      void playQueuedAudio();
    } catch (error) {
      console.error("Error synthesizing speech:", error);
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

  const startVolumeMonitoring = (stream: MediaStream) => {
    try {
      const audioContext = initializeAudioContext();
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
    if (!user) {
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

      const assistantReply = await psychologistAI.getVoiceResponse(conversationRef.current, memoryRef.current);
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
    const segment = rawText.trim();
    if (!segment) {
      return;
    }

    stopAssistantSpeech();

    pendingTranscriptRef.current = [pendingTranscriptRef.current, segment].filter(Boolean).join(" ");

    if (pendingProcessTimeoutRef.current) {
      window.clearTimeout(pendingProcessTimeoutRef.current);
    }

    pendingProcessTimeoutRef.current = window.setTimeout(() => {
      pendingProcessTimeoutRef.current = null;
      flushPendingTranscript();
    }, 300);
  };

  const updateConversationMemory = async (userText: string, assistantText: string) => {
    if (!user) {
      return;
    }

    const entry = `Клиент: ${userText}\nМарк: ${assistantText}`;
    try {
      const updatedMemory = await memoryService.appendMemory(user.id, "audio", entry);
      memoryRef.current = updatedMemory;
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
      const userData = await userService.getOrCreateUser(email, name);
      setUser(userData);
      const info = await subscriptionService.getAudioSessionInfo(userData.id);
      setSubscriptionInfo(info);
    } catch (error) {
      console.error('Error initializing user:', error);
    } finally {
      setLoading(false);
    }
  };

  const startCall = async () => {
    if (!user || isCallActive) {
      return;
    }

    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      setAudioError("Ваш браузер не поддерживает запись аудио.");
      return;
    }

    try {
      setAudioError(null);
      setIsMuted(false);
      isMutedRef.current = false;
      setIsSpeakerOn(true);
      setCallDuration(0);
      callLimitReachedRef.current = false;
      callLimitWarningSentRef.current = false;
      memoryRef.current = await memoryService.getMemory(user.id, "audio");

      const sessionInfo = await subscriptionService.getAudioSessionInfo(user.id);
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

      if (!SpeechRecognitionConstructor) {
        setAudioError("Ваш браузер не поддерживает системное распознавание речи.");
        return;
      }

      const call = await audioCallService.createAudioCall(user.id);
      setCurrentCallId(call.id);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const recognition = new SpeechRecognitionConstructor();
      recognition.lang = "ru-RU";
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const transcript = result?.[0]?.transcript ?? "";
          if (result.isFinal && transcript) {
            handleRecognizedText(transcript);
          }
        }
      };

      recognition.onspeechstart = () => {
        stopAssistantSpeech();
      };

      recognition.onaudiostart = () => {
        stopAssistantSpeech();
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event);
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

      // Запускаем мониторинг громкости для прерывания Марка
      startVolumeMonitoring(stream);

      try {
        recognition.start();
      } catch (error) {
        console.error("Failed to start speech recognition:", error);
        setAudioError("Не удалось запустить распознавание речи.");
        stopRecognition();
        cleanupRecording();
        await audioCallService.endAudioCall(call.id, 0);
        setCurrentCallId(null);
        return;
      }

      const greeting = "Здравствуйте. Я Марк, психолог. Расскажите, что вас сейчас больше всего беспокоит?";
      conversationRef.current.push({ role: "assistant", content: greeting });
      await enqueueSpeechPlayback(greeting);

      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }

      callTimerRef.current = window.setInterval(() => {
        setCallDuration((prev) => {
          const next = prev + 1;
          if (!callLimitWarningSentRef.current && next >= CALL_LIMIT_WARNING_SECONDS && next < MAX_CALL_DURATION_SECONDS) {
            callLimitWarningSentRef.current = true;
            const warningMessage = "У нас осталось около пяти минут. Давайте коротко вспомним, что вы успели проговорить и что хотите забрать с собой";
            conversationRef.current.push({ role: "assistant", content: warningMessage });
            responseQueueRef.current = responseQueueRef.current
              .catch((error) => console.error("Previous voice response error:", error))
              .then(async () => {
                try {
                  setTranscriptionStatus("Озвучиваю напоминание...");
                  await enqueueSpeechPlayback(warningMessage);
                } catch (error) {
                  console.error("Error playing limit warning:", error);
                } finally {
                  setTranscriptionStatus("");
                }
              });
          }
          if (next >= MAX_CALL_DURATION_SECONDS && !callLimitReachedRef.current) {
            callLimitReachedRef.current = true;
            window.setTimeout(() => {
              setAudioError("Звонок автоматически завершён: достигнут лимит 40 минут.");
              endCall(next).catch((error) => console.error("Error auto-ending call", error));
            }, 0);
            return MAX_CALL_DURATION_SECONDS;
          }
          return Math.min(next, MAX_CALL_DURATION_SECONDS);
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
      await audioCallService.endAudioCall(currentCallId, durationToSave);

      if (user && durationToSave > 0 && subscriptionInfo?.plan === 'premium' && subscriptionInfo.status === 'active') {
        const result = await subscriptionService.recordAudioSession(user.id);
        if (!result.success && result.message) {
          setAudioError(result.message);
        }
        const latestInfo = await subscriptionService.getAudioSessionInfo(user.id);
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
                    onClick={endCall}
                    size="lg"
                    variant="destructive"
                    className="rounded-full w-16 h-16 p-0 shadow-medium"
                  >
                    <PhoneOff className="w-6 h-6" />
                  </Button>
                </div>

                <p className="text-muted-foreground text-sm">
                  {!isSpeakerOn && "Звук выключен"}
                </p>

                {subscriptionInfo && (
                  <p className="text-xs text-muted-foreground">
                    Осталось сессий в этом месяце: {subscriptionInfo.remaining} из {subscriptionInfo.limit}
                  </p>
                )}

                {transcriptionStatus && (
                  <p className="text-sm text-primary/80">{transcriptionStatus}</p>
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

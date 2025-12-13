import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Phone, PhoneOff, Mic, MicOff, Square, Bug, X } from "lucide-react";
import Navigation from "@/components/Navigation";
import { userApi, audioCallApi, walletApi } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

// Hooks
import { useTTS } from "@/hooks/useTTS";
import { useLLM } from "@/hooks/useLLM";
import { useTranscription } from "@/hooks/useTranscription";

interface User {
  id: string;
  name: string;
  email: string;
}

// Debug Logs Component - улучшенная версия с русским интерфейсом
const DebugLogs = ({ logs, isVisible, onToggle, onClear, onCopy }: {
  logs: string[];
  isVisible: boolean;
  onToggle: () => void;
  onClear: () => void;
  onCopy: () => void;
}) => {
  if (!isVisible) return null;

  // Парсинг логов для извлечения полезной информации
  const parseLogs = () => {
    const parsed = {
      conversation: [] as Array<{speaker: string, text: string, time: string, type: 'user' | 'mark'}>,
      timing: [] as Array<{operation: string, duration: string, time: string}>,
      costs: [] as Array<{service: string, cost: string, time: string}>
    };

    logs.forEach(log => {
      const timestamp = log.match(/\[(\d{2}:\d{2}:\d{2})\]/)?.[1] || new Date().toLocaleTimeString();

      // Распознавание реплик пользователей - расширенные паттерны
      if (log.includes('Transcribed') || log.includes('транскрибирован') || log.includes('🎤')) {
        const textMatch = log.match(/Transcribed: "([^"]+)"/) ||
                         log.match(/транскрибирован: "([^"]+)"/) ||
                         log.match(/"([^"]+)"/);
        if (textMatch) {
          parsed.conversation.push({
            speaker: '👤 Пользователь',
            text: textMatch[1],
            time: timestamp,
            type: 'user'
          });
        }
      }

      // Распознавание ответов Марка - расширенные паттерны
      if (log.includes('Марк') || log.includes('психолог') || log.includes('AI') || log.includes('ответ')) {
        const textMatch = log.match(/"([^"]+)"/) || log.match(/Ответ: ([^\n]+)/);
        if (textMatch && (log.includes('Марк') || log.includes('психолог') || log.includes('AI'))) {
          parsed.conversation.push({
            speaker: '🧠 Марк',
            text: textMatch[1],
            time: timestamp,
            type: 'mark'
          });
        }
      }

      // Время генерации ответа - расширенные паттерны
      const timingMatch = log.match(/(LLM|OpenAI|TTS|STT|время).*?(\d+(?:\.\d+)?)\s*(мс|ms|сек|секунд|s)/i);
      if (timingMatch) {
        parsed.timing.push({
          operation: timingMatch[1],
          duration: `${timingMatch[2]}${timingMatch[3]}`,
          time: timestamp
        });
      }

      // Стоимость услуг - расширенные паттерны
      const costMatch = log.match(/(TTS|LLM|STT|стоимость|цена).*?(₽|\$|руб|рублей).*?(\d+(?:\.\d+)?)/i);
      if (costMatch) {
        parsed.costs.push({
          service: costMatch[1],
          cost: `${costMatch[3]}${costMatch[2]}`,
          time: timestamp
        });
      }
    });

    return parsed;
  };

  const parsedData = parseLogs();

  return (
    <div className="fixed bottom-4 right-4 w-[500px] max-h-[600px] bg-black/95 text-green-400 font-mono text-sm rounded-lg border border-gray-600 overflow-hidden z-50 shadow-2xl">
      <div className="flex items-center justify-between p-3 bg-gray-800 border-b border-gray-600">
        <span className="flex items-center gap-2 text-white font-semibold">
          <Bug className="w-5 h-5" />
          Отладочная информация
        </span>
        <div className="flex gap-1">
          <Button
            onClick={onCopy}
            size="sm"
            variant="ghost"
            className="h-7 px-3 text-xs text-gray-400 hover:text-white hover:bg-gray-700"
          >
            📋 Копировать
          </Button>
          <Button
            onClick={onClear}
            size="sm"
            variant="ghost"
            className="h-7 px-3 text-xs text-gray-400 hover:text-white hover:bg-gray-700"
          >
            🗑️ Очистить
          </Button>
          <Button
            onClick={onToggle}
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-gray-400 hover:text-white hover:bg-gray-700"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="p-3 max-h-[500px] overflow-y-auto space-y-4">
        {logs.length === 0 ? (
          <div className="text-gray-500 italic text-center py-8">
            Логи пока пусты... Начните разговор для отображения информации
          </div>
        ) : (
          <>
            {/* Диалог */}
            {parsedData.conversation.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-yellow-400 font-semibold border-b border-gray-600 pb-1">💬 Диалог</h3>
                {parsedData.conversation.slice(-10).map((msg, index) => (
                  <div key={index} className={`p-2 rounded border-l-4 ${
                    msg.type === 'user' ? 'border-blue-500 bg-blue-900/20' : 'border-green-500 bg-green-900/20'
                  }`}>
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-white">{msg.speaker}</span>
                      <span className="text-xs text-gray-400">{msg.time}</span>
                    </div>
                    <p className="text-sm text-gray-200 leading-relaxed">{msg.text}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Время обработки */}
            {parsedData.timing.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-blue-400 font-semibold border-b border-gray-600 pb-1">⏱️ Время обработки</h3>
                {parsedData.timing.slice(-5).map((timing, index) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-gray-800/50 rounded">
                    <span className="text-gray-300">{timing.operation}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-green-400 font-mono">{timing.duration}</span>
                      <span className="text-xs text-gray-500">{timing.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Стоимость услуг */}
            {parsedData.costs.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-purple-400 font-semibold border-b border-gray-600 pb-1">💰 Стоимость услуг</h3>
                {parsedData.costs.slice(-5).map((cost, index) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-gray-800/50 rounded">
                    <span className="text-gray-300">{cost.service}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-yellow-400 font-mono font-semibold">{cost.cost}</span>
                      <span className="text-xs text-gray-500">{cost.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Сырые логи */}
            <div className="space-y-2">
              <h3 className="text-gray-400 font-semibold border-b border-gray-600 pb-1">📄 Сырые логи</h3>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {logs.slice(-20).map((log, index) => (
                  <div key={index} className="text-xs leading-tight opacity-75 hover:opacity-100 transition-opacity">
                    <span className="text-gray-500">[{new Date().toLocaleTimeString()}]</span> {log}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const AudioCall = () => {
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  
  // UI State
  const [isCallActive, setIsCallActive] = useState(false);
  const [isInitializingCall, setIsInitializingCall] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const isCallActiveRef = useRef(false);
  const lastUserMessageRef = useRef<string>("");

  // Debug Logs State
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebugLogs, setShowDebugLogs] = useState(false);
  
  // Data State
  const [user, setUser] = useState<User | null>(null);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  
  // Audio/Video State
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const callTimerRef = useRef<number | null>(null);

  // Debug logging functions
  const addDebugLog = useCallback((message: string) => {
    console.log(message); // Keep console logging
    setDebugLogs(prev => [...prev, message]);
  }, []);

  const clearDebugLogs = useCallback(() => {
    setDebugLogs([]);
  }, []);

  const toggleDebugLogs = useCallback(() => {
    setShowDebugLogs(prev => !prev);
  }, []);

  const copyDebugLogs = useCallback(() => {
    const text = debugLogs.join('\n');
    if (!text) return;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
        addDebugLog('[Debug] Logs copied to clipboard');
      } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        addDebugLog('[Debug] Logs copied to clipboard (fallback)');
      }
    } catch (error) {
      console.error('[Debug] Failed to copy logs:', error);
    }
  }, [debugLogs, addDebugLog]);
  
  // --- Hooks Initialization ---
  
  // Общий ref для статуса "Ассистент говорит"
  const isAssistantSpeakingRef = useRef(false);

  // 1. LLM Service (Logic)
  const {
    processUserMessage,
    loadUserProfile,
    updateUserProfile,
    updateConversationMemory,
    addToConversation,
    isProcessing: isAIProcessing
  } = useLLM({
    userId: user?.id,
    callId: currentCallId,
    onResponseGenerated: async (text) => {
      // Log AI response for debugging
      addDebugLog(`[AI] 🎭 Марк ответил: "${text}"`);

      // Update conversation memory after AI response
      if (lastUserMessageRef.current) {
        await updateConversationMemory(lastUserMessageRef.current, text);
        lastUserMessageRef.current = ""; // Clear after use
      }

      await speak(text);
    },
    onError: (err) => setError(err)
  });

  // 2. Transcription Service (Speech Recognition)
  const {
    initializeRecognition,
    cleanup: cleanupRecognition,
    transcriptionStatus,
    microphoneAccessGranted,
    microphonePermissionStatus,
    forceOpenAI,
    isIOS,
    pauseRecordingForTTS,
    resumeRecordingAfterTTS,
    stopRecognition,
    startRecognition
  } = useTranscription({
    isTTSActiveRef: isAssistantSpeakingRef,
    addDebugLog,
    onTranscriptionComplete: async (text, source) => {
      const transcribeId = Date.now();
      console.log(`[AudioCall] onTranscriptionComplete (ID: ${transcribeId}) called with: "${text}" from ${source}`);

      // Log user transcription for debugging
      addDebugLog(`[User] 🎤 Пользователь сказал: "${text}" (${source})`);

      if (!text) return;

      // Ignore transcription if microphone is muted
      if (isMuted) {
        console.log(`[AudioCall] Ignoring transcription - microphone is muted`);
        return;
      }

      // Save user message for memory update
      lastUserMessageRef.current = text;

      // Stop TTS if user interrupted (handled by hook, but good to ensure)
      if (source !== 'manual') stopTTS();

      // Reset TTS deduplication for new user input
      resetDeduplication();

      console.log(`[AudioCall] About to call processUserMessage (ID: ${transcribeId})`);
      await processUserMessage(text);
      console.log(`[AudioCall] processUserMessage completed (ID: ${transcribeId})`);
    },
    onInterruption: () => {
      addDebugLog(`[AudioCall] 🎤 Voice interruption detected - stopping TTS and resuming listening`);
      stopTTS();
      // Reset TTS deduplication for new user input after interruption
      resetDeduplication();
    },
    onSpeechStart: () => {
       // Optional: UI indication
    },
    onError: (err) => setError(err)
  });

  // 3. TTS Service (Speech Synthesis)
  const {
    speak,
    stop: stopTTS,
    resetDeduplication,
    isPlaying: isTTSPlaying,
    isSynthesizing: isTTSSynthesizing,
    isPlayingRef: isTTSPlayingRef, // Needed for transcription hook ref
    isSynthesizingRef: isTTSSynthesizingRef // Needed for logic
  } = useTTS({
    onPlaybackStatusChange: (isActive) => {
      if (isActive) {
        // Во время TTS глушим запись/распознавание (кроме Safari — логика внутри useTranscription)
        pauseRecordingForTTS?.();
      } else {
        // Возвращаем запись/распознавание только если звонок еще активен
        if (isCallActiveRef.current) {
          resumeRecordingAfterTTS?.();
          console.log('[TTS] TTS session ended, ready for new text');
        }
      }
    }
  });

  useEffect(() => {
    isAssistantSpeakingRef.current = isTTSPlaying || isTTSSynthesizing;
    
    // Update video based on TTS state
    if (videoRef.current) {
      if (isAssistantSpeakingRef.current) {
        videoRef.current.play().catch(() => {});
    } else {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    }
  }, [isTTSPlaying, isTTSSynthesizing]);

  useEffect(() => {
    isCallActiveRef.current = isCallActive;
  }, [isCallActive]);

  // --- Lifecycle & Logic ---

  const initializeUser = useCallback(async () => {
    try {
      let email: string;
      let name: string;

      if (authUser?.email) {
        // Authenticated user - use real credentials
        email = authUser.email;
        name = authUser.name ?? authUser.email;
      } else {
        // Anonymous user - generate unique identifier based on browser fingerprint
        const fingerprint = navigator.userAgent + navigator.language + screen.width + screen.height;
        const uniqueId = btoa(fingerprint).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
        email = `anonymous_${uniqueId}@zenmindmate.com`;
        name = 'Анонимный пользователь';
      }

      const userData = await userApi.getOrCreateUser(email, name);
      setUser(userData);
      
      const wallet = await walletApi.getWallet(userData.id);
      setWalletBalance(wallet.balance);
    } catch (err) {
      console.error('Error initializing user:', err);
    } finally {
      setLoading(false);
    }
  }, [authUser]);

  useEffect(() => {
    initializeUser();
  }, [initializeUser]);

  const startCall = async () => {
    if (!user || isCallActive) return;
    setIsInitializingCall(true);
    setError(null);

    try {
      // Check wallet balance (at least 1 minute)
      const wallet = await walletApi.getWallet(user.id);
      setWalletBalance(wallet.balance);
      if ((wallet.balance || 0) < 8) {
        setError("Недостаточно средств. Пополните кошелёк (минимум 8₽).");
        navigate('/subscription');
        return;
      }

      // Create Call Session (but don't count as used session yet)
      const call = await audioCallApi.createAudioCall(user.id);
      setCurrentCallId(call.id);
      
      // Load User Profile
      await loadUserProfile();

      // Don't increment session count here - will be done in endCall if conversation actually happened

      // Initialize Audio/Recognition
      await initializeRecognition();
      
      // UI Updates
      setIsCallActive(true);
      setCallDuration(0);
      
      // Initial Greeting
      setTimeout(async () => {
         const greeting = "Здравствуйте. Я Марк, психолог. Рад вас слышать. Что вас беспокоит?";
         addToConversation('assistant', greeting);
         await speak(greeting);
      }, 1000);

      // Start Timer
      callTimerRef.current = window.setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);

    } catch (err: unknown) {
      console.error("Start call error:", err);
      setError(err.message || "Не удалось начать звонок");
      cleanupRecognition();
      setCurrentCallId(null);
                } finally {
      setIsInitializingCall(false);
    }
  };

  const endCall = async () => {
    console.log('[AudioCall] 🛑 Ending call - stopping all processes');

    // Сразу помечаем, что звонок завершен, чтобы TTS не возобновлял запись
    isCallActiveRef.current = false;
    setIsCallActive(false);

    // Aggressive cleanup - stop everything
    console.log('[AudioCall] Stopping TTS...');
    stopTTS();

    console.log('[AudioCall] Cleaning up recognition...');
    cleanupRecognition();

    // Additional cleanup for any remaining processes
    console.log('[AudioCall] Explicitly stopping recognition...');
    stopRecognition?.(); // Explicitly stop recognition
    console.log('[AudioCall] Resetting TTS deduplication...');
    resetDeduplication?.(); // Reset TTS deduplication

    // Clear any pending TTS operations
    if (isTTSPlayingRef.current || isTTSSynthesizingRef.current) {
      console.log('[AudioCall] ⚠️ TTS still active during endCall - forcing stop');
    }

    console.log('[AudioCall] 🎉 Call ended successfully');
    
    if (currentCallId) {
      try {
        await audioCallApi.endAudioCall(currentCallId, callDuration);

        // Charge per full minute (8 ₽/min)
        const minutes = Math.floor(callDuration / 60);
        if (minutes > 0) {
          try {
            const result = await walletApi.debit(user.id, minutes * 8, 'voice_call', `call-${currentCallId}`);
            setWalletBalance(result.balance);
            addDebugLog(`[Billing] Charged ${minutes} min x 8₽ = ${minutes * 8}₽`);
          } catch (debitErr: any) {
            if (debitErr?.status === 402) {
              setError("Недостаточно средств для оплаты звонка. Пополните кошелёк.");
            } else {
              console.error("Wallet debit error:", debitErr);
              setError("Не удалось списать оплату за звонок");
            }
          }
        } else {
          addDebugLog(`[Billing] Call shorter than 1 minute, no charge`);
        }
      } catch (err) {
        console.error("Error ending call:", err);
      }
    }

    // Update user profile with final session data (but don't increment counter here)
    try {
      await updateUserProfile("", ""); // Empty strings to trigger profile save
    } catch (err) {
      console.error("Error updating user profile:", err);
    }

      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
    }

      setIsCallActive(false);
      setCallDuration(0);
      setCurrentCallId(null);
    setError(null);
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      resumeRecordingAfterTTS?.(); // Resume audio recording
      addDebugLog(`[AudioCall] 🎤 Microphone unmuted - recording resumed`);
    } else {
      setIsMuted(true);
      pauseRecordingForTTS?.(); // Pause audio recording
      addDebugLog(`[AudioCall] 🔇 Microphone muted - recording paused`);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // --- Render ---

  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent.toLowerCase());

  return (
    <div className="h-screen overflow-hidden bg-calm-gradient flex flex-col">
      <Navigation />
      <div className="flex-1 overflow-hidden px-4 pt-20 pb-4 flex items-center">
        <div className="container mx-auto max-w-2xl">
          <div className="text-center mb-6 animate-fade-in">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Аудио звонок</h1>
            <p className="text-muted-foreground">Голосовая сессия с ИИ-психологом</p>
          </div>

          <Card className="bg-card-gradient border-2 border-border shadow-strong p-6 md:p-8 text-center animate-scale-in">
            {isInitializingCall ? (
              <div className="space-y-8">
                 <div className="w-[180px] h-[180px] sm:w-[260px] sm:h-[260px] mx-auto rounded-full overflow-hidden shadow-strong">
                  <video ref={videoRef} src="/Untitled Video.mp4" className="w-full h-full object-cover pointer-events-none" muted loop playsInline />
                </div>
                <h2 className="text-2xl font-bold">Инициализация...</h2>
              </div>
            ) : !isCallActive ? (
              <div className="space-y-8">
                <div className="w-[180px] h-[180px] sm:w-[260px] sm:h-[260px] mx-auto rounded-full overflow-hidden shadow-strong">
                  <video ref={videoRef} src="/Untitled Video.mp4" className="w-full h-full object-cover pointer-events-none" muted loop playsInline />
                </div>

                <div>
                  <h2 className="text-2xl font-bold mb-2">Начать звонок</h2>
                  <p className="text-muted-foreground">Нажмите кнопку ниже, чтобы начать</p>
                  
                  {isMobile && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm text-blue-800">📱 Мобильное устройство обнаружено</p>
                      {isIOS && <p className="text-xs text-blue-600 mt-1">Оптимизировано для iOS</p>}
                    </div>
                  )}

                  {walletBalance !== null && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Баланс: {walletBalance.toFixed(2)}₽ • 1 мин = 8₽
                    </p>
                  )}
                </div>

                <Button
                  onClick={startCall}
                  size="lg"
                  className="bg-hero-gradient text-white hover:shadow-lg shadow-medium text-lg px-12 py-6"
                  disabled={loading}
                >
                  <Phone className="w-6 h-6 mr-2" />
                  {loading ? "Загрузка..." : "Позвонить"}
                </Button>

                {error && <p className="text-sm text-destructive mt-4">{error}</p>}
              </div>
            ) : (
              <div className="space-y-8">
                 <div className="w-[220px] h-[220px] sm:w-[320px] sm:h-[320px] mx-auto rounded-full overflow-hidden shadow-strong">
                  <video ref={videoRef} src="/Untitled Video.mp4" className="w-full h-full object-cover pointer-events-none" muted loop playsInline />
                </div>

                <div>
                  <h2 className="text-2xl font-bold mb-2">Звонок идет</h2>
                  <div className="text-lg font-medium text-primary">{formatDuration(callDuration)}</div>
                </div>

                <div className="flex justify-center gap-4">
                  <Button
                    onClick={toggleMute}
                    size="lg"
                    variant={isMuted ? "destructive" : "outline"}
                    className="rounded-full w-16 h-16 p-0"
                  >
                    {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                  </Button>

                  {(isTTSPlaying || isTTSSynthesizing) && (
                    <Button
                      onClick={() => {
                        stopTTS();
                        resetDeduplication();
                        resumeRecordingAfterTTS?.();
                      }}
                      size="lg"
                      variant="destructive"
                      className="rounded-full w-16 h-16 p-0 animate-pulse"
                      title="Прервать"
                    >
                      <Square className="w-6 h-6" />
                    </Button>
                  )}

                  <Button
                    onClick={endCall}
                    size="lg"
                    variant="destructive"
                    className="rounded-full w-16 h-16 p-0 shadow-medium"
                  >
                    <PhoneOff className="w-6 h-6" />
                  </Button>
                </div>

                {/* Debug Logs Toggle */}
                <div className="mt-4 flex justify-center">
                  <Button
                    onClick={toggleDebugLogs}
                    size="sm"
                    variant="outline"
                    className="flex items-center gap-2 text-xs"
                  >
                    <Bug className="w-3 h-3" />
                    {showDebugLogs ? 'Скрыть отладку' : 'Показать отладку'}
                  </Button>
                </div>

                {/* Mobile/No-Mic Text Fallback */}
                {!microphoneAccessGranted && (
                   <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                     <h3 className="text-sm font-medium mb-3 text-red-800">
                       🚫 Проблема с микрофоном
                     </h3>
                     <p className="text-sm text-red-600 mb-1">
                       Ваш микрофон занят
                     </p>
                     <p className="text-xs text-gray-500">
                       Проверьте, не используется ли микрофон другим приложением или вкладкой.
                     </p>
                  </div>
                )}

                {transcriptionStatus && (
                  <p className="text-sm text-primary/80 animate-pulse">{transcriptionStatus}</p>
                )}
                
                {error && <p className="text-sm text-destructive">{error}</p>}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Debug Logs Panel */}
      <DebugLogs
        logs={debugLogs}
        isVisible={showDebugLogs}
        onToggle={toggleDebugLogs}
        onClear={clearDebugLogs}
        onCopy={copyDebugLogs}
      />
    </div>
  );
};

export default AudioCall;

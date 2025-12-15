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

// Debug Logs Component - технический формат как в dev tools
const DebugLogs = ({ logs, isVisible, onToggle, onClear, onCopy }: {
  logs: string[];
  isVisible: boolean;
  onToggle: () => void;
  onClear: () => void;
  onCopy: () => void;
}) => {
  if (!isVisible) return null;

  const getLogLevel = (log: string) => {
    if (log.includes('❌') || log.includes('Error') || log.includes('Failed')) return 'error';
    if (log.includes('⚠️') || log.includes('Warning')) return 'warning';
    if (log.includes('✅') || log.includes('Success')) return 'success';
    if (log.includes('🎤') || log.includes('🎭')) return 'info';
    return 'log';
  };

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-400';
      case 'warning': return 'text-yellow-400';
      case 'success': return 'text-green-400';
      case 'info': return 'text-blue-400';
      default: return 'text-gray-300';
    }
  };

  const getLogLevelIcon = (level: string) => {
    switch (level) {
      case 'error': return '🔴';
      case 'warning': return '🟡';
      case 'success': return '🟢';
      case 'info': return '🔵';
      default: return '⚪';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 left-4 md:left-auto md:right-4 w-auto md:w-[600px] max-h-[70vh] md:max-h-[500px] bg-black/95 text-gray-300 font-mono text-xs rounded-lg border border-gray-600 overflow-hidden z-50 shadow-2xl">
      <div className="flex items-center justify-between p-2 bg-gray-800 border-b border-gray-600">
        <span className="flex items-center gap-2 text-white font-semibold text-sm">
          <Bug className="w-4 h-4" />
          Console
        </span>
        <div className="flex gap-1">
          <Button
            onClick={onCopy}
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs text-gray-400 hover:text-white hover:bg-gray-700"
          >
            Copy
          </Button>
          <Button
            onClick={onClear}
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs text-gray-400 hover:text-white hover:bg-gray-700"
          >
            Clear
          </Button>
          <Button
            onClick={onToggle}
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 text-gray-400 hover:text-white hover:bg-gray-700"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <div className="p-2 max-h-[calc(70vh-60px)] md:max-h-[440px] overflow-y-auto">
        {logs.length === 0 ? (
          <div className="text-gray-500 italic py-4 text-center">
            Console was cleared
          </div>
        ) : (
          <div className="space-y-0.5">
            {logs.slice(-100).map((log, index) => {
              const level = getLogLevel(log);
              const levelColor = getLogLevelColor(level);
              const levelIcon = getLogLevelIcon(level);

              return (
                <div key={index} className="group hover:bg-gray-800/30 px-1 py-0.5 rounded transition-colors">
                  <div className="flex items-start gap-2">
                    <span className="text-gray-500 text-[10px] mt-0.5 opacity-60">
                      {new Date().toLocaleTimeString()}
                    </span>
                    <span className="text-[10px] mt-0.5 opacity-60">{levelIcon}</span>
                    <span className={`flex-1 break-all ${levelColor} text-xs leading-tight`}>
                      {log}
                    </span>
                  </div>
                </div>
              );
            })}
            </div>
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
  const [markStatus, setMarkStatus] = useState<string>('Готов к разговору');
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

  // 1. TTS Service (Speech Synthesis) - Инициализируем ПЕРВЫМ, чтобы функции были доступны
  const {
    speak,
    stop: stopTTS,
    resetDeduplication,
    isPlaying: isTTSPlaying,
    isSynthesizing: isTTSSynthesizing,
    isPlayingRef: isTTSPlayingRef,
    isSynthesizingRef: isTTSSynthesizingRef
  } = useTTS({
    onPlaybackStatusChange: (isActive) => {
      // Этот callback будет обновлен через useEffect ниже
    }
  });

  // 2. LLM Service (Logic)
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

  // Stable callbacks to prevent useTranscription hook re-initialization
  const handleTranscriptionComplete = useCallback(async (text: string, source: 'browser' | 'openai' | 'manual') => {
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

    try {
    // Save user message for memory update
    lastUserMessageRef.current = text;

    // Stop TTS if user interrupted (handled by hook, but good to ensure)
    if (source !== 'manual') stopTTS();

    // Reset TTS deduplication for new user input
    resetDeduplication();

    console.log(`[AudioCall] About to call processUserMessage (ID: ${transcribeId})`);

      // Add iOS-specific error handling
      if (isIOS) {
        console.log(`[iOS] Processing transcription on iOS device`);
        // Add small delay for iOS to prevent race conditions
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    await processUserMessage(text);
    console.log(`[AudioCall] processUserMessage completed (ID: ${transcribeId})`);
    } catch (error) {
      console.error(`[AudioCall] Error in handleTranscriptionComplete:`, error);
      addDebugLog(`[Error] Transcription processing failed: ${error}`);

      // On iOS, show user-friendly error and don't crash
      if (isIOS) {
        setError("Ошибка обработки речи. Попробуйте перезагрузить страницу.");
      }
    }
  }, [isMuted, isIOS, addDebugLog, stopTTS, resetDeduplication, processUserMessage]);

  const handleInterruption = useCallback(() => {
    addDebugLog(`[AudioCall] 🎤 Voice interruption detected - stopping TTS and resuming listening`);
    stopTTS();
    // Reset TTS deduplication for new user input after interruption
    resetDeduplication();
  }, [addDebugLog, stopTTS, resetDeduplication]);

  const handleSpeechStart = useCallback(() => {
     // Optional: UI indication
  }, []);

  const handleTranscriptionError = useCallback((err: string) => {
    setError(err);
  }, [setError]);

  // 3. Transcription Service (Speech Recognition)
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
    startRecognition,
    testMicrophoneAccess
  } = useTranscription({
    isTTSActiveRef: isAssistantSpeakingRef,
    addDebugLog,
    onTranscriptionComplete: handleTranscriptionComplete,
    onInterruption: handleInterruption,
    onSpeechStart: handleSpeechStart,
    onError: handleTranscriptionError
  });

  // Update TTS playback status change handler with pauseRecordingForTTS/resumeRecordingAfterTTS
  useEffect(() => {
    // Мы не можем изменить onPlaybackStatusChange после инициализации useTTS,
    // поэтому управляем состоянием через useEffect
    if (isTTSPlaying || isTTSSynthesizing) {
        setMarkStatus('Говорю');
        pauseRecordingForTTS?.();
      } else {
        setMarkStatus('Слушаю');
        if (isCallActiveRef.current) {
          resumeRecordingAfterTTS?.();
        // Remove excessive logging - only log once per session
        if (!isTTSPlaying && !isTTSSynthesizing) {
          console.log('[TTS] TTS session ended, ready for new text');
        }
      }
    }
  }, [isTTSPlaying, isTTSSynthesizing]); // Remove function dependencies to prevent infinite loops

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

  // Update Mark status based on AI processing and TTS state
  useEffect(() => {
    if (isAIProcessing) {
      setMarkStatus('Думаю');
    } else if (isTTSPlaying) {
      setMarkStatus('Говорю');
    } else if (isTTSSynthesizing) {
      setMarkStatus('Генерирую голос');
    } else {
      setMarkStatus('Слушаю');
    }
  }, [isAIProcessing, isTTSPlaying, isTTSSynthesizing]);

  useEffect(() => {
    isCallActiveRef.current = isCallActive;
  }, [isCallActive]);

  // --- Lifecycle & Logic ---

  const initializeUser = useCallback(async () => {
    try {
      let email: string = '';
      let name: string = '';

      if (authUser?.email) {
        // Authenticated user - use real credentials
        email = authUser?.email;
        name = authUser?.name ?? authUser?.email;
      } else {
        // Anonymous user - generate unique identifier based on browser fingerprint
        const fingerprint = navigator.userAgent + navigator.language + screen.width + screen.height;
        const uniqueId = btoa(fingerprint).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
        email = `anonymous_${uniqueId}@zenmindmate.com`;
        name = 'Анонимный пользователь';
      }

      const userData = await userApi.getOrCreateUser(email, name);
      setUser(userData);
      
      const wallet = await walletApi.getWallet(userData?.id);
      setWalletBalance(wallet?.balance);
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

    // iOS-specific safety check
    if (isIOS) {
      console.log(`[iOS] Starting call on iOS device`);
      addDebugLog(`[iOS] Инициализация звонка на iOS`);
    }

    try {
      // Check wallet balance (at least 1 minute)
      const wallet = await walletApi.getWallet(user?.id);
      setWalletBalance(wallet?.balance);
      if ((wallet?.balance || 0) < 8) {
        setError("Недостаточно средств. Пополните кошелёк (минимум 8₽).");
        navigate('/subscription');
        return;
      }

      // Create Call Session (but don't count as used session yet)
      const call = await audioCallApi.createAudioCall(user?.id);
      setCurrentCallId(call?.id);
      
      // Load User Profile
      await loadUserProfile();

      // Don't increment session count here - will be done in endCall if conversation actually happened

      // Initialize Audio/Recognition
      await initializeRecognition();
      
      // UI Updates
      setIsCallActive(true);
      setCallDuration(0);
      setMarkStatus('Приветствую');
      
      // Initial Greeting
      setTimeout(async () => {
         const greeting = "Здравствуйте. Я Марк, психолог. Рад вас слышать. Что вас беспокоит?";
         addToConversation('assistant', greeting);

         // iOS-specific delay before TTS
         if (isIOS) {
           console.log(`[iOS] Adding delay before initial greeting TTS`);
           await new Promise(resolve => setTimeout(resolve, 500));
         }

         try {
         await speak(greeting);
         } catch (error) {
           console.error(`[iOS] Initial greeting TTS failed:`, error);
           if (isIOS) {
             addDebugLog(`[iOS] TTS не работает. Проверьте настройки звука.`);
           }
         }
      }, 1000);

      // Start Timer
      callTimerRef.current = window.setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);

    } catch (err: unknown) {
      console.error("Start call error:", err);
      setError(err.message || "Не удалось начать звонок");
      cleanupRecognition(false); // Don't reset microphone state on start error
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
    setMarkStatus('Готов к разговору');

    // Aggressive cleanup - stop everything
    console.log('[AudioCall] Stopping TTS...');
    stopTTS();

    console.log('[AudioCall] Cleaning up recognition...');
    cleanupRecognition(true); // Full cleanup when ending call

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
            const result = await walletApi.debit(user?.id, minutes * 8, 'voice_call', `call-${currentCallId}`);
            setWalletBalance(result?.balance);
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
                  <h2 className="text-2xl font-bold mb-2">Марк</h2>
                  <div className="text-lg font-medium text-primary mb-1">{markStatus}</div>
                  <div className="text-sm text-muted-foreground">{formatDuration(callDuration)}</div>
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
                     {isIOS ? (
                       <div className="space-y-3">
                         <div className="space-y-2">
                           <p className="text-sm text-red-600 mb-1">
                             <strong>Проблема с доступом к микрофону на iPhone</strong>
                           </p>
                           <div className="text-xs text-gray-600 space-y-2">
                             <div>
                               <p className="font-medium">🔧 Попробуйте эти решения по порядку:</p>
                               <ol className="list-decimal list-inside space-y-1 ml-2 mt-1">
                                 <li>Перезагрузите Safari (двойное нажатие на home, свайп вверх)</li>
                                 <li>Откройте <strong>Настройки</strong> → <strong>Safari</strong> → <strong>Микрофон</strong> → <strong>Разрешить</strong></li>
                                 <li>Перезагрузите iPhone</li>
                                 <li>Попробуйте другой браузер (Chrome, Firefox)</li>
                                 <li>Проверьте что сайт использует HTTPS (замок в адресной строке)</li>
                               </ol>
                             </div>

                             <div className="bg-blue-50 p-2 rounded border border-blue-200">
                               <p className="text-blue-800 font-medium text-xs">💡 Дополнительные советы:</p>
                               <ul className="text-blue-700 text-xs space-y-1 mt-1 ml-2">
                                 <li>• Убедитесь что другие вкладки Safari закрыты</li>
                                 <li>• Попробуйте в частном режиме (новая вкладка → приватно)</li>
                                 <li>• Проверьте что микрофон устройства работает (диктофон)</li>
                                 <li>• Если ничего не помогает - обратитесь в поддержку</li>
                               </ul>
                             </div>

                             <div className="flex gap-2 mt-3">
                               <Button
                                 onClick={() => window.location.reload()}
                                 size="sm"
                                 className="text-xs bg-blue-600 hover:bg-blue-700"
                               >
                                 🔄 Перезагрузить страницу
                               </Button>
                               <Button
                                 onClick={async () => {
                                   const result = await testMicrophoneAccess();
                                   if (result?.success) {
                                     alert(`✅ Доступ к микрофону работает! (${result?.tracks} треков)\nПерезагрузите страницу для начала разговора.`);
                                   } else {
                                     alert(`❌ Доступ все еще заблокирован.\nОшибка: ${result?.error}\n${result?.message}\n\nСледуйте инструкциям выше.`);
                                   }
                                 }}
                                 size="sm"
                                 variant="outline"
                                 className="text-xs"
                               >
                                 🔧 Проверить доступ
                               </Button>
                             </div>
                           </div>
                         </div>
                       </div>
                     ) : (
                       <div className="space-y-1">
                     <p className="text-sm text-red-600 mb-1">
                           Ваш микрофон занят другим приложением
                     </p>
                     <p className="text-xs text-gray-500">
                           Проверьте, не используется ли микрофон другим приложением или вкладкой браузера.
                     </p>
                         <Button
                           onClick={() => window.location.reload()}
                           size="sm"
                           className="mt-2 text-xs"
                         >
                           🔄 Перезагрузить страницу
                         </Button>
                       </div>
                     )}
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

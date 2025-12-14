import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Send, Mic, Square, Loader2, Volume2, VolumeX } from "lucide-react";
import Navigation from "@/components/Navigation";
import { userApi, chatApi, memoryApi, walletApi } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { psychologistAI } from "@/services/openai";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";

interface Message {
  id: string;
  text: string;
  sender: "user" | "assistant";
  timestamp: Date;
}

const Chat = () => {
  // Session constants
  const SESSION_DURATION_SECONDS = 1800; // 30 minutes
  const SESSION_WARNING_SECONDS = 1500; // 25 minutes (5 minutes before end)

  const { user: authUser } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; name: string; email: string } | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [sessionWarningShown, setSessionWarningShown] = useState(false);
  const messagesRef = useRef<Message[]>([]);
  const memoryRef = useRef<string>("");
  const sessionTimerRef = useRef<number | null>(null);
  const billingTimerRef = useRef<number | null>(null);
  const [billingCostPreview, setBillingCostPreview] = useState<string | null>(null);
  const {
    isRecording,
    startRecording,
    stopRecording,
    requestPermission,
    hasPermission,
  } = useAudioRecorder();

  const getUserCredentials = () => {
    if (authUser?.email) {
      // Authenticated user - use real credentials
      return {
        email: authUser?.email,
        name: authUser.name ?? authUser.email
      };
    } else {
      // Anonymous user - generate unique identifier based on browser fingerprint
      const fingerprint = navigator.userAgent + navigator.language + screen.width + screen.height;
      const uniqueId = btoa(fingerprint).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
      return {
        email: `anonymous_${uniqueId}@zenmindmate.com`,
        name: 'Анонимный пользователь'
      };
    }
  };

  useEffect(() => {
    initializeChat();
  }, [authUser]);

  const initializeChat = async () => {
    try {
      setLoading(true);

      // Get or create user
      const { email, name } = getUserCredentials();
      const userData = await userApi.getOrCreateUser(email, name);
      setUser(userData);

      const existingMemory = await memoryApi.getMemory(userData.id, "chat");
      memoryRef.current = existingMemory ?? "";

      // Create new chat session
      const session = await chatApi.createChatSession(userData.id, 'Новая сессия');
      setCurrentSessionId(session.id);

      // Add initial bot message
      await chatApi.addChatMessage(
        session.id,
        userData.id,
        "Здравствуйте. Я Марк, психолог. Расскажите, что привело вас сюда?",
        "assistant"
      );

      // Load messages for this session
      await loadMessages(session.id);

      // Запускаем таймер сессии
      startSessionTimer();

    } catch (error) {
      console.error('Error initializing chat:', error);
    } finally {
      setLoading(false);
    }
  };

  const startSessionTimer = () => {
    if (sessionTimerRef.current) {
      clearInterval(sessionTimerRef.current);
    }

    setSessionDuration(0);
    setSessionWarningShown(false);

    sessionTimerRef.current = window.setInterval(() => {
      setSessionDuration((prev) => {
        const next = prev + 1;

        // Предупреждение за 5 минут до конца
        if (!sessionWarningShown && next >= SESSION_WARNING_SECONDS) {
          setSessionWarningShown(true);
          generateSessionSummary();
        }

        // Завершение сессии через 30 минут
        if (next >= SESSION_DURATION_SECONDS) {
          endChatSession();
          return SESSION_DURATION_SECONDS;
        }

        return next;
      });
    }, 1000);
  };

  const stopBillingTimer = () => {
    if (billingTimerRef.current) {
      clearInterval(billingTimerRef.current);
      billingTimerRef.current = null;
    }
  };

  const generateSessionSummary = async () => {
    if (!user || !currentSessionId) return;

    try {
      setIsTyping(true);

      const summaryPrompt = `У нас осталось около пяти минут до конца нашей тридцатиминутной сессии. 
      
Задача:
1. Кратко подведи итоги: что мы обсудили, какие важные моменты всплыли
2. Отметь, что важного клиент для себя понял или осознал
3. Предложи конкретную тему для следующей встречи, основываясь на том, что осталось недообсужденным или требует более глубокой проработки

Говори от первого лица, естественно и по-человечески. Максимум три-четыре предложения.`;

      const conversationForSummary = [
        ...messagesRef.current.map(msg => ({
          role: msg.sender as 'user' | 'assistant',
          content: msg.text
        })),
        { role: 'user' as const, content: summaryPrompt }
      ];

      const summaryResponse = await psychologistAI.getResponse(conversationForSummary, memoryRef.current);

      // Сохраняем в БД
      await chatApi.addChatMessage(currentSessionId, user.id, summaryResponse, "assistant");

      const botMessage: Message = {
        id: Date.now().toString(),
        text: summaryResponse,
        sender: "assistant",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMessage]);

    } catch (error) {
      console.error('Error generating session summary:', error);
    } finally {
      setIsTyping(false);
    }
  };

  const endChatSession = async () => {
    if (sessionTimerRef.current) {
      clearInterval(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
    stopBillingTimer();

    if (currentSessionId) {
      try {
        await chatApi.endChatSession(currentSessionId);
      } catch (error) {
        console.error('Error ending chat session:', error);
      }
    }

    // Показываем сообщение о завершении сессии
    const endMessage: Message = {
      id: Date.now().toString(),
      text: "Наша сессия завершена (прошло 30 минут). Спасибо за доверие! Вы можете начать новую сессию в любое время.",
      sender: "assistant",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, endMessage]);
  };

  // Очистка таймера и аудио при размонтировании
  useEffect(() => {
    return () => {
      if (sessionTimerRef.current) {
        clearInterval(sessionTimerRef.current);
      }
    };
  }, []);

  const loadMessages = async (sessionId: string) => {
    try {
      const chatMessages = await chatApi.getChatMessages(sessionId);
      const formattedMessages = chatMessages.map(msg => ({
        id: msg.id,
        text: msg.content,
        sender: msg.role as "user" | "assistant",
        timestamp: msg.timestamp,
      }));
      setMessages(formattedMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const estimateTokens = (text: string) => {
    // Simple heuristic: ~4 chars per token
    const tokens = Math.max(1, Math.ceil(text.length / 4));
    return tokens;
  };

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const sanitizeAssistantResponse = (text: string) => {
    const withoutWord = text.replace(/\bсегодня\b/gi, "");
    return withoutWord
      .replace(/\s{2,}/g, " ")
      .replace(/\s([?.!,])/g, "$1")
      .trim();
  };

  const sendMessage = async (content: string) => {
    console.log('[Chat] sendMessage called with content:', content);
    console.log('[Chat] currentSessionId:', currentSessionId, 'user:', user);

    if (!content.trim() || !currentSessionId || !user) {
      console.log('[Chat] sendMessage blocked - missing required data');
      return;
    }

    try {
      // Биллинг: считаем токены на вход и выход. 1 токен = 0.05₽.
      const tokensIn = estimateTokens(content);
      const costIn = tokensIn * 0.05;
      const idempotencyIn = `chat-${currentSessionId}-msg-in-${Date.now()}`;

      // Списываем за входящие токены
      try {
        await walletApi.debit(user.id, costIn, 'chat_token', idempotencyIn);
        setBillingError(null);
        setBillingCostPreview(`Списано за ввод ${costIn.toFixed(2)}₽ (${tokensIn} ток.)`);
        setTimeout(() => setBillingCostPreview(null), 6000);
      } catch (err: any) {
        if (err?.status === 402) {
          setBillingError("Недостаточно средств. Пополните кошелёк.");
          return;
        } else {
          console.error('Chat billing error (input):', err);
          setBillingError("Не удалось списать оплату за сообщение.");
          return;
        }
      }

      // Save user message to database
      await chatApi.addChatMessage(currentSessionId, user.id, content, "user");

      // Add to local state
      const userMessage: Message = {
        id: Date.now().toString(), // Temporary ID for local state
        text: content,
        sender: "user",
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, userMessage]);

      // Get AI response
      setIsTyping(true);
      try {
        // Prepare conversation history for AI
        const conversationHistory = messagesRef.current.concat(userMessage).map(msg => ({
          role: msg.sender as 'user' | 'assistant',
          content: msg.text
        }));

        const rawBotResponse = await psychologistAI.getResponse(conversationHistory, memoryRef.current);
        const botResponse = sanitizeAssistantResponse(rawBotResponse);

        // Списываем за выходящие токены (ответ ассистента)
        const tokensOut = estimateTokens(botResponse);
        const costOut = tokensOut * 0.05;
        const idempotencyOut = `chat-${currentSessionId}-msg-out-${Date.now()}`;
        try {
          await walletApi.debit(user.id, costOut, 'chat_token', idempotencyOut);
          setBillingError(null);
          setBillingCostPreview(`Списано за ввод ${costIn.toFixed(2)}₽ (${tokensIn} ток.) + вывод ${costOut.toFixed(2)}₽ (${tokensOut} ток.)`);
          setTimeout(() => setBillingCostPreview(null), 8000);
        } catch (err: any) {
          if (err?.status === 402) {
            setBillingError("Недостаточно средств для ответа. Пополните кошелёк.");
            setIsTyping(false);
            return;
          } else {
            console.error('Chat billing error (output):', err);
            setBillingError("Не удалось списать оплату за ответ.");
            setIsTyping(false);
            return;
          }
        }

        // Save bot message to database
        await chatApi.addChatMessage(currentSessionId, user.id, botResponse, "assistant");

        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: botResponse,
          sender: "assistant",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botMessage]);
        await updateConversationMemory(content, botResponse);
      } catch (error) {
        console.error('Error getting AI response:', error);
        // Fallback message
        const fallbackMessage = "Извините, я временно недоступен. Можете рассказать подробнее о том, что вас беспокоит?";

        await chatApi.addChatMessage(currentSessionId, user.id, fallbackMessage, "assistant");

        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: fallbackMessage,
          sender: "assistant",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botMessage]);
        await updateConversationMemory(content, fallbackMessage);
      } finally {
        setIsTyping(false);
      }

    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text) return;
    setInputValue("");
    await sendMessage(text);
  };

  const updateConversationMemory = async (userText: string, assistantText: string) => {
    if (!user || !currentSessionId) {
      return;
    }

    try {
      // Сохраняем в БД с sessionId и обновляем локальную память
      const updatedMemory = await memoryApi.appendMemory(
        user.id,
        "chat",
        currentSessionId,
        userText,
        assistantText
      );
      memoryRef.current = updatedMemory;
      console.log("[Chat] Memory updated and saved to DB");
    } catch (error) {
      console.error('Error updating chat memory:', error);
    }
  };

  const handleToggleRecording = async () => {
    try {
      setAudioError(null);
      console.log('[Voice] Toggle recording called, isRecording:', isRecording);

      if (!isRecording) {
        if (!hasPermission) {
          console.log('[Voice] Requesting microphone permission...');
          const allowed = await requestPermission();
          if (!allowed) {
            console.log('[Voice] Microphone permission denied');
            setAudioError("Требуется доступ к микрофону.");
            return;
          }
          console.log('[Voice] Microphone permission granted');
        }

        console.log('[Voice] Starting recording...');
        await startRecording();
      } else {
        setIsProcessingAudio(true);
        console.log('[Voice] Stopping recording and processing audio...');

        try {
          const audioBlob = await stopRecording();
          console.log('[Voice] Audio blob received, size:', audioBlob?.size);

          if (audioBlob && audioBlob.size > 0) {
            try {
              console.log('[Voice] Starting transcription...');

              // Use server API instead of direct OpenAI call
              const formData = new FormData();
              formData.append('file', audioBlob, 'voice.webm');
              formData.append('model', 'whisper-1');
              formData.append('language', 'ru');
              formData.append('response_format', 'text');
              formData.append('prompt', 'Разговор с психологом. Короткие фразы: Привет, Да, Нет, Хорошо, Понял.');

              const response = await fetch('/api/audio/transcriptions', {
                method: 'POST',
                body: formData
              });

              if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(`Server error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
              }

              const transcription = await response.json();
              const text = (transcription.text || transcription).toString().trim();
              console.log('[Voice] Server transcription result:', text);

              if (text.length > 0) {
                console.log('[Voice] Sending transcribed message:', text);
                await sendMessage(text);
                console.log('[Voice] Message sent successfully');
              } else {
                console.log('[Voice] Empty transcription result');
                setAudioError("Не удалось распознать речь. Попробуйте ещё раз или напишите текстом.");
              }
            } catch (error) {
              console.error('[Voice] Transcription error:', error);
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';

              // More specific error messages
              if (errorMessage.includes('401') || errorMessage.includes('403')) {
                setAudioError("Ошибка авторизации OpenAI API. Проверьте настройки.");
              } else if (errorMessage.includes('429')) {
                setAudioError("Превышен лимит запросов к OpenAI. Попробуйте позже.");
              } else if (errorMessage.includes('Connection') || errorMessage.includes('Network')) {
                setAudioError("Проблема с интернет-соединением. Проверьте подключение.");
              } else {
              setAudioError("Голосовое распознавание временно недоступно. Напишите сообщение текстом.");
              }
            }
          } else {
            console.log('[Voice] Audio blob is empty or invalid');
            setAudioError("Похоже, запись не содержит звука.");
          }
        } finally {
          setIsProcessingAudio(false);
        }
      }
    } catch (error) {
      console.error("[Voice] Audio recording error:", error);
      setAudioError("Не удалось получить доступ к микрофону.");
      setIsProcessingAudio(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const audioContextRef = useRef<AudioContext | null>(null);

  // Initialize audio context for iOS compatibility
  useEffect(() => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();

      // Resume audio context on user interaction (important for iOS)
      const resumeAudioContext = async () => {
        if (audioContextRef.current?.state === 'suspended') {
          await audioContextRef.current.resume();
        }
        setHasUserInteracted(true);
      };

      // Add event listeners for user interaction
      document.addEventListener('touchstart', resumeAudioContext, { once: true });
      document.addEventListener('click', resumeAudioContext, { once: true });

      return () => {
        document.removeEventListener('touchstart', resumeAudioContext);
        document.removeEventListener('click', resumeAudioContext);
      };
    } catch (error) {
      console.error('[Chat TTS] Failed to initialize audio context:', error);
    }
  }, []);
  // Для TTS воспроизведения в чате
  const chatAudioRef = useRef<HTMLAudioElement | null>(null);
  const chatAudioUrlRef = useRef<string | null>(null);
  const [ttsStatus, setTtsStatus] = useState<"idle" | "thinking" | "speaking">("idle");
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

  const stopSpeaking = () => {
    if (chatAudioRef.current) {
      try {
        chatAudioRef.current.pause();
      } catch {
        // ignore
      }
      chatAudioRef.current = null;
    }
    if (chatAudioUrlRef.current) {
      URL.revokeObjectURL(chatAudioUrlRef.current);
      chatAudioUrlRef.current = null;
    }
    setSpeakingMessageId(null);
    setTtsStatus("idle");
  };

  const speakMessage = async (messageId: string, text: string) => {
    console.log('[Chat TTS] speakMessage called for message:', messageId);

    if (speakingMessageId === messageId) {
      console.log('[Chat TTS] Stopping current playback');
      stopSpeaking();
      return;
    }

    // Stop any current playback
    stopSpeaking();

    try {
      setSpeakingMessageId(messageId);
      setTtsStatus("thinking");
      console.log('[Chat TTS] Starting speech synthesis');

      // Get audio buffer from TTS
      console.log('[Chat TTS] Requesting TTS synthesis...');
      const audioBuffer = await psychologistAI.synthesizeSpeech(text);
      console.log('[Chat TTS] Received audio buffer, size:', audioBuffer.byteLength);

      // Create blob from array buffer with correct MIME type
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const mimeType = isIOS ? 'audio/wav' : 'audio/mpeg';
      const blob = new Blob([audioBuffer], { type: mimeType });
      const url = URL.createObjectURL(blob);

      console.log('[Chat TTS] Created audio URL:', url);

      // Use HTML5 Audio for playback (more reliable than Web Audio API)
      const audio = new Audio(url);
      chatAudioRef.current = audio;
      chatAudioUrlRef.current = url;
      audio.volume = 1.0; // Maximum volume

      console.log('[Chat TTS] Audio element created, volume:', audio.volume);

      audio.onended = () => {
        console.log('[Chat TTS] Playback ended');
        stopSpeaking();
      };

      audio.onerror = (e) => {
        console.error('[Chat TTS] Audio playback error:', e);
        // Try fallback approach for iOS
        handleIOSAudioError(messageId, text);
      };

      // iOS specific handling - check if we need user interaction
      if (isIOS) {
        console.log('[Chat TTS] iOS detected, user interacted:', hasUserInteracted);

        // Check if audio context is suspended (common on iOS)
        if (audioContextRef.current?.state === 'suspended') {
          console.log('[Chat TTS] Audio context suspended, resuming...');
          await audioContextRef.current.resume();
        }

        try {
          console.log('[Chat TTS] Starting playback on iOS...');
          await audio.play();
          setTtsStatus("speaking");
          console.log('[Chat TTS] Playback started successfully on iOS');
        } catch (playError) {
          console.error('[Chat TTS] iOS playback failed:', playError);

          if (!hasUserInteracted) {
            alert('Нажмите на экран и попробуйте озвучку снова');
          } else {
            alert('Ошибка воспроизведения звука. Попробуйте перезагрузить страницу');
          }
          stopSpeaking();
        }
      } else {
        // Non-iOS devices
      console.log('[Chat TTS] Starting playback...');
      await audio.play();
      setTtsStatus("speaking");
      console.log('[Chat TTS] Playback started successfully');
      }

    } catch (error) {
      console.error('[Chat TTS] Error speaking message:', error);
      setSpeakingMessageId(null);
      setTtsStatus("idle");
    }
  };

  // Fallback function for iOS audio issues
  const handleIOSAudioError = async (messageId: string, text: string) => {
    console.log('[Chat TTS] Attempting iOS fallback for audio playback');

    try {
      // Try with WAV format instead of MP3 for iOS
      const audioBuffer = await psychologistAI.synthesizeSpeech(text, {
        response_format: 'wav' // Try WAV format for iOS
      });

      const blob = new Blob([audioBuffer], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);

      const audio = new Audio(url);
      chatAudioRef.current = audio;
      chatAudioUrlRef.current = url;
      audio.volume = 1.0;

      audio.onended = () => {
        console.log('[Chat TTS] WAV playback ended');
        stopSpeaking();
      };

      audio.onerror = (e) => {
        console.error('[Chat TTS] WAV playback also failed:', e);
        stopSpeaking();
      };

      await audio.play();
      setTtsStatus("speaking");
      console.log('[Chat TTS] WAV playback started successfully');

    } catch (fallbackError) {
      console.error('[Chat TTS] iOS fallback also failed:', fallbackError);
      stopSpeaking();
    }
  };

  // Останавливаем TTS при уходе со страницы/размонтаже
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        stopSpeaking();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      stopSpeaking();
    };
  }, []);

  return (
    <div className="min-h-screen bg-calm-gradient">
      <Navigation />

      <div className="pt-16 px-4">
        <div className="w-full max-w-5xl mx-auto">
          <Card className="bg-card border-0 shadow-none animate-scale-in rounded-3xl">
            <div className="min-h-[calc(100vh-8rem)] flex flex-col">
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-hero-gradient animate-pulse" />
                      <p className="text-muted-foreground">Загрузка чата...</p>
                    </div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-hero-gradient" />
                      <p className="text-muted-foreground">Начните разговор с ИИ-психологом</p>
                    </div>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 animate-fade-in ${message.sender === "user" ? "flex-row-reverse" : ""
                        }`}
                    >
                      <div
                        className={`flex-1 max-w-[80%] p-4 rounded-3xl ${message.sender === "assistant"
                          ? "bg-muted/50 text-foreground"
                          : "bg-hero-gradient text-white shadow-soft"
                          }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1">
                            <p className="text-sm md:text-base leading-relaxed">{message.text}</p>
                            <span className="text-xs opacity-70 mt-2 block">
                              {new Date(message.timestamp).toLocaleTimeString("ru-RU", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          {message.sender === "assistant" && (
                            <Button
                              onClick={() => speakMessage(message.id, message.text)}
                              size="sm"
                              variant="ghost"
                              className={`shrink-0 h-8 w-8 p-0 hover:bg-muted ${speakingMessageId === message.id ? 'text-blue-500' : 'text-muted-foreground'
                                }`}
                              title={speakingMessageId === message.id ? "Остановить озвучку" : "Озвучить сообщение"}
                            >
                              {speakingMessageId === message.id ? (
                                ttsStatus === "thinking" ? (
                                  <span className="text-xs animate-pulse">Думаю</span>
                                ) : ttsStatus === "speaking" ? (
                                  <span className="text-xs">Говорю</span>
                                ) : (
                                <VolumeX className="w-4 h-4" />
                                )
                              ) : (
                                <Volume2 className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {/* Typing indicator */}
                {isTyping && (
                  <div className="flex gap-3 animate-fade-in">
                    <div className="flex-1 max-w-[80%] p-4 rounded-3xl bg-muted/50 text-foreground">
                      <div className="flex items-center gap-1">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                        <span className="text-sm text-muted-foreground ml-2">Марк печатает...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Input Area */}
              <div className="border-t border-border p-4 md:p-6">
                {billingError && (
                  <div className="text-sm text-destructive mb-2">{billingError}</div>
                )}
                <div className="flex gap-2">
                  <Input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())}
                    placeholder="Напишите ваше сообщение..."
                    className="flex-1 bg-background border-border"
                    disabled={loading || isTyping || isProcessingAudio}
                  />
                  <Button
                    onClick={inputValue.trim() ? handleSend : handleToggleRecording}
                    className="bg-hero-gradient hover:opacity-90 text-white shadow-medium"
                    size="icon"
                    disabled={
                      loading ||
                      isTyping ||
                      (isProcessingAudio && !inputValue.trim())
                    }
                    aria-label={
                      inputValue.trim()
                        ? "Отправить сообщение"
                        : isRecording
                          ? "Остановить запись"
                          : isProcessingAudio
                            ? "Обработка голосового сообщения"
                            : "Начать запись голосового сообщения"
                    }
                  >
                    {inputValue.trim() ? (
                      <Send className="w-5 h-5" />
                    ) : isProcessingAudio ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : isRecording ? (
                      <Square className="w-5 h-5" />
                    ) : (
                      <Mic className="w-5 h-5" />
                    )}
                  </Button>
                </div>
                {(billingCostPreview || isRecording || isProcessingAudio || audioError) && (
                  <div className="mt-3 text-xs text-muted-foreground flex items-center gap-2">
                    {billingCostPreview && <span className="text-green-600 font-medium">{billingCostPreview}</span>}
                    {isRecording && <span className="text-red-500 font-medium">Идёт запись...</span>}
                    {isProcessingAudio && <span>Обрабатываю голосовое сообщение...</span>}
                    {audioError && <span className="text-destructive">{audioError}</span>}
                  </div>
                )}

              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Chat;

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Send, Mic, Square, Loader2, Volume2, VolumeX } from "lucide-react";
import Navigation from "@/components/Navigation";
import { userApi, chatApi, memoryApi } from "@/services/api";
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
  const { user: authUser } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; name: string; email: string } | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [sessionWarningShown, setSessionWarningShown] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const memoryRef = useRef<string>("");
  const sessionTimerRef = useRef<number | null>(null);

  const SESSION_DURATION_SECONDS = 30 * 60; // 30 минут
  const SESSION_WARNING_SECONDS = SESSION_DURATION_SECONDS - 5 * 60; // За 5 минут
  const {
    isRecording,
    startRecording,
    stopRecording,
    requestPermission,
    hasPermission,
  } = useAudioRecorder();

  const getUserCredentials = () => {
    const fallbackEmail = 'user@zenmindmate.com';
    const email = authUser?.email ?? fallbackEmail;
    const name = authUser?.name ?? authUser?.email ?? 'Пользователь';
    return { email, name };
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
      // Cleanup audio
      if (audioSourceRef.current) {
        try {
          audioSourceRef.current.stop();
        } catch (e) {
          // Ignore
        }
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
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
              const transcription = await psychologistAI.transcribeAudio(audioBlob);
              const text = transcription.trim();
              console.log('[Voice] Transcription result:', text);

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
              // Fallback: show error but allow text input
              setAudioError("Голосовое распознавание временно недоступно. Напишите сообщение текстом.");
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
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const stopSpeaking = () => {
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch (e) {
        // Ignore errors if already stopped
      }
      audioSourceRef.current = null;
    }
    setSpeakingMessageId(null);
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
      console.log('[Chat TTS] Starting speech synthesis');

      // Get audio buffer from TTS
      console.log('[Chat TTS] Requesting TTS synthesis...');
      const audioBuffer = await psychologistAI.synthesizeSpeech(text);
      console.log('[Chat TTS] Received audio buffer, size:', audioBuffer.byteLength);

      // Create blob from array buffer
      const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);

      console.log('[Chat TTS] Created audio URL:', url);

      // Use HTML5 Audio for playback (more reliable than Web Audio API)
      const audio = new Audio(url);
      audio.volume = 1.0; // Maximum volume

      console.log('[Chat TTS] Audio element created, volume:', audio.volume);

      audio.onended = () => {
        console.log('[Chat TTS] Playback ended');
        URL.revokeObjectURL(url);
        setSpeakingMessageId(null);
      };

      audio.onerror = (e) => {
        console.error('[Chat TTS] Audio playback error:', e);
        URL.revokeObjectURL(url);
        setSpeakingMessageId(null);
      };

      console.log('[Chat TTS] Starting playback...');
      await audio.play();
      console.log('[Chat TTS] Playback started successfully');

    } catch (error) {
      console.error('[Chat TTS] Error speaking message:', error);
      setSpeakingMessageId(null);
    }
  };

  return (
    <div className="min-h-screen bg-calm-gradient">
      <Navigation />

      <div className="pt-16 px-4">
        <div className="w-full max-w-5xl mx-auto">
          <Card className="bg-card border-0 shadow-none animate-scale-in rounded-3xl">
            <div className="min-h-[calc(100vh-8rem)] flex flex-col">
              {/* Таймер сессии */}
              {!loading && sessionDuration > 0 && (
                <div className="px-6 pt-4 pb-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Время сессии: {formatDuration(sessionDuration)}
                    </span>
                    {sessionDuration >= SESSION_WARNING_SECONDS && (
                      <span className="text-orange-500 font-medium animate-pulse">
                        Осталось ~{Math.ceil((SESSION_DURATION_SECONDS - sessionDuration) / 60)} мин
                      </span>
                    )}
                  </div>
                  <div className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-1000 ${sessionDuration >= SESSION_WARNING_SECONDS
                        ? 'bg-orange-500'
                        : 'bg-blue-500'
                        }`}
                      style={{ width: `${(sessionDuration / SESSION_DURATION_SECONDS) * 100}%` }}
                    />
                  </div>
                </div>
              )}
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
                                <VolumeX className="w-4 h-4" />
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
                {(isRecording || isProcessingAudio || audioError) && (
                  <div className="mt-3 text-xs text-muted-foreground flex items-center gap-2">
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

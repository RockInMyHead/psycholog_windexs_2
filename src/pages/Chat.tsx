import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Send, Bot, User as UserIcon } from "lucide-react";
import Navigation from "@/components/Navigation";

interface Message {
  id: number;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
}

const Chat = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: "Здравствуйте! Я ваш ИИ-психолог. Как я могу помочь вам сегодня?",
      sender: "bot",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: messages.length + 1,
      text: inputValue,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages([...messages, userMessage]);
    setInputValue("");

    // Simulate bot response
    setTimeout(() => {
      const botMessage: Message = {
        id: messages.length + 2,
        text: "Спасибо, что поделились со мной. Я здесь, чтобы выслушать и поддержать вас. Расскажите подробнее о том, что вас беспокоит.",
        sender: "bot",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMessage]);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-calm-gradient">
      <Navigation />
      
      <div className="pt-24 pb-8 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-8 animate-fade-in">
            <h1 className="text-4xl font-bold text-foreground mb-3">Чат с психологом</h1>
            <p className="text-muted-foreground">Конфиденциальный разговор с ИИ-психологом</p>
          </div>

          <Card className="bg-card border-2 border-border shadow-medium animate-scale-in">
            <div className="h-[500px] md:h-[600px] flex flex-col">
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 animate-fade-in ${
                      message.sender === "user" ? "flex-row-reverse" : ""
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        message.sender === "bot"
                          ? "bg-hero-gradient shadow-medium"
                          : "bg-accent/20"
                      }`}
                    >
                      {message.sender === "bot" ? (
                        <Bot className="w-5 h-5 text-white" />
                      ) : (
                        <UserIcon className="w-5 h-5 text-accent" />
                      )}
                    </div>
                    <div
                      className={`flex-1 max-w-[80%] p-4 rounded-2xl ${
                        message.sender === "bot"
                          ? "bg-muted/50 text-foreground"
                          : "bg-hero-gradient text-white shadow-soft"
                      }`}
                    >
                      <p className="text-sm md:text-base leading-relaxed">{message.text}</p>
                      <span className="text-xs opacity-70 mt-2 block">
                        {message.timestamp.toLocaleTimeString("ru-RU", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input Area */}
              <div className="border-t border-border p-4 bg-background/50">
                <div className="flex gap-2">
                  <Input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSend()}
                    placeholder="Напишите ваше сообщение..."
                    className="flex-1 bg-background border-border"
                  />
                  <Button
                    onClick={handleSend}
                    className="bg-hero-gradient hover:opacity-90 text-white shadow-medium"
                    size="icon"
                  >
                    <Send className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Chat;

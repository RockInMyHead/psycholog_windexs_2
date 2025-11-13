import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MessageCircle, Phone, Lightbulb, PlayCircle, Sparkles, RefreshCw } from "lucide-react";
import Navigation from "@/components/Navigation";

const quotes = [
  "Единственный способ сделать что-то хорошо — полюбить то, что вы делаете.",
  "Жизнь — это то, что происходит с вами, пока вы строите другие планы.",
  "Путь в тысячу миль начинается с первого шага.",
  "Не важно, как медленно вы идете, главное — не останавливаться.",
  "Счастье — это не цель, а способ жить.",
  "Будьте тем изменением, которое хотите видеть в мире.",
  "Лучшее время посадить дерево было 20 лет назад. Второе лучшее время — сейчас.",
];

const Index = () => {
  const [currentQuote, setCurrentQuote] = useState(quotes[0]);

  const getNewQuote = () => {
    const newQuote = quotes[Math.floor(Math.random() * quotes.length)];
    setCurrentQuote(newQuote);
  };

  const features = [
    {
      icon: MessageCircle,
      title: "Чат с психологом",
      description: "Общайтесь с ИИ-психологом в любое время",
      link: "/chat",
      gradient: "from-emerald-400 to-teal-500"
    },
    {
      icon: Phone,
      title: "Аудио звонок",
      description: "Голосовая сессия с психологом",
      link: "/audio",
      gradient: "from-teal-400 to-cyan-500"
    },
    {
      icon: Lightbulb,
      title: "Мудрые фразы",
      description: "Вдохновляющие мысли каждый день",
      link: "/quotes",
      gradient: "from-green-400 to-emerald-500"
    },
    {
      icon: PlayCircle,
      title: "Медитации",
      description: "Видео для релаксации и осознанности",
      link: "/meditations",
      gradient: "from-lime-400 to-green-500"
    }
  ];

  return (
    <div className="min-h-screen bg-calm-gradient">
      <Navigation />
      
      {/* Hero Section */}
      <section className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6 animate-pulse-soft">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">Ваш личный ИИ-психолог</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 leading-tight">
              Путь к внутренней
              <span className="block bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                гармонии
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Профессиональная психологическая поддержка с помощью искусственного интеллекта. 
              Доступно 24/7, конфиденциально и безопасно.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/chat">
                <Button size="lg" className="bg-hero-gradient hover:opacity-90 text-white shadow-medium hover:shadow-strong transition-all text-lg px-8 py-6">
                  <MessageCircle className="w-5 h-5 mr-2" />
                  Начать чат
                </Button>
              </Link>
              <Link to="/audio">
                <Button size="lg" variant="outline" className="border-2 border-primary text-primary hover:bg-primary/10 text-lg px-8 py-6">
                  <Phone className="w-5 h-5 mr-2" />
                  Аудио звонок
                </Button>
              </Link>
            </div>
          </div>

          {/* Quote of the Day */}
          <Card className="mt-16 p-8 bg-card-gradient border-2 border-border shadow-medium hover:shadow-strong transition-all animate-scale-in">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 text-primary mb-4">
                <Lightbulb className="w-6 h-6" />
                <span className="text-sm font-semibold uppercase tracking-wider">Фраза дня</span>
              </div>
              <p className="text-xl md:text-2xl text-foreground font-medium mb-6 italic leading-relaxed">
                "{currentQuote}"
              </p>
              <Button 
                onClick={getNewQuote}
                variant="outline"
                className="gap-2 hover:bg-primary/10 border-primary/30"
              >
                <RefreshCw className="w-4 h-4" />
                Еще
              </Button>
            </div>
          </Card>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-foreground mb-12">
            Наши возможности
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Link 
                  key={index} 
                  to={feature.link}
                  className="group"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <Card className="p-6 h-full bg-card hover:bg-card-gradient border-2 border-border hover:border-primary/30 shadow-soft hover:shadow-medium transition-all cursor-pointer animate-fade-in">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-medium`}>
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground">
                      {feature.description}
                    </p>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <Card className="p-8 md:p-12 bg-hero-gradient text-white text-center shadow-strong">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Готовы начать свой путь к гармонии?
            </h2>
            <p className="text-lg mb-8 opacity-90">
              Присоединяйтесь к тысячам людей, которые уже нашли поддержку
            </p>
            <Link to="/profile">
              <Button size="lg" variant="secondary" className="text-lg px-8 py-6 bg-white text-primary hover:bg-white/90 shadow-medium">
                Создать профиль
              </Button>
            </Link>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default Index;

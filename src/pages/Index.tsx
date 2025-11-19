import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MessageCircle, Phone, Lightbulb, PlayCircle, Sparkles, RefreshCw, Shield, Clock, Heart, Users, Brain, Zap, Star, CheckCircle } from "lucide-react";
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

  const benefits = [
    {
      icon: Clock,
      title: "Доступно 24/7",
      description: "Получите поддержку в любое время дня и ночи"
    },
    {
      icon: Shield,
      title: "Конфиденциально",
      description: "Ваши разговоры защищены и анонимны"
    },
    {
      icon: Heart,
      title: "Эмпатия",
      description: "Понимающий и заботливый подход"
    },
    {
      icon: Zap,
      title: "Быстрый отклик",
      description: "Мгновенные ответы на ваши вопросы"
    }
  ];

  const stats = [
    { number: "10,000+", label: "Пользователей", icon: Users },
    { number: "50,000+", label: "Сессий", icon: MessageCircle },
    { number: "98%", label: "Удовлетворенность", icon: Star },
    { number: "24/7", label: "Поддержка", icon: Clock }
  ];


  const steps = [
    {
      number: "01",
      title: "Зарегистрируйтесь",
      description: "Создайте профиль за 30 секунд"
    },
    {
      number: "02",
      title: "Выберите формат",
      description: "Чат, звонок или медитация"
    },
    {
      number: "03",
      title: "Начните путь",
      description: "К внутренней гармонии и покою"
    }
  ];

  return (
    <div className="min-h-screen bg-calm-gradient">
      <Navigation />
      
      {/* Hero Section */}
      <section className="pt-24 pb-20 px-4 relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />
        </div>

        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="text-center animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6 animate-pulse-soft">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">Ваш личный ИИ-психолог</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-foreground mb-6 leading-tight">
              Windexs-Психолог
              <span className="block mt-2 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-pulse-soft">
                Путь к гармонии
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-3xl mx-auto leading-relaxed">
              Профессиональная психологическая поддержка с помощью искусственного интеллекта. 
              Доступно 24/7, конфиденциально и безопасно.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link to="/chat">
                <Button size="lg" className="bg-hero-gradient hover:brightness-110 text-white shadow-medium hover:shadow-strong transition-all text-lg px-10 py-7 animate-scale-in">
                  <MessageCircle className="w-6 h-6 mr-2" />
                  Начать чат
                </Button>
              </Link>
              <Link to="/audio">
                <Button size="lg" variant="outline" className="border-2 border-primary text-primary hover:bg-primary/10 text-lg px-10 py-7 animate-scale-in" style={{ animationDelay: '100ms' }}>
                  <Phone className="w-6 h-6 mr-2" />
                  Аудио звонок
                </Button>
              </Link>
            </div>

            {/* Stats Section */}
            <div className="grid grid-cols-1 gap-6 mt-16 animate-fade-in max-w-md mx-auto" style={{ animationDelay: '200ms' }}>
              {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <Card key={index} className="p-6 bg-card-gradient border-2 border-border shadow-soft hover:shadow-medium transition-all">
                    <Icon className="w-7 h-7 text-primary mx-auto mb-3" />
                    <div className="text-2xl md:text-3xl font-bold text-foreground mb-2">{stat.number}</div>
                    <div className="text-sm text-muted-foreground">{stat.label}</div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Quote of the Day */}
          <Card className="mt-20 p-8 md:p-10 bg-card-gradient border-2 border-border shadow-strong hover:shadow-strong transition-all animate-scale-in" style={{ animationDelay: '300ms' }}>
            <div className="text-center">
              <div className="inline-flex items-center gap-2 text-primary mb-4">
                <Lightbulb className="w-6 h-6 animate-pulse-soft" />
                <span className="text-sm font-semibold uppercase tracking-wider">Фраза дня</span>
              </div>
              <p className="text-xl md:text-3xl text-foreground font-medium mb-6 italic leading-relaxed">
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

      {/* Benefits Section */}
      <section className="py-20 px-4 bg-background/50">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16 animate-fade-in">
            <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
              Почему выбирают нас?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Современные технологии ИИ для вашего психологического благополучия
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <Card
                  key={index}
                  className="p-6 text-center bg-card border-2 border-border hover:border-primary/30 shadow-soft hover:shadow-medium transition-all animate-fade-in group"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-hero-gradient flex items-center justify-center mb-4 shadow-medium group-hover:scale-110 transition-transform">
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">{benefit.title}</h3>
                  <p className="text-muted-foreground">{benefit.description}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16 animate-fade-in">
            <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
              Наши возможности
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Комплексный подход к вашему психологическому здоровью
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Link 
                  key={index} 
                  to={feature.link}
                  className="group"
                >
                  <Card className="p-8 h-full bg-card hover:bg-card-gradient border-2 border-border hover:border-primary/30 shadow-soft hover:shadow-strong transition-all cursor-pointer animate-fade-in">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-medium`}>
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-foreground mb-3 group-hover:text-primary transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground text-lg">
                      {feature.description}
                    </p>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 bg-background/50">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16 animate-fade-in">
            <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
              Как это работает?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Три простых шага до вашей первой сессии
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {steps.map((step, index) => (
              <Card
                key={index}
                className="p-6 md:p-8 text-center bg-card-gradient border-2 border-border shadow-soft hover:shadow-medium transition-all animate-fade-in relative overflow-hidden group"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-hero-gradient" />
                <div className="text-4xl md:text-6xl font-bold text-primary/20 mb-3 md:mb-4 group-hover:scale-110 transition-transform">
                  {step.number}
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-foreground mb-2 md:mb-3">{step.title}</h3>
                <p className="text-muted-foreground text-base md:text-lg leading-relaxed">{step.description}</p>
                <CheckCircle className="w-10 h-10 md:w-12 md:h-12 text-primary/20 mx-auto mt-4 md:mt-6 group-hover:text-primary/60 transition-colors" />
              </Card>
            ))}
          </div>
        </div>
      </section>


      {/* Why AI Psychology */}
      <section className="py-20 px-4 bg-background/50">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="animate-fade-in">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6">
                <Brain className="w-4 h-4" />
                <span className="text-sm font-medium">Технологии будущего</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-6">
                Почему ИИ-психология эффективна?
              </h2>
              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                Наш искусственный интеллект обучен на тысячах часов психологических сессий и 
                научных исследований. Он сочетает лучшие практики когнитивно-поведенческой 
                терапии с современными технологиями машинного обучения.
              </p>
              <ul className="space-y-4">
                {[
                  "Научно обоснованные методики",
                  "Персонализированный подход",
                  "Отсутствие суждений и предвзятости",
                  "Постоянное обучение и улучшение"
                ].map((item, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-foreground text-lg">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative animate-fade-in" style={{ animationDelay: '200ms' }}>
              <Card className="p-4 sm:p-8 bg-card-gradient border-2 border-primary/20 shadow-strong">
                <div className="grid grid-cols-1 gap-4 sm:gap-6">
                  <div className="text-center p-4 sm:p-6 rounded-xl bg-gradient-to-br from-emerald-400/10 to-teal-500/10 border border-primary/20">
                    <Brain className="w-8 h-8 sm:w-12 sm:h-12 text-primary mx-auto mb-2 sm:mb-3" />
                    <div className="text-2xl sm:text-3xl font-bold text-foreground mb-1 sm:mb-2">98%</div>
                    <div className="text-xs sm:text-sm text-muted-foreground break-words">Точность анализа</div>
                  </div>
                  <div className="text-center p-4 sm:p-6 rounded-xl bg-gradient-to-br from-teal-400/10 to-cyan-500/10 border border-primary/20">
                    <Zap className="w-8 h-8 sm:w-12 sm:h-12 text-accent mx-auto mb-2 sm:mb-3" />
                    <div className="text-2xl sm:text-3xl font-bold text-foreground mb-1 sm:mb-2">&lt;1с</div>
                    <div className="text-xs sm:text-sm text-muted-foreground break-words">Время отклика</div>
                  </div>
                  <div className="text-center p-4 sm:p-6 rounded-xl bg-gradient-to-br from-green-400/10 to-emerald-500/10 border border-primary/20">
                    <Heart className="w-8 h-8 sm:w-12 sm:h-12 text-primary mx-auto mb-2 sm:mb-3" />
                    <div className="text-2xl sm:text-3xl font-bold text-foreground mb-1 sm:mb-2">95%</div>
                    <div className="text-xs sm:text-sm text-muted-foreground break-words">Удовлетворенность</div>
                  </div>
                  <div className="text-center p-4 sm:p-6 rounded-xl bg-gradient-to-br from-lime-400/10 to-green-500/10 border border-primary/20">
                    <Shield className="w-8 h-8 sm:w-12 sm:h-12 text-accent mx-auto mb-2 sm:mb-3" />
                    <div className="text-2xl sm:text-3xl font-bold text-foreground mb-1 sm:mb-2">100%</div>
                    <div className="text-xs sm:text-sm text-muted-foreground break-words">Конфиденциальность</div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <Card className="p-12 md:p-16 bg-hero-gradient text-white text-center shadow-strong relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-20" />
            <div className="relative z-10">
              <Sparkles className="w-16 h-16 mx-auto mb-6 animate-pulse-soft" />
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                Готовы начать свой путь к гармонии?
              </h2>
              <p className="text-xl mb-10 opacity-90 max-w-2xl mx-auto">
                Присоединяйтесь к тысячам людей, которые уже нашли поддержку и 
                начали путь к психологическому благополучию
              </p>
              <div className="flex justify-center">
                <Link to="/chat">
                  <Button size="lg" variant="outline" className="text-lg px-10 py-7 text-foreground hover:bg-green-50 hover:text-green-600">
                    Начать сейчас
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default Index;

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlayCircle, Clock, Wind } from "lucide-react";
import Navigation from "@/components/Navigation";
import { userApi } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

interface MeditationItem {
  title: string;
  duration: string;
  description: string;
  thumbnail: string;
  videoUrl: string;
}

const meditations = [
  {
    title: "Медитация благодарности",
    duration: "15 мин",
    description: "Сессия с психологом: Как притянуть благоприятные события и изменить свою жизнь к лучшему",
    thumbnail: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80",
    videoUrl: "https://rutube.ru/video/e3d8fb2e5a1f6d4cf5c825d30cc7b27c/"
  },
  {
    title: "Медитация на дыхание",
    duration: "12 мин",
    description: "Фон моря вдох выдох успокаивающее дыхание",
    thumbnail: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80",
    videoUrl: "https://rutube.ru/video/1b675c50e3bec1a6560ab4d8340136a3/"
  },
  {
    title: "Снятие стресса",
    duration: "15 мин",
    description: "Гармонизация вдох, впускаете тишину. пауза, это равновесие., выдох, растворяете напряжение",
    thumbnail: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80",
    videoUrl: "https://rutube.ru/video/04056c4c8e1c601bdd0178e6535e4a97/"
  },
  {
    title: "Метод Бутейко",
    duration: "20 мин",
    description: "Метод бутейко вдох выдох 1 лечебно успокаивающее дыхание",
    thumbnail: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80",
    videoUrl: "https://rutube.ru/video/5fbdc99016f4e3ddd1aaa76df328a053/"
  },
  {
    title: "Лечебное дыхание",
    duration: "10 мин",
    description: "Лечебно оздоровительное дыхание, для снятия стресса",
    thumbnail: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80",
    videoUrl: "https://rutube.ru/video/5128986cee1e6f4f90ed8e482f83a323/"
  },
  {
    title: "Успокаивающее дыхание",
    duration: "10 мин",
    description: "Лечебно успокаивающее дыхание",
    thumbnail: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80",
    videoUrl: "https://rutube.ru/video/6e98f59165e1cac058374ff27931d511/"
  },
  {
    title: "Дыхание в моменте",
    duration: "5 мин",
    description: "Дышите — чтобы выжить в моменте и вернуть себе контроль",
    thumbnail: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80",
    videoUrl: "https://rutube.ru/video/8eb3261b4be614727eb96c97b5f4af44/"
  },
  {
    title: "Вечерняя медитация",
    duration: "10 мин",
    description: "Вечерняя медитация: Найти покой в центре бури для хорошего сна",
    thumbnail: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80",
    videoUrl: "https://rutube.ru/video/5e5196b25a7c25e539cca4bfd9604e78/"
  },
];

const Meditations = () => {
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authUser) {
    initializeUser();
    }
  }, [authUser]);

  const initializeUser = async () => {
    try {
      setLoading(true);

      // Use real user from auth context, or generate unique ID for anonymous users
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

    } catch (error) {
      console.error('Error initializing user:', error);
    } finally {
      setLoading(false);
    }
  };

  const openRuTubeVideo = (meditation: MeditationItem) => {
    if (meditation.videoUrl.includes('rutube.ru')) {
      window.open(meditation.videoUrl, '_blank', 'noopener,noreferrer');
    } else {
      // Fallback for other video platforms
      window.open(meditation.videoUrl, '_blank', 'noopener,noreferrer');
    }
  };


  return (
    <div className="min-h-screen bg-calm-gradient">
      <Navigation />
      
      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12 animate-fade-in">
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-3">Медитации</h1>
            <p className="text-muted-foreground text-lg">
              Видео для релаксации, осознанности и внутреннего покоя
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Special card for Meditation with Mark */}
            <Card
              className="overflow-hidden bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/30 shadow-soft hover:shadow-medium transition-all group cursor-pointer animate-fade-in"
              onClick={() => navigate('/meditation-with-marque')}
            >
              <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                <div className="text-center">
                  <Wind className="w-16 h-16 text-primary mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-primary mb-2">Медитация с Марком</h3>
                  <p className="text-sm text-muted-foreground">Интерактивная йога-медитация</p>
                </div>
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/meditation-with-marque');
                    }}
                    className="w-16 h-16 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-strong"
                    size="icon"
                  >
                    <Wind className="w-10 h-10 text-primary" />
                  </Button>
                </div>
                <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-primary/20 backdrop-blur-sm flex items-center gap-1 text-sm text-primary font-medium">
                  <Wind className="w-3 h-3" />
                  Марк
                </div>
              </div>

              <div className="p-5">
                <h3 className="text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                  Медитация с Марком
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed mb-3">
                  Интерактивная йога-медитация с персональными инструкциями от ИИ-психолога Марка
                </p>
                <div className="flex items-center gap-2 text-xs text-primary font-medium">
                  <Wind className="w-3 h-3" />
                  <span>Йога-позы • Анализ формы • TTS инструкции</span>
                </div>
              </div>
            </Card>

            {meditations.map((meditation, index) => (
              <Card
                key={index}
                className="overflow-hidden bg-card border-2 border-border hover:border-primary/30 shadow-soft hover:shadow-medium transition-all group cursor-pointer animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => openRuTubeVideo(meditation)}
              >
                <div className="relative aspect-video overflow-hidden">
                  <img
                    src={meditation.thumbnail}
                    alt={meditation.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                    onError={(e) => {
                      // Fallback to a stable remote nature photo if thumbnail fails
                      const target = e.target as HTMLImageElement;
                      target.src = "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80";
                    }}
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="text-center">
                      <div className="text-white text-sm font-medium mb-2 opacity-90">Открыть в RuTube</div>
                      <PlayCircle className="w-12 h-12 text-white drop-shadow-lg" />
                    </div>
                  </div>
                  <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-black/70 backdrop-blur-sm flex items-center gap-1  text-sm">
                    <Clock className="w-3 h-3" />
                    {meditation.duration}
                  </div>
                </div>

                <div className="p-5">
                  <h3 className="text-xl font-bold text-foreground mb-2 group-hover:text-white transition-colors">
                    {meditation.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {meditation.description}
                  </p>
                </div>
              </Card>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Card className="p-8 bg-card-gradient border-2 border-primary/20 shadow-medium inline-block">
              <h3 className="text-xl font-bold text-foreground mb-2">Советы для медитации</h3>
              <ul className="text-left text-muted-foreground space-y-2">
                <li>• Найдите тихое и комфортное место</li>
                <li>• Используйте наушники для лучшего эффекта</li>
                <li>• Медитируйте регулярно для достижения результата</li>
                <li>• Не волнуйтесь о "правильной" медитации</li>
              </ul>
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Meditations;

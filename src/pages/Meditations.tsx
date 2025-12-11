import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlayCircle, Clock, Star, Wind } from "lucide-react";
import Navigation from "@/components/Navigation";
import { userApi, meditationApi } from "@/services/api";

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
    thumbnail: "https://images.unsplash.com/photo-1499728603263-13726abce5fd?w=400&h=225&fit=crop",
    videoUrl: "https://rutube.ru/video/e3d8fb2e5a1f6d4cf5c825d30cc7b27c/"
  },
  {
    title: "Медитация на дыхание",
    duration: "12 мин",
    description: "Фон моря вдох выдох успокаивающее дыхание",
    thumbnail: "https://images.unsplash.com/photo-1447452001602-7090c7ab2db3?w=400&h=225&fit=crop",
    videoUrl: "https://rutube.ru/video/1b675c50e3bec1a6560ab4d8340136a3/"
  },
  {
    title: "Снятие стресса",
    duration: "15 мин",
    description: "Гармонизация вдох, впускаете тишину. пауза, это равновесие., выдох, растворяете напряжение",
    thumbnail: "https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=400&h=225&fit=crop",
    videoUrl: "https://rutube.ru/video/04056c4c8e1c601bdd0178e6535e4a97/"
  },
  {
    title: "Метод Бутейко",
    duration: "20 мин",
    description: "Метод бутейко вдох выдох 1 лечебно успокаивающее дыхание",
    thumbnail: "https://images.unsplash.com/photo-1508672019048-805c876b67e2?w=400&h=225&fit=crop",
    videoUrl: "https://rutube.ru/video/5fbdc99016f4e3ddd1aaa76df328a053/"
  },
  {
    title: "Лечебное дыхание",
    duration: "10 мин",
    description: "Лечебно оздоровительное дыхание, для снятия стресса",
    thumbnail: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&h=225&fit=crop",
    videoUrl: "https://rutube.ru/video/5128986cee1e6f4f90ed8e482f83a323/"
  },
  {
    title: "Успокаивающее дыхание",
    duration: "10 мин",
    description: "Лечебно успокаивающее дыхание",
    thumbnail: "https://images.unsplash.com/photo-1495954484750-af469f2f9be5?w=400&h=225&fit=crop",
    videoUrl: "https://rutube.ru/video/6e98f59165e1cac058374ff27931d511/"
  },
  {
    title: "Дыхание в моменте",
    duration: "5 мин",
    description: "Дышите — чтобы выжить в моменте и вернуть себе контроль",
    thumbnail: "https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=400&h=225&fit=crop",
    videoUrl: "https://rutube.ru/video/8eb3261b4be614727eb96c97b5f4af44/"
  },
  {
    title: "Вечерняя медитация",
    duration: "10 мин",
    description: "Вечерняя медитация: Найти покой в центре бури для хорошего сна",
    thumbnail: "https://images.unsplash.com/photo-1495954484750-af469f2f9be5?w=400&h=225&fit=crop",
    videoUrl: "https://rutube.ru/video/5e5196b25a7c25e539cca4bfd9604e78/"
  },
];

const Meditations = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentMeditation, setCurrentMeditation] = useState<any>(null);
  const [meditationStartTime, setMeditationStartTime] = useState<Date | null>(null);
  const [showRating, setShowRating] = useState(false);

  // Default user ID for demo purposes
  const defaultUserId = 'user@zenmindmate.com';

  useEffect(() => {
    initializeUser();
  }, []);

  const initializeUser = async () => {
    try {
      setLoading(true);
      const userData = await userApi.getOrCreateUser(defaultUserId, 'Пользователь');
      setUser(userData);

    } catch (error) {
      console.error('Error initializing user:', error);
    } finally {
      setLoading(false);
    }
  };

  const startMeditation = (meditation: MeditationItem) => {
    setCurrentMeditation(meditation);
    setMeditationStartTime(new Date());
  };

  const completeMeditation = async (rating?: number, notes?: string) => {
    if (!currentMeditation || !meditationStartTime || !user) return;

    try {
      const duration = Math.floor((new Date().getTime() - meditationStartTime.getTime()) / (1000 * 60)); // in minutes

      await meditationApi.createMeditationSession(
        user.id,
        currentMeditation.title,
        duration,
        rating,
        notes
      );

      setCurrentMeditation(null);
      setMeditationStartTime(null);
      setShowRating(false);
    } catch (error) {
      console.error('Error completing meditation:', error);
    }
  };

  const stopMeditation = () => {
    setShowRating(true);
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
              >
                <div className="relative aspect-video overflow-hidden">
                  <img
                    src={meditation.thumbnail}
                    alt={meditation.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      onClick={() => startMeditation(meditation)}
                      className="w-16 h-16 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-strong"
                      size="icon"
                      disabled={loading}
                    >
                      <PlayCircle className="w-10 h-10 text-white" />
                    </Button>
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

          {/* Meditation Modal */}
          {currentMeditation && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <Card className="max-w-sm sm:max-w-md w-full bg-card p-4 sm:p-6">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-hero-gradient text-white flex items-center justify-center">
                    <PlayCircle className="w-8 h-8 " />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">{currentMeditation.title}</h3>
                  <p className="text-muted-foreground mb-6">{currentMeditation.description}</p>

                  {!showRating ? (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground mb-4">
                        Откройте видео медитации и наслаждайтесь процессом...
                      </p>

                      {/* Video Player */}
                      <div className="w-full aspect-video bg-black rounded-lg overflow-hidden mb-4">
                        {currentMeditation.videoUrl.includes('rutube.ru') ? (
                          <iframe
                            src={`https://rutube.ru/play/embed/${currentMeditation.videoUrl.split('/').pop()?.split('/')[0]}/`}
                            className="w-full h-full"
                            allowFullScreen
                            allow="autoplay; encrypted-media"
                            title={currentMeditation.title}
                          />
                        ) : (
                          <iframe
                            src={currentMeditation.videoUrl}
                            className="w-full h-full"
                            allowFullScreen
                            allow="autoplay; encrypted-media"
                            title={currentMeditation.title}
                          />
                        )}
                      </div>

                      {/* Alternative link for RuTube */}
                      {currentMeditation.videoUrl.includes('rutube.ru') && (
                        <div className="text-center">
                          <a
                            href={currentMeditation.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary/80 text-sm underline"
                          >
                            Открыть в RuTube →
                          </a>
                        </div>
                      )}

                      <Button
                        onClick={stopMeditation}
                        variant="outline"
                        className="w-full"
                      >
                        Завершить медитацию
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground mb-4">
                        Как вам понравилась медитация?
                      </p>
                      <div className="flex justify-center gap-2 mb-4">
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <Button
                            key={rating}
                            variant="outline"
                            size="sm"
                            onClick={() => completeMeditation(rating)}
                            className="w-10 h-10 p-0"
                          >
                            <Star className={`w-4 h-4 ${rating <= 3 ? 'text-gray-400' : 'text-yellow-500 fill-current'}`} />
                          </Button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => completeMeditation()}
                          variant="outline"
                          className="flex-1"
                        >
                          Пропустить
                        </Button>
                        <Button
                          onClick={() => completeMeditation(5)}
                          className="flex-1 bg-hero-gradient text-white hover:shadow-lg"
                        >
                          Отлично!
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Meditations;

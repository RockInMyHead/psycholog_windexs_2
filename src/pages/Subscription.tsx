import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Check, Crown, Star, Sparkles, MessageCircle, Phone, Lightbulb, PlayCircle, Heart, CreditCard, X, CheckCircle, AlertCircle, PartyPopper } from "lucide-react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { subscriptionApi } from "@/services/api";
import { paymentService, PaymentData } from "@/services/payment";

// Confetti component for celebration
const Confetti = ({ show }: { show: boolean }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {Array.from({ length: 50 }).map((_, i) => (
        <div
          key={i}
          className={`absolute w-2 h-2 rounded-full animate-bounce`}
          style={{
            left: `${Math.random() * 100}%`,
            top: `-10px`,
            backgroundColor: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b', '#eb4d4b', '#6c5ce7', '#a29bfe', '#fd79a8', '#e17055'][Math.floor(Math.random() * 10)],
            animationDelay: `${Math.random() * 3}s`,
            animationDuration: `${2 + Math.random() * 2}s`,
          }}
        />
      ))}
      {Array.from({ length: 30 }).map((_, i) => (
        <div
          key={`star-${i}`}
          className="absolute text-yellow-400 animate-spin"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            fontSize: `${12 + Math.random() * 12}px`,
            animationDelay: `${Math.random() * 2}s`,
            animationDuration: `${3 + Math.random() * 2}s`,
          }}
        >
          ⭐
        </div>
      ))}
    </div>
  );
};

const Subscription = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  // Payment states
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState<any>(null);
  const [audioAccess, setAudioAccess] = useState<any>(null);
  const [meditationAccess, setMeditationAccess] = useState<any>(null);
  const [activePlans, setActivePlans] = useState<string[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);

  // Check for payment result on page load
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    const paymentId = searchParams.get('payment_id');

    if (paymentStatus === 'success' && paymentId && user) {
      handlePaymentSuccess(paymentId, user.id);
    }

    // Load current subscription and access info
    if (user) {
      loadCurrentSubscription();
      loadAccessInfo();
    }
  }, [searchParams, user]);

  const loadCurrentSubscription = async () => {
    if (!user) return;

    try {
      const subscription = await subscriptionApi.getUserSubscription(user.id);
      setCurrentSubscription(subscription);
    } catch (error) {
      console.error('Error loading subscription:', error);
    }
  };

  const loadAccessInfo = async () => {
    if (!user) return;

    try {
      const [audioAccessResult, meditationAccessResult] = await Promise.all([
        subscriptionApi.checkAudioAccess(user.id),
        subscriptionApi.checkMeditationAccess(user.id)
      ]);

      setAudioAccess(audioAccessResult);
      setMeditationAccess(meditationAccessResult);

      // Определяем активные планы
      const plans: string[] = ['chat']; // Чат всегда доступен

      if (audioAccessResult?.hasAccess) {
        if (audioAccessResult.type === 'free_trial') {
          plans.push('free_trial');
        } else if (audioAccessResult.type === 'paid') {
          if (audioAccessResult.total === 1) {
            plans.push('single_session');
          } else if (audioAccessResult.total === 4) {
            plans.push('four_sessions');
          }
        }
      }

      if (meditationAccessResult?.hasAccess) {
        plans.push('meditation_monthly');
      }

      setActivePlans(plans);
    } catch (error) {
      console.error('Error loading access info:', error);
    }
  };

  const handlePaymentSuccess = async (paymentId: string, userId: string) => {
    try {
      setPaymentProcessing(true);

      // Process payment and create subscription
      const success = await paymentService.processPaymentSuccess(paymentId, userId);

      if (success) {
        // Подписка создается автоматически в API при проверке платежа
        setPaymentSuccess(true);
        setShowConfetti(true);
        await loadCurrentSubscription();
        await loadAccessInfo();

        // Hide confetti after 5 seconds
        setTimeout(() => setShowConfetti(false), 5000);
      } else {
        setPaymentError('Не удалось обработать платеж');
      }
    } catch (error) {
      console.error('Payment processing error:', error);
      setPaymentError('Произошла ошибка при обработке платежа');
    } finally {
      setPaymentProcessing(false);
    }
  };

  const handleSubscribe = (planId: string) => {
    if (!user) return;

    // Определяем стоимость плана
    const planPrices = {
      single_session: 1,
      four_sessions: 1,
      meditation_monthly: 1,
    };

    const amount = planPrices[planId as keyof typeof planPrices] || 0;

    if (amount === 0) {
      setPaymentError('Неизвестный план подписки');
      return;
    }

    // Создаем платеж
    const paymentData = {
      amount,
      currency: 'RUB',
      description: getPlanDescription(planId),
      userId: user.id,
      userEmail: user.email,
      plan: planId as 'single_session' | 'four_sessions' | 'meditation_monthly',
    };

    setPaymentError(null);

    // Начинаем процесс оплаты
    handlePaymentProcess(planId, paymentData);
  };

  const getPlanDescription = (planId: string): string => {
    const descriptions = {
      single_session: '1 аудио сессия с психологом Марком',
      four_sessions: '4 аудио сессии с психологом Марком',
      meditation_monthly: 'Медитации - подписка на месяц',
    };
    return descriptions[planId as keyof typeof descriptions] || 'Подписка на психологическую поддержку';
  };

  const handlePaymentProcess = async (planId: string, paymentData: any) => {
    try {
      setPaymentProcessing(true);
      setPaymentError(null);
      setShowPaymentDialog(true);

      const response = await paymentService.createPayment(paymentData);

      if (response.confirmation?.confirmation_url) {
        // Перенаправляем на ЮKassa
        window.location.href = response.confirmation.confirmation_url;
      } else {
        setPaymentError('Не удалось получить ссылку на оплату');
        setPaymentProcessing(false);
      }
    } catch (error: any) {
      console.error('Payment creation error:', error);
      setPaymentError(error.message || 'Ошибка при создании платежа');
      setPaymentProcessing(false);
    }
  };

  const pricingPlans = [
    {
      id: 'chat',
      name: 'Чат с психологом',
      price: 0,
      period: '',
      description: 'Безлимитный чат с AI-психологом Марком',
      features: [
        { icon: MessageCircle, text: "Безлимитный чат с AI-психологом" },
        { icon: Lightbulb, text: "Доступ к мудрым фразам" },
        { icon: Heart, text: "Поддержка в трудные моменты" },
      ],
      buttonText: 'Бесплатно',
      buttonVariant: 'outline' as const,
      popular: false,
    },
    {
      id: 'single_session',
      name: '1 аудио сессия',
      price: 1,
      period: 'разово',
      description: 'Одна 30-минутная аудио сессия с психологом',
      features: [
        { icon: Phone, text: "30-минутная аудио сессия" },
        { icon: MessageCircle, text: "Безлимитный чат включен" },
        { icon: Lightbulb, text: "Персонализированные рекомендации" },
        { icon: Heart, text: "Полная поддержка психолога" },
      ],
      buttonText: 'Купить за 1 ₽',
      buttonVariant: 'default' as const,
      popular: false,
    },
    {
      id: 'four_sessions',
      name: '4 аудио сессии',
      price: 1,
      period: 'пакет',
      description: 'Четыре 30-минутные сессии с экономией 10%',
      features: [
        { icon: Phone, text: "4 аудио сессии по 30 минут" },
        { icon: MessageCircle, text: "Безлимитный чат включен" },
        { icon: Lightbulb, text: "Расширенная коллекция мудрых фраз" },
        { icon: Heart, text: "Глубокая проработка тем" },
        { icon: Star, text: "Экономия 100 ₽" },
      ],
      buttonText: 'Купить за 1 ₽',
      buttonVariant: 'default' as const,
      popular: true,
    },
    {
      id: 'meditation_monthly',
      name: 'Медитации',
      price: 1,
      period: 'в месяц',
      description: 'Полный доступ к библиотеке медитаций',
      features: [
        { icon: PlayCircle, text: "Полная библиотека медитаций" },
        { icon: MessageCircle, text: "Безлимитный чат включен" },
        { icon: Lightbulb, text: "Медитации для разных ситуаций" },
        { icon: Heart, text: "Улучшение благополучия" },
        { icon: Sparkles, text: "Новые медитации ежемесячно" },
      ],
      buttonText: 'Купить за 1 ₽/мес',
      buttonVariant: 'default' as const,
      popular: false,
    },
  ];

  return (
    <div className="min-h-screen bg-calm-gradient">
      <Confetti show={showConfetti} />
      <Navigation />

      <div className="pt-24 pb-12 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-12 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white mb-4">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">Тарифы</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-3">
              Выберите свой путь
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Начните с бесплатного чата или выберите удобный тариф для глубокого сопровождения
            </p>
            {user && audioAccess && (
              <div className="mt-4 space-y-3 max-w-md mx-auto">
                {/* Информация о бесплатных сессиях для новых пользователей */}
                {audioAccess.type === 'free_trial' && audioAccess.remaining > 0 && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <p className="text-green-700 dark:text-green-300 text-sm">
                      🎁 <strong>Бесплатные сессии:</strong> {audioAccess.remaining} из 3 доступно
                    </p>
                  </div>
                )}

                {/* Информация о платных сессиях */}
                {audioAccess.type === 'paid' && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-blue-700 dark:text-blue-300 text-sm">
                      🎧 <strong>Аудио сессии:</strong> {audioAccess.remaining} доступно
                    </p>
                  </div>
                )}

                {/* Информация об отсутствии доступа */}
                {!audioAccess.hasAccess && audioAccess.reason === 'no_subscription' && (
                  <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                    <p className="text-orange-700 dark:text-orange-300 text-sm">
                      ⚠️ <strong>Нет активных сессий:</strong> Оформите подписку для доступа к аудио звонкам
                    </p>
                  </div>
                )}

                {/* Информация о медитациях */}
                {meditationAccess && meditationAccess.hasAccess && (
                  <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                    <p className="text-purple-700 dark:text-purple-300 text-sm">
                      🧘 <strong>Медитации:</strong> Доступ открыт
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Активные подписки */}
            {activePlans.length > 0 && (
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 max-w-md mx-auto">
                <p className="text-blue-700 dark:text-blue-300 text-sm font-medium mb-2">
                  ✅ Ваши активные подписки:
                </p>
                <div className="flex flex-wrap gap-2">
                  {activePlans.map(planId => {
                    const planName = pricingPlans.find(p => p.id === planId)?.name || planId;
                    return (
                      <Badge key={planId} variant="secondary" className="text-xs">
                        {planName}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {pricingPlans.map((plan, index) => {
              const isPopular = plan.popular;
              const isFree = plan.price === 0;

              return (
                <Card
                  key={plan.id}
                  className={`relative p-6 animate-scale-in ${isPopular
                    ? 'bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-2 border-yellow-300 dark:border-yellow-600 shadow-strong ring-2 ring-yellow-400/20'
                    : isFree
                      ? 'bg-card border-2 border-border shadow-medium'
                      : 'bg-card border-2 border-border shadow-medium hover:shadow-strong transition-shadow'
                    }`}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-3 py-1">
                        <Star className="w-3 h-3 mr-1" />
                        Популярный
                      </Badge>
                    </div>
                  )}

                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold text-foreground mb-2">{plan.name}</h3>
                    <div className="mb-2">
                      {isFree ? (
                        <span className="text-3xl font-bold text-foreground">Бесплатно</span>
                      ) : (
                        <>
                          <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                          <span className="text-muted-foreground"> ₽</span>
                          {plan.period && (
                            <span className="text-sm text-muted-foreground">/{plan.period}</span>
                          )}
                        </>
                      )}
                    </div>
                    <p className="text-muted-foreground text-sm">{plan.description}</p>
                  </div>

                  <div className="space-y-3 mb-6">
                    {plan.features.map((feature, featureIndex) => {
                      const Icon = feature.icon;
                      return (
                        <div key={featureIndex} className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${isPopular ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-primary/10'
                            }`}>
                            <Icon className={`w-3 h-3 ${isPopular ? 'text-yellow-600 dark:text-yellow-400' : 'text-primary'
                              }`} />
                          </div>
                          <span className="text-foreground text-sm">{feature.text}</span>
                        </div>
                      );
                    })}
                  </div>

                  {activePlans.includes(plan.id) ? (
                    <Button variant="outline" className="w-full" disabled>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Активен
                    </Button>
                  ) : plan.id === 'chat' ? (
                    <Button variant={plan.buttonVariant} className="w-full" disabled>
                      <Check className="w-4 h-4 mr-2" />
                      {plan.buttonText}
                    </Button>
                  ) : (
                    <Button
                      variant={plan.buttonVariant}
                      className={`w-full ${isPopular
                        ? 'bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white'
                        : ''
                        }`}
                      onClick={() => handleSubscribe(plan.id)}
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      {plan.buttonText}
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>

          {/* Benefits Section */}
          <Card className="p-8 bg-card border-2 border-border shadow-soft animate-fade-in">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-foreground mb-4">
                Почему выбирают премиум?
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Премиум подписка дает вам полный доступ к персонализированной психологической поддержке
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="text-center p-6 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
                <Phone className="w-12 h-12 mx-auto mb-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Голосовые сессии
                </h3>
                <p className="text-muted-foreground">
                  4 персональные аудио сессии с AI-психологом Марком в месяц
                </p>
              </div>

              <div className="text-center p-6 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
                <Sparkles className="w-12 h-12 mx-auto mb-4 text-green-600 dark:text-green-400" />
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Персонализация
                </h3>
                <p className="text-muted-foreground">
                  Индивидуальные рекомендации и практики, адаптированные под вас
                </p>
              </div>

              <div className="text-center p-6 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
                <Star className="w-12 h-12 mx-auto mb-4 text-purple-600 dark:text-purple-400" />
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  Приоритетная поддержка
                </h3>
                <p className="text-muted-foreground">
                  Быстрые ответы и персональное сопровождение вашего прогресса
                </p>
              </div>
            </div>
          </Card>

          {/* FAQ Section */}
          <Card className="p-8 bg-card border-2 border-border shadow-soft animate-fade-in mt-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-foreground mb-4">
                Часто задаваемые вопросы
              </h2>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Могу ли я отменить подписку в любое время?
                </h3>
                <p className="text-muted-foreground">
                  Да, вы можете отменить подписку в любое время без штрафов. Доступ к премиум функциям будет сохранен до конца оплаченного периода.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Что произойдет с моими данными при отмене?
                </h3>
                <p className="text-muted-foreground">
                  Все ваши данные и история переписок остаются сохраненными. Вы сможете продолжить использовать бесплатный план.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Можно ли вернуть деньги?
                </h3>
                <p className="text-muted-foreground">
                  Если подписка не оправдала ваших ожиданий в течение первых 7 дней, мы вернем полную стоимость.
                </p>
              </div>
            </div>
          </Card>

          {/* Payment Dialog */}
          <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Оплата подписки
                </DialogTitle>
                <DialogDescription>
                  Вы будете перенаправлены на страницу оплаты ЮKassa
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {paymentError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm">{paymentError}</span>
                  </div>
                )}

                {paymentProcessing && (
                  <div className="flex flex-col items-center justify-center gap-4 p-8">
                    <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <div className="text-center">
                      <p className="font-medium text-foreground mb-1">Создание платежа...</p>
                      <p className="text-sm text-muted-foreground">
                        Пожалуйста, подождите. Вы будете перенаправлены на страницу оплаты.
                      </p>
                    </div>
                  </div>
                )}

                {!paymentProcessing && paymentError && (
                  <div className="flex gap-2 pt-4">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowPaymentDialog(false)}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Закрыть
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Success Dialog */}
          <Dialog open={paymentSuccess} onOpenChange={setPaymentSuccess}>
            <DialogContent className="sm:max-w-lg relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-green-400 via-blue-500 to-purple-600 opacity-10 rounded-lg" />

              <DialogHeader className="relative">
                <DialogTitle className="flex items-center gap-3 text-center justify-center text-2xl font-bold text-green-700 mb-2">
                  <PartyPopper className="w-8 h-8 text-yellow-500 animate-bounce" />
                  🎉 Ура! Поздравляем! 🎉
                  <PartyPopper className="w-8 h-8 text-yellow-500 animate-bounce" style={{ animationDelay: '0.2s' }} />
                </DialogTitle>
                <DialogDescription className="text-center text-lg">
                  Ваш платеж успешно обработан! Спасибо за доверие к Windexs-Психологу!
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 relative">
                <div className="text-center space-y-4">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-100 to-blue-100 rounded-full border-2 border-green-300">
                    <Crown className="w-5 h-5 text-yellow-600" />
                    <span className="font-bold text-green-700">Премиум подписка активирована!</span>
                  </div>

                  <div className="space-y-2">
                    <p className="text-lg font-medium text-gray-800">
                      ✨ Спасибо за вашу поддержку! ✨
                    </p>
                    <p className="text-gray-600 leading-relaxed">
                      Теперь у вас есть полный доступ ко всем возможностям нашего ИИ-психолога.
                      Начните свой путь к внутреннему благополучию прямо сейчас!
                    </p>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-green-50 via-blue-50 to-purple-50 p-4 rounded-xl border border-green-200">
                  <div className="text-center space-y-2">
                    <div className="flex justify-center gap-1 mb-2">
                      {['🎈', '🎊', '🎉', '✨', '🌟'].map((emoji, i) => (
                        <span key={i} className="text-2xl animate-bounce" style={{ animationDelay: `${i * 0.1}s` }}>
                          {emoji}
                        </span>
                      ))}
                    </div>
                    <p className="text-sm font-medium text-gray-700">
                      Наслаждайтесь персонализированной психологической поддержкой!
                    </p>
                  </div>
                </div>

                <Button
                  className="w-full bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 text-white font-bold py-3 text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
                  onClick={() => {
                    setPaymentSuccess(false);
                    setShowConfetti(false);
                  }}
                >
                  🚀 Начать пользоваться!
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
};

export default Subscription;

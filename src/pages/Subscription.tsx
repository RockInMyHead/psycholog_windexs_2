import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Check, Crown, Star, Sparkles, MessageCircle, Phone, Lightbulb, PlayCircle, Heart, CreditCard, X, CheckCircle, AlertCircle } from "lucide-react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { subscriptionApi } from "@/services/api";
import { paymentService, PaymentData } from "@/services/payment";

const Subscription = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  // Payment states
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState<any>(null);

  // Check for payment result on page load
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    const paymentId = searchParams.get('payment_id');

    if (paymentStatus === 'success' && paymentId && user) {
      handlePaymentSuccess(paymentId, user.id);
    }

    // Load current subscription
    if (user) {
      loadCurrentSubscription();
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

  const handlePaymentSuccess = async (paymentId: string, userId: string) => {
    try {
      setPaymentProcessing(true);

      // Process payment and create subscription
      const success = await paymentService.processPaymentSuccess(paymentId, userId);

      if (success) {
        // Create premium subscription
        await subscriptionApi.createSubscription(userId, 'premium', paymentId);
        setPaymentSuccess(true);
        await loadCurrentSubscription();
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

  const handleSubscribe = () => {
    setShowPaymentDialog(true);
    setPaymentError(null);
  };

  const handleTestPayment = async (action: string) => {
    if (!user) return;

    try {
      setPaymentProcessing(true);
      setPaymentError(null);

      const result = await paymentService.simulatePayment(action, user.id);

      if (result.success && result.paymentId) {
        await handlePaymentSuccess(result.paymentId, user.id);
      } else {
        setPaymentError('Платеж был отменен');
      }
    } catch (error) {
      console.error('Test payment error:', error);
      setPaymentError('Ошибка тестовой оплаты');
    } finally {
      setPaymentProcessing(false);
    }
  };

  const features = {
    free: [
      { icon: MessageCircle, text: "Безлимитный чат с AI-психологом" },
      { icon: Lightbulb, text: "Доступ к мудрым фразам" },
      { icon: PlayCircle, text: "Базовые медитации" },
    ],
    premium: [
      { icon: MessageCircle, text: "Безлимитный чат с AI-психологом" },
      { icon: Phone, text: "4 аудио сессии в месяц" },
      { icon: Lightbulb, text: "Расширенная коллекция мудрых фраз" },
      { icon: PlayCircle, text: "Полная библиотека медитаций" },
      { icon: Heart, text: "Персонализированные рекомендации" },
      { icon: Star, text: "Приоритетная поддержка" },
      { icon: Sparkles, text: "Эксклюзивный контент" },
    ]
  };

  return (
    <div className="min-h-screen bg-calm-gradient">
      <Navigation />

      <div className="pt-24 pb-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white mb-4">
              <Crown className="w-4 h-4" />
              <span className="text-sm font-medium">Премиум</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-3">
              Разблокируйте свой потенциал
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Получите полный доступ ко всем возможностям психологической поддержки с персональным сопровождением
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            {/* Free Plan */}
            <Card className="p-8 bg-card border-2 border-border shadow-medium animate-scale-in">
              <div className="text-center mb-6">
                <Badge variant="outline" className="mb-4">
                  Бесплатный план
                </Badge>
                <h2 className="text-3xl font-bold text-foreground mb-2">Бесплатно</h2>
                <p className="text-muted-foreground">Начните свой путь к благополучию</p>
              </div>

              <div className="space-y-4 mb-8">
                {features.free.map((feature, index) => {
                  const Icon = feature.icon;
                  return (
                    <div key={index} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <span className="text-foreground">{feature.text}</span>
                    </div>
                  );
                })}
              </div>

              <Button variant="outline" className="w-full" disabled>
                <Check className="w-4 h-4 mr-2" />
                Текущий план
              </Button>
            </Card>

            {/* Premium Plan */}
            <Card className="p-8 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-2 border-yellow-300 dark:border-yellow-600 shadow-strong animate-scale-in" style={{ animationDelay: "200ms" }}>
              <div className="text-center mb-6">
                <Badge className="mb-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-white">
                  <Crown className="w-3 h-3 mr-1" />
                  Премиум план
                </Badge>
                <div className="mb-2">
                  <span className="text-4xl font-bold text-foreground">799</span>
                  <span className="text-muted-foreground"> ₽/мес</span>
                </div>
                <p className="text-muted-foreground">Полный доступ ко всем возможностям</p>
              </div>

              <div className="space-y-4 mb-8">
                {features.premium.map((feature, index) => {
                  const Icon = feature.icon;
                  return (
                    <div key={index} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                      </div>
                      <span className="text-foreground font-medium">{feature.text}</span>
                    </div>
                  );
                })}
              </div>

              {currentSubscription?.plan === 'premium' && currentSubscription?.status === 'active' ? (
                <Button variant="outline" className="w-full" disabled>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Премиум активен
                </Button>
              ) : (
                <Button
                  className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white hover:from-yellow-500 hover:to-orange-600 shadow-lg"
                  onClick={handleSubscribe}
                >
                  <Crown className="w-4 h-4 mr-2" />
                  Оформить подписку
                </Button>
              )}

              <p className="text-xs text-muted-foreground text-center mt-4">
                Отмена в любое время • Без скрытых платежей
              </p>
            </Card>
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
                  Выберите способ оплаты для премиум подписки за 799 ₽/мес
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {paymentError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm">{paymentError}</span>
                  </div>
                )}

                <div className="space-y-3">
                  {paymentService.getTestPaymentMethods().map((method, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      className="w-full justify-start gap-3 h-auto p-4 hover:bg-primary/5"
                      onClick={() => handleTestPayment(method.action)}
                      disabled={paymentProcessing}
                    >
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                        <CreditCard className="w-5 h-5 text-white" />
                      </div>
                      <div className="text-left">
                        <div className="font-medium">{method.name}</div>
                        <div className="text-sm text-muted-foreground">{method.description}</div>
                      </div>
                    </Button>
                  ))}
                </div>

                {paymentProcessing && (
                  <div className="flex items-center justify-center gap-2 p-4 bg-blue-50 rounded-lg">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm text-blue-700">Обработка платежа...</span>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowPaymentDialog(false)}
                    disabled={paymentProcessing}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Отмена
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Success Dialog */}
          <Dialog open={paymentSuccess} onOpenChange={setPaymentSuccess}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-green-700">
                  <CheckCircle className="w-5 h-5" />
                  Платеж успешно обработан!
                </DialogTitle>
                <DialogDescription>
                  Ваша премиум подписка активирована. Наслаждайтесь всеми преимуществами!
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700 mb-2">
                    <Crown className="w-4 h-4" />
                    <span className="font-medium">Премиум подписка активна</span>
                  </div>
                  <p className="text-sm text-green-600">
                    Спасибо за подписку! Теперь у вас есть доступ ко всем премиум функциям.
                  </p>
                </div>

                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={() => setPaymentSuccess(false)}
                >
                  Отлично!
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

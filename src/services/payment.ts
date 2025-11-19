// Yookassa Payment Integration Service
// Test credentials for development

interface YookassaConfig {
  shopId: string;
  secretKey: string;
  returnUrl: string;
  testMode: boolean;
}

const YOOKASSA_CONFIG: YookassaConfig = {
  shopId: '1183996', // Real shop ID
  secretKey: 'live_OTmJmdMHX6ysyUcUpBz5kt-dmSq1pT-Y5gLgmpT1jXg', // Real secret key
  returnUrl: `${window.location.origin}/subscription?payment=success`,
  testMode: false,
};

export interface PaymentData {
  amount: number;
  currency: string;
  description: string;
  userId: string;
  userEmail: string;
  plan: 'single_session' | 'four_sessions' | 'meditation_monthly';
}

export interface YookassaPaymentResponse {
  id: string;
  status: 'pending' | 'succeeded' | 'canceled';
  confirmation: {
    type: 'redirect';
    confirmation_url: string;
  };
}

class PaymentService {
  private config: YookassaConfig;

  constructor() {
    this.config = YOOKASSA_CONFIG;
  }

  async createPayment(paymentData: PaymentData): Promise<YookassaPaymentResponse> {
    try {
      // Очищаем старые данные из localStorage перед созданием нового платежа
      localStorage.removeItem('pending_payment_id');
      localStorage.removeItem('pending_payment_user');
      localStorage.removeItem('pending_payment_plan');

      // Create payment request for Yookassa API
      const yookassaPayload = {
        amount: {
          value: paymentData.amount.toFixed(2),
          currency: paymentData.currency,
        },
        capture: true,
        confirmation: {
          type: 'redirect',
          return_url: this.config.returnUrl,
        },
        description: paymentData.description,
        metadata: {
          userId: paymentData.userId,
          plan: paymentData.plan,
        },
        receipt: {
          customer: {
            email: paymentData.userEmail,
          },
          items: [
            {
              description: paymentData.description,
              quantity: 1,
              amount: {
                value: paymentData.amount.toFixed(2),
                currency: paymentData.currency,
              },
              vat_code: 1, // НДС 20%
              payment_subject: 'service', // Обязательное поле для Yookassa
              payment_mode: 'full_payment', // Обязательное поле для Yookassa
            },
          ],
        },
      };

      // In production, this would make a real API call to Yookassa
      // For now, we'll use the proxy through our server
      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...yookassaPayload,
          shopId: this.config.shopId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Payment creation failed: ${response.status}`);
      }

      const paymentResponse = await response.json();

      console.log('Yookassa payment created:', paymentResponse);

      // Сохраняем paymentId в localStorage перед редиректом
      if (paymentResponse.id) {
        localStorage.setItem('pending_payment_id', paymentResponse.id);
        localStorage.setItem('pending_payment_user', paymentData.userId);
        localStorage.setItem('pending_payment_plan', paymentData.plan);
        console.log('[Payment] Saved payment info to localStorage:', {
          paymentId: paymentResponse.id,
          userId: paymentData.userId,
          plan: paymentData.plan
        });
      }

      return paymentResponse;
    } catch (error) {
      console.error('Payment creation error:', error);
      throw new Error('Не удалось создать платеж');
    }
  }

  async processPaymentSuccess(paymentId: string, userId: string): Promise<boolean> {
    try {
      // Verify payment with Yookassa API through our server
      const response = await fetch(`/api/payments/verify/${paymentId}`, {
        method: 'GET',
      });

      if (!response.ok) {
        console.error('Payment verification failed');
        return false;
      }

      const paymentData = await response.json();

      if (paymentData.status !== 'succeeded') {
        console.error('Payment not succeeded:', paymentData.status);
        return false;
      }

      console.log('Payment verified successfully:', { paymentId, userId, plan: paymentData.metadata?.plan });

      return true;
    } catch (error) {
      console.error('Payment processing error:', error);
      return false;
    }
  }

  getPaymentUrl(paymentId: string): string {
    // In test mode, redirect to success page immediately
    return `${this.config.returnUrl}&payment_id=${paymentId}&status=success`;
  }

  // Test payment methods for demo
  getTestPaymentMethods() {
    return [
      {
        name: 'Тестовая карта',
        description: 'Номер: 5555 5555 5555 4444, CVC: 123, Срок: 12/30',
        action: 'test_card',
      },
      {
        name: 'Мгновенная оплата',
        description: 'Симуляция успешного платежа',
        action: 'instant_success',
      },
      {
        name: 'Тест отмены',
        description: 'Симуляция отмены платежа',
        action: 'test_cancel',
      },
    ];
  }

  async simulatePayment(action: string, userId: string): Promise<{ success: boolean; paymentId?: string }> {
    const paymentId = `payment_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    switch (action) {
      case 'instant_success':
        console.log('Simulating instant payment success');
        return { success: true, paymentId };

      case 'test_cancel':
        console.log('Simulating payment cancellation');
        return { success: false };

      case 'test_card':
      default:
        console.log('Simulating bank card payment');
        return { success: true, paymentId };
    }
  }
}

export const paymentService = new PaymentService();

# Настройка Webhook для ЮKassa

## Проблема
После успешной оплаты на ЮKassa:
- Сессии не добавляются к аккаунту пользователя
- Модальное окно успеха не появляется
- Подписка не обновляется

## Решение
Настроить webhook в личном кабинете ЮKassa для автоматической обработки платежей.

## Шаги настройки

### 1. Войдите в личный кабинет ЮKassa
- URL: https://yookassa.ru/my
- Войдите с учетными данными магазина (Shop ID: 1183996)

### 2. Перейдите в настройки уведомлений
- Меню: **Настройки** → **Уведомления**
- Или прямая ссылка: https://yookassa.ru/my/merchant/integration/http-notifications

### 3. Добавьте URL для HTTP-уведомлений
**Production URL:**
```
https://psycholog.windexs.ru/api/payments/webhook
```

**Development URL (для тестирования):**
```
https://psycholog.windexs.ru/api/payments/webhook
```

### 4. Выберите события для уведомлений
Отметьте следующие события:
- ✅ **payment.succeeded** - платеж успешно завершен
- ✅ **payment.canceled** - платеж отменен (опционально)

### 5. Сохраните настройки

## Как это работает

### Текущий flow (с webhook):

1. **Пользователь нажимает "Купить"**
   - Frontend сохраняет `paymentId` в `localStorage`
   - Редирект на страницу оплаты ЮKassa

2. **Пользователь оплачивает на ЮKassa**
   - ЮKassa обрабатывает платеж
   - ЮKassa отправляет webhook на наш сервер

3. **Сервер получает webhook**
   - Endpoint: `POST /api/payments/webhook`
   - Проверяет событие `payment.succeeded`
   - Создает/обновляет подписку пользователя
   - Добавляет сессии к аккаунту

4. **Пользователь возвращается на сайт**
   - URL: `/subscription?payment=success`
   - Frontend проверяет `pending_payment_id` из `localStorage`
   - Загружает обновленную подписку
   - Показывает модальное окно успеха с конфетти 🎉

### Резервный механизм (без webhook):

Если webhook не настроен или не сработал:
- Frontend проверяет `pending_payment_id` при возврате
- Вызывает `GET /api/payments/verify/:paymentId`
- Сервер проверяет статус платежа в ЮKassa API
- Создает подписку если платеж успешен

## Логирование

### Backend логи (server/server.log):
```
[WEBHOOK] Received notification from Yookassa: {...}
[WEBHOOK] Payment succeeded: 2d5a1234-5678-90ab-cdef-1234567890ab
[WEBHOOK] Creating subscription for user: user_xyz123
[WEBHOOK] Subscription created with ID: sub_abc456
```

### Frontend логи (Browser Console):
```
[Payment] Saved payment info to localStorage: {paymentId, userId, plan}
[Payment] Page loaded with params: {paymentStatus: 'success', pendingPaymentId: '...'}
[Payment] Found pending payment, verifying: 2d5a1234-5678-90ab-cdef-1234567890ab
[Payment] Payment verified successfully
```

## Тестирование

### 1. Проверка webhook endpoint:
```bash
curl -X POST https://psycholog.windexs.ru/api/payments/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "payment.succeeded",
    "object": {
      "id": "test-payment-123",
      "status": "succeeded",
      "metadata": {
        "userId": "user_test123",
        "plan": "single_session"
      }
    }
  }'
```

### 2. Проверка verify endpoint:
```bash
curl https://psycholog.windexs.ru/api/payments/verify/REAL_PAYMENT_ID
```

### 3. Проверка подписки пользователя:
```bash
curl https://psycholog.windexs.ru/api/users/USER_ID/subscription
curl https://psycholog.windexs.ru/api/users/USER_ID/audio-access
```

## Troubleshooting

### Проблема: Webhook не приходит
**Решение:**
1. Проверьте URL webhook в настройках ЮKassa
2. Убедитесь, что сервер доступен извне (для production)
3. Проверьте логи сервера на наличие ошибок

### Проблема: Сессии не добавляются
**Решение:**
1. Проверьте логи webhook: `tail -f server/server.log`
2. Убедитесь, что metadata содержит `userId` и `plan`
3. Проверьте базу данных: `sqlite3 zen-mind-mate.db "SELECT * FROM subscriptions WHERE user_id = 'USER_ID';"`

### Проблема: Модальное окно не появляется
**Решение:**
1. Проверьте Browser Console на наличие ошибок
2. Убедитесь, что `pending_payment_id` сохранен в localStorage
3. Проверьте, что URL содержит `?payment=success`

## Важные замечания

1. **Webhook URL должен быть HTTPS** для production (ЮKassa требует)
2. **Webhook должен отвечать быстро** (< 10 секунд), иначе ЮKassa повторит запрос
3. **Всегда возвращайте 200 OK** из webhook, даже при ошибках (чтобы избежать повторных попыток)
4. **Проверяйте идемпотентность** - webhook может прийти несколько раз для одного платежа

## Дополнительная информация

- [Документация ЮKassa по webhook](https://yookassa.ru/developers/using-api/webhooks)
- [Формат уведомлений](https://yookassa.ru/developers/api#webhook)
- [Безопасность webhook](https://yookassa.ru/developers/using-api/webhooks#security)


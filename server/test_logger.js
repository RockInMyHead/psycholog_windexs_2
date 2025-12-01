// Тестовый файл для проверки системы логирования
const logger = require('./logger');

// Тестируем различные уровни логирования
console.log('=== Тестирование системы логирования ===\n');

logger.info('TEST', 'Тест информационного сообщения');
logger.warn('TEST', 'Тест предупреждения');
logger.error('TEST', 'Тест ошибки', { error: 'Тестовая ошибка' });
logger.debug('TEST', 'Тест отладочного сообщения', { data: { key: 'value' } });

// Тестируем специализированные функции
logger.user.created('test_user_123', 'test@example.com');
logger.user.notFound('nonexistent@example.com');

logger.subscription.created('test_user_123', 'premium', 'sub_test_123');

logger.payment.created('payment_test_123', 1000, 'test_user_123');

logger.api.request('GET', '/api/test', 'test_user_123');

console.log('\n=== Тест завершен ===');

// Создадим тестовую ошибку, чтобы проверить запись в файл
setTimeout(() => {
  logger.error('TEST', 'Тестовая ошибка для записи в файл', new Error('Test error for file logging'));
  console.log('Ошибка записана в файл (если LOG_LEVEL=ERROR или выше)');
}, 100);

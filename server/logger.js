const fs = require('fs');
const path = require('path');

// Уровни логирования
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

// Текущий уровень логирования (можно менять через переменную окружения)
const CURRENT_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL || 'INFO'];

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  gray: '\x1b[90m'
};

// Функция для форматирования времени
function formatTimestamp() {
  const now = new Date();
  return now.toISOString().replace('T', ' ').slice(0, -5); // YYYY-MM-DD HH:mm:ss
}

// Функция для форматирования сообщения
function formatMessage(level, context, message, data = null) {
  const timestamp = formatTimestamp();
  const levelStr = level.toUpperCase().padEnd(5);
  const contextStr = context ? `[${context}]` : '';

  let formatted = `${colors.gray}${timestamp}${colors.reset} ${levelStr} ${contextStr} ${message}`;

  if (data && CURRENT_LEVEL >= LOG_LEVELS.DEBUG) {
    formatted += `\n${colors.gray}${JSON.stringify(data, null, 2)}${colors.reset}`;
  }

  return formatted;
}

// Основная функция логирования
function log(level, context, message, data = null) {
  if (LOG_LEVELS[level.toUpperCase()] > CURRENT_LEVEL) {
    return;
  }

  let color = colors.reset;
  switch (level.toUpperCase()) {
    case 'ERROR':
      color = colors.red;
      break;
    case 'WARN':
      color = colors.yellow;
      break;
    case 'INFO':
      color = colors.green;
      break;
    case 'DEBUG':
      color = colors.blue;
      break;
  }

  const formatted = formatMessage(level, context, message, data);
  console.log(`${color}${formatted}${colors.reset}`);

  // Для ошибок также пишем в файл
  if (level === 'error') {
    writeToFile('ERROR', context, message, data);
  }
}

// Функция для записи ошибок в файл
function writeToFile(level, context, message, data) {
  try {
    const logDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(logDir, `error-${today}.log`);

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      data: data || null
    };

    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
  } catch (error) {
    // Если не можем записать в файл, просто выводим в консоль
    console.error('Failed to write to log file:', error.message);
  }
}

// Экспортируем функции логирования
const logger = {
  error: (context, message, data) => log('error', context, message, data),
  warn: (context, message, data) => log('warn', context, message, data),
  info: (context, message, data) => log('info', context, message, data),
  debug: (context, message, data) => log('debug', context, message, data),

  // Специализированные функции для разных типов операций
  user: {
    created: (userId, email) => log('info', 'USER', `Пользователь создан: ${email} (${userId})`),
    found: (userId, email) => log('debug', 'USER', `Пользователь найден: ${email} (${userId})`),
    notFound: (email) => log('debug', 'USER', `Пользователь не найден: ${email}`),
    error: (operation, error, userId = null) => log('error', 'USER', `Ошибка ${operation}${userId ? ` для пользователя ${userId}` : ''}`, { error: error.message })
  },

  subscription: {
    created: (userId, plan, subscriptionId) => log('info', 'SUBSCRIPTION', `Подписка создана: ${plan} для ${userId} (${subscriptionId})`),
    updated: (userId, changes) => log('info', 'SUBSCRIPTION', `Подписка обновлена для ${userId}`, changes),
    error: (operation, error, userId = null) => log('error', 'SUBSCRIPTION', `Ошибка ${operation}${userId ? ` для пользователя ${userId}` : ''}`, { error: error.message })
  },

  audio: {
    callStarted: (userId, callId) => log('info', 'AUDIO', `Звонок начат: ${userId} (${callId})`),
    callEnded: (callId, duration) => log('info', 'AUDIO', `Звонок завершен: ${callId} (${duration} сек)`),
    sessionUsed: (userId, remaining) => log('info', 'AUDIO', `Сессия использована: ${userId}, осталось ${remaining}`),
    error: (operation, error, callId = null) => log('error', 'AUDIO', `Ошибка ${operation}${callId ? ` звонка ${callId}` : ''}`, { error: error.message })
  },

  payment: {
    created: (paymentId, amount, userId) => log('info', 'PAYMENT', `Платеж создан: ${paymentId}, ${amount} руб, пользователь ${userId}`),
    succeeded: (paymentId, userId) => log('info', 'PAYMENT', `Платеж успешен: ${paymentId}, пользователь ${userId}`),
    failed: (paymentId, error) => log('error', 'PAYMENT', `Платеж неудачен: ${paymentId}`, { error }),
    error: (operation, error, paymentId = null) => log('error', 'PAYMENT', `Ошибка ${operation}${paymentId ? ` платежа ${paymentId}` : ''}`, { error: error.message })
  },

  api: {
    request: (method, url, userId = null) => log('debug', 'API', `${method} ${url}${userId ? ` (user: ${userId})` : ''}`),
    error: (method, url, status, error, userId = null) => log('error', 'API', `${method} ${url} -> ${status}${userId ? ` (user: ${userId})` : ''}`, { error: error.message })
  },

  openai: {
    request: (type, tokens = null) => log('debug', 'OPENAI', `Запрос ${type}${tokens ? ` (${tokens} токенов)` : ''}`),
    error: (type, error) => log('error', 'OPENAI', `Ошибка ${type}`, { error: error.message })
  },

  db: {
    error: (operation, error, table = null) => log('error', 'DB', `Ошибка ${operation}${table ? ` в таблице ${table}` : ''}`, { error: error.message }),
    // Не логируем успешные операции БД, чтобы не засорять логи
  },

  server: {
    started: (port, protocol = 'HTTP') => log('info', 'SERVER', `Сервер запущен на порту ${port} (${protocol})`),
    error: (error) => log('error', 'SERVER', 'Ошибка сервера', { error: error.message })
  }
};

module.exports = logger;

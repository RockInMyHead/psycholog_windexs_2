// Тест записи ошибок в файл
const logger = require('./logger');

console.log('Тестируем запись ошибки в файл...');
logger.error('TEST', 'Тестовая ошибка для проверки записи в файл', new Error('Test error'));
console.log('Тест завершен. Проверьте директорию logs/');

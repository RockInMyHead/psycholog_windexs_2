# Инструкция по развертыванию обновления системы памяти

## 📋 Обзор

Это обновление добавляет новую таблицу `conversation_history` и изменяет логику работы с памятью.

## 🚀 Шаги развертывания

### 1. Обновление кода на сервере

```bash
cd /path/to/psycholog
git pull origin main
```

### 2. Перезапуск сервера

**Вариант A: С помощью systemd (рекомендуется)**
```bash
sudo systemctl restart psycholog-api
sudo systemctl status psycholog-api
```

**Вариант B: Вручную**
```bash
# Остановить текущий процесс
pkill -f "node app.js"

# Запустить заново
cd server
node app.js
```

### 3. Проверка создания таблицы

```bash
sqlite3 zen-mind-mate.db "SELECT name FROM sqlite_master WHERE type='table';"
```

Должна появиться таблица `conversation_history`.

### 4. Проверка структуры таблицы

```bash
sqlite3 zen-mind-mate.db "PRAGMA table_info(conversation_history);"
```

Ожидаемые поля:
- id
- user_id
- session_id
- session_type
- user_message
- assistant_message
- timestamp
- created_at

### 5. Проверка API endpoints

```bash
# Проверка health
curl http://localhost:3002/health

# Проверка получения памяти (замените USER_ID на реальный)
curl http://localhost:3002/api/memory/USER_ID/audio
```

### 6. Проверка логов

```bash
tail -f server/server.log
```

Должны увидеть:
```
Database initialized successfully!
Server running on port 3002
```

## 🔍 Проверка работоспособности

### Тест 1: Создание записи

```bash
curl -X POST http://localhost:3002/api/memory/test_user/audio/append \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test_session_123",
    "userMessage": "Тестовое сообщение пользователя",
    "assistantMessage": "Тестовый ответ психолога"
  }'
```

### Тест 2: Получение истории

```bash
curl http://localhost:3002/api/memory/test_user/audio
```

### Тест 3: Проверка записи в БД

```bash
sqlite3 zen-mind-mate.db "SELECT * FROM conversation_history WHERE user_id='test_user';"
```

## ⚠️ Возможные проблемы

### Проблема 1: Таблица не создается

**Решение:**
```bash
# Создать таблицу вручную
sqlite3 zen-mind-mate.db < create_conversation_history.sql
```

Содержимое `create_conversation_history.sql`:
```sql
CREATE TABLE IF NOT EXISTS conversation_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id TEXT,
  session_type TEXT NOT NULL,
  user_message TEXT NOT NULL,
  assistant_message TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Проблема 2: API возвращает 500

**Проверить:**
1. Логи сервера: `tail -f server/server.log`
2. Права доступа к БД: `ls -la zen-mind-mate.db`
3. Версия Node.js: `node --version` (должна быть >= 18)

### Проблема 3: Frontend не подключается

**Проверить:**
1. Vite proxy настройки: `vite.config.ts`
2. CORS настройки в `server/app.js`
3. Порты: сервер должен быть на 3002

## 🧪 Тестирование

### Тест E2E (End-to-End)

1. Откройте приложение в браузере
2. Войдите в аккаунт
3. Начните чат с психологом
4. Отправьте сообщение "Привет"
5. Получите ответ от Марка
6. Проверьте БД:
```bash
sqlite3 zen-mind-mate.db "SELECT COUNT(*) FROM conversation_history;"
```

Должно быть >= 1 запись.

### Тест аудио звонка

1. Начните аудио звонок
2. Скажите что-то в микрофон
3. Дождитесь ответа (через 5 секунд)
4. Проверьте БД:
```bash
sqlite3 zen-mind-mate.db "SELECT * FROM conversation_history WHERE session_type='audio' ORDER BY timestamp DESC LIMIT 1;"
```

## 📊 Мониторинг

### Проверка размера БД

```bash
du -h zen-mind-mate.db
```

### Количество записей в истории

```bash
sqlite3 zen-mind-mate.db "SELECT COUNT(*) FROM conversation_history;"
```

### Последние 5 записей

```bash
sqlite3 zen-mind-mate.db "SELECT user_id, session_type, substr(user_message, 1, 50) as message FROM conversation_history ORDER BY timestamp DESC LIMIT 5;"
```

## 🔄 Откат (если нужно)

Если что-то пошло не так:

```bash
# Откатить git
git reset --hard c4e6d5c

# Удалить таблицу (опционально)
sqlite3 zen-mind-mate.db "DROP TABLE IF EXISTS conversation_history;"

# Перезапустить сервер
sudo systemctl restart psycholog-api
```

## ✅ Чеклист развертывания

- [ ] Код обновлен через git pull
- [ ] Сервер перезапущен
- [ ] Таблица conversation_history создана
- [ ] API endpoints работают
- [ ] Логи не показывают ошибок
- [ ] Тест создания записи прошел
- [ ] Тест получения истории прошел
- [ ] E2E тест с фронтендом прошел
- [ ] Мониторинг настроен

## 📞 Поддержка

Если возникли проблемы:
1. Проверьте логи: `tail -f server/server.log`
2. Проверьте БД: `sqlite3 zen-mind-mate.db ".tables"`
3. Проверьте процессы: `ps aux | grep node`

---

**Версия:** 1.1.0  
**Дата:** 18 ноября 2024  
**Требования:** Node.js >= 18, SQLite3


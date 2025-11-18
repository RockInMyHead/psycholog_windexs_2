# Система памяти и контекста психолога

## Обзор

Реализована полноценная система хранения истории диалогов в базе данных, которая позволяет психологу Марку помнить контекст между сессиями.

## Архитектура

### База данных

Создана таблица `conversation_history`:

```sql
CREATE TABLE conversation_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id TEXT,              -- ID сессии чата или аудио звонка
  session_type TEXT NOT NULL,   -- 'chat' или 'audio'
  user_message TEXT NOT NULL,
  assistant_message TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### API Endpoints

#### `GET /api/memory/:userId/:type`
Загружает историю диалогов из БД.

**Параметры:**
- `userId` - ID пользователя
- `type` - тип сессии: `chat` или `audio`

**Ответ:**
```json
{
  "memory": "Клиент: ...\nМарк: ...\n\n..."
}
```

#### `POST /api/memory/:userId/:type/append`
Сохраняет новую запись в историю.

**Параметры:**
- `userId` - ID пользователя
- `type` - тип сессии: `chat` или `audio`

**Тело запроса:**
```json
{
  "sessionId": "session_123",
  "userMessage": "Текст пользователя",
  "assistantMessage": "Ответ психолога"
}
```

**Ответ:**
```json
{
  "memory": "Обновленная история последних 10 записей"
}
```

#### `DELETE /api/memory/:userId/:type`
Удаляет всю историю пользователя определенного типа.

**Параметры:**
- `userId` - ID пользователя
- `type` - тип сессии: `chat` или `audio`

## Функциональность

### 1. Сохранение истории

Каждый диалог между пользователем и психологом сохраняется в БД с привязкой к:
- Пользователю (`user_id`)
- Сессии (`session_id`)
- Типу взаимодействия (`session_type`: chat/audio)

### 2. Загрузка контекста

При старте чата или аудио звонка:
1. Загружаются последние 10 записей истории из БД
2. История форматируется в текст для LLM
3. Контекст передается в системный промпт

### 3. Передача в LLM

История передается в OpenAI API в следующем формате:

```javascript
const conversation = [
  { role: 'system', content: systemPrompt },
  { role: 'system', content: `Контекст прошлых бесед: ${memoryContext}` },
  ...currentMessages
];
```

## Изменения в коде

### AudioCall.tsx

- **5-секундная задержка**: Увеличено время ожидания перед отправкой в LLM с 100мс до 5000мс
- **Сохранение в БД**: `updateConversationMemory()` теперь сохраняет каждую запись с `sessionId`
- **Загрузка истории**: История загружается при `initializeUser()`

```typescript
const updateConversationMemory = async (userText: string, assistantText: string) => {
  if (!user || !currentCallId) return;
  
  const updatedMemory = await memoryApi.appendMemory(
    user.id, 
    "audio", 
    currentCallId, 
    userText, 
    assistantText
  );
  memoryRef.current = updatedMemory;
};
```

### Chat.tsx

- **Сохранение в БД**: Аналогичные изменения для текстового чата
- **sessionId**: Используется ID текущей сессии чата

### services/api.ts

Обновлен `memoryApi` для работы с новыми endpoints:

```typescript
export const memoryApi = {
  async getMemory(userId: string, type: string): Promise<string>
  async appendMemory(userId: string, type: string, sessionId: string, userMessage: string, assistantMessage: string): Promise<string>
  async clearMemory(userId: string, type: string): Promise<void>
}
```

### server/database.js

Добавлен `conversationHistoryService`:

```javascript
const conversationHistoryService = {
  async addConversationEntry(userId, sessionId, sessionType, userMessage, assistantMessage)
  async getConversationHistory(userId, sessionType, limit = 20)
  async getFormattedHistory(userId, sessionType, limit = 10)
  async clearUserHistory(userId, sessionType)
}
```

## Преимущества

1. ✅ **Постоянная память**: История сохраняется между сессиями
2. ✅ **Контекстность**: Психолог помнит предыдущие разговоры
3. ✅ **Масштабируемость**: Легко расширяется для новых типов сессий
4. ✅ **5-секундная пауза**: Позволяет пользователю закончить мысль
5. ✅ **Раздельное хранение**: Отдельная история для чата и аудио

## Лимиты

- **Количество записей в контексте**: 10 последних диалогов
- **Тип хранения**: SQLite БД
- **Форматирование**: `Клиент: ...\nМарк: ...`

## Будущие улучшения

- [ ] Сжатие старой истории с помощью LLM
- [ ] Поиск по истории диалогов
- [ ] Экспорт истории для пользователя
- [ ] Аналитика по темам разговоров
- [ ] Умное определение релевантных записей (не только последние 10)


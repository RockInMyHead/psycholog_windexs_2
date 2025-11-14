# Настройка API для проекта Windexs-Психолог

## Текущая конфигурация

Приложение настроено для работы с API через домен **psycholog.windexs.ru**.

### Переменные окружения (.env)

```env
# OpenAI API Configuration
REACT_APP_OPENAI_API_KEY=ваш_ключ_openai

# Proxy Configuration
REACT_APP_PROXY_HOST=185.68.187.20
REACT_APP_PROXY_PORT=8000
REACT_APP_PROXY_USERNAME=rBD9e6
REACT_APP_PROXY_PASSWORD=jZdUnJ

# Server Configuration
PORT=3001

# API Configuration
REACT_APP_API_BASE_URL=https://psycholog.windexs.ru
```

## Режимы работы

### 1. Production режим (рекомендуемый)
```bash
npm run dev
```
- Все API запросы идут на https://psycholog.windexs.ru
- Frontend работает на localhost:8080

### 2. Development режим с локальным прокси
```bash
npm run dev:with-proxy
```
- Запускается локальный прокси-сервер на порту 3001
- API запросы проксируются через локальный сервер

## Настройка домена psycholog.windexs.ru

Для работы в production режиме необходимо:

1. **Развернуть API сервер** на домене psycholog.windexs.ru
2. **Установить переменную окружения** REACT_APP_API_BASE_URL=https://psycholog.windexs.ru
3. **Настроить CORS** на сервере для приема запросов от localhost:8080

### Пример настройки сервера на psycholog.windexs.ru

```javascript
// server/app.js
app.use(cors({
  origin: ['http://localhost:8080', 'https://psycholog.windexs.ru'],
  credentials: true
}));
```

## Проверка работы

Тестирование API:
```bash
curl http://localhost:8080/api/v1/models
```

Если возвращается 502 Bad Gateway - значит домен не настроен.
Если возвращается JSON с моделями OpenAI - значит все работает корректно.

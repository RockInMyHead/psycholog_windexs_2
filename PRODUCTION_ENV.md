# Production .env Configuration

На сервере создайте файл `/opt/psycholog-backend/.env` со следующим содержимым:

```env
# OpenAI API Configuration
# Получите ключ на https://platform.openai.com/api-keys
VITE_OPENAI_API_KEY=your_real_openai_api_key_here

# Server Configuration
PORT=1033
NODE_ENV=production

# Proxy Configuration (опционально, только если нужен для доступа к OpenAI)
USE_PROXY=false
PROXY_HOST=185.68.187.20
PROXY_PORT=8000
PROXY_USERNAME=rBD9e6
PROXY_PASSWORD=jZdUnJ
```

## Важные переменные:

- **VITE_OPENAI_API_KEY** - обязательна! Без неё API не будет работать
- **PORT** - порт для backend-сервера (должен быть 1033 по конфигу Nginx)
- **NODE_ENV** - ВСЕГДА должна быть `production` на сервере
- **USE_PROXY** - ставьте `true` только если нужен прокси для доступа к OpenAI

## Frontend автоматически:
- В production режиме использует `https://psycholog.windexs.ru/api`
- В dev режиме использует `https://psycholog.windexs.ru/api`

Переключение происходит автоматически в зависимости от `import.meta.env.DEV`.



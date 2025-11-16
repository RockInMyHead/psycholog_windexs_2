# 🚀 Инструкция по деплою на сервер

## Подготовка на локальной машине

### 1. Собрать production-версию фронтенда
```bash
npm run build
```
Это создаст оптимизированную папку `dist/` с готовым приложением.

### 2. Проверить сборку (опционально)
```bash
npm run preview
```
Откроет локальный сервер для тестирования prod-версии.

## Развертывание на сервере psycholog.windexs.ru

### Шаг 1: Загрузить файлы на сервер

**Вариант A: Через SFTP/SCP**
```bash
# Скопировать папку dist на сервер
scp -r dist/* user@psycholog.windexs.ru:/var/www/psycholog.windexs.ru/

# Скопировать backend-сервер
scp -r server/* user@psycholog.windexs.ru:/opt/psycholog-backend/
```

**Вариант B: Через Git** (если репозиторий на сервере)
```bash
git pull origin main
npm run build
```

### Шаг 2: Настроить Backend на сервере

На сервере в папке `/opt/psycholog-backend/`:

1. Создать `.env` файл:
```bash
cat > .env << 'EOF'
PORT=3002
NODE_ENV=production
VITE_OPENAI_API_KEY=your_real_openai_api_key_here

# Прокси (опционально)
USE_PROXY=false
PROXY_HOST=185.68.187.20
PROXY_PORT=8000
PROXY_USERNAME=rBD9e6
PROXY_PASSWORD=jZdUnJ
EOF
```

2. Установить зависимости:
```bash
npm install --production
```

3. Запустить сервер (используя PM2 или systemd):
```bash
# Вариант с PM2 (рекомендуется)
npm install -g pm2
pm2 start app.js --name "psycholog-api" --env production
pm2 save
pm2 startup

# Вариант с systemd (см. psycholog-api.service)
sudo systemctl start psycholog-api
sudo systemctl enable psycholog-api
```

### Шаг 3: Настроить Nginx

Убедитесь, что на сервере стоит Nginx и настроен как в README.md:

```nginx
server {
    listen 443 ssl http2;
    server_name psycholog.windexs.ru;

    ssl_certificate /etc/letsencrypt/live/psycholog.windexs.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/psycholog.windexs.ru/privkey.pem;

    # Фронтенд (статика)
    root /var/www/psycholog.windexs.ru;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API прокси к backend-серверу
    location /api {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}

# Редирект с http на https
server {
    listen 80;
    server_name psycholog.windexs.ru;
    return 301 https://$server_name$request_uri;
}
```

Перезагрузить Nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Шаг 4: Проверить развертывание

```bash
# Проверить backend
curl https://psycholog.windexs.ru/api/health

# Проверить frontend
curl https://psycholog.windexs.ru/
```

Должны получить ответы без ошибок.

## Обновление приложения

### На локальной машине:
```bash
git add .
git commit -m "Update psycholog"
git push origin main
```

### На сервере:
```bash
cd /var/www/psycholog.windexs.ru
git pull origin main
npm run build
# Статика обновится автоматически

# Если нужен перезапуск backend:
pm2 restart psycholog-api
# или
sudo systemctl restart psycholog-api
```

## Мониторинг

### Проверить логи backend:
```bash
# PM2
pm2 logs psycholog-api

# Systemd
sudo journalctl -u psycholog-api -f
```

### Проверить статус:
```bash
# PM2
pm2 status

# Systemd
sudo systemctl status psycholog-api
```

## Откат на предыдущую версию

```bash
# На сервере
git revert HEAD
npm run build

# Перезапустить backend если нужно
pm2 restart psycholog-api
```

## Troubleshooting

### Frontend не обновляется
- Очистить кэш браузера (Ctrl+Shift+Del)
- Проверить, что сборка произошла: `ls -la dist/`
- Проверить права доступа: `sudo chown -R www-data:www-data /var/www/psycholog.windexs.ru`

### Backend не отвечает
```bash
# Проверить, слушает ли порт
netstat -tlnp | grep 3002

# Перезапустить
pm2 restart psycholog-api

# Проверить логи
pm2 logs psycholog-api
```

### API ошибки
- Проверить `.env` на сервере (особенно `VITE_OPENAI_API_KEY`)
- Проверить Nginx конфиг: `sudo nginx -t`
- Проверить CORS в браузере

---

**Все готово!** Приложение полностью production-ready и простое в развертывании. 🚀




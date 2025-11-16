# ⚡ Быстрый старт деплоя на psycholog.windexs.ru

## За 5 минут до запуска в production

### На локальной машине:

#### 1. Собрать фронтенд
```bash
npm run build
```

#### 2. Запустить deploy-скрипт (если SSH настроен)
```bash
./deploy.sh
```

**Или вручную:**

#### Загрузить статику (dist/)
```bash
scp -r dist/* user@psycholog.windexs.ru:/var/www/psycholog.windexs.ru/
```

#### Загрузить backend (server/)
```bash
scp -r server/app.js server/package*.json user@psycholog.windexs.ru:/opt/psycholog-backend/
```

---

### На сервере (psycholog.windexs.ru):

#### 1. Перейти в папку backend
```bash
cd /opt/psycholog-backend
```

#### 2. Создать .env файл
```bash
cat > .env << 'EOF'
PORT=3002
NODE_ENV=production
VITE_OPENAI_API_KEY=your_real_api_key_here
USE_PROXY=false
EOF
```

#### 3. Установить зависимости
```bash
npm install --production
```

#### 4. Запустить backend (выбери один способ):

**Вариант A: PM2 (рекомендуется)**
```bash
npm install -g pm2
pm2 start app.js --name "psycholog-api" --env production
pm2 save
pm2 startup
```

**Вариант B: Systemd**
```bash
sudo cp psycholog-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl start psycholog-api
sudo systemctl enable psycholog-api
```

#### 5. Проверить, что всё работает
```bash
curl https://psycholog.windexs.ru/api/health
```

---

## Структура на сервере

```
/var/www/psycholog.windexs.ru/        <- Фронтенд (статика)
  ├── index.html
  ├── assets/
  └── ...

/opt/psycholog-backend/               <- Backend API
  ├── app.js
  ├── package.json
  ├── node_modules/
  └── .env
```

---

## После деплоя

✅ Frontend: https://psycholog.windexs.ru
✅ API: https://psycholog.windexs.ru/api/health
✅ Марк готов общаться! 🎙️

---

## Обновление приложения

```bash
# На локальной машине
npm run build
./deploy.sh

# На сервере
pm2 restart psycholog-api
# или
sudo systemctl restart psycholog-api
```

---

**Всё просто! Никаких сложностей. 🚀**




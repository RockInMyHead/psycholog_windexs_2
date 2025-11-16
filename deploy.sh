#!/bin/bash

# Скрипт для simple деплоя на psycholog.windexs.ru
# Использование: ./deploy.sh

set -e

echo "🚀 Психолог Windexs - Скрипт деплоя"
echo "======================================"

# Настройки
SERVER_USER="user"  # Замени на реального пользователя
SERVER_HOST="psycholog.windexs.ru"
FRONTEND_PATH="/var/www/psycholog.windexs.ru"
BACKEND_PATH="/opt/psycholog-backend"

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Проверка, что мы в правильной директории
if [ ! -f "package.json" ]; then
    echo -e "${RED}✗ Ошибка: запустите скрипт из корневой папки проекта${NC}"
    exit 1
fi

# Шаг 1: Собрать фронтенд
echo -e "${YELLOW}[1/4] Собираю фронтенд...${NC}"
npm run build
echo -e "${GREEN}✓ Фронтенд собран${NC}"

# Шаг 2: Загрузить статику на сервер
echo -e "${YELLOW}[2/4] Загружаю статику на сервер...${NC}"
scp -r dist/* $SERVER_USER@$SERVER_HOST:$FRONTEND_PATH/
echo -e "${GREEN}✓ Статика загружена${NC}"

# Шаг 3: Загрузить backend на сервер
echo -e "${YELLOW}[3/4] Загружаю backend на сервер...${NC}"
scp -r server/app.js $SERVER_USER@$SERVER_HOST:$BACKEND_PATH/
scp -r server/package.json $SERVER_USER@$SERVER_HOST:$BACKEND_PATH/
scp -r server/package-lock.json $SERVER_USER@$SERVER_HOST:$BACKEND_PATH/
echo -e "${GREEN}✓ Backend загружен${NC}"

# Шаг 4: Перезапустить backend (если используется PM2)
echo -e "${YELLOW}[4/4] Перезапускаю backend...${NC}"
ssh $SERVER_USER@$SERVER_HOST << 'EOF'
    cd /opt/psycholog-backend
    npm install --production 2>/dev/null || true
    pm2 restart psycholog-api || pm2 start app.js --name "psycholog-api"
    pm2 save
EOF
echo -e "${GREEN}✓ Backend перезапущен${NC}"

echo ""
echo -e "${GREEN}✅ Деплой завершён успешно!${NC}"
echo ""
echo "Проверьте:"
echo "  - Frontend: https://psycholog.windexs.ru"
echo "  - API: curl https://psycholog.windexs.ru/api/health"
echo ""

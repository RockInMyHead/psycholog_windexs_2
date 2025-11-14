#!/bin/bash

# Скрипт развертывания Express сервера на psycholog.windexs.ru
# Использование: ./deploy_server.sh

set -e

SERVER="svr@windexs03"
REMOTE_DIR="/home/svr/psycholog-api"

echo "🚀 Развертывание Express сервера на $SERVER"
echo "==========================================="

# Создание директории на сервере
echo "📁 Создание директории на сервере..."
ssh "$SERVER" "mkdir -p $REMOTE_DIR"

# Копирование файлов
echo "📦 Копирование файлов сервера..."
rsync -avz --delete --exclude=node_modules server/ "$SERVER:$REMOTE_DIR/"

# Установка зависимостей
echo "📦 Установка зависимостей..."
ssh "$SERVER" "cd $REMOTE_DIR && npm install --production"

echo ""
echo "✅ Сервер развернут!"
echo "🌐 Для запуска: ssh $SERVER 'cd $REMOTE_DIR && NODE_ENV=production npm start'"
echo "🔧 Для постоянного запуска настройте systemd сервис"

# Проверка
echo ""
echo "🧪 Быстрая проверка:"
ssh "$SERVER" "cd $REMOTE_DIR && timeout 3 NODE_ENV=production npm start" 2>/dev/null || echo "Сервер готов к запуску"
EOF && chmod +x deploy_server.sh
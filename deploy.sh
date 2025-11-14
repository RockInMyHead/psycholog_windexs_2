#!/bin/bash

# Скрипт развертывания production сборки на сервер psycholog.windexs.ru
# Использование: ./deploy.sh [user@server]

set -e

SERVER=${1:-"user@server"}
REMOTE_DIR="/var/www/html"

echo "🚀 Развертывание production сборки на $SERVER"
echo "==============================================="

# Сборка проекта если нужно
if [ ! -d "docs/deploy" ] || [ "docs/deploy" -ot "src" ]; then
    echo "🔨 Сборка production версии..."
    npm run build
    mkdir -p docs/deploy
    cp -r dist/* docs/deploy/
fi

echo "📦 Копирование файлов на сервер..."
rsync -avz --delete docs/deploy/ "$SERVER:$REMOTE_DIR/"

echo "🔧 Установка прав доступа..."
ssh "$SERVER" "sudo chown -R www-data:www-data $REMOTE_DIR/"

echo "🔄 Перезагрузка nginx..."
ssh "$SERVER" "sudo nginx -t && sudo systemctl reload nginx"

echo ""
echo "✅ Развертывание завершено!"
echo "🌐 Проверьте: https://psycholog.windexs.ru"

# Проверка результата
echo ""
echo "🧪 Проверка развертывания:"
if curl -s https://psycholog.windexs.ru/ | grep -q "@vite/client"; then
    echo "❌ На сервере все еще development версия!"
else
    echo "✅ Production сборка успешно развернута!"
fi
EOF && chmod +x deploy.sh
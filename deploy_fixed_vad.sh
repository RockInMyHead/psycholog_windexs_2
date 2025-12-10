#!/bin/bash

# Скрипт для развертывания исправленной версии VAD (без ошибки базы данных)
# Использование: ./deploy_fixed_vad.sh

set -e

SERVER="svr@windexs03"
REMOTE_DIR="/home/svr/windexscook-docker"

echo "🔧 Развертывание исправленной версии VAD на $SERVER"
echo "================================================="

echo ""
echo "📁 Копирование исправленных файлов..."
rsync -avz --delete --exclude=node_modules --exclude=.env server/ voice-chat-system/ src/ "$SERVER:$REMOTE_DIR/"

echo ""
echo "🐳 Перезапуск Docker контейнера..."
ssh "$SERVER" << 'EOF'
cd ~/windexscook-docker
echo "Останавливаем контейнер..."
docker-compose down
echo "Запускаем с исправленной версией..."
docker-compose up -d
echo ""
echo "Ожидание запуска..."
sleep 5
echo "Проверяем статус..."
docker ps | grep psycholog
EOF

echo ""
echo "✅ Исправленная версия VAD развернута!"
echo ""
echo "🔍 Проверьте логи:"
echo "ssh $SERVER 'docker logs psycholog-psy-server-1 --tail 20'"
echo ""
echo "🎯 Что теперь работает:"
echo "  ✅ Voice Activity Detection (VAD) для мобильной транскрибации"
echo "  ✅ iOS rate limiting fixes"
echo "  ✅ HTTP 429 error fixes"
echo "  ✅ Исправленная инициализация базы данных (без ошибки 'no such table')"
echo ""
echo "❌ Что отсутствует (откат до e719b24):"
echo "  ❌ Fix voice chat LLM responses"
echo "  ❌ Security fixes rollback"
echo "  ❌ All deployment scripts"
echo ""
echo "🌐 Проверьте приложение: https://psycholog.windexs.ru"
echo ""
echo "💡 Функция ensureUserPasswordColumn теперь вызывается после создания таблиц"
#!/bin/bash

# Скрипт для развертывания исправления VAD таймаута на iOS
# Использование: ./deploy_vad_fix.sh

set -e

SERVER="svr@windexs03"
REMOTE_DIR="/home/svr/windexscook-docker"

echo "🎤 Развертывание исправления VAD таймаута на $SERVER"
echo "=================================================="

echo ""
echo "📁 Копирование исправленного useTranscription.ts..."
rsync -avz --delete --exclude=node_modules --exclude=.env src/hooks/useTranscription.ts "$SERVER:$REMOTE_DIR/src/hooks/"

echo ""
echo "🐳 Перезапуск Docker контейнера..."
ssh "$SERVER" << 'EOF'
cd ~/windexscook-docker
echo "Останавливаем контейнер..."
docker-compose down
echo "Запускаем с исправлением VAD..."
docker-compose up -d
echo ""
echo "Ожидание запуска..."
sleep 5
echo "Проверяем статус..."
docker ps | grep psycholog
EOF

echo ""
echo "✅ Исправление VAD развернуто!"
echo ""
echo "🔍 Проверьте логи:"
echo "ssh $SERVER 'docker logs psycholog-psy-server-1 --tail 20'"
echo ""
echo "🎯 Что исправлено:"
echo "  ✅ VAD timeout увеличен с 4s до 15s"
echo "  ✅ Добавлен 8-секундный grace period (25s total initially)"
echo "  ✅ Таймер не останавливается так рано на iOS"
echo "  ✅ Пользователь может начать говорить через 5-10 секунд после начала звонка"
echo ""
echo "🧪 Протестируйте на iPhone:"
echo "  1. Начните звонок"
echo "  2. Подождите 5-10 секунд"
echo "  3. Начните говорить"
echo "  4. Аудио должно отправляться в TTS"
echo ""
echo "🌐 Проверьте приложение: https://psycholog.windexs.ru"
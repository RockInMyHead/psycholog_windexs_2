#!/bin/bash

# Скрипт для развертывания локального отката до коммита e719b24 (VAD)
# Локальная история откатана, но GitHub не тронут
# Использование: ./deploy_local_reset_to_vad.sh

set -e

SERVER="svr@windexs03"
REMOTE_DIR="/home/svr/windexscook-docker"

echo "🔄 Развертывание локального отката до VAD (e719b24) на $SERVER"
echo "=========================================================="

echo ""
echo "📁 Копирование откатанных файлов..."
rsync -avz --delete --exclude=node_modules --exclude=.env server/ voice-chat-system/ src/ "$SERVER:$REMOTE_DIR/"

echo ""
echo "🐳 Перезапуск Docker контейнера..."
ssh "$SERVER" << 'EOF'
cd ~/windexscook-docker
echo "Останавливаем контейнер..."
docker-compose down
echo "Запускаем с локально откатанной версией..."
docker-compose up -d
echo ""
echo "Ожидание запуска..."
sleep 5
echo "Проверяем статус..."
docker ps | grep psycholog
EOF

echo ""
echo "✅ Локальный откат до VAD развернут!"
echo ""
echo "🔍 Проверьте логи:"
echo "ssh $SERVER 'docker logs psycholog-psy-server-1 --tail 20'"
echo ""
echo "🎯 Что теперь на сервере:"
echo "  ✅ Voice Activity Detection (VAD) для мобильной транскрибации"
echo "  ✅ iOS rate limiting fixes"
echo "  ✅ HTTP 429 error fixes"
echo ""
echo "❌ Что удалено локально (но сохранено на GitHub):"
echo "  ❌ Fix voice chat LLM responses"
echo "  ❌ Security fixes rollback"
echo "  ❌ Database initialization fixes"
echo "  ❌ All deployment scripts"
echo ""
echo "🌐 Проверьте приложение: https://psycholog.windexs.ru"
echo ""
echo "💡 Примечание: GitHub история НЕ тронут - все коммиты сохранены там"
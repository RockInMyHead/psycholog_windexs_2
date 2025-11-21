#!/bin/bash

# Скрипт диагностики проблемы с TTS на сервере psycholog.windexs.ru
# Запуск: ./diagnose_tts_issue.sh

SERVER="svr@windexs03"
REMOTE_DIR="/opt/psycholog-backend"

echo "🔍 Диагностика проблемы TTS на сервере"
echo "======================================"

echo ""
echo "1. Проверка статуса systemd сервиса:"
ssh "$SERVER" "sudo systemctl status psycholog-api --no-pager -l" || echo "❌ Не удалось проверить статус сервиса"

echo ""
echo "2. Проверка переменных окружения:"
ssh "$SERVER" "sudo cat /opt/psycholog-backend/.env 2>/dev/null | grep -E '(OPENAI_API_KEY|PORT|NODE_ENV)' | sed 's/=.*/=***HIDDEN***/' || echo '❌ Файл .env не найден'"

echo ""
echo "3. Проверка открытых портов:"
ssh "$SERVER" "sudo netstat -tlnp | grep :1033 || echo '❌ Порт 1033 не прослушивается'"

echo ""
echo "4. Проверка логов systemd:"
ssh "$SERVER" "sudo journalctl -u psycholog-api --no-pager -n 20 | tail -10" || echo "❌ Не удалось получить логи"

echo ""
echo "5. Проверка файлов сервера:"
ssh "$SERVER" "ls -la /opt/psycholog-backend/ | head -10"

echo ""
echo "6. Тест прямого запроса к API:"
curl -s -X POST https://psycholog.windexs.ru/api/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"model":"tts-1","voice":"onyx","input":"тест","response_format":"mp3"}' \
  | head -5

echo ""
echo "🔧 РЕКОМЕНДАЦИИ ПО ИСПРАВЛЕНИЮ:"
echo "================================"

echo ""
echo "1. Проверьте API ключ OpenAI:"
echo "   ssh $SERVER 'sudo nano /opt/psycholog-backend/.env'"

echo ""
echo "2. Перезапустите сервис:"
echo "   ssh $SERVER 'sudo systemctl restart psycholog-api'"

echo ""
echo "3. Проверьте логи детально:"
echo "   ssh $SERVER 'sudo journalctl -u psycholog-api -f'"

echo ""
echo "4. Проверьте работу Node.js:"
echo "   ssh $SERVER 'cd /opt/psycholog-backend && node --version && npm --version'"

echo ""
echo "5. Ручной запуск сервера для тестирования:"
echo "   ssh $SERVER 'cd /opt/psycholog-backend && NODE_ENV=production npm start'"

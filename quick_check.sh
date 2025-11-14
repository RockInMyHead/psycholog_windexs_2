#!/bin/bash
echo "🚀 Быстрая проверка развертывания psycholog.windexs.ru"
echo "=================================================="

echo ""
echo "1. Главная страница (проверка на отсутствие Vite dev):"
if curl -s https://psycholog.windexs.ru/ | grep -q "@vite/client"; then
    echo "❌ ПРОБЛЕМА: Все еще Vite dev сервер!"
else
    echo "✅ OK: Продакшен сборка работает"
fi

echo ""
echo "2. API endpoint:"
API_RESP=$(curl -s https://psycholog.windexs.ru/api/test)
if echo "$API_RESP" | grep -q "Proxy server is working"; then
    echo "✅ OK: Express API сервер работает"
else
    echo "❌ ПРОБЛЕМА: API не работает"
    echo "   Response: ${API_RESP:0:100}..."
fi

echo ""
echo "3. OpenAI API тест:"
CHAT_RESP=$(timeout 10 curl -s -X POST https://psycholog.windexs.ru/api/chat/completions \
    -H "Content-Type: application/json" \
    -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"test"}]}' 2>/dev/null)
if echo "$CHAT_RESP" | grep -q "chat.completion"; then
    echo "✅ OK: OpenAI API работает"
elif echo "$CHAT_RESP" | grep -q "404"; then
    echo "❌ ПРОБЛЕМА: 404 ошибка - Express не запущен"
else
    echo "⚠️  OpenAI API: ${CHAT_RESP:0:50}..."
fi

echo ""
echo "💡 Если проблемы остались - проверьте логи:"
echo "   sudo journalctl -u psycholog-api -f  # Express логи"
echo "   sudo nginx -t && sudo systemctl reload nginx  # Nginx проверка"
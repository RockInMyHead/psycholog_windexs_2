#!/bin/bash

echo "🔍 Проверка развертывания psycholog.windexs.ru"
echo "=============================================="

echo ""
echo "1. Проверка главной страницы:"
curl -s https://psycholog.windexs.ru/ | grep -q "@vite/client"
if [ $? -eq 0 ]; then
    echo "❌ НАЙДЕНА ПРОБЛЕМА: Все еще работает Vite dev сервер!"
    echo "   В HTML есть скрипты @vite/client"
else
    echo "✅ OK: Продакшен сборка загружена"
fi

echo ""
echo "2. Проверка API:"
API_RESPONSE=$(curl -s https://psycholog.windexs.ru/api/test)
if echo "$API_RESPONSE" | grep -q "Proxy server is working"; then
    echo "✅ OK: Express API сервер работает"
elif echo "$API_RESPONSE" | grep -q "@vite/client"; then
    echo "❌ ПРОБЛЕМА: API возвращает HTML от Vite, а не Express"
    echo "   Проверьте nginx конфигурацию для location /api"
else
    echo "❌ ПРОБЛЕМА: API не отвечает или возвращает ошибку"
    echo "   Response: $API_RESPONSE"
fi

echo ""
echo "3. Проверка OpenAI API:"
CHAT_RESPONSE=$(curl -s -X POST https://psycholog.windexs.ru/api/chat/completions \
    -H "Content-Type: application/json" \
    -d '{"model":"gpt-5.2","messages":[{"role":"user","content":"test"}]}' 2>/dev/null)
if echo "$CHAT_RESPONSE" | grep -q "chat.completion"; then
    echo "✅ OK: OpenAI API работает через прокси"
elif echo "$CHAT_RESPONSE" | grep -q "404"; then
    echo "❌ ПРОБЛЕМА: API возвращает 404"
    echo "   Express сервер не запущен или неправильно настроен"
else
    echo "❌ ПРОБЛЕМА: OpenAI API не работает"
fi

echo ""
echo "📋 РЕЗУЛЬТАТЫ ПРОВЕРКИ"
echo "======================"

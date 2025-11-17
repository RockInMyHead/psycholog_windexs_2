#!/bin/bash
echo "🔍 Проверка состояния сервера psycholog.windexs.ru"
echo "================================================"

echo ""
echo "1. Проверка главной страницы:"
if curl -s https://psycholog.windexs.ru/ | grep -q "@vite/client"; then
    echo "❌ ПРОБЛЕМА: Все еще работает Vite dev сервер!"
    echo "   Нужно загрузить продакшен сборку и остановить dev сервер"
else
    echo "✅ OK: Продакшен сборка загружена"
fi

echo ""
echo "2. Проверка API сервера:"
API_RESP=$(curl -s https://psycholog.windexs.ru/api/test)
if echo "$API_RESP" | grep -q "Proxy server is working"; then
    echo "✅ OK: Express API сервер работает"
elif echo "$API_RESP" | grep -q "@vite/client"; then
    echo "❌ ПРОБЛЕМА: API возвращает HTML от Vite"
    echo "   Нужно запустить Express сервер и настроить nginx прокси"
else
    echo "❌ ПРОБЛЕМА: API сервер не отвечает"
    echo "   Проверьте, запущен ли Express сервер на порту 1033"
fi

echo ""
echo "3. Проверка конфигурации приложения:"
if curl -s https://psycholog.windexs.ru/ | grep -q "mode.*production"; then
    echo "✅ OK: Приложение работает в production режиме"
else
    echo "⚠️  Приложение может работать в development режиме"
fi

echo ""
echo "📋 РЕЗУЛЬТАТЫ ДИАГНОСТИКИ"
echo "========================"
echo "Если есть проблемы - следуйте инструкциям ниже!"

echo ""
echo "🔧 Быстрое исправление проблем:"
echo "================================="

echo ""
echo "1. Проверьте переменные окружения:"
echo "   sudo nano /opt/psycholog-backend/.env"
echo ""
echo "   Убедитесь что есть:"
echo "   VITE_OPENAI_API_KEY=ваш_реальный_ключ_openai"
echo "   PORT=1033"
echo "   NODE_ENV=production"

echo ""
echo "2. Перезапустите сервис:"
echo "   sudo systemctl restart psycholog-api"
echo "   sudo systemctl status psycholog-api"

echo ""
echo "3. Проверьте логи:"
echo "   sudo journalctl -u psycholog-api -f --no-pager | tail -50"

echo ""
echo "4. Перезагрузите Nginx:"
echo "   sudo nginx -t"
echo "   sudo systemctl reload nginx"

echo ""
echo "5. Проверьте что порт 1033 открыт:"
echo "   sudo netstat -tlnp | grep :1033"
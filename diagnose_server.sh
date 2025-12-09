#!/bin/bash

echo "=== Психолог сервер диагностика ==="
echo ""

echo "1. Проверка запущенных node процессов:"
ps aux | grep node | grep -v grep
echo ""

echo "2. Проверка открытых портов (1033, 3002, 80, 443):"
netstat -tuln | grep -E ':1033|:3002|:80|:443' || echo "Порты не найдены"
echo ""

echo "3. Проверка nginx конфигурации:"
sudo nginx -t 2>/dev/null || echo "Nginx конфиг не найден или ошибка"
echo ""

echo "4. Проверка nginx статуса:"
sudo systemctl is-active nginx 2>/dev/null || echo "Nginx не активен"
echo ""

echo "5. Проверка API доступности:"
curl -s -o /dev/null -w "HTTP %{http_code}: %{url_effective}\n" http://localhost:1033/health 2>/dev/null || echo "localhost:1033 недоступен"
curl -s -o /dev/null -w "HTTP %{http_code}: %{url_effective}\n" http://localhost:3002/health 2>/dev/null || echo "localhost:3002 недоступен"
echo ""

echo "6. Проверка логов психолога (последние 10 строк):"
tail -10 /home/svr/psycholog/logs/*.log 2>/dev/null || echo "Логи не найдены в /home/svr/psycholog/logs/"
echo ""

echo "7. Проверка сервиса психолога:"
sudo systemctl status psycholog-api.service --no-pager -l 2>/dev/null || echo "Сервис psycholog-api.service не найден"
echo ""

echo "8. Проверка памяти и CPU:"
free -h && echo "" && uptime
echo ""

echo "=== Конец диагностики ==="


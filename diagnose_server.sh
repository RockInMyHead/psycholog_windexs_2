#!/bin/bash

# Complete server diagnosis for psycholog.windexs.ru deployment

echo "🔬 COMPLETE SERVER DIAGNOSIS"
echo "============================"
echo ""

REMOTE_PATH="/var/www/psycholog.windexs.ru"

echo "1️⃣ CHECKING FILE SYSTEM:"
echo "-----------------------"
echo "Files in $REMOTE_PATH:"
ls -la "$REMOTE_PATH" 2>/dev/null || echo "❌ Cannot access $REMOTE_PATH"

echo ""
echo "Assets directory:"
ls -la "$REMOTE_PATH/assets/" 2>/dev/null || echo "❌ Cannot access assets directory"

echo ""
echo "2️⃣ CHECKING WEBSITE RESPONSE:"
echo "-----------------------------"
if command -v curl >/dev/null 2>&1; then
    echo "HTTP Status:"
    curl -s -I "https://psycholog.windexs.ru" | head -1

    echo ""
    echo "JavaScript file in HTML:"
    JS_FILE=$(curl -s "https://psycholog.windexs.ru" | grep -o "index-[a-zA-Z0-9_-]*\.js" | head -1)
    echo "Current: $JS_FILE"
    echo "Expected: index-D9_ZgnPJ.js"

    if [[ "$JS_FILE" == "index-D9_ZgnPJ.js" ]]; then
        echo "✅ CORRECT: New bundle is active"
    else
        echo "❌ WRONG: Old bundle still active"
    fi

    echo ""
    echo "File size check:"
    curl -s "https://psycholog.windexs.ru/assets/$JS_FILE" -I | grep -i "content-length"
else
    echo "❌ curl not available"
fi

echo ""
echo "3️⃣ CHECKING NGINX CONFIG:"
echo "-------------------------"
if [ -f "/etc/nginx/sites-enabled/psycholog.windexs.ru" ]; then
    echo "Nginx config found"
    grep -A 5 -B 5 "psycholog.windexs.ru" /etc/nginx/sites-enabled/psycholog.windexs.ru 2>/dev/null || echo "Config check failed"
else
    echo "❌ Nginx config not found at expected location"
fi

echo ""
echo "4️⃣ DEPLOYMENT STATUS:"
echo "---------------------"
if [ -f "$REMOTE_PATH/assets/index-D9_ZgnPJ.js" ]; then
    echo "✅ New JS file exists"
    ls -lh "$REMOTE_PATH/assets/index-D9_ZgnPJ.js"
else
    echo "❌ New JS file missing"
fi

if [ -f "$REMOTE_PATH/assets/index-Dtn52uhQ.js" ]; then
    echo "⚠️  Old JS file still exists"
    echo "   This should be replaced!"
else
    echo "✅ Old JS file removed"
fi

echo ""
echo "5️⃣ TROUBLESHOOTING STEPS:"
echo "========================="
echo "If files are correct but error persists:"
echo "- Clear browser cache: Ctrl+Shift+R"
echo "- Reload nginx: systemctl reload nginx"
echo "- Check file permissions: chmod 644 $REMOTE_PATH/assets/*"
echo "- Verify nginx is running: systemctl status nginx"
echo ""
echo "If files are wrong:"
echo "- Check upload path: $REMOTE_PATH"
echo "- Re-upload archive: tar -xzf audio-fix-deploy.tar.gz"
echo "- Verify archive contents before upload"
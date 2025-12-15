#!/bin/bash

echo "🔬 FINAL DIAGNOSIS FOR AUDIO ERROR"
echo "=================================="

REMOTE_PATH="/var/www/psycholog.windexs.ru"

echo "1️⃣ CHECKING HTML FILE ON SERVER:"
echo "-------------------------------"
if [ -f "$REMOTE_PATH/index.html" ]; then
    echo "HTML file exists. Checking JS reference:"
    grep -o "index-[a-zA-Z0-9_-]*\.js" "$REMOTE_PATH/index.html" 2>/dev/null || echo "No JS reference found in HTML"
else
    echo "❌ HTML file missing!"
fi

echo ""
echo "2️⃣ CHECKING JS FILES ON SERVER:"
echo "------------------------------"
echo "Files in $REMOTE_PATH/assets/:"
ls -la "$REMOTE_PATH/assets/" 2>/dev/null | grep "index-.*\.js" || echo "No JS files found"

echo ""
echo "3️⃣ CHECKING WEBSITE RESPONSE:"
echo "----------------------------"
if command -v curl >/dev/null 2>&1; then
    echo "HTML from website:"
    JS_IN_HTML=$(curl -s "https://psycholog.windexs.ru" | grep -o "index-[a-zA-Z0-9_-]*\.js" | head -1)
    echo "JS file referenced: $JS_IN_HTML"

    echo ""
    echo "Actual JS file size:"
    if [[ -n "$JS_IN_HTML" ]]; then
        SIZE=$(curl -s "https://psycholog.windexs.ru/assets/$JS_IN_HTML" -I | grep -i "content-length" | awk '{print $2}' | tr -d '\r')
        echo "Size: $SIZE bytes"
    fi
else
    echo "❌ curl not available"
fi

echo ""
echo "4️⃣ DIAGNOSIS:"
echo "============="

HTML_JS=$(grep -o "index-[a-zA-Z0-9_-]*\.js" "$REMOTE_PATH/index.html" 2>/dev/null)
SERVER_JS=$(ls "$REMOTE_PATH/assets/" | grep "index-.*\.js" | head -1)
WEBSITE_JS=$JS_IN_HTML

echo "HTML references: $HTML_JS"
echo "Server has: $SERVER_JS"
echo "Website serves: $WEBSITE_JS"

if [[ "$HTML_JS" == "index-D9_ZgnPJ.js" ]] && [[ "$SERVER_JS" == "index-D9_ZgnPJ.js" ]] && [[ "$WEBSITE_JS" == "index-D9_ZgnPJ.js" ]]; then
    echo "✅ ALL CORRECT: New files are active"
    echo "   If error persists, it's browser cache issue"
elif [[ "$HTML_JS" != "index-D9_ZgnPJ.js" ]]; then
    echo "❌ HTML FILE PROBLEM: Update index.html"
elif [[ "$SERVER_JS" != "index-D9_ZgnPJ.js" ]]; then
    echo "❌ SERVER FILES PROBLEM: Update JS files"
elif [[ "$WEBSITE_JS" != "index-D9_ZgnPJ.js" ]]; then
    echo "❌ NGINX PROBLEM: Reload nginx configuration"
fi

echo ""
echo "5️⃣ FIX COMMANDS:"
echo "================"

if [[ "$HTML_JS" != "index-D9_ZgnPJ.js" ]]; then
    echo "# Update HTML file:"
    echo "cp /path/to/correct/index.html $REMOTE_PATH/"
fi

if [[ "$SERVER_JS" != "index-D9_ZgnPJ.js" ]]; then
    echo "# Update JS files:"
    echo "cp /path/to/dist/assets/index-D9_ZgnPJ.js $REMOTE_PATH/assets/"
fi

if [[ "$WEBSITE_JS" != "index-D9_ZgnPJ.js" ]]; then
    echo "# Reload nginx:"
    echo "sudo systemctl reload nginx"
fi

echo ""
echo "# Always clear browser cache:"
echo "Ctrl+Shift+R"
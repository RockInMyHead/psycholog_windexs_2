#!/bin/bash

echo "🔍 SERVER STATUS CHECK"
echo "===================="

REMOTE_PATH="/var/www/psycholog.windexs.ru"

echo "1️⃣ CHECKING JS FILES:"
echo "-------------------"
echo "Files in $REMOTE_PATH/assets/:"
ls -la "$REMOTE_PATH/assets/" 2>/dev/null || echo "❌ Cannot access directory"

echo ""
echo "2️⃣ CHECKING WEBSITE:"
echo "------------------"
if command -v curl >/dev/null 2>&1; then
    JS_FILE=$(curl -s "https://psycholog.windexs.ru" | grep -o "index-[a-zA-Z0-9_-]*\.js" | head -1)
    echo "JavaScript file in HTML: $JS_FILE"

    if [[ "$JS_FILE" == "index-D9_ZgnPJ.js" ]]; then
        echo "✅ CORRECT: New fixed file is active"
    elif [[ "$JS_FILE" == "index-Dtn52uhQ.js" ]]; then
        echo "❌ PROBLEM: Old broken file still active"
        echo "   Need to update server files!"
    else
        echo "⚠️  UNKNOWN: Unexpected file: $JS_FILE"
    fi
else
    echo "❌ curl not available"
fi

echo ""
echo "3️⃣ DIAGNOSIS:"
echo "============="
if [ -f "$REMOTE_PATH/assets/index-D9_ZgnPJ.js" ] && [[ "$JS_FILE" == "index-Dtn52uhQ.js" ]]; then
    echo "❌ Files updated but nginx serves old version"
    echo "   Try: sudo systemctl reload nginx"
elif [ -f "$REMOTE_PATH/assets/index-Dtn52uhQ.js" ]; then
    echo "❌ Old files still on server"
    echo "   Need to rebuild: npm run build"
elif [ ! -f "$REMOTE_PATH/assets/index-D9_ZgnPJ.js" ]; then
    echo "❌ New files not found on server"
    echo "   Need to deploy files"
else
    echo "✅ Everything looks correct"
fi
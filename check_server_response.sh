#!/bin/bash

echo "🔍 CHECKING SERVER RESPONSE"
echo "=========================="

URL="https://psycholog.windexs.ru"

echo "1. Checking HTML content:"
echo "------------------------"
JS_FILE=$(curl -s "$URL" | grep -o "index-[a-zA-Z0-9_-]*\.js" | head -1)
echo "JavaScript file in HTML: $JS_FILE"

echo ""
echo "2. Checking actual file:"
echo "-----------------------"
if command -v curl >/dev/null 2>&1; then
    FILE_SIZE=$(curl -s "$URL/assets/$JS_FILE" -I | grep -i "content-length" | awk '{print $2}' | tr -d '\r')
    echo "File size: $FILE_SIZE bytes"

    if [[ "$JS_FILE" == "index-D9_ZgnPJ.js" ]]; then
        echo "✅ CORRECT: New fixed file is being served"
        if [[ "$FILE_SIZE" -gt 900000 ]]; then
            echo "✅ CORRECT: File size matches (~949KB)"
        else
            echo "⚠️  WARNING: File size seems small ($FILE_SIZE bytes)"
        fi
    else
        echo "❌ ERROR: Wrong file being served: $JS_FILE"
        echo "   Expected: index-D9_ZgnPJ.js"
    fi
else
    echo "❌ curl not available"
fi

echo ""
echo "3. Browser instructions:"
echo "-----------------------"
echo "1. Open browser DevTools (F12)"
echo "2. Go to Network tab"
echo "3. Visit: $URL/audio"
echo "4. Look for JavaScript files"
echo "5. Should see: index-D9_ZgnPJ.js"
echo ""
echo "If you still see index-Dtn52uhQ.js:"
echo "- Clear browser cache (Ctrl+Shift+R)"
echo "- Try incognito mode"
echo "- Check server nginx config"
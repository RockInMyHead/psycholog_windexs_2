#!/bin/bash

# Check deployment status on server
# Run this on the server to verify files are updated

echo "🔍 CHECKING DEPLOYMENT STATUS ON SERVER"
echo "======================================"
echo ""

REMOTE_PATH="/var/www/psycholog.windexs.ru"

echo "📂 Checking files in $REMOTE_PATH:"
echo "-----------------------------------"

# Check if new JS file exists
if [ -f "$REMOTE_PATH/assets/index-D9_ZgnPJ.js" ]; then
    echo "✅ NEW JS FILE FOUND: index-D9_ZgnPJ.js"
    ls -la "$REMOTE_PATH/assets/index-D9_ZgnPJ.js"
else
    echo "❌ NEW JS FILE MISSING: index-D9_ZgnPJ.js"
fi

# Check old JS file
if [ -f "$REMOTE_PATH/assets/index-Dtn52uhQ.js" ]; then
    echo "⚠️  OLD JS FILE STILL EXISTS: index-Dtn52uhQ.js"
    echo "   This file should be replaced!"
else
    echo "✅ OLD JS FILE REMOVED: index-Dtn52uhQ.js"
fi

echo ""
echo "🌐 Testing website:"
echo "------------------"

# Test HTTP response
if command -v curl >/dev/null 2>&1; then
    response=$(curl -s -I "https://psycholog.windexs.ru" | grep -i "content-type\|status\|location")
    echo "HTTP Response: $response"

    # Check if new JS is being served
    js_in_html=$(curl -s "https://psycholog.windexs.ru" | grep -o "index-[a-zA-Z0-9_-]*\.js" | head -1)
    echo "JavaScript in HTML: $js_in_html"

    if [[ "$js_in_html" == "index-D9_ZgnPJ.js" ]]; then
        echo "✅ CORRECT: New JavaScript bundle is active"
    else
        echo "❌ PROBLEM: Old or wrong JavaScript bundle detected"
        echo "   Expected: index-D9_ZgnPJ.js"
        echo "   Found: $js_in_html"
    fi
else
    echo "❌ curl not available for testing"
fi

echo ""
echo "🔧 IF FILES ARE CORRECT BUT ERROR PERSISTS:"
echo "=========================================="
echo "1. Clear browser cache: Ctrl+Shift+R"
echo "2. Hard refresh: Ctrl+F5"
echo "3. Try incognito mode"
echo "4. Check nginx cache: systemctl reload nginx"
echo "5. Clear CDN cache if using one"

echo ""
echo "📞 For help: Check URGENT_DEPLOY.txt for deployment commands"
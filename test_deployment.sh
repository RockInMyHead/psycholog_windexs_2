#!/bin/bash

# Test script to verify deployment on psycholog.windexs.ru
# Run this on the server after uploading files

echo "🧪 TESTING DEPLOYMENT ON psycholog.windexs.ru"
echo "============================================"
echo ""

REMOTE_PATH="/var/www/psycholog.windexs.ru"
TEST_URL="https://psycholog.windexs.ru"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "📂 Checking deployed files..."
echo "----------------------------"

# Check critical files
files_to_check=(
    "index.html"
    "assets/index-DXMmaIhT.js"
    "assets/index-DTCsXawP.css"
)

for file in "${files_to_check[@]}"; do
    if [ -f "$REMOTE_PATH/$file" ]; then
        size=$(stat -c%s "$REMOTE_PATH/$file" 2>/dev/null || stat -f%z "$REMOTE_PATH/$file" 2>/dev/null)
        echo -e "${GREEN}✅ $file${NC} (${size} bytes)"
    else
        echo -e "${RED}❌ $file${NC} - MISSING!"
    fi
done

echo ""
echo "🌐 Testing website response..."
echo "-----------------------------"

# Test HTTP response
if command -v curl >/dev/null 2>&1; then
    response=$(curl -s -o /dev/null -w "%{http_code}" "$TEST_URL" 2>/dev/null)
    if [ "$response" = "200" ]; then
        echo -e "${GREEN}✅ Website responds with HTTP 200${NC}"
    else
        echo -e "${RED}❌ Website responds with HTTP $response${NC}"
    fi

    # Check if the new JS file is being served
    js_response=$(curl -s "$TEST_URL" | grep -o "index-[a-zA-Z0-9_-]*\.js" | head -1)
    if [[ "$js_response" == "index-DXMmaIhT.js" ]]; then
        echo -e "${GREEN}✅ New JavaScript bundle is active${NC}"
    else
        echo -e "${YELLOW}⚠️  Old JavaScript bundle detected: $js_response${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ curl not available, skipping HTTP tests${NC}"
fi

echo ""
echo "📋 DEPLOYMENT STATUS:"
echo "===================="

if [ -f "$REMOTE_PATH/assets/index-DXMmaIhT.js" ] && [ -f "$REMOTE_PATH/index.html" ]; then
    echo -e "${GREEN}✅ Files deployed successfully${NC}"
    echo ""
    echo "🎯 NEXT STEPS:"
    echo "=============="
    echo "1. Clear browser cache (Ctrl+Shift+R)"
    echo "2. Visit: $TEST_URL/audio"
    echo "3. Check browser console (F12) for errors"
    echo "4. Try starting an audio call"
    echo ""
    echo "🔍 Expected: No 'Can't find variable: useEffect' errors"
else
    echo -e "${RED}❌ Deployment incomplete - missing critical files${NC}"
    echo ""
    echo "🔧 TROUBLESHOOTING:"
    echo "=================="
    echo "1. Check file permissions: chmod 644 $REMOTE_PATH/*"
    echo "2. Check nginx configuration"
    echo "3. Restart nginx: systemctl restart nginx"
    echo "4. Clear any CDN cache"
fi

echo ""
echo "📞 For help: Check AUDIO_FIX_COMPLETE.md for detailed instructions"
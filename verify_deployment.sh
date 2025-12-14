#!/bin/bash

# Verify Audio Call Fix Deployment
# Run this on the server after uploading files

echo "🔍 VERIFYING AUDIO CALL FIX DEPLOYMENT"
echo "========================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SERVER_PATH="/var/www/psycholog.windexs.ru"
TEST_URL="https://psycholog.windexs.ru/audio"

echo "📂 Checking deployed files..."
echo ""

# Check if main files exist
files_to_check=(
    "index.html"
    "assets/index-BTkKYdJS.js"
    "assets/index-DTCsXawP.css"
)

for file in "${files_to_check[@]}"; do
    if [ -f "$SERVER_PATH/$file" ]; then
        size=$(stat -f%z "$SERVER_PATH/$file" 2>/dev/null || stat -c%s "$SERVER_PATH/$file" 2>/dev/null)
        echo -e "${GREEN}✅ $file${NC} (${size} bytes)"
    else
        echo -e "${RED}❌ $file${NC} - MISSING!"
    fi
done

echo ""
echo "🌐 Testing website..."
echo ""

# Test HTTP response
if command -v curl >/dev/null 2>&1; then
    response=$(curl -s -o /dev/null -w "%{http_code}" "$TEST_URL" 2>/dev/null)
    if [ "$response" = "200" ]; then
        echo -e "${GREEN}✅ Website responds with HTTP 200${NC}"
    else
        echo -e "${RED}❌ Website responds with HTTP $response${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ curl not available, skipping HTTP test${NC}"
fi

echo ""
echo "🔧 Checking file permissions..."
echo ""

# Check permissions
for file in "${files_to_check[@]}"; do
    if [ -f "$SERVER_PATH/$file" ]; then
        perms=$(stat -c%a "$SERVER_PATH/$file" 2>/dev/null || stat -f%p "$SERVER_PATH/$file" 2>/dev/null | cut -c -3)
        owner=$(stat -c%U:%G "$SERVER_PATH/$file" 2>/dev/null || stat -f%Su:%Sg "$SERVER_PATH/$file" 2>/dev/null)
        echo -e "📄 $file: ${perms} ${owner}"
    fi
done

echo ""
echo "📋 NEXT STEPS:"
echo "=============="
echo ""
echo "1. 🌐 Open browser and go to: $TEST_URL"
echo "2. 🧹 Clear browser cache (Ctrl+Shift+R)"
echo "3. 🐛 Open DevTools (F12) → Console tab"
echo "4. 🔍 Look for 'Cannot access uninitialized variable' errors"
echo "5. 🧪 Try starting an audio call to test functionality"
echo ""
echo "✅ If no errors in console - FIX IS WORKING!"
echo ""
echo "📞 If problems persist:"
echo "   - Check nginx error logs: tail -f /var/log/nginx/error.log"
echo "   - Check nginx config: nginx -t"
echo "   - Restart nginx: systemctl restart nginx"
echo "   - Clear CDN cache if using one"
echo ""

echo "🎉 VERIFICATION COMPLETE!"
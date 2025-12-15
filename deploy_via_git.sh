#!/bin/bash

# Deploy via Git - clone repo directly on server
# For Ubuntu servers without file upload capability

echo "📥 DEPLOY VIA GIT CLONE"
echo "======================="
echo ""

REMOTE_PATH="/var/www/psycholog.windexs.ru"
REPO_URL="https://github.com/RockInMyHead/psycholog_windexs_2.git"
TEMP_DIR="/tmp/psycholog_deploy"

echo "1️⃣ CREATING TEMP DIRECTORY:"
echo "---------------------------"
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"
echo "✅ Temp directory: $TEMP_DIR"

echo ""
echo "2️⃣ CLONING REPOSITORY:"
echo "----------------------"
if command -v git >/dev/null 2>&1; then
    git clone "$REPO_URL" . --depth 1
    echo "✅ Repository cloned"
else
    echo "❌ Git not installed. Install with: apt update && apt install -y git"
    exit 1
fi

echo ""
echo "3️⃣ CHECKING ARCHIVE:"
echo "--------------------"
if [ -f "audio-fix-deploy.tar.gz" ]; then
    echo "✅ Deployment archive found"
    ls -lh audio-fix-deploy.tar.gz
else
    echo "❌ Archive not found in repo!"
    exit 1
fi

echo ""
echo "4️⃣ BACKING UP CURRENT FILES:"
echo "----------------------------"
mkdir -p "$REMOTE_PATH/backup/$(date +%Y%m%d_%H%M%S)"
cp -r "$REMOTE_PATH/"* "$REMOTE_PATH/backup/$(date +%Y%m%d_%H%M%S)/" 2>/dev/null || true
echo "✅ Backup created"

echo ""
echo "5️⃣ EXTRACTING NEW FILES:"
echo "------------------------"
cd "$REMOTE_PATH"
tar -xzf "$TEMP_DIR/audio-fix-deploy.tar.gz"
echo "✅ Files extracted"

echo ""
echo "6️⃣ VERIFYING DEPLOYMENT:"
echo "------------------------"
if [ -f "$REMOTE_PATH/assets/index-D9_ZgnPJ.js" ]; then
    echo "✅ NEW JS FILE: index-D9_ZgnPJ.js"
    ls -lh "$REMOTE_PATH/assets/index-D9_ZgnPJ.js"
else
    echo "❌ New JS file missing!"
fi

if [ ! -f "$REMOTE_PATH/assets/index-Dtn52uhQ.js" ]; then
    echo "✅ OLD JS FILE REMOVED"
else
    echo "⚠️  Old JS file still exists - manual cleanup needed"
fi

echo ""
echo "7️⃣ CLEANING UP:"
echo "----------------"
rm -rf "$TEMP_DIR"
echo "✅ Temp files cleaned"

echo ""
echo "8️⃣ RELOADING SERVICES:"
echo "----------------------"
if command -v systemctl >/dev/null 2>&1; then
    systemctl reload nginx 2>/dev/null || echo "⚠️  Nginx reload failed"
fi

echo ""
echo "9️⃣ TESTING:"
echo "-----------"
if command -v curl >/dev/null 2>&1; then
    JS_IN_HTML=$(curl -s "https://psycholog.windexs.ru" | grep -o "index-[a-zA-Z0-9_-]*\.js" | head -1)
    echo "JavaScript in HTML: $JS_IN_HTML"
    if [[ "$JS_IN_HTML" == "index-D9_ZgnPJ.js" ]]; then
        echo "✅ SUCCESS: New bundle active!"
    else
        echo "❌ FAILED: Old bundle still active"
        echo "   Expected: index-D9_ZgnPJ.js"
        echo "   Found: $JS_IN_HTML"
    fi
fi

echo ""
echo "🎯 NEXT STEPS:"
echo "=============="
echo "1. Clear browser cache: Ctrl+Shift+R"
echo "2. Test: https://psycholog.windexs.ru/audio"
echo "3. Check console for errors"

echo ""
echo "📞 ALTERNATIVE MANUAL METHOD:"
echo "============================="
echo "If git method fails:"
echo "1. Download archive manually from GitHub"
echo "2. Upload via SCP: scp file.tar.gz user@server:~/"
echo "3. Extract: tar -xzf file.tar.gz"
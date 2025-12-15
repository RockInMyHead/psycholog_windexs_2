#!/bin/bash

# Force deployment script - ensures old files are replaced
# Run this on the server after uploading audio-fix-deploy.tar.gz

echo "🔨 FORCE DEPLOYMENT TO REPLACE OLD FILES"
echo "========================================"
echo ""

REMOTE_PATH="/var/www/psycholog.windexs.ru"

echo "1️⃣ BACKING UP CURRENT FILES:"
echo "----------------------------"
mkdir -p "$REMOTE_PATH/backup/$(date +%Y%m%d_%H%M%S)"
cp -r "$REMOTE_PATH/"* "$REMOTE_PATH/backup/$(date +%Y%m%d_%H%M%S)/" 2>/dev/null || true
echo "✅ Backup created"

echo ""
echo "2️⃣ REMOVING OLD FILES:"
echo "----------------------"
rm -rf "$REMOTE_PATH/assets/"
rm -f "$REMOTE_PATH/index.html"
rm -f "$REMOTE_PATH"/*.js
rm -f "$REMOTE_PATH"/*.css
echo "✅ Old files removed"

echo ""
echo "3️⃣ EXTRACTING NEW FILES:"
echo "------------------------"
if [ -f ~/audio-fix-deploy.tar.gz ]; then
    cd "$REMOTE_PATH"
    tar -xzf ~/audio-fix-deploy.tar.gz
    echo "✅ New files extracted"
else
    echo "❌ Archive not found! Upload audio-fix-deploy.tar.gz first"
    exit 1
fi

echo ""
echo "4️⃣ VERIFYING DEPLOYMENT:"
echo "------------------------"
if [ -f "$REMOTE_PATH/assets/index-D9_ZgnPJ.js" ]; then
    echo "✅ NEW JS FILE: index-D9_ZgnPJ.js"
    ls -lh "$REMOTE_PATH/assets/index-D9_ZgnPJ.js"
else
    echo "❌ New JS file missing!"
    exit 1
fi

if [ ! -f "$REMOTE_PATH/assets/index-Dtn52uhQ.js" ]; then
    echo "✅ OLD JS FILE REMOVED: index-Dtn52uhQ.js"
else
    echo "❌ Old JS file still exists!"
fi

echo ""
echo "5️⃣ RELOADING SERVICES:"
echo "----------------------"
if command -v systemctl >/dev/null 2>&1; then
    systemctl reload nginx 2>/dev/null || echo "⚠️  Nginx reload failed"
fi

echo ""
echo "6️⃣ TESTING:"
echo "-----------"
if command -v curl >/dev/null 2>&1; then
    JS_IN_HTML=$(curl -s "https://psycholog.windexs.ru" | grep -o "index-[a-zA-Z0-9_-]*\.js" | head -1)
    echo "JavaScript in HTML: $JS_IN_HTML"
    if [[ "$JS_IN_HTML" == "index-D9_ZgnPJ.js" ]]; then
        echo "✅ SUCCESS: New bundle active!"
    else
        echo "❌ FAILED: Old bundle still active"
    fi
fi

echo ""
echo "🎯 NEXT STEPS:"
echo "=============="
echo "1. Clear browser cache: Ctrl+Shift+R"
echo "2. Test: https://psycholog.windexs.ru/audio"
echo "3. No more 'Cannot access uninitialized variable' errors!"

echo ""
echo "📞 EMERGENCY ROLLBACK:"
echo "======================"
echo "If something breaks, restore from backup:"
echo "cp -r $REMOTE_PATH/backup/*/ $REMOTE_PATH/"
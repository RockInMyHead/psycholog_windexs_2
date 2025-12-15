#!/bin/bash

# Quick deployment script for psycholog.windexs.ru
# Direct upload of fixed files

echo "🚀 QUICK DEPLOYMENT TO psycholog.windexs.ru"
echo "=========================================="
echo ""

SERVER_IP="77.37.146.116"
REMOTE_PATH="/var/www/psycholog.windexs.ru"

echo "📋 Upload methods:"
echo ""

echo "Method 1: SCP (if SSH access works)"
echo "-----------------------------------"
echo "scp audio-fix-deploy.tar.gz root@$SERVER_IP:~/"
echo ""
echo "ssh root@$SERVER_IP"
echo "cd $REMOTE_PATH"
echo "tar -xzf ~/audio-fix-deploy.tar.gz"
echo ""

echo "Method 2: FTP/SFTP"
echo "------------------"
echo "Connect to: $SERVER_IP"
echo "Upload: audio-fix-deploy.tar.gz"
echo "Extract: tar -xzf audio-fix-deploy.tar.gz"
echo ""

echo "Method 3: Direct file upload"
echo "---------------------------"
echo "Copy contents of dist/ folder to server $REMOTE_PATH"
echo ""

echo "🧪 Verify deployment:"
echo "curl -I https://psycholog.windexs.ru/audio"
echo ""

echo "📦 Archive contents:"
tar -tzf audio-fix-deploy.tar.gz | head -5
echo ""

echo "✅ Archive includes ALL fixes:"
echo "  - iOS white screen fix"
echo "  - TTS logging spam fix"
echo "  - Telegram icon fix"
echo "  - Hook initialization fix"
echo ""

echo "🎯 TARGET: Fix 'Cannot access uninitialized variable' error"
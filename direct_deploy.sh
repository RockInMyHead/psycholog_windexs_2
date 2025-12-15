#!/bin/bash

# Direct deployment script for psycholog.windexs.ru
# Uploads fixed audio files to server

echo "🚀 DIRECT DEPLOYMENT TO psycholog.windexs.ru"
echo "=========================================="
echo ""

# Server details
SERVER_IP="77.37.146.116"
REMOTE_PATH="/var/www/psycholog.windexs.ru"

echo "📋 Deployment methods:"
echo "1. SCP (if SSH key configured)"
echo "2. FTP/SFTP upload"
echo "3. Manual file transfer"
echo ""

echo "🔧 Method 1: SCP Upload"
echo "-----------------------"
echo "# Upload archive:"
echo "scp audio-fix-deploy.tar.gz root@$SERVER_IP:~/"
echo ""
echo "# Extract on server:"
echo "ssh root@$SERVER_IP"
echo "cd $REMOTE_PATH"
echo "tar -xzf ~/audio-fix-deploy.tar.gz"
echo "rm ~/audio-fix-deploy.tar.gz"
echo ""

echo "🔧 Method 2: FTP/SFTP Upload"
echo "----------------------------"
echo "Connect to: $SERVER_IP"
echo "Port: 22 (SFTP)"
echo "Upload: audio-fix-deploy.tar.gz"
echo "Extract to: $REMOTE_PATH"
echo ""

echo "🔧 Method 3: Manual Transfer"
echo "----------------------------"
echo "1. Download audio-fix-deploy.tar.gz from your local machine"
echo "2. Upload to server via any file manager"
echo "3. Extract: tar -xzf audio-fix-deploy.tar.gz"
echo "4. Move files to $REMOTE_PATH"
echo ""

echo "🧪 After deployment:"
echo "-------------------"
echo "# Verify files:"
echo "ls -la $REMOTE_PATH/"
echo ""
echo "# Test website:"
echo "curl -I https://psycholog.windexs.ru/audio"
echo ""

echo "✅ Archive location:"
echo "$(pwd)/audio-fix-deploy.tar.gz"
echo ""

echo "📊 Archive contents:"
tar -tzf audio-fix-deploy.tar.gz | head -10
echo ""

echo "🎯 TARGET: Fix 'Can't find variable: useEffect' error"
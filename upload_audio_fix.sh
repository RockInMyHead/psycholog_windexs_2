#!/bin/bash

# Deploy Audio Call Hook Order Fix to production server
# This script uploads the fixed build to psycholog.windexs.ru

set -e

echo "🚀 UPLOADING AUDIO CALL FIX TO PRODUCTION"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Server configuration - UPDATE THESE VALUES
SERVER_HOST="psycholog.windexs.ru"
SERVER_USER="svr"  # Update with your SSH username
REMOTE_PATH="/var/www/psycholog.windexs.ru"

echo -e "${YELLOW}⚠️  Make sure you have SSH access configured!${NC}"
echo ""
echo "Server: $SERVER_USER@$SERVER_HOST"
echo "Remote path: $REMOTE_PATH"
echo ""

# Check if dist/ exists
if [ ! -d "dist" ]; then
    echo -e "${RED}❌ dist/ folder not found! Run 'npm run build' first.${NC}"
    exit 1
fi

echo "📦 Uploading files to server..."
echo ""

# Upload using rsync (more efficient than scp)
rsync -avz --progress \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    dist/ "${SERVER_USER}@${SERVER_HOST}:${REMOTE_PATH}/"

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Upload successful!${NC}"
    echo ""
    echo "🌐 Clear browser cache and test: https://psycholog.windexs.ru/audio"
    echo ""
    echo "🎉 DEPLOYMENT COMPLETE!"
else
    echo ""
    echo -e "${RED}❌ Upload failed!${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "1. Make sure SSH key is set up: ssh-copy-id ${SERVER_USER}@${SERVER_HOST}"
    echo "2. Test SSH connection: ssh ${SERVER_USER}@${SERVER_HOST}"
    echo "3. Check server path exists: ssh ${SERVER_USER}@${SERVER_HOST} 'ls -la ${REMOTE_PATH}'"
    echo ""
    echo "Alternative: Upload manually via FTP/SFTP"
    echo "  - Connect to: ${SERVER_HOST}"
    echo "  - Upload dist/* to: ${REMOTE_PATH}/"
    exit 1
fi

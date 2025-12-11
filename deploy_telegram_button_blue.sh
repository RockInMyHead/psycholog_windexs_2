#!/bin/bash

# Deploy script for Telegram button blue color change
# Changes Telegram button from outline to solid blue background

set -e

echo "🔵 DEPLOYING TELEGRAM BUTTON BLUE COLOR CHANGE"
echo "=============================================="
echo ""

# Server details - update these for your server
SERVER_HOST="your-server-host"
SERVER_USER="your-username"
REMOTE_PATH="/path/to/your/app"

echo "📋 What this deployment changes:"
echo "  ✅ Telegram button changes from outline style to solid blue background"
echo "  ✅ Button text remains 'Спросить'"
echo "  ✅ Blue color: bg-blue-500 with hover:bg-blue-600"
echo "  ✅ White text on blue background"
echo "  ✅ More attractive and clickable appearance"
echo ""
echo "🎨 Visual change:"
echo "  - Before: Outlined button with primary color border"
echo "  - After: Solid blue button with white text"
echo "  - Same size and position, better visual appeal"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Checking local changes..."
if ! git diff --quiet; then
    echo -e "${YELLOW}⚠️  You have uncommitted changes. Please commit or stash them first.${NC}"
    exit 1
fi

echo "📦 Copying updated Index page to server..."
rsync -avz --delete \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    src/pages/Index.tsx \
    "${SERVER_USER}@${SERVER_HOST}:${REMOTE_PATH}/src/pages/"

echo ""
echo -e "${GREEN}✅ Index page updated successfully!${NC}"
echo ""

echo "🔄 Restarting server..."
ssh "${SERVER_USER}@${SERVER_HOST}" "cd ${REMOTE_PATH} && docker-compose restart psycholog-psy-server-1"

echo ""
echo -e "${GREEN}✅ Server restarted!${NC}"
echo ""

echo "📊 Checking server status..."
sleep 3
ssh "${SERVER_USER}@${SERVER_HOST}" "cd ${REMOTE_PATH} && docker-compose logs --tail=10 psycholog-psy-server-1"

echo ""
echo "🎉 DEPLOYMENT COMPLETE!"
echo ""
echo "🔵 Telegram button is now blue!"
echo "   - Attractive blue background (bg-blue-500)"
echo "   - White text 'Спросить'"
echo "   - Hover effect (bg-blue-600)"
echo "   - Better visual appeal for user engagement"
echo ""
echo "💬 Users will find the Telegram button more inviting to click!"
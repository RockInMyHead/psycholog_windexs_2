#!/bin/bash

# Deploy script for final removal of voice interruption visual overlay
# Ensures the red circle overlay is completely removed from AudioCall interface

set -e

echo "🚫 FINAL REMOVAL OF VOICE INTERRUPTION OVERLAY"
echo "=============================================="
echo ""

# Server details - update these for your server
SERVER_HOST="your-server-host"
SERVER_USER="your-username"
REMOTE_PATH="/path/to/your/app"

echo "📋 What this deployment ensures:"
echo "  ✅ Complete removal of red circle overlay during voice interruption"
echo "  ✅ No more '🎤 Прерывание' text appearing on video element"
echo "  ✅ Clean video interface without visual distractions"
echo "  ✅ Voice interruption functionality preserved (TTS stopping)"
echo ""
echo "🐛 Problem being fixed:"
echo "  - User sees red circle with 'Прерывание' text when speaking"
echo "  - This overlay covers the entire video element"
echo "  - Distracting visual feedback during conversation"
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

echo "📦 Copying clean AudioCall component to server..."
rsync -avz --delete \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    src/pages/AudioCall.tsx \
    "${SERVER_USER}@${SERVER_HOST}:${REMOTE_PATH}/src/pages/"

echo ""
echo -e "${GREEN}✅ AudioCall component updated successfully!${NC}"
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
echo "🧹 Interface is now completely clean:"
echo "   - No red circle overlay when speaking"
echo "   - No 'Прерывание' text on video"
echo "   - Clean video display during calls"
echo "   - Voice interruption works silently in background"
echo ""
echo "💡 If you still see the overlay, try:"
echo "   - Hard refresh: Ctrl+F5 or Cmd+Shift+R"
echo "   - Clear browser cache"
echo "   - Try incognito/private browsing mode"
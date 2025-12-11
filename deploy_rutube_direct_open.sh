#!/bin/bash

# Deploy script for RuTube direct opening in meditations
# Changes meditation clicks to open RuTube directly instead of modal player

set -e

echo "🌿 DEPLOYING RUTUBE DIRECT OPENING FOR MEDITATIONS"
echo "=================================================="
echo ""

# Server details - update these for your server
SERVER_HOST="your-server-host"
SERVER_USER="your-username"
REMOTE_PATH="/path/to/your/app"

echo "📋 What this deployment changes:"
echo "  ✅ Meditation cards now open RuTube directly when clicked"
echo "  ✅ Removed modal video player from meditations"
echo "  ✅ All thumbnails now use RuTube API previews"
echo "  ✅ Removed meditation session tracking and ratings"
echo "  ✅ Simplified meditation component"
echo ""
echo "🎯 User experience:"
echo "  - Click any meditation → opens RuTube video in new tab"
echo "  - No more app-based video playback"
echo "  - Direct access to full RuTube video experience"
echo "  - All Russian breathing and meditation content"
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

echo "📦 Copying updated Meditations component to server..."
rsync -avz --delete \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    src/pages/Meditations.tsx \
    "${SERVER_USER}@${SERVER_HOST}:${REMOTE_PATH}/src/pages/"

echo ""
echo -e "${GREEN}✅ Meditations component updated successfully!${NC}"
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
echo "🌿 Meditation experience updated:"
echo "   - Click 'Медитация благодарности' → opens RuTube psychologist session"
echo "   - All 8 meditations open directly in RuTube"
echo "   - Authentic Russian breathing techniques and meditations"
echo "   - No more app restrictions on video playback"
echo ""
echo "🧘 Users now get the full RuTube video experience for meditations!"
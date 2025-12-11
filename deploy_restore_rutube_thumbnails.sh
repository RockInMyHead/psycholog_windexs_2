#!/bin/bash

# Deploy script for restoring RuTube thumbnails on meditation cards
# Changes back to actual video thumbnails from RuTube API

set -e

echo "🎬 RESTORING RUTUBE THUMBNAILS FOR MEDITATIONS"
echo "=============================================="
echo ""

# Server details - update these for your server
SERVER_HOST="your-server-host"
SERVER_USER="your-username"
REMOTE_PATH="/path/to/your/app"

echo "📋 What this deployment restores:"
echo "  ✅ Original RuTube API thumbnail URLs for all meditations"
echo "  ✅ Actual video previews instead of generic Unsplash images"
echo "  ✅ Maintained full card clickability to open RuTube videos"
echo "  ✅ Fallback images if RuTube thumbnails fail to load"
echo ""
echo "🖼️ Thumbnail sources:"
echo "  - Медитация благодарности: RuTube API thumbnail"
echo "  - Медитация на дыхание: RuTube API thumbnail"
echo "  - Снятие стресса: RuTube API thumbnail"
echo "  - Метод Бутейко: RuTube API thumbnail"
echo "  - Лечебное дыхание: RuTube API thumbnail"
echo "  - Успокаивающее дыхание: RuTube API thumbnail"
echo "  - Дыхание в моменте: RuTube API thumbnail"
echo "  - Вечерняя медитация: RuTube API thumbnail"
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
echo "🖼️ Meditation cards now show authentic RuTube previews:"
echo "   - Click anywhere on a card to open the full RuTube video"
echo "   - Real video thumbnails from RuTube API"
echo "   - Fallback to Unsplash images if thumbnails fail"
echo "   - Better user experience with actual video previews"
echo ""
echo "🎬 Users can now see what each meditation video contains before clicking!"
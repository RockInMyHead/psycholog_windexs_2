#!/bin/bash

# Deploy script for meditation photos restoration and full card clickability
# Restores photos and makes entire meditation cards clickable

set -e

echo "🖼️ DEPLOYING MEDITATION PHOTOS & CLICKABILITY FIX"
echo "================================================"
echo ""

# Server details - update these for your server
SERVER_HOST="your-server-host"
SERVER_USER="your-username"
REMOTE_PATH="/path/to/your/app"

echo "📋 What this deployment restores:"
echo "  ✅ Beautiful Unsplash photos back on all meditation cards"
echo "  ✅ Entire meditation cards are now clickable (opens RuTube)"
echo "  ✅ Improved hover overlay with 'Открыть в RuTube' text"
echo "  ✅ Larger, more prominent play icon on hover"
echo "  ✅ Image fallback handling for failed thumbnail loads"
echo "  ✅ Better visual feedback for clickable cards"
echo ""
echo "🎨 Visual improvements:"
echo "  - Before: Plain cards with individual play buttons"
echo "  - After: Beautiful photo previews with full card clickability"
echo "  - Enhanced hover effects and clear call-to-action"
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
echo "🖼️ Meditation cards are now fully restored:"
echo "   - Beautiful photos for visual appeal"
echo "   - Click anywhere on card to open RuTube video"
echo "   - Clear hover indicators ('Открыть в RuTube')"
echo "   - Fallback images if thumbnails fail to load"
echo "   - Much better user experience!"
echo ""
echo "🧘 Users can now enjoy the full meditation experience with visual previews!"
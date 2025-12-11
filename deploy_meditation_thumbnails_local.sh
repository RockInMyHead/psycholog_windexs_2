#!/bin/bash

# Deploy script for using local photo.jpg thumbnails with placeholder fallback

set -e

echo "🖼️ DEPLOYING LOCAL MEDITATION THUMBNAILS"
echo "======================================="
echo ""

# Server details - update these for your server
SERVER_HOST="your-server-host"
SERVER_USER="your-username"
REMOTE_PATH="/path/to/your/app"

echo "📋 What this deployment does:"
echo "  ✅ Uses local photo.jpg for all meditation thumbnails"
echo "  ✅ Fallback to placeholder.svg on any load error"
echo "  ✅ No external CORS issues"
echo ""

echo "🔧 Files deployed:"
echo "  - src/pages/Meditations.tsx"
echo "  - public/photo.jpg"
echo "  - public/placeholder.svg"
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

echo "📦 Copying updated Meditations and assets..."
rsync -avz --delete \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    src/pages/Meditations.tsx \
    public/photo.jpg \
    public/placeholder.svg \
    "${SERVER_USER}@${SERVER_HOST}:${REMOTE_PATH}/src/pages/" \
    "${SERVER_USER}@${SERVER_HOST}:${REMOTE_PATH}/public/"

echo ""
echo -e "${GREEN}✅ Files updated successfully!${NC}"
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
echo "🧘 Meditations thumbnails now use local photo.jpg with placeholder fallback."
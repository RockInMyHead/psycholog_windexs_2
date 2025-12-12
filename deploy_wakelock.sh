#!/bin/bash

# Deploy script for wake lock support (keep screen awake during calls and meditations)

set -e

echo "🛡️ DEPLOYING WAKE LOCK SUPPORT"
echo "==============================="
echo ""

# Server details - update these for your server
SERVER_HOST="your-server-host"
SERVER_USER="your-username"
REMOTE_PATH="/path/to/your/app"

echo "📋 What this deployment does:"
echo "  ✅ Prevents screen sleep during active audio calls"
echo "  ✅ Prevents screen sleep on Meditations page"
echo "  ✅ Uses Screen Wake Lock API with re-acquire on visibility change"
echo "  ✅ Fails silently on unsupported browsers"
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

echo "📦 Copying updated files..."
rsync -avz --delete \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    src/hooks/useWakeLock.ts \
    src/pages/AudioCall.tsx \
    src/pages/Meditations.tsx \
    "${SERVER_USER}@${SERVER_HOST}:${REMOTE_PATH}/src/hooks/" \
    "${SERVER_USER}@${SERVER_HOST}:${REMOTE_PATH}/src/pages/"

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
echo "📱 Screen should now stay awake during calls and on the Meditations page."
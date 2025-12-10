#!/bin/bash

# Deploy script to revert iPhone voice call to original VAD implementation (commit e719b24)
# This reverts the recent complex VAD changes that broke iPhone voice calls

set -e

echo "🔄 DEPLOYING REVERT TO ORIGINAL VAD IMPLEMENTATION (e719b24)"
echo "======================================================"
echo ""

# Server details - update these for your server
SERVER_HOST="your-server-host"
SERVER_USER="your-username"
REMOTE_PATH="/path/to/your/app"

echo "📋 What this deployment does:"
echo "  ✅ Copies src/hooks/useTranscription.ts with fixed VAD logic"
echo "  ✅ Timer intervals: 3 seconds"
echo "  ✅ Audio sent every 3 seconds when voice detected"
echo "  ✅ VAD timeout: 20 seconds (gives user time to start speaking)"
echo "  ✅ lastVoiceActivityTime properly initialized with Date.now()"
echo "  ✅ Fixed immediate timer stop bug"
echo ""
echo "🎯 This fixes iPhone voice call issues by properly initializing VAD state"
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

echo "📦 Copying files to server..."
rsync -avz --delete \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    src/hooks/useTranscription.ts \
    "${SERVER_USER}@${SERVER_HOST}:${REMOTE_PATH}/src/hooks/"

echo ""
echo -e "${GREEN}✅ Files copied successfully!${NC}"
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
echo "📱 Test iPhone voice calls now - VAD timer should work properly"
echo "   - Timer runs every 3 seconds"
echo "   - Audio sent when voice detected"
echo "   - VAD stops after 20s of silence (gives time to speak)"
echo "   - No more immediate timer stops"
echo ""
echo "🐛 If issues persist, check server logs with:"
echo "   ssh ${SERVER_USER}@${SERVER_HOST} 'cd ${REMOTE_PATH} && docker-compose logs psycholog-psy-server-1'"
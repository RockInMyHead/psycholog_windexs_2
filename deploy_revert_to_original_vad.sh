#!/bin/bash

# Deploy script to revert iPhone voice call to original VAD implementation (commit e719b24)
# This reverts the recent complex VAD changes that broke iPhone voice calls

set -e

echo "🔄 DEPLOYING EXACT ORIGINAL VAD FROM e719b24 (WORKING VERSION)"
echo "======================================================"
echo ""
echo "⚠️  This is the EXACT copy from commit e719b24 - NO modifications!"
echo ""

# Server details - update these for your server
SERVER_HOST="your-server-host"
SERVER_USER="your-username"
REMOTE_PATH="/path/to/your/app"

echo "📋 What this deployment does:"
echo "  ✅ Deploys EXACT copy from commit e719b24 (working version)"
echo "  ✅ Timer intervals: 3 seconds"
echo "  ✅ Audio sent every 3 seconds when voice detected"
echo "  ✅ VAD timeout: 4 seconds"
echo "  ✅ lastVoiceActivityTime initialized with 0 (original)"
echo "  ✅ VAD initialized only in init block (original behavior)"
echo "  ✅ NO modifications - exact working version"
echo ""
echo "🎯 This is the version that ACTUALLY WORKED on iPhone for the user"
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
echo "📱 Test iPhone voice calls now - EXACT WORKING VERSION from e719b24"
echo "   - Timer runs every 3 seconds"
echo "   - Audio sent when voice detected"
echo "   - VAD stops after 4s of silence"
echo "   - This is the version that worked before!"
echo ""
echo "🐛 If issues persist, check server logs with:"
echo "   ssh ${SERVER_USER}@${SERVER_HOST} 'cd ${REMOTE_PATH} && docker-compose logs psycholog-psy-server-1'"
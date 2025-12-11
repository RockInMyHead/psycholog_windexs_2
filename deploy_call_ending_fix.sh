#!/bin/bash

# Deploy script for call ending cleanup fix
# Fixes issue where TTS and transcription continue after call end

set -e

echo "🛑 DEPLOYING CALL ENDING CLEANUP FIX"
echo "===================================="
echo ""

# Server details - update these for your server
SERVER_HOST="your-server-host"
SERVER_USER="your-username"
REMOTE_PATH="/path/to/your/app"

echo "📋 What this deployment fixes:"
echo "  ✅ TTS completely stops when call ends"
echo "  ✅ Speech recognition fully stops after call end"
echo "  ✅ No more Mark speaking after call termination"
echo "  ✅ Aggressive cleanup of all audio processes"
echo "  ✅ Proper state reset during call cleanup"
echo ""
echo "🎯 Technical changes:"
echo "  - Enhanced endCall() with multiple stop calls"
echo "  - Improved cleanup() in useTranscription hook"
echo "  - Reset TTS resumption flags during cleanup"
echo "  - Better logging for debugging cleanup process"
echo "  - Explicit stop calls for all audio components"
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

echo "📦 Copying updated AudioCall and transcription hook..."
rsync -avz --delete \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    src/pages/AudioCall.tsx \
    src/hooks/useTranscription.ts \
    "${SERVER_USER}@${SERVER_HOST}:${REMOTE_PATH}/src/pages/" \
    "${SERVER_USER}@${SERVER_HOST}:${REMOTE_PATH}/src/hooks/"

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
echo "📞 Call ending now works properly:"
echo "   - TTS stops immediately when call ends"
echo "   - Speech recognition is fully disabled"
echo "   - No more audio activity after call termination"
echo "   - Clean state reset for next call"
echo ""
echo "🧪 Test by making a call, then ending it - Mark should stop speaking completely!"
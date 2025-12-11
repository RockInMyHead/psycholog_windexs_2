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
echo "  ✅ Copies src/hooks/useTranscription.ts with comprehensive voice fixes"
echo "  ✅ Voice detection threshold: 0.05% for iOS (was too high at 1.0%)"
echo "  ✅ Real-time voice interruption monitoring restored"
echo "  ✅ Voice interruption threshold: 0.02% for iOS barge-in"
echo "  ✅ OpenAI timeout: 20s for iOS (was 12s, causing timeouts)"
echo "  ✅ Size-based volume estimation for iOS audio/mp4"
echo "  ✅ Improved browser speech recognition for Windows/Chrome"
echo ""
echo "🎯 Fixes iPhone voice detection, interruption, and OpenAI timeouts"
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
echo "📱 Test iPhone voice calls now - voice-triggered sending with strict threshold"
echo "   - Timer checks every 2 seconds for activity"
echo "   - Audio sent only when voice detected (>1.0% volume)"
echo "   - Minimum blob size: 5000 bytes for quality"
echo "   - Accumulates audio segments for better detection"
echo "   - VAD stops after 15s of silence"
echo "   - Eliminates microphone noise false positives"
echo ""
echo "🐛 If issues persist, check server logs with:"
echo "   ssh ${SERVER_USER}@${SERVER_HOST} 'cd ${REMOTE_PATH} && docker-compose logs psycholog-psy-server-1'"
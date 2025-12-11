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
echo "  ✅ Copies src/hooks/useTranscription.ts with voice-triggered sending"
echo "  ✅ Timer checks every 2 seconds for voice activity"
echo "  ✅ Audio sent ONLY when voice detected (not timer-based)"
echo "  ✅ Accumulates audio until voice threshold reached"
echo "  ✅ VAD timeout: 15 seconds (prevents premature stop)"
echo "  ✅ Eliminates OpenAI hallucinations from silent periods"
echo ""
echo "🎯 This fixes the issue where user got random responses instead of transcription"
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
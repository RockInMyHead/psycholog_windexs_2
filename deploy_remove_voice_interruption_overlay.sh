#!/bin/bash

# Deploy script for removing voice interruption visual overlay
# Removes red oval and interruption text from AudioCall interface

set -e

echo "🔴 REMOVING VOICE INTERRUPTION VISUAL OVERLAY"
echo "=============================================="
echo ""

# Server details - update these for your server
SERVER_HOST="your-server-host"
SERVER_USER="your-username"
REMOTE_PATH="/path/to/your/app"

echo "📋 What this deployment removes:"
echo "  ✅ Red oval ring around video during voice interruption"
echo "  ✅ '🎤 Прерывание' text overlay on video element"
echo "  ✅ voiceInterruptionDetected state and related logic"
echo "  ✅ Visual distraction that appeared on Windows Chrome"
echo ""
echo "🔊 What remains:"
echo "  ✅ Voice interruption functionality (TTS stopping when user speaks)"
echo "  ✅ Debug logging for voice interruption detection"
echo "  ✅ TTS reset and deduplication clearing"
echo "  ✅ All voice interruption logic except visual feedback"
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

echo "📦 Copying updated AudioCall component to server..."
rsync -avz --delete \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    src/pages/AudioCall.tsx \
    "${SERVER_USER}@${SERVER_HOST}:${REMOTE_PATH}/src/pages/"

echo ""
echo -e "${GREEN}✅ AudioCall component updated successfully!${NC}"
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
echo "🎨 Clean interface restored:"
echo "   - No more red oval overlay on Windows Chrome"
echo "   - No more 'Прерывание' text appearing on video"
echo "   - Voice interruption still works (TTS stops when speaking)"
echo "   - Cleaner, less distracting interface"
echo ""
echo "🗣️ Voice interruption functionality preserved without visual clutter!"
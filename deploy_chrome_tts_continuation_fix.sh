#!/bin/bash

# Deploy script for Chrome TTS continuation fix
# Fixes issue where user continues speaking after Mark's response but Mark doesn't hear

set -e

echo "🔊 DEPLOYING CHROME TTS CONTINUATION FIX"
echo "========================================"
echo ""

# Server details - update these for your server
SERVER_HOST="your-server-host"
SERVER_USER="your-username"
REMOTE_PATH="/path/to/your/app"

echo "📋 What this deployment fixes:"
echo "  ✅ Chrome now hears user speech continuation after TTS ends"
echo "  ✅ No more need to pause before speaking again"
echo "  ✅ Immediate interim transcript sending after TTS resumption"
echo "  ✅ Better conversation flow on desktop browsers"
echo ""
echo "🎯 Technical changes:"
echo "  - Added justResumedAfterTTS flag in useTranscription"
echo "  - First interim transcript sent immediately after TTS pause"
echo "  - Flag resets after sending to prevent spam"
echo "  - Maintains final transcript processing for accuracy"
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

echo "📦 Copying updated transcription hook..."
rsync -avz --delete \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    src/hooks/useTranscription.ts \
    "${SERVER_USER}@${SERVER_HOST}:${REMOTE_PATH}/src/hooks/"

echo ""
echo -e "${GREEN}✅ Transcription hook updated successfully!${NC}"
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
echo "🗣️ Chrome voice chat improvements:"
echo "   - Users can continue speaking immediately after Mark responds"
echo "   - No more 'Mark doesn't hear me' issues"
echo "   - First interim transcript sent immediately after TTS"
echo "   - Better real-time conversation experience"
echo ""
echo "🧪 Test by having Mark respond, then immediately continue speaking without pausing!"
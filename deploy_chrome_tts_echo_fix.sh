#!/bin/bash

# Deploy script for Chrome TTS echo capture fix
# Prevents system from hearing TTS audio as user speech

set -e

echo "🔊 DEPLOYING CHROME TTS ECHO CAPTURE FIX"
echo "========================================"
echo ""

# Server details - update these for your server
SERVER_HOST="your-server-host"
SERVER_USER="your-username"
REMOTE_PATH="/path/to/your/app"

echo "📋 What this deployment fixes:"
echo "  ✅ Chrome no longer captures TTS audio as user speech"
echo "  ✅ Mark doesn't hear his own voice ending ('беспокоит')"
echo "  ✅ Longer delay before resuming speech recognition after TTS"
echo "  ✅ Echo protection period ignores interim results after TTS"
echo "  ✅ Better TTS/speech recognition synchronization"
echo ""
echo "🎯 Technical changes:"
echo "  - TTS resume delay: 400ms → 1200ms for Chrome"
echo "  - Echo protection: ignore interim for 2s after TTS on Chrome"
echo "  - TTS end time tracking to prevent echo capture"
echo "  - Enhanced logging for echo protection debugging"
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
echo "🎙️ TTS echo protection now active:"
echo "   - Longer delay before resuming speech recognition"
echo "   - Echo protection ignores interim results after TTS"
echo "   - No more TTS audio captured as user speech"
echo "   - Mark's voice endings don't trigger responses"
echo ""
echo "🧪 Test by starting a call - Mark should not hear his own 'Что вас беспокоит?' ending!"
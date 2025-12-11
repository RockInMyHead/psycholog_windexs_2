#!/bin/bash

# Deploy script for iOS TTS audio playback fixes
# Fixes TTS not working on iPhone by addressing autoplay restrictions

set -e

echo "🔊 DEPLOYING IOS TTS AUDIO PLAYBACK FIXES"
echo "=========================================="
echo ""

# Server details - update these for your server
SERVER_HOST="your-server-host"
SERVER_USER="your-username"
REMOTE_PATH="/path/to/your/app"

echo "📋 What this deployment fixes:"
echo "  ✅ iOS TTS audio playback now works properly"
echo "  ✅ WAV format used instead of MP3 for better iOS compatibility"
echo "  ✅ User interaction detection before autoplay attempts"
echo "  ✅ AudioContext initialization and resume on iOS"
echo "  ✅ Better error handling for mobile Safari restrictions"
echo ""
echo "🎵 Technical fixes:"
echo "  - WAV audio format for iOS (vs MP3 for other devices)"
echo "  - AudioContext resume on user interaction"
echo "  - Autoplay failure detection with user guidance"
echo "  - Fallback error handling for iOS audio issues"
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

echo "📦 Copying updated Chat and OpenAI service files..."
rsync -avz --delete \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    src/pages/Chat.tsx \
    src/services/openai.ts \
    "${SERVER_USER}@${SERVER_HOST}:${REMOTE_PATH}/src/pages/" \
    "${SERVER_USER}@${SERVER_HOST}:${REMOTE_PATH}/src/services/"

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
echo "📱 iOS TTS audio should now work:"
echo "   - Click speaker icon on chat messages"
echo "   - Audio should play on iPhone/iPad"
echo "   - If blocked, follow on-screen instructions"
echo "   - WAV format ensures better compatibility"
echo ""
echo "🧪 Test by sending a message and clicking the speaker button on AI responses!"
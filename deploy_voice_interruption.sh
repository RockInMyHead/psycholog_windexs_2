#!/bin/bash

# Deploy script for iPhone voice interruption feature
# Adds ability to interrupt psychologist by speaking

set -e

echo "🎤 DEPLOYING IPHONE VOICE INTERRUPTION FEATURE"
echo "=============================================="
echo ""

# Server details - update these for your server
SERVER_HOST="your-server-host"
SERVER_USER="your-username"
REMOTE_PATH="/path/to/your/app"

echo "📋 What this deployment adds:"
echo "  ✅ Voice interruption on iPhone - interrupt psychologist by speaking"
echo "  ✅ Lower threshold (0.8%) for reliable voice detection during TTS"
echo "  ✅ Visual feedback when interruption occurs (red ring + text)"
echo "  ✅ TTS automatically stops and resets when interrupted"
echo "  ✅ More natural conversation flow"
echo ""
echo "🎯 User experience:"
echo "  - Psychologist is speaking → user starts talking → TTS stops immediately"
echo "  - Visual indication shows interruption occurred"
echo "  - System starts listening to user input"
echo "  - No more waiting for psychologist to finish speaking"
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

echo "📦 Copying updated components to server..."
rsync -avz --delete \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    src/pages/AudioCall.tsx \
    src/hooks/useTranscription.ts \
    "${SERVER_USER}@${SERVER_HOST}:${REMOTE_PATH}/src/pages/" \
    "${SERVER_USER}@${SERVER_HOST}:${REMOTE_PATH}/src/hooks/"

echo ""
echo -e "${GREEN}✅ Components updated successfully!${NC}"
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
echo "🎤 Voice interruption now works on iPhone:"
echo "   - Speak while psychologist talks → TTS stops immediately"
echo "   - Red ring appears around video with 'Прерывание' text"
echo "   - System starts listening to your response"
echo "   - Much more natural conversation flow!"
echo ""
echo "🧪 Test by starting a conversation and interrupting the psychologist mid-sentence"
#!/bin/bash

# Deploy script for iPhone microphone mute button fix
# Fixes the issue where mute button didn't actually stop audio recording

set -e

echo "🎤 DEPLOYING IPHONE MICROPHONE MUTE FIX"
echo "======================================="
echo ""

# Server details - update these for your server
SERVER_HOST="your-server-host"
SERVER_USER="your-username"
REMOTE_PATH="/path/to/your/app"

echo "📋 What this deployment fixes:"
echo "  ✅ iPhone mute button now properly stops audio recording"
echo "  ✅ toggleMute uses MediaRecorder controls instead of Speech Recognition"
echo "  ✅ Transcription is ignored when microphone is muted"
echo "  ✅ Visual feedback shows correct mute state"
echo ""
echo "🐛 Previous issue:"
echo "  - Mute button only controlled Speech Recognition API"
echo "  - MediaRecorder continued recording audio"
echo "  - User thought mic was off but audio was still being captured"
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
echo "📱 iPhone microphone mute button now works correctly:"
echo "   - Press mute button → audio recording stops"
echo "   - Press unmute button → audio recording resumes"
echo "   - No more accidental audio capture when muted"
echo ""
echo "🐛 If issues persist, check browser console for MediaRecorder errors"
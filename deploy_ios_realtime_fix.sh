#!/bin/bash

# Deploy script for iOS realtime transcription fix
# - iOS now sends audio chunks immediately without 2s timer delay
# - Maintains timer-based accumulation for Android

set -e

SERVER_HOST="your-server-host"
SERVER_USER="your-username"
REMOTE_PATH="/path/to/your/app"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "📱 DEPLOYING IOS REALTIME TRANSCRIPTION FIX"
echo "=========================================="
echo ""
echo "🎯 Changes:"
echo "  ✅ iOS: Realtime audio chunks sent immediately to OpenAI"
echo "  ✅ Android: Maintains 2s timer with voice detection"
echo "  ✅ No more 2s delay on iPhone voice recognition"
echo ""

echo "🔍 Checking local changes..."
if ! git diff --quiet; then
  echo -e "${YELLOW}⚠️  Uncommitted changes detected. Please commit or stash first.${NC}"
  exit 1
fi

echo "📦 Copying updated transcription hook..."
rsync -avz --delete \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='*.log' \
  src/hooks/useTranscription.ts \
  "${SERVER_USER}@${SERVER_HOST}:${REMOTE_PATH}/src/hooks/"

echo -e "${GREEN}✅ Files updated${NC}\n"

echo "🔄 Restarting server..."
ssh "${SERVER_USER}@${SERVER_HOST}" "cd ${REMOTE_PATH} && docker-compose restart psycholog-psy-server-1"

echo -e "${GREEN}✅ Server restarted${NC}\n"

echo "📊 Checking server status..."
sleep 3
ssh "${SERVER_USER}@${SERVER_HOST}" "cd ${REMOTE_PATH} && docker-compose logs --tail=10 psycholog-psy-server-1"

echo -e "\n🎉 DEPLOYMENT COMPLETE!"
echo ""
echo "📱 Test iPhone voice calls now:"
echo "  - Voice should be recognized immediately (no 2s delay)"
echo "  - Text should appear in logs instantly when speaking"
echo "  - Android behavior unchanged (2s timer)"
echo ""
echo "🐛 If issues persist, check server logs:"
echo "   ssh ${SERVER_USER}@${SERVER_HOST} 'docker logs psycholog-psy-server-1'"

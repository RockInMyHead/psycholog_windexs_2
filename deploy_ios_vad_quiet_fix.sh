#!/bin/bash

# Deploy script for iOS VAD quiet speech fix
# - Stops MediaRecorder/stream when VAD timer stops
# - Increases VAD timeout to 30s (less aggressive)
# - Lowers iOS volume threshold to 0.5% (quiet speech)

set -e

echo "🍏 DEPLOYING IOS VAD QUIET SPEECH FIX"
echo "====================================="
echo ""

SERVER_HOST="your-server-host"
SERVER_USER="your-username"
REMOTE_PATH="/path/to/your/app"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

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

echo "\n🎉 DEPLOYMENT COMPLETE"
echo "- VAD timeout: 30s"
echo "- iOS volume threshold: 0.5%"
echo "- Recorder/stream stop when timer stops"
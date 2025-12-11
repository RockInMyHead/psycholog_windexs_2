#!/bin/bash

# Deploy script for Chrome interim transcript processing fix
# Fixes premature LLM calls when users speak long phrases

set -e

echo "🔧 DEPLOYING CHROME INTERIM TRANSCRIPT FIX"
echo "=========================================="
echo ""

# Server details - update these for your server
SERVER_HOST="your-server-host"
SERVER_USER="your-username"
REMOTE_PATH="/path/to/your/app"

echo "📋 What this deployment fixes:"
echo "  ✅ Chrome no longer sends interim transcripts to LLM prematurely"
echo "  ✅ Users can speak complete sentences without interruption"
echo "  ✅ AI waits for final speech recognition before responding"
echo "  ✅ Fixes 'меня беспокоит тревога' being heard as just 'беспокоит'"
echo ""
echo "🎯 Technical changes:"
echo "  - Removed onTranscriptionComplete calls for interim results"
echo "  - Only final transcripts trigger LLM processing"
echo "  - Interim results still logged for debugging"
echo "  - Cleaner speech flow on desktop browsers"
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
echo "   - Users can now speak complete thoughts"
echo "   - No more premature AI responses to partial speech"
echo "   - Better conversation flow on desktop"
echo "   - Interim transcripts still visible in logs for debugging"
echo ""
echo "🧪 Test by saying a long sentence like 'меня беспокоит тревога' and verify AI hears the complete phrase!"
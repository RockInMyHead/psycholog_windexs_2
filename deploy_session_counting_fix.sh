#!/bin/bash

# Deploy script for audio session counting fix
# Fixes issue where sessions were counted on call start instead of meaningful calls

set -e

echo "📊 DEPLOYING AUDIO SESSION COUNTING FIX"
echo "======================================="
echo ""

# Server details - update these for your server
SERVER_HOST="your-server-host"
SERVER_USER="your-username"
REMOTE_PATH="/path/to/your/app"

echo "📋 What this deployment fixes:"
echo "  ✅ Sessions no longer counted when call starts"
echo "  ✅ Sessions counted only when call ends AND lasted ≥30 seconds"
echo "  ✅ Free tier users don't lose sessions on accidental calls"
echo "  ✅ Premium tier sessions still counted as before"
echo "  ✅ More fair session usage tracking"
echo ""
echo "🐛 Previous issue:"
echo "  - User starts call → session counted as used immediately"
echo "  - User hangs up → session lost even if no conversation happened"
echo "  - 4 free sessions could be wasted on quick test calls"
echo ""
echo "✅ New behavior:"
echo "  - User starts call → no session counted yet"
echo "  - User talks for ≥30 seconds → session counted when call ends"
echo "  - User hangs up quickly → no session used"
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
echo "💰 Better session management:"
echo "   - Test calls don't waste free sessions"
echo "   - Sessions counted only for meaningful conversations"
echo "   - 30+ second minimum for free tier counting"
echo "   - Premium tier unchanged (counts all calls)"
echo ""
echo "🧪 Users can now safely test calls without losing free sessions!"
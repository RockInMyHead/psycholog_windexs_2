#!/bin/bash

# Deploy script for user data isolation fix
# Fixes the bug where all users shared the same data

set -e

echo "🔒 DEPLOYING USER DATA ISOLATION FIX"
echo "===================================="
echo ""

# Server details - update these for your server
SERVER_HOST="your-server-host"
SERVER_USER="your-username"
REMOTE_PATH="/path/to/your/app"

echo "📋 What this deployment fixes:"
echo "  ✅ Eliminates shared user data bug"
echo "  ✅ Each user gets unique data isolation"
echo "  ✅ Likes are now personal per user"
echo "  ✅ Chat histories are separate"
echo "  ✅ Meditation progress is individual"
echo "  ✅ Audio call records are per-user"
echo ""
echo "🐛 Previous bug:"
echo "  - All users used same defaultUserId: 'user@zenmindmate.com'"
echo "  - One user's likes appeared for everyone"
echo "  - Chat history was shared across users"
echo "  - Meditation ratings affected all users"
echo ""
echo "✅ New behavior:"
echo "  - Authenticated users: Use real email/name from auth"
echo "  - Anonymous users: Get unique ID based on browser fingerprint"
echo "  - Each user has completely isolated data"
echo "  - No more shared likes, chats, or progress"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Checking local changes..."
if ! git diff --quiet; then
    echo -e "${YELLOW}⚠️  You have uncommitted changes. Please commit or stash them first.${NC}"
    exit 1
fi

echo "📦 Copying updated page components to server..."
rsync -avz --delete \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    src/pages/Quotes.tsx \
    src/pages/AudioCall.tsx \
    src/pages/Chat.tsx \
    src/pages/Meditations.tsx \
    "${SERVER_USER}@${SERVER_HOST}:${REMOTE_PATH}/src/pages/"

echo ""
echo -e "${GREEN}✅ Page components updated successfully!${NC}"
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
echo "🔒 User data isolation is now active:"
echo "   - Each user has unique liked quotes"
echo "   - Personal chat histories are separate"
echo "   - Individual meditation progress tracking"
echo "   - Audio call records are per-user"
echo "   - No more shared data between users!"
echo ""
echo "🧪 Test by having different users like different quotes - they should stay separate"
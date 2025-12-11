#!/bin/bash

# Deploy script for subscription buttons alignment fix
# Makes all "Купить" buttons same width and height

set -e

echo "📐 DEPLOYING SUBSCRIPTION BUTTONS ALIGNMENT FIX"
echo "=============================================="
echo ""

# Server details - update these for your server
SERVER_HOST="your-server-host"
SERVER_USER="your-username"
REMOTE_PATH="/path/to/your/app"

echo "📋 What this deployment fixes:"
echo "  ✅ All subscription buttons now have identical dimensions"
echo "  ✅ Fixed width: 192px (w-48)"
echo "  ✅ Fixed height: 48px (h-12)"
echo "  ✅ Perfect visual alignment across all pricing cards"
echo ""
echo "🎨 Visual improvement:"
echo "  - Before: Buttons had different widths based on text length"
echo "  - After: All buttons are perfectly aligned and uniform"
echo "  - Consistent user experience across all pricing tiers"
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

echo "📦 Copying updated Subscription page to server..."
rsync -avz --delete \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    src/pages/Subscription.tsx \
    "${SERVER_USER}@${SERVER_HOST}:${REMOTE_PATH}/src/pages/"

echo ""
echo -e "${GREEN}✅ Subscription page updated successfully!${NC}"
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
echo "📐 Subscription buttons are now perfectly aligned:"
echo "   - All 'Купить' buttons have identical width (192px)"
echo "   - Consistent height (48px) for visual harmony"
echo "   - Professional appearance on pricing page"
echo ""
echo "💳 Improved user experience for subscription selection!"
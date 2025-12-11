#!/bin/bash

# Deploy script for RuTube meditation videos update
# Updates meditation content with new RuTube video links

set -e

echo "🌿 DEPLOYING RUTUBE MEDITATION VIDEOS UPDATE"
echo "============================================="
echo ""

# Server details - update these for your server
SERVER_HOST="your-server-host"
SERVER_USER="your-username"
REMOTE_PATH="/path/to/your/app"

echo "📋 What this deployment does:"
echo "  ✅ Updates src/pages/Meditations.tsx with new RuTube video content"
echo "  ✅ Adds 8 meditation modules with breathing and relaxation techniques"
echo "  ✅ Implements RuTube iframe embedding support"
echo "  ✅ Adds fallback links for RuTube videos"
echo ""
echo "🎯 New meditation content:"
echo "  • Медитация благодарности - психологическая сессия"
echo "  • Медитация на дыхание - фон моря"
echo "  • Снятие стресса - гармонизация дыхания"
echo "  • Метод Бутейко - лечебное дыхание"
echo "  • Лечебное дыхание - для снятия стресса"
echo "  • Успокаивающее дыхание - релаксация"
echo "  • Дыхание в моменте - контроль и спокойствие"
echo "  • Вечерняя медитация - для хорошего сна"
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

echo "📦 Copying updated meditation component to server..."
rsync -avz --delete \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    src/pages/Meditations.tsx \
    "${SERVER_USER}@${SERVER_HOST}:${REMOTE_PATH}/src/pages/"

echo ""
echo -e "${GREEN}✅ Meditation component updated successfully!${NC}"
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
echo "🌿 New meditation videos are now available:"
echo "   - All videos from RuTube with Russian breathing techniques"
echo "   - Embedded video player in meditation modal"
echo "   - Fallback links for external viewing"
echo ""
echo "🧘 Users can now enjoy authentic Russian meditation and breathing practices!"
echo ""
echo "🐛 If videos don't load, check RuTube embedding permissions or use fallback links"
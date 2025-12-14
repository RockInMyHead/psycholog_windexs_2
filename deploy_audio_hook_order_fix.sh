#!/bin/bash

# Deploy script for Audio Call Hook Order Fix
# Fixes "Cannot access uninitialized variable" error on /audio page

set -e

echo "🔧 DEPLOYING AUDIO CALL HOOK ORDER FIX"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "📋 What this deployment fixes:"
echo "  ✅ Fixed hook initialization order in AudioCall component"
echo "  ✅ useTTS now initializes BEFORE useTranscription"
echo "  ✅ stopTTS and resetDeduplication functions available when needed"
echo "  ✅ Resolved 'Cannot access uninitialized variable' error"
echo ""

echo "🔍 Building production bundle..."
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed!${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Build successful!${NC}"
echo ""

echo "📦 Build output created in dist/"
echo ""
echo "🚀 Next steps for deployment:"
echo "   1. Upload the dist/ folder to your server"
echo "   2. Make sure the files are served by nginx/apache"
echo "   3. Clear browser cache and test https://psycholog.windexs.ru/audio"
echo ""
echo "Manual deployment commands:"
echo "   scp -r dist/* user@server:/var/www/psycholog.windexs.ru/"
echo "   or use FTP/SFTP client to upload dist/ contents"
echo ""
echo "🎉 LOCAL BUILD COMPLETE!"
echo ""
echo "🧪 The fix includes:"
echo "   - Reordered hook initialization (useTTS → useLLM → useTranscription)"
echo "   - Proper callback dependencies"
echo "   - Stable function references across renders"
echo ""


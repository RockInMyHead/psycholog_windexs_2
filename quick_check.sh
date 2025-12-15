#!/bin/bash

# Quick check for deployment status
echo "🔍 QUICK DEPLOYMENT CHECK"
echo "========================"

REMOTE_PATH="/var/www/psycholog.windexs.ru"

echo "Checking JavaScript files:"
ls -la "$REMOTE_PATH/assets/" | grep "index-.*\.js"

echo ""
echo "Checking which JS file is in HTML:"
curl -s "https://psycholog.windexs.ru" | grep -o "index-[a-zA-Z0-9_-]*\.js"

echo ""
echo "If you see 'index-Dtn52uhQ.js' - files not updated!"
echo "If you see 'index-D9_ZgnPJ.js' - deployment successful!"
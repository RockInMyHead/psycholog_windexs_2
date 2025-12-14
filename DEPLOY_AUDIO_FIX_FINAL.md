# 🚀 DEPLOY AUDIO FIX - FINAL INSTRUCTIONS

## ✅ Problem Solved
**Error:** `ReferenceError: Cannot access uninitialized variable` on `/audio` page

**Root Cause:** Wrong React hooks initialization order in `AudioCall.tsx`

**Solution:** Reordered hooks: `useTTS` → `useLLM` → `useTranscription`

---

## 📦 Deployment Ready

### Files Created:
- ✅ `dist/` - Production build (ready to deploy)
- ✅ `audio-fix-deploy.tar.gz` - Compressed archive (3.2MB)
- ✅ `DEPLOYMENT_GUIDE_AUDIO_FIX.md` - Detailed deployment guide
- ✅ Commit pushed to repository

### Build Status:
```
✓ 1871 modules transformed.
✓ built in 4.30s
```

---

## 🚀 DEPLOYMENT METHODS

### Method 1: Direct Upload (Recommended)
```bash
# Upload the compressed archive to server
scp audio-fix-deploy.tar.gz svr@psycholog.windexs.ru:~/

# On server:
ssh svr@psycholog.windexs.ru
cd /var/www/psycholog.windexs.ru/
tar -xzf ~/audio-fix-deploy.tar.gz
rm -f ~/audio-fix-deploy.tar.gz
```

### Method 2: FTP/SFTP Upload
1. Connect to `psycholog.windexs.ru` via FTP/SFTP
2. Navigate to `/var/www/psycholog.windexs.ru/`
3. Upload all files from local `dist/` folder
4. Overwrite existing files

### Method 3: Rsync (if SSH works)
```bash
rsync -avz --progress dist/ svr@psycholog.windexs.ru:/var/www/psycholog.windexs.ru/
```

---

## 🧪 TESTING AFTER DEPLOYMENT

### Step 1: Clear Browser Cache
- Open browser dev tools (F12)
- Right-click refresh button → "Empty Cache and Hard Reload"
- Or: Ctrl+Shift+R (Chrome/Firefox)

### Step 2: Test the Page
1. Go to: https://psycholog.windexs.ru/audio
2. Open browser console (F12 → Console tab)
3. **Expected:** No `ReferenceError: Cannot access uninitialized variable`
4. **Expected:** Page loads without errors

### Step 3: Test Audio Call
1. Click "Позвонить" button
2. Grant microphone access
3. Speak to Mark
4. **Expected:** No crashes, TTS works, STT works

### Step 4: Verify Fix
- Check console logs - should see hook initialization in correct order
- No more "Cannot access uninitialized variable" errors

---

## 🔍 TECHNICAL VERIFICATION

### Code Changes Made:
```javascript
// BEFORE (BROKEN):
const { processUserMessage } = useLLM({...});
const { ... } = useTranscription({
  onInterruption: () => stopTTS() // ❌ stopTTS undefined
});
const { stop: stopTTS } = useTTS({...}); // ❌ Too late!

// AFTER (FIXED):
const { stop: stopTTS } = useTTS({...}); // ✅ First
const { processUserMessage } = useLLM({...}); // ✅ Second
const { ... } = useTranscription({
  onInterruption: () => stopTTS() // ✅ stopTTS available
}); // ✅ Last
```

### Hook Dependencies:
- `useTTS`: No dependencies on other hooks
- `useLLM`: Depends on `speak()` from `useTTS`
- `useTranscription`: Depends on `stopTTS()`, `resetDeduplication()` from `useTTS`

---

## 🚨 ROLLBACK PLAN

If deployment fails:
```bash
# On server
cd /var/www/psycholog.windexs.ru/
git checkout HEAD~1 dist/
# OR restore from backup
cp -r backup-dist/* .
```

---

## 📞 SUPPORT

If you need help with deployment:
1. SSH access issues: Check SSH keys, contact server admin
2. File permissions: `chown -R www-data:www-data /var/www/psycholog.windexs.ru/`
3. Nginx issues: Check nginx config, restart service
4. Contact: Check server logs in `/var/log/nginx/error.log`

---

## ✅ READY FOR DEPLOYMENT!

**Build:** ✅ Ready
**Testing:** ✅ Local tests pass
**Archive:** ✅ `audio-fix-deploy.tar.gz` (3.2MB)
**Documentation:** ✅ Complete guides available

**Next step:** Upload files to server and test! 🎉
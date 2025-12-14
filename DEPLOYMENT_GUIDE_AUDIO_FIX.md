# 🔧 Audio Call Hook Order Fix - Manual Deployment Guide

## Problem Fixed
**Error:** "Cannot access uninitialized variable" on `/audio` page

**Root Cause:** Hooks in `AudioCall.tsx` were initialized in wrong order - `useTranscription` was trying to use `stopTTS()` and `resetDeduplication()` functions before they were created by `useTTS` hook.

## Solution
Changed hook initialization order in `src/pages/AudioCall.tsx`:
1. **useTTS** - initialized FIRST (provides stopTTS, resetDeduplication)
2. **useLLM** - initialized SECOND (uses speak from useTTS)
3. **useTranscription** - initialized LAST (uses stopTTS, resetDeduplication)

## Files Changed
- `src/pages/AudioCall.tsx` - reordered hook initialization (lines 194-345)

## Deployment Steps

### Option 1: Automatic Upload (if SSH is configured)
```bash
# Build the project
npm run build

# Upload to server (requires SSH access)
rsync -avz dist/ svr@psycholog.windexs.ru:/var/www/psycholog.windexs.ru/
```

### Option 2: Manual Upload via FTP/SFTP

1. **Build the project locally:**
   ```bash
   npm run build
   ```

2. **Connect to server via FTP/SFTP:**
   - Host: `psycholog.windexs.ru` or `77.37.146.116`
   - Username: `svr` (or your username)
   - Protocol: SFTP (port 22)

3. **Upload files:**
   - Navigate to: `/var/www/psycholog.windexs.ru/`
   - Upload all contents from local `dist/` folder
   - Make sure to overwrite existing files

4. **Verify deployment:**
   - Clear browser cache (Ctrl+Shift+Delete)
   - Visit: https://psycholog.windexs.ru/audio
   - The error should be gone!

### Option 3: Docker Deployment (if using containers)

```bash
# Build
npm run build

# Copy to container or rebuild image
docker cp dist/. container_name:/var/www/psycholog.windexs.ru/

# Or rebuild and restart
docker-compose up -d --build
```

## Testing After Deployment

1. **Clear browser cache completely** (important!)
2. Open: https://psycholog.windexs.ru/audio
3. Check browser console (F12) - should see no errors
4. Try starting an audio call
5. Verify that hooks initialize in correct order

## Technical Details

### Before (BROKEN):
```javascript
// useLLM initialized first - uses speak()
const { speak, ... } = useLLM({ 
  onResponseGenerated: async (text) => {
    await speak(text); // speak is undefined here!
  }
});

// useTranscription - uses stopTTS(), resetDeduplication()
const { ... } = useTranscription({
  onInterruption: () => {
    stopTTS(); // stopTTS is undefined here!
    resetDeduplication(); // resetDeduplication is undefined here!
  }
});

// useTTS initialized LAST - provides functions too late
const { speak, stopTTS, resetDeduplication } = useTTS({ ... });
```

### After (FIXED):
```javascript
// useTTS initialized FIRST - functions available immediately
const { speak, stopTTS, resetDeduplication } = useTTS({ ... });

// useLLM second - can safely use speak()
const { ... } = useLLM({
  onResponseGenerated: async (text) => {
    await speak(text); // ✅ speak is defined
  }
});

// useTranscription last - can safely use stopTTS, resetDeduplication
const { ... } = useTranscription({
  onInterruption: () => {
    stopTTS(); // ✅ stopTTS is defined
    resetDeduplication(); // ✅ resetDeduplication is defined
  }
});
```

## Rollback Plan

If something goes wrong, restore previous version:
```bash
# On server
cd /var/www/psycholog.windexs.ru/
git checkout HEAD~1 dist/
# or restore from backup
```

## Support

If deployment fails:
1. Check SSH access: `ssh svr@psycholog.windexs.ru`
2. Check server logs: `tail -f /var/log/nginx/error.log`
3. Verify file permissions: `ls -la /var/www/psycholog.windexs.ru/`
4. Contact server administrator for access

---

**Build timestamp:** $(date)
**Build location:** `dist/`
**Production URL:** https://psycholog.windexs.ru/audio

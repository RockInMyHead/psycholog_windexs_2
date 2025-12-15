# DEPLOYMENT VIA GITHUB (No Direct Server Access)

## Problem: "Cannot access uninitialized variable" error persists
## Solution: Update JavaScript bundle from GitHub

---

## STEP 1: DOWNLOAD FILES FROM GITHUB

### Option A: Download Archive (Recommended)
```
URL: https://github.com/RockInMyHead/psycholog_windexs_2/raw/main/audio-fix-deploy.tar.gz

Download this file to your computer.
```

### Option B: Download Individual Files
If archive download fails, download these files individually:

1. `index.html`
   - URL: https://github.com/RockInMyHead/psycholog_windexs_2/raw/main/dist/index.html

2. `assets/index-D9_ZgnPJ.js` (NEW - replaces old index-Dtn52uhQ.js)
   - URL: https://github.com/RockInMyHead/psycholog_windexs_2/raw/main/dist/assets/index-D9_ZgnPJ.js

3. `assets/index-DTCsXawP.css`
   - URL: https://github.com/RockInMyHead/psycholog_windexs_2/raw/main/dist/assets/index-DTCsXawP.css

---

## STEP 2: UPLOAD TO SERVER

### Via Hosting Control Panel
1. Login to your hosting control panel (cPanel, Plesk, etc.)
2. Go to File Manager
3. Navigate to `/var/www/psycholog.windexs.ru/`
4. Upload and overwrite these files:
   - `index.html`
   - `assets/index-D9_ZgnPJ.js` (replace `index-Dtn52uhQ.js`)
   - `assets/index-DTCsXawP.css`

### Via FTP/SFTP
1. Connect to your server via FTP/SFTP
2. Host: 77.37.146.116 or psycholog.windexs.ru
3. Navigate to `/var/www/psycholog.windexs.ru/`
4. Upload files and overwrite existing ones

### Via Archive Upload
If your hosting allows archive upload:
1. Upload `audio-fix-deploy.tar.gz` to server
2. Extract it in `/var/www/psycholog.windexs.ru/`
3. The `dist/` folder contents will be extracted correctly

---

## STEP 3: VERIFY DEPLOYMENT

After uploading, check that the website loads the correct file:

**Check JavaScript file in browser:**
1. Open https://psycholog.windexs.ru/audio
2. Press F12 → Console
3. Look for logs - should show "index-D9_ZgnPJ.js" instead of "index-Dtn52uhQ.js"

**Or check via command line:**
```bash
curl -s "https://psycholog.windexs.ru" | grep "index-.*\.js"
# Should return: index-D9_ZgnPJ.js
```

---

## STEP 4: CLEAR CACHE

After deployment:
1. **Browser cache:** Ctrl+Shift+R (hard refresh)
2. **Server cache:** If using CDN, clear CDN cache
3. **Hosting cache:** Check hosting panel for cache clearing options

---

## CRITICAL FILES TO REPLACE

| Old File | New File | Status |
|----------|----------|--------|
| `index-Dtn52uhQ.js` | `index-D9_ZgnPJ.js` | **MUST REPLACE** |
| Old `index.html` | New `index.html` | Replace |
| Old `index-DTCsXawP.css` | Same file | Keep latest |

---

## IF STILL BROKEN

If error persists after deployment:

1. **Verify files:** Check that `index-D9_ZgnPJ.js` exists on server
2. **Check path:** Files must be in `/var/www/psycholog.windexs.ru/`
3. **Permissions:** Files should be readable (644)
4. **Reload services:** If you have access, reload nginx/apache

---

## EMERGENCY MANUAL FIX

If automatic methods fail:

1. Download `index-D9_ZgnPJ.js` from GitHub
2. On server, backup old file: `cp index-Dtn52uhQ.js index-Dtn52uhQ.js.backup`
3. Replace: `cp index-D9_ZgnPJ.js index-Dtn52uhQ.js`
4. Or rename: `mv index-D9_ZgnPJ.js index-Dtn52uhQ.js`

This forces the server to use the fixed JavaScript bundle.

---

**DOWNLOAD FROM GITHUB AND UPLOAD TO SERVER NOW! 🚀**
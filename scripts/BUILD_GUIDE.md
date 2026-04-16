# ClipStream — Build & Distribution Guide

## One-time setup (run these once on your Mac)

```bash
# 1. Install dependencies
npm install

# 2. Generate the .icns icon (macOS only — uses built-in iconutil)
bash scripts/build-icons.sh
```

---

## Build the distributable app

### macOS (.dmg + .zip)
```bash
npm run build:mac
```
Output: `dist-electron/ClipStream-1.0.0.dmg`
→ Share the `.dmg` — users drag ClipStream into their Applications folder.

> **First launch warning:** Since the app isn't notarized with an Apple Developer account ($99/yr),
> macOS will show a security warning. Users just need to:
> Right-click the app → Open → Open (once only).

### Windows (.exe installer)
```bash
npm run build:win
```
Output: `dist-electron/ClipStream Setup 1.0.0.exe`
→ Share the `.exe` — users run the installer.

---

## Sharing the app

### Option A — Direct share (free)
Upload the `.dmg` / `.exe` to:
- Google Drive / Dropbox → share a link
- GitHub Releases (free) → `github.com/YOUR_NAME/ClipStream/releases`

### Option B — Website download button
Host the file on GitHub Releases and link to it from your site:

```html
<a href="https://github.com/YOUR_NAME/ClipStream/releases/latest/download/ClipStream-1.0.0.dmg">
  Download for Mac
</a>
<a href="https://github.com/YOUR_NAME/ClipStream/releases/latest/download/ClipStream-Setup-1.0.0.exe">
  Download for Windows
</a>
```

### Option C — Auto-updates (for future versions)
The app already has `electron-updater` installed. To enable it, publish releases
to GitHub and add this to `package.json` build config:

```json
"publish": {
  "provider": "github",
  "owner": "YOUR_GITHUB_USERNAME",
  "repo": "ClipStream"
}
```

Then run: `npm run build:mac -- --publish always`

---

## Bump the version

Edit `package.json` → `"version": "1.0.1"` before each new build.

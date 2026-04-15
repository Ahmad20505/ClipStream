const { app, BrowserWindow, ipcMain, dialog, shell, Notification, net, protocol, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');
const os = require('os');

// ─── Bundled ffmpeg binary (no install needed) ───────────────────────────────
// When packaged with asar, ffmpeg-static is unpacked — fix the path so the OS can execute it.
const ffmpegPath = require('ffmpeg-static').replace('app.asar', 'app.asar.unpacked');

// ─── Auto Updater ────────────────────────────────────────────────────────────
const { autoUpdater } = require('electron-updater');

function initAutoUpdater() {
  if (!app.isPackaged) return; // skip in dev mode

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    console.log(`[ClipStream] Update available: v${info.version}`);
    sendToRenderer('update:available', { version: info.version });
  });

  autoUpdater.on('update-downloaded', (info) => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '🎉 Update Ready to Install',
      message: `ClipStream v${info.version} has been downloaded.`,
      detail: 'Restart ClipStream to apply the update. Your settings and clips will be preserved.',
      buttons: ['Restart & Update', 'Later'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('[ClipStream] Auto-updater error:', err.message);
  });

  // Check 5s after launch, then every 4 hours
  setTimeout(() => autoUpdater.checkForUpdatesAndNotify(), 5000);
  setInterval(() => autoUpdater.checkForUpdatesAndNotify(), 4 * 60 * 60 * 1000);
}

// ─── Global EPIPE / uncaught-exception safety net ───────────────────────────
// EPIPE (broken pipe) fires when one side of a pipe (streamlink → ffmpeg)
// closes while the other is still writing. This is expected behaviour when
// a monitor is stopped mid-stream and must NOT crash the main process.
process.on('uncaughtException', (err) => {
  if (err.code === 'EPIPE' || err.message?.includes('EPIPE')) {
    // Broken pipe from a child-process pipe closing — safe to ignore.
    return;
  }
  // Re-throw anything else so Electron's default handler still sees it.
  console.error('[ClipStream] Uncaught exception:', err);
});

// ─── App Configuration ──────────────────────────────────────────────────────
let Store;
let store;

async function initStore() {
  const { default: ElectronStore } = await import('electron-store');
  Store = ElectronStore;
  store = new Store({
    defaults: {
      subscription: { active: false, plan: null, expiresAt: null, customerId: null },
      settings: {
        outputDir: path.join(os.homedir(), 'Raw Clips'),
        clipBuffer: 30,
        clipDuration: 60,
        audioThreshold: -20,
        chatThreshold: 15,
        sensitivity: 50,
        autoStart: false,
        notifications: true,
        quality: 'best',
        discordWebhook: '',        // Discord webhook URL for auto-posting clips
        webhookUrl: '',            // Generic webhook URL
        normalizeAudio: true,      // Normalize clip volume on save
        autoCleanupDays: 0,        // 0 = disabled, else delete staged clips after N days
        systemTray: true,          // Run in system tray when window closed
        variableClipLength: true,  // Extend clip if hype continues
      },
      streamerBaselines: {},       // Persistent baselines per streamer ID
      streamerSettings: {},        // Per-streamer overrides (sensitivity etc.)
      apiKeys: {
        twitchClientId: '',
        twitchClientSecret: '',
        youtubeApiKey: '',
        stripePublishableKey: '',
      },
      // Auth account storage
      account: { email: null, passwordHash: null, createdAt: null },
      auth: { loggedIn: false },
      // SMTP settings for monthly receipts
      smtp: { host: '', port: 587, user: '', pass: '', fromName: 'ClipStream' },
      monitors: [],
      recentClips: [],
    },
  });
}

// ─── Window Management ───────────────────────────────────────────────────────
let mainWindow;
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    frame: false,
    ...(process.platform === 'darwin' ? { titleBarStyle: 'hidden', trafficLightPosition: { x: 16, y: 16 } } : {}),
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false, // allows file:// URLs — safe for local-only desktop app
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── Local file protocol — lets the renderer load clip videos securely ────────
// Registers clipfile:// so <video src="clipfile:///path/to/clip.mp4"> works
// without disabling webSecurity or exposing arbitrary file:// access.
protocol.registerSchemesAsPrivileged([
  { scheme: 'clipfile', privileges: { secure: true, supportFetchAPI: true, stream: true } },
]);

app.whenReady().then(async () => {
  // Handle clipfile:// requests by serving the local file
  protocol.handle('clipfile', async (request) => {
    try {
      // Decode path segments individually so spaces and special chars work
      const rawPath = request.url.slice('clipfile://'.length);
      const filePath = rawPath.split('/').map(seg => decodeURIComponent(seg)).join('/');

      if (!fs.existsSync(filePath)) {
        console.error('[ClipStream] clipfile: file not found:', filePath);
        return new Response('File not found', { status: 404 });
      }

      const stat = fs.statSync(filePath);
      const total = stat.size;
      const ext = path.extname(filePath).toLowerCase();
      const mime = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' }[ext] || 'application/octet-stream';

      // Handle Range requests — essential for video seeking in <video> element
      const range = request.headers.get('Range');
      if (range) {
        const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
        const start = parseInt(startStr, 10);
        const end = endStr ? parseInt(endStr, 10) : total - 1;
        const chunkSize = end - start + 1;
        const nodeStream = fs.createReadStream(filePath, { start, end });
        const webStream = new ReadableStream({
          start(ctrl) {
            nodeStream.on('data', chunk => ctrl.enqueue(chunk));
            nodeStream.on('end', () => ctrl.close());
            nodeStream.on('error', err => ctrl.error(err));
          },
          cancel() { nodeStream.destroy(); },
        });
        return new Response(webStream, {
          status: 206,
          headers: {
            'Content-Type': mime,
            'Content-Range': `bytes ${start}-${end}/${total}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(chunkSize),
          },
        });
      }

      // Full file response
      const nodeStream = fs.createReadStream(filePath);
      const webStream = new ReadableStream({
        start(ctrl) {
          nodeStream.on('data', chunk => ctrl.enqueue(chunk));
          nodeStream.on('end', () => ctrl.close());
          nodeStream.on('error', err => ctrl.error(err));
        },
        cancel() { nodeStream.destroy(); },
      });
      return new Response(webStream, {
        status: 200,
        headers: {
          'Content-Type': mime,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(total),
        },
      });
    } catch (e) {
      console.error('[ClipStream] clipfile protocol error:', e.message, request.url);
      return new Response('File not found', { status: 404 });
    }
  });

  await initStore();
  ensureOutputDir();
  cleanupOldThumbnails();
  createWindow();
  createTray();
  scheduleRenewalCheck();
  scheduleDailyDigest();
  checkStreamlinkInstalled();
  initAutoUpdater();
  scheduleAutoCleanup();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// ─── Streamlink Check ────────────────────────────────────────────────────────
function checkStreamlinkInstalled() {
  exec('streamlink --version', (err) => {
    if (!err) return; // already installed — nothing to do

    const isMac = process.platform === 'darwin';
    const isWin = process.platform === 'win32';

    // Not found — show a helpful install dialog after a short delay
    // (so the main window has time to appear first)
    setTimeout(() => {
      const win = BrowserWindow.getAllWindows()[0];
      if (!win) return;

      const installBtn = isMac ? 'Install with Homebrew' : 'Install Automatically';

      dialog.showMessageBox(win, {
        type: 'warning',
        title: 'streamlink not found',
        message: 'ClipStream needs streamlink to record streams.',
        detail: 'streamlink is a free, open-source tool that captures stream video. Without it, ClipStream can detect highlights but cannot save clips.\n\nClick "' + installBtn + '" to install it automatically, or visit streamlink.github.io to install manually.',
        buttons: [installBtn, 'Install Manually', 'Remind Me Later'],
        defaultId: 0,
        cancelId: 2,
      }).then(({ response }) => {
        if (response === 0) {
          if (isWin) {
            installStreamlinkWindows(win);
          } else {
            installStreamlinkMac(win);
          }
        } else if (response === 1) {
          shell.openExternal('https://streamlink.github.io');
        }
      });
    }, 3000);
  });
}

function installStreamlinkMac(win) {
  const installWin = new BrowserWindow({
    width: 500, height: 220,
    resizable: false, minimizable: false, fullscreenable: false,
    title: 'Installing streamlink…',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  installWin.loadURL('data:text/html,<html><body style="font-family:sans-serif;padding:24px;background:#111;color:#ccc"><h3 style="color:#a78bfa">Installing streamlink…</h3><p>Running: <code>brew install streamlink</code></p><p style="color:#888;font-size:13px">This may take a minute. The window will close when done.</p></body></html>');

  // Try both common Homebrew paths (Intel /usr/local, Apple Silicon /opt/homebrew)
  const brewCmd = 'export PATH="$PATH:/usr/local/bin:/opt/homebrew/bin" && brew install streamlink';
  exec(brewCmd, { shell: '/bin/bash' }, (brewErr) => {
    try { installWin.close(); } catch {}
    if (brewErr) {
      dialog.showMessageBox(win, {
        type: 'info',
        title: 'Install streamlink manually',
        message: 'Homebrew install failed.',
        detail: 'Please visit streamlink.github.io to download and install streamlink manually, then restart ClipStream.',
        buttons: ['Open streamlink.github.io', 'OK'],
        defaultId: 0,
      }).then(({ response: r }) => {
        if (r === 0) shell.openExternal('https://streamlink.github.io');
      });
    } else {
      dialog.showMessageBox(win, {
        type: 'info',
        title: 'streamlink installed!',
        message: 'streamlink was installed successfully.',
        detail: "ClipStream can now save clips. You're all set!",
        buttons: ['Great!'],
      });
    }
  });
}

function installStreamlinkWindows(win) {
  const installWin = new BrowserWindow({
    width: 500, height: 240,
    resizable: false, minimizable: false, fullscreenable: false,
    title: 'Installing streamlink…',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  installWin.loadURL('data:text/html,<html><body style="font-family:sans-serif;padding:24px;background:#111;color:#ccc"><h3 style="color:#a78bfa">Installing streamlink…</h3><p>Using Windows Package Manager (winget)</p><p style="color:#888;font-size:13px">This may take a minute. Please wait…</p></body></html>');

  // Method 1: winget — built into Windows 10/11, most reliable
  exec('winget install streamlink.streamlink --accept-package-agreements --accept-source-agreements --silent',
    { timeout: 120000 },
    (wingetErr) => {
      if (!wingetErr) {
        try { installWin.close(); } catch {}
        showStreamlinkSuccessWindows(win);
        return;
      }

      // Method 2: PowerShell download — handles all redirects natively
      installWin.loadURL('data:text/html,<html><body style="font-family:sans-serif;padding:24px;background:#111;color:#ccc"><h3 style="color:#a78bfa">Downloading streamlink…</h3><p>Fetching installer via PowerShell</p><p style="color:#888;font-size:13px">This may take a minute. Please wait…</p></body></html>');

      const psScript = [
        '$ErrorActionPreference = "Stop"',
        '$headers = @{ "User-Agent" = "ClipStream-App" }',
        '$release = Invoke-RestMethod "https://api.github.com/repos/streamlink/streamlink/releases/latest" -Headers $headers',
        '$asset = $release.assets | Where-Object { $_.name -match "windows" -and $_.name -match "setup\\.exe" } | Select-Object -First 1',
        'if (-not $asset) { throw "No installer found" }',
        '$out = Join-Path $env:TEMP "streamlink-setup.exe"',
        'Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $out -UseBasicParsing',
        'Start-Process -FilePath $out -ArgumentList "/S" -Wait',
      ].join('; ');

      exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psScript}"`,
        { timeout: 300000 },
        (psErr) => {
          try { installWin.close(); } catch {}
          if (!psErr) {
            showStreamlinkSuccessWindows(win);
          } else {
            fallbackToManual(win);
          }
        }
      );
    }
  );
}

function showStreamlinkSuccessWindows(win) {
  dialog.showMessageBox(win, {
    type: 'info',
    title: 'streamlink installed!',
    message: 'streamlink was installed successfully.',
    detail: 'Please restart ClipStream to start saving clips.',
    buttons: ['Restart Now', 'Later'],
    defaultId: 0,
  }).then(({ response: r }) => {
    if (r === 0) { app.relaunch(); app.exit(0); }
  });
}

function fallbackToManual(win) {
  dialog.showMessageBox(win, {
    type: 'info',
    title: 'Install streamlink manually',
    message: 'Automatic install failed.',
    detail: 'Please visit streamlink.github.io to download and install streamlink manually, then restart ClipStream.',
    buttons: ['Open streamlink.github.io', 'OK'],
    defaultId: 0,
  }).then(({ response: r }) => {
    if (r === 0) shell.openExternal('https://streamlink.github.io');
  });
}

// ─── System Tray ─────────────────────────────────────────────────────────────
let tray = null;

function createTray() {
  try {
    // Use a simple colored dot as the tray icon
    const iconPath = path.join(__dirname, 'assets', 'icon.png');
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    tray = new Tray(icon);
    tray.setToolTip('ClipStream — AI Clip Monitor');
    updateTrayMenu();

    tray.on('click', () => {
      if (mainWindow) {
        mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
      } else {
        createWindow();
      }
    });
  } catch (e) {
    console.error('[ClipStream] Tray error:', e.message);
  }
}

function updateTrayMenu() {
  if (!tray) return;
  const liveCount   = activeMonitors.size;
  const pendingClips = store.get('recentClips', []).filter(c => c.staged).length;
  const contextMenu = Menu.buildFromTemplate([
    { label: 'ClipStream', enabled: false },
    { type: 'separator' },
    { label: liveCount > 0 ? `${liveCount} stream${liveCount > 1 ? 's' : ''} live` : 'No live streams', enabled: false },
    { label: pendingClips > 0 ? `${pendingClips} clips awaiting review` : 'No clips to review', enabled: false },
    { type: 'separator' },
    { label: 'Show ClipStream', click: () => { if (mainWindow) mainWindow.show(); else createWindow(); } },
    { label: 'Open Clip Gallery', click: () => { if (mainWindow) { mainWindow.show(); sendToRenderer('navigate', 'clips'); } } },
    { type: 'separator' },
    { label: 'Quit', click: () => { stopAllMonitors(); app.quit(); } },
  ]);
  tray.setContextMenu(contextMenu);
}

// Update tray every 30s to reflect live state
setInterval(updateTrayMenu, 30000);

// ─── Auto Cleanup ─────────────────────────────────────────────────────────────
function scheduleAutoCleanup() {
  // Run once on startup, then every 6 hours
  runAutoCleanup();
  setInterval(runAutoCleanup, 6 * 60 * 60 * 1000);
}

function runAutoCleanup() {
  const settings = store.get('settings');
  const days = settings.autoCleanupDays ?? 0;
  if (!days || days <= 0) return;

  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const clips = store.get('recentClips', []);
  let removed = 0;

  const remaining = clips.filter(clip => {
    if (clip.staged && clip.createdAt < cutoff) {
      // Delete the actual file and thumbnail
      try { if (fs.existsSync(clip.path)) fs.unlinkSync(clip.path); } catch {}
      try { if (clip.thumbnail && fs.existsSync(clip.thumbnail)) fs.unlinkSync(clip.thumbnail); } catch {}
      removed++;
      return false;
    }
    return true;
  });

  if (removed > 0) {
    store.set('recentClips', remaining);
    sendToRenderer('clips:refreshed', remaining);
    console.log(`[ClipStream] Auto-cleanup: removed ${removed} old staged clip(s)`);
  }
}

app.on('window-all-closed', () => {
  const settings = store.get('settings');
  // If system tray is enabled, keep running in background on close
  if (settings.systemTray !== false && tray) {
    if (mainWindow) mainWindow.hide();
    return;
  }
  stopAllMonitors();
  if (process.platform !== 'darwin') app.quit();
});

// ─── Output Directory ────────────────────────────────────────────────────────
function ensureOutputDir() {
  const dir = store.get('settings.outputDir');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Remove any stray _thumb.jpg files that older versions wrote into the clips folder.
// Thumbnails now live in app.getPath('userData')/thumbnails/ instead.
function cleanupOldThumbnails() {
  try {
    const clipsDir = store.get('settings.outputDir');
    if (!fs.existsSync(clipsDir)) return;
    const removeThumbsFrom = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { removeThumbsFrom(full); continue; }
        if (entry.name.endsWith('_thumb.jpg')) {
          try { fs.unlinkSync(full); } catch {}
        }
      }
    };
    removeThumbsFrom(clipsDir);
  } catch {}
}

// Sanitize a streamer display name so it's always a valid directory name.
// Replaces characters that are illegal on Windows/macOS/Linux with underscores.
function safeName(name) {
  return (name || 'Unknown')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') // illegal filesystem chars
    .replace(/\s+/g, '_')                     // spaces → underscores
    .replace(/_+/g, '_')                      // collapse multiple underscores
    .replace(/^_|_$/g, '')                    // strip leading/trailing underscores
    .slice(0, 80)                             // max 80 chars
    || 'Unknown';
}

// Get (and create) the directory for a given streamer's clips.
function streamerClipDir(settings, streamer) {
  const dir = path.join(
    settings.outputDir,
    safeName(streamer.platform || 'unknown'),
    safeName(streamer.displayName),
  );
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Internal staging dir — clips land here first before user saves them.
function stagingDir() {
  const dir = path.join(app.getPath('userData'), 'staging');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Internal thumbnails dir — inside app userData, NOT in the user's clips folder.
function thumbnailsDir() {
  const dir = path.join(app.getPath('userData'), 'thumbnails');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ─── Active Monitor Registry ─────────────────────────────────────────────────
const activeMonitors = new Map(); // streamerId → MonitorSession

class MonitorSession {
  constructor(streamer) {
    this.streamer = streamer;
    this.streamlinkProcess = null;
    this.ffmpegProcess = null;
    this.chatClient = null;
    this.buffer = [];
    this.chatCounts = [];
    this.isLive = false;
    this.clipsCreated = 0;
    this.startedAt = Date.now();
    this.status = 'connecting';
    this.lastClipTime = 0;
    this.audioLevel = -60;
    this.chatRate = 0;
    // ── Smart detection: rolling history for baseline computation ──
    this.audioReadings = [];  // [{ t, v }] last 90 s of LUFS readings
    this.chatReadings  = [];  // [{ t, v }] last 90 s of msg/10s readings
    this.audioBaseline = null;
    this.chatBaseline  = null;
    this.hyping        = false; // true while in a hype window (prevents re-trigger)
  }

  destroy() {
    if (this.streamlinkProcess) { try { this.streamlinkProcess.kill(); } catch (e) {} }
    if (this.ffmpegProcess) { try { this.ffmpegProcess.kill(); } catch (e) {} }
    if (this.chatClient) { try { this.chatClient.quit(); } catch (e) {} }
    if (this.chatMonitorInterval) clearInterval(this.chatMonitorInterval);
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
  }
}

// ─── Stream Monitor IPC ──────────────────────────────────────────────────────
ipcMain.handle('monitor:start', async (event, streamer) => {
  if (activeMonitors.has(streamer.id)) {
    return { success: false, error: 'Already monitoring this streamer' };
  }
  try {
    const session = new MonitorSession(streamer);
    // Load previously learned baseline — skip the 90s warmup for returning streamers
    const savedBaselines = store.get('streamerBaselines', {});
    if (savedBaselines[streamer.id]) {
      const b = savedBaselines[streamer.id];
      // Only use saved baseline if it's from the last 30 days
      if (Date.now() - b.updatedAt < 30 * 24 * 60 * 60 * 1000) {
        session.audioBaseline = b.audio;
        session.chatBaseline  = b.chat;
        session.startedAt     = Date.now() - 91000; // skip warmup immediately
        console.log(`[ClipStream] Loaded saved baseline for ${streamer.displayName}: audio=${b.audio?.toFixed(1)}, chat=${b.chat?.toFixed(1)}`);
      }
    }
    activeMonitors.set(streamer.id, session);
    startMonitorSession(session);

    // Save to store
    const monitors = store.get('monitors', []);
    if (!monitors.find(m => m.id === streamer.id)) {
      monitors.push({ ...streamer, monitoredSince: Date.now() });
      store.set('monitors', monitors);
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('monitor:stop', async (event, streamerId) => {
  const session = activeMonitors.get(streamerId);
  if (session) {
    // Save learned baseline so next session starts smart
    if (session.audioBaseline !== null) {
      const baselines = store.get('streamerBaselines', {});
      baselines[streamerId] = {
        audio: session.audioBaseline,
        chat: session.chatBaseline,
        updatedAt: Date.now(),
      };
      store.set('streamerBaselines', baselines);
    }
    session.destroy();
    activeMonitors.delete(streamerId);
  }
  const monitors = store.get('monitors', []).filter(m => m.id !== streamerId);
  store.set('monitors', monitors);
  return { success: true };
});

ipcMain.handle('monitor:list', async () => {
  const result = [];
  for (const [id, session] of activeMonitors) {
    result.push({
      id,
      streamer: session.streamer,
      status: session.status,
      clipsCreated: session.clipsCreated,
      startedAt: session.startedAt,
      audioLevel: session.audioLevel,
      chatRate: session.chatRate,
      isLive: session.isLive,
    });
  }
  return result;
});

ipcMain.handle('monitor:status', async (event, streamerId) => {
  const session = activeMonitors.get(streamerId);
  if (!session) return null;
  return {
    id: streamerId,
    status: session.status,
    clipsCreated: session.clipsCreated,
    startedAt: session.startedAt,
    audioLevel: session.audioLevel,
    chatRate: session.chatRate,
    isLive: session.isLive,
  };
});

// ─── Monitor Session Logic ───────────────────────────────────────────────────
function startMonitorSession(session) {
  const { streamer } = session;
  const streamUrl = getStreamUrl(streamer);
  const settings = store.get('settings');

  // Pre-create this streamer's clip folder so it's visible immediately in Finder
  try { streamerClipDir(settings, streamer); } catch {}

  // Start chat monitoring
  startChatMonitor(session);

  // Poll for live status and start capture
  pollLiveStatus(session, streamUrl, settings);
}

function getStreamUrl(streamer) {
  switch (streamer.platform) {
    case 'twitch': return `https://twitch.tv/${streamer.login}`;
    case 'youtube': return `https://youtube.com/channel/${streamer.id}/live`;
    case 'kick': return `https://kick.com/${streamer.login}`;
    default: return '';
  }
}

async function pollLiveStatus(session, streamUrl, settings) {
  if (!activeMonitors.has(session.streamer.id)) return;

  try {
    session.status = 'checking';
    sendToRenderer('monitor:update', {
      id: session.streamer.id,
      status: 'checking',
      isLive: session.isLive, // keep last known state while checking
    });

    const isLive = await checkIfLive(session.streamer);

    // null = API call failed — keep previous state, don't flip live status
    if (isLive === null) {
      session.status = session.isLive ? 'live' : 'offline';
      sendToRenderer('monitor:update', {
        id: session.streamer.id,
        status: session.status,
        isLive: session.isLive,
      });
    } else if (isLive && !session.isLive) {
      // Went live
      session.isLive = true;
      session.status = 'live';
      startStreamCapture(session, streamUrl, settings);
      sendToRenderer('monitor:update', {
        id: session.streamer.id,
        status: 'live',
        isLive: true,
      });
      notifyUser(`${session.streamer.displayName} is live!`, 'ClipStream started monitoring');
    } else if (!isLive && session.isLive) {
      // Went offline
      session.isLive = false;
      session.status = 'offline';
      if (session.ffmpegProcess) { try { session.ffmpegProcess.kill(); } catch (e) {} }
      sendToRenderer('monitor:update', {
        id: session.streamer.id,
        status: 'offline',
        isLive: false,
      });
    } else {
      // No change — just confirm current state
      session.status = isLive ? 'live' : 'offline';
      sendToRenderer('monitor:update', {
        id: session.streamer.id,
        status: session.status,
        isLive: !!isLive,
      });
    }
  } catch (err) {
    console.error('[ClipStream] pollLiveStatus error:', err.message);
    // Don't change isLive on unexpected errors — just show error badge
    session.status = 'error';
    sendToRenderer('monitor:update', {
      id: session.streamer.id,
      status: 'error',
      isLive: session.isLive,
    });
  }

  // Poll again in 60 seconds
  if (activeMonitors.has(session.streamer.id)) {
    session.reconnectTimeout = setTimeout(() => pollLiveStatus(session, streamUrl, settings), 60000);
  }
}

// Returns true/false, or null if the check failed (caller should keep previous state)
async function checkIfLive(streamer) {
  const { default: nodeFetch } = await import('node-fetch');
  const apiKeys = store.get('apiKeys');

  try {
    if (streamer.platform === 'twitch') {
      if (!apiKeys.twitchClientId) return null; // can't check without keys
      // Refresh access token if missing
      let token = streamer._accessToken;
      if (!token && apiKeys.twitchClientSecret) {
        try {
          const tokenRes = await nodeFetch(
            `https://id.twitch.tv/oauth2/token?client_id=${apiKeys.twitchClientId}&client_secret=${apiKeys.twitchClientSecret}&grant_type=client_credentials`,
            { method: 'POST' }
          );
          const tokenData = await tokenRes.json();
          token = tokenData.access_token;
          streamer._accessToken = token; // cache for next poll
        } catch { return null; }
      }
      if (!token) return null;
      const res = await nodeFetch(
        `https://api.twitch.tv/helix/streams?user_login=${streamer.login}`,
        { headers: { 'Client-ID': apiKeys.twitchClientId, Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return null;
      const data = await res.json();
      return !!(data.data && data.data.length > 0 && data.data[0].type === 'live');
    }

    if (streamer.platform === 'youtube') {
      if (!apiKeys.youtubeApiKey) return null;
      const res = await nodeFetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${streamer.id}&type=video&eventType=live&key=${apiKeys.youtubeApiKey}`
      );
      if (!res.ok) return null;
      const data = await res.json();
      return !!(data.items && data.items.length > 0);
    }

    if (streamer.platform === 'kick') {
      // Use Electron net.fetch (Chromium stack) to pass Cloudflare
      const res = await net.fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(streamer.login)}`, {
        headers: {
          'Accept': 'application/json',
          'Referer': 'https://kick.com/',
        },
      });
      if (!res.ok) return null;
      const data = await res.json();
      // livestream field is null when offline, object when live
      return data.livestream !== null && data.livestream !== undefined;
    }

  } catch (err) {
    console.error(`[ClipStream] checkIfLive error for ${streamer.platform}/${streamer.login}:`, err.message);
    return null; // unknown — don't flip status
  }
  return null;
}

async function startStreamCapture(session, streamUrl, settings) {
  // Use streamlink to pipe stream to ffmpeg for real-time audio analysis
  const streamlink = spawn('streamlink', [
    '--stdout',
    '--retry-streams', '30',
    '--retry-open', '3',
    streamUrl,
    settings.quality || 'best',
  ]);
  session.streamlinkProcess = streamlink;
  const streamSource = streamlink;

  // ebur128 outputs momentary loudness (M:) every ~0.1s — works on live streams
  // volumedetect only outputs at end-of-file so it never fires on live streams
  const ffmpegInputArgs = ['-i', 'pipe:0'];

  const ffmpeg = spawn(ffmpegPath, [
    ...ffmpegInputArgs,
    '-af', 'ebur128=peak=true',
    '-vn',
    '-f', 'null',
    '-',
  ]);

  session.ffmpegProcess = ffmpeg;
  if (streamSource) streamSource.stdout.pipe(ffmpeg.stdin);

  // Suppress EPIPE — happens when ffmpeg closes while streamlink is still writing
  if (streamSource) {
    ffmpeg.stdin.on('error', (err) => {
      if (err.code !== 'EPIPE') console.error('[ClipStream] ffmpeg stdin error:', err.message);
    });
    streamSource.stdout.on('error', (err) => {
      if (err.code !== 'EPIPE') console.error('[ClipStream] streamlink stdout error:', err.message);
    });
    streamSource.on('error', (err) => {
      if (err.code === 'ENOENT') {
        console.error('[ClipStream] streamlink is not installed! Visit https://streamlink.github.io to install it.');
        notifyUser('⚠️ ClipStream needs streamlink', 'Install streamlink from streamlink.github.io to enable monitoring');
      } else {
        console.error('[ClipStream] streamlink error:', err.message);
      }
    });
    streamSource.on('close', (code) => {
      console.log(`[ClipStream] streamlink closed (code ${code}) for ${session.streamer.login}`);
      if (activeMonitors.has(session.streamer.id) && session.isLive) {
        session.status = 'reconnecting';
        sendToRenderer('monitor:update', { id: session.streamer.id, status: 'reconnecting' });
        session.reconnectTimeout = setTimeout(() => pollLiveStatus(session, streamUrl, settings), 10000);
      }
    });
    streamSource.stderr.on('data', (d) => {
      const t = d.toString();
      console.log(`[streamlink] ${session.streamer.login}:`, t.trim().slice(0, 120));
      if (t.includes('No playable streams') || t.includes('Unable to open URL')) {
        session.status = 'error';
        sendToRenderer('monitor:update', { id: session.streamer.id, status: 'error', isLive: session.isLive });
      }
    });
  }

  ffmpeg.on('error', (err) => {
    console.error('[ClipStream] ffmpeg analysis error:', err.message);
  });

  ffmpeg.stderr.on('data', (data) => {
    const text = data.toString();
    // ebur128 line format: "M: -18.5  S: -19.2  I: -20.0 LUFS  LRA: ..."
    const match = text.match(/M:\s*(-?\d+\.?\d*)/);
    if (match) {
      session.audioLevel = parseFloat(match[1]);
      if (session.audioLevel > -50) pushReading(session.audioReadings, session.audioLevel);
      if (session.audioReadings.length % 20 === 0) {
        session.audioBaseline = computeBaseline(session.audioReadings);
      }
      sendToRenderer('monitor:metrics', {
        id: session.streamer.id,
        audioLevel: session.audioLevel,
        chatRate: session.chatRate,
        audioBaseline: session.audioBaseline,
      });
      checkForClipTrigger(session, settings);
    }
  });

  ffmpeg.on('close', (code) => {
    console.log(`[ClipStream] ffmpeg analysis closed (code ${code}) for ${session.streamer.login}`);
  });
}

// ─── Chat Monitor ─────────────────────────────────────────────────────────────
function startChatMonitor(session) {
  const { streamer } = session;
  let messageTimestamps = [];

  if (streamer.platform === 'twitch') {
    startTwitchChat(session, messageTimestamps);
  } else if (streamer.platform === 'youtube') {
    startYouTubeChat(session, messageTimestamps);
  } else if (streamer.platform === 'kick') {
    startKickChat(session, messageTimestamps);
  }

  // Calculate chat rate every second
  session.chatMonitorInterval = setInterval(() => {
    const now = Date.now();
    const cutoff = now - 10000;
    // Mutate in-place — do NOT reassign the array or the chat clients lose their reference
    let i = 0;
    while (i < messageTimestamps.length && messageTimestamps[i] < cutoff) i++;
    if (i > 0) messageTimestamps.splice(0, i);
    session.chatRate = messageTimestamps.length;
    // Record chat reading every 5 s for baseline (avoid flooding the array)
    if (!session._lastChatRecord || now - session._lastChatRecord > 5000) {
      pushReading(session.chatReadings, session.chatRate);
      session.chatBaseline = computeBaseline(session.chatReadings);
      session._lastChatRecord = now;
    }
    sendToRenderer('monitor:metrics', {
      id: session.streamer.id,
      audioLevel: session.audioLevel,
      chatRate: session.chatRate,
      audioBaseline: session.audioBaseline,
      chatBaseline: session.chatBaseline,
    });
  }, 1000);
}

function startTwitchChat(session, messageTimestamps) {
  try {
    const { Client } = require('irc-framework');
    const client = new Client();
    session.chatClient = client;

    client.connect({
      host: 'irc.chat.twitch.tv',
      port: 6667,
      nick: 'justinfan' + Math.floor(Math.random() * 80000 + 10000),
      username: 'justinfan',
      password: 'SCHMOOPIIE',
    });

    client.on('registered', () => {
      client.join(`#${session.streamer.login}`);
    });

    client.on('privmsg', () => {
      messageTimestamps.push(Date.now());
      session.chatEverActive = true;
    });

    client.on('close', () => {
      if (activeMonitors.has(session.streamer.id)) {
        setTimeout(() => startTwitchChat(session, messageTimestamps), 5000);
      }
    });
  } catch (err) {
    console.error('IRC error:', err.message);
  }
}

function startYouTubeChat(session, messageTimestamps) {
  // YouTube Live chat via polling API
  const pollYouTubeChat = async () => {
    if (!activeMonitors.has(session.streamer.id)) return;
    try {
      const apiKeys = store.get('apiKeys');
      if (!apiKeys.youtubeApiKey || !session.streamer._liveChatId) return;
      const { default: fetch } = await import('node-fetch');
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/liveChat/messages?liveChatId=${session.streamer._liveChatId}&part=snippet&key=${apiKeys.youtubeApiKey}`
      );
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        data.items.forEach(() => messageTimestamps.push(Date.now()));
        session.chatEverActive = true;
      }
    } catch {}
    if (activeMonitors.has(session.streamer.id)) {
      setTimeout(pollYouTubeChat, 5000);
    }
  };
  pollYouTubeChat();
}

async function startKickChat(session, messageTimestamps) {
  const WebSocket = require('ws');

  // If chatroom ID is missing, fetch it from the Kick API first
  if (!session.streamer._chatroomId) {
    try {
      const res = await net.fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(session.streamer.login)}`, {
        headers: { 'Accept': 'application/json', 'Referer': 'https://kick.com/' },
      });
      if (res.ok) {
        const data = await res.json();
        session.streamer._chatroomId = data.chatroom?.id;
        console.log(`[Kick] Fetched chatroom ID for ${session.streamer.login}:`, session.streamer._chatroomId);
      }
    } catch (e) {
      console.error('[Kick] Failed to fetch chatroom ID:', e.message);
    }
  }

  if (!session.streamer._chatroomId) {
    console.warn(`[Kick] No chatroom ID for ${session.streamer.login} — chat monitoring disabled`);
    return;
  }

  try {
    const ws = new WebSocket(
      'wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=7.6.0&flash=false',
      { headers: { 'Origin': 'https://kick.com' } }
    );
    session.chatClient = ws;

    ws.on('open', () => {
      console.log(`[Kick] Chat WS connected for ${session.streamer.login}, room ${session.streamer._chatroomId}`);
      ws.send(JSON.stringify({
        event: 'pusher:subscribe',
        data: { auth: '', channel: `chatrooms.${session.streamer._chatroomId}.v2` },
      }));
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.event === 'App\\Events\\ChatMessageEvent' || msg.event === 'ChatMessageEvent') {
          messageTimestamps.push(Date.now());
          session.chatEverActive = true;
        }
      } catch {}
    });

    ws.on('error', (err) => {
      console.error(`[Kick] Chat WS error for ${session.streamer.login}:`, err.message);
    });

    ws.on('close', () => {
      if (activeMonitors.has(session.streamer.id)) {
        console.log(`[Kick] Chat WS closed, reconnecting in 5s for ${session.streamer.login}`);
        setTimeout(() => startKickChat(session, messageTimestamps), 5000);
      }
    });
  } catch (err) {
    console.error('Kick chat error:', err.message);
  }
}

// ─── Baseline Helpers ────────────────────────────────────────────────────────
// Push a new reading into a rolling window and trim old entries.
function pushReading(arr, value, windowMs = 90000) {
  const now = Date.now();
  arr.push({ t: now, v: value });
  const cutoff = now - windowMs;
  let i = 0;
  while (i < arr.length && arr[i].t < cutoff) i++;
  if (i > 0) arr.splice(0, i);
}

// Return the 40th-percentile value of a readings array, or null if too few samples.
// Using the 40th percentile means occasional loud spikes don't inflate the baseline.
function computeBaseline(arr, minSamples = 12) {
  if (arr.length < minSamples) return null;
  const sorted = arr.map(r => r.v).sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * 0.40)];
}

// ─── Clip Detection ──────────────────────────────────────────────────────────
// Smart, baseline-relative spike detection.
//
// Instead of fixed absolute thresholds (which fire constantly for high-energy
// streamers like RampageJackson), we learn each streamer's personal "normal"
// over the first 60–90 seconds, then only clip when something is significantly
// above that baseline.  This means:
//   • Big streamers with loud audio/busy chat → clips only during real hype spikes
//   • Small streamers with quiet chat         → still clips at lower absolute levels
//
function checkForClipTrigger(session, settings) {
  const now = Date.now();

  // ── Cooldown: min 3 min between clips — quality over quantity ─────────────
  const cooldown = 180000;
  if (now - session.lastClipTime < cooldown) return;

  // ── Warmup: need ≥ 90 s of data before we have a reliable baseline ─────────
  const warmup = 90000;
  if (now - session.startedAt < warmup) return;

  // ── Compute this streamer's personal baselines ─────────────────────────────
  const audioBaseline = computeBaseline(session.audioReadings); // LUFS 40th pct
  const chatBaseline  = computeBaseline(session.chatReadings);  // msg/10s 40th pct

  // Still not enough data (stream was quiet / just started sending audio)
  if (audioBaseline === null) return;

  // ── Audio spike: dB above this streamer's normal level ────────────────────
  const audioSpikeDb = session.audioLevel - audioBaseline;
  // Check for per-streamer sensitivity override, fall back to global
  const streamerOverride = store.get(`streamerSettings.${session.streamer.id}`, {});
  const rawSensitivity   = streamerOverride.sensitivity ?? settings.sensitivity ?? 50;
  const sensitivity      = Math.max(0, Math.min(100, rawSensitivity));
  // Raised floor — needs a bigger spike to qualify
  const audioNeed      = 14 - (sensitivity / 100) * 6;   // 8–14 dB depending on sensitivity
  const audioTriggered = audioSpikeDb >= audioNeed && session.audioLevel > -40;

  // ── Chat spike: multiple of this streamer's normal rate ───────────────────
  const chatBase       = Math.max(chatBaseline ?? 0, 3);
  const chatMultiplier = session.chatRate / chatBase;
  // Require 3× normal chat rate minimum — filters out small bumps
  const chatNeed       = 3.0 - (sensitivity / 100) * 1.0; // 2.0–3.0× depending on sensitivity
  const chatTriggered  = chatMultiplier >= chatNeed && session.chatRate >= 8;

  // ── Hype score 0–1 ────────────────────────────────────────────────────────
  const audioScore = Math.min(1, Math.max(0, (audioSpikeDb - audioNeed)  / 8));
  const chatScore  = Math.min(1, Math.max(0, (chatMultiplier - 1)        / 4));
  const hypeScore  = audioScore * 0.55 + chatScore * 0.45;

  // ── Trigger logic — BOTH signals must fire for most clips ─────────────────
  const chatWorking = session.chatEverActive || (now - session.startedAt < 120000);

  // Require both audio AND chat to spike simultaneously
  const bothTriggered = audioTriggered && chatTriggered;
  // Only clip on a single signal if it's truly extreme (huge outlier moments)
  const extremeAudio  = audioSpikeDb >= audioNeed + 10 && chatWorking && session.chatRate >= 5;
  const extremeChat   = chatMultiplier >= chatNeed  + 3 && audioSpikeDb >= 4;
  // Audio-only fallback only when chat genuinely never connected
  const audioOnly     = !chatWorking && audioSpikeDb >= audioNeed + 8;

  // Hype score must also clear a minimum bar — filters borderline moments
  const scoreThreshold = 0.35 + (1 - sensitivity / 100) * 0.25; // 0.35–0.60
  const shouldClip = (bothTriggered || extremeAudio || extremeChat || audioOnly) && hypeScore >= scoreThreshold;

  if (shouldClip) {
    const reason = bothTriggered ? 'both' : extremeAudio ? 'extreme-audio' : extremeChat ? 'extreme-chat' : 'audio-only';
    console.log(
      `[ClipStream] 🎬 Hype! ${session.streamer.displayName} ` +
      `audio+${audioSpikeDb.toFixed(1)}dB (base ${audioBaseline.toFixed(1)}) ` +
      `chat×${chatMultiplier.toFixed(1)} (base ${chatBase.toFixed(0)}) ` +
      `score=${hypeScore.toFixed(2)} reason=${reason}`
    );
    // ── Deduplication: skip if last clip was less than 10s ago ────────────────
    // This prevents double-clips when a stream briefly drops and reconnects
    if (now - session.lastClipTime < 10000) {
      console.log(`[ClipStream] Skipping duplicate clip for ${session.streamer.displayName} — too soon after last clip`);
      return;
    }

    // ── Smart merging: if last clip was < 2 min ago, flag as consecutive ──────
    const timeSinceLast = now - session.lastClipTime;
    const isMergeCandidate = timeSinceLast < 120000 && timeSinceLast > 10000;

    session.lastClipTime = now;
    captureClip(session, settings, hypeScore, reason, isMergeCandidate);
  }
}

async function captureClip(session, settings, hypeScore = 0.5, reason = 'both', isMergeCandidate = false) {
  const streamUrl = getStreamUrl(session.streamer);

  // Clips land in staging first — user reviews and saves from the gallery
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${safeName(session.streamer.displayName)}_${timestamp}.mp4`;
  const outputPath = path.join(stagingDir(), filename);
  // Variable clip length — extend if hype is still elevated (max 3× base duration)
  let duration = settings.clipDuration || 60;
  if (settings.variableClipLength !== false) {
    const audioBaseline = session.audioBaseline ?? -30;
    const audioSpikeNow = session.audioLevel - audioBaseline;
    const chatSpikeNow  = session.chatRate / Math.max(session.chatBaseline ?? 3, 3);
    if (audioSpikeNow > 12 || chatSpikeNow > 3.5) {
      duration = Math.min(duration * 2, 180); // double duration for big moments
    } else if (audioSpikeNow > 8 || chatSpikeNow > 2.5) {
      duration = Math.min(Math.round(duration * 1.5), 120);
    }
  }

  console.log(`[ClipStream] Starting clip capture → staging → ${outputPath}`);

  // Helper: save clip data to store and notify renderer
  function finalizeClip() {
    try {
      const stat = fs.existsSync(outputPath) ? fs.statSync(outputPath) : null;
      if (!stat || stat.size < 50000) {
        console.warn(`[ClipStream] Clip too small or missing (${stat?.size ?? 0} bytes), skipping`);
        return;
      }
      console.log(`[ClipStream] Clip saved! ${(stat.size / 1024 / 1024).toFixed(1)} MB`);
      session.clipsCreated++;

      const clipData = {
        id: require('uuid').v4(),
        streamerId: session.streamer.id,
        streamerName: session.streamer.displayName,
        platform: session.streamer.platform,
        filename,
        path: outputPath,
        staged: true,   // clip is in staging — not yet saved to user's folder
        duration,
        createdAt: Date.now(),
        audioLevel: session.audioLevel,
        chatRate: session.chatRate,
        audioBaseline: session.audioBaseline,
        chatBaseline: session.chatBaseline,
        hypeScore: Math.round(hypeScore * 100),
        reason,
        consecutive: isMergeCandidate, // true = part of an ongoing hype chain
        thumbnail: null,
      };

      generateThumbnail(outputPath, clipData);

      const clips = store.get('recentClips', []);
      clips.unshift(clipData);
      if (clips.length > 500) clips.splice(500);
      store.set('recentClips', clips);

      sendToRenderer('clip:created', clipData);
      sendToRenderer('monitor:update', { id: session.streamer.id, clipsCreated: session.clipsCreated });
      notifyUser('🎬 New clip ready to review!', `${session.streamer.displayName} — check Clip Gallery`);

      // Fire webhooks asynchronously (don't block clip creation)
      const settings = store.get('settings');
      fireWebhooks(clipData, settings).catch(() => {});
    } catch (e) {
      console.error('[ClipStream] finalizeClip error:', e.message);
    }
  }

  // ── Try streamlink → ffmpeg pipe ─────────────────────────────────────────
  const ffmpegArgs = [
    '-y',
    '-i', 'pipe:0',
    '-t', String(duration),
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    '-loglevel', 'warning',
    outputPath,
  ];

  let usedStreamlink = false;

  const tryStreamlink = () => new Promise((resolve) => {
    const sl = spawn('streamlink', ['--stdout', '--loglevel', 'warning', streamUrl, settings.quality || 'best']);
    const ff = spawn('ffmpeg', ffmpegArgs);

    sl.on('error', (err) => {
      if (err.code === 'ENOENT') {
        console.warn('[ClipStream] streamlink not found — falling back to direct ffmpeg HLS');
      } else {
        console.error('[ClipStream] streamlink error:', err.message);
      }
      try { ff.kill(); } catch {}
      resolve(false);
    });

    sl.stdout.pipe(ff.stdin);

    // Suppress EPIPE — expected when ffmpeg finishes and stdin closes
    ff.stdin.on('error', (err) => {
      if (err.code !== 'EPIPE') console.error('[ClipStream] clip ffmpeg stdin error:', err.message);
    });
    sl.stdout.on('error', (err) => {
      if (err.code !== 'EPIPE') console.error('[ClipStream] clip streamlink stdout error:', err.message);
    });

    // When streamlink stderr says it opened successfully, mark as started
    sl.stderr.on('data', (d) => {
      const t = d.toString();
      if (t.includes('Opening stream')) usedStreamlink = true;
    });

    ff.on('error', (err) => {
      console.error('[ClipStream] ffmpeg clip error:', err.message);
      try { sl.kill(); } catch {}
      resolve(false);
    });

    ff.on('close', (code) => {
      try { sl.kill(); } catch {}
      // Accept even non-zero exit — ffmpeg often exits 1 when stdin pipe closes mid-encode
      // What matters is whether a usable file was written
      finalizeClip();
      resolve(true);
    });

    // Kill streamlink after duration + buffer to force ffmpeg to finish writing
    setTimeout(() => {
      try { sl.kill('SIGTERM'); } catch {}
    }, (duration + 5) * 1000);
  });

  const streamlinkWorked = await tryStreamlink();

  // ── Fallback: direct ffmpeg HLS (no streamlink needed) ───────────────────
  if (!streamlinkWorked) {
    console.log('[ClipStream] Attempting direct HLS capture via ffmpeg...');

    let hlsUrl = null;

    // For Kick, fetch the HLS URL from the API
    if (session.streamer.platform === 'kick') {
      try {
        const res = await net.fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(session.streamer.login)}`, {
          headers: { 'Accept': 'application/json', 'Referer': 'https://kick.com/' },
        });
        if (res.ok) {
          const data = await res.json();
          hlsUrl = data.playback_url || data.livestream?.playback_url;
        }
      } catch (e) {
        console.error('[ClipStream] Failed to get Kick HLS URL:', e.message);
      }
    }

    if (hlsUrl) {
      await new Promise((resolve) => {
        const ff = spawn(ffmpegPath, [
          '-y',
          '-i', hlsUrl,
          '-t', String(duration),
          '-c:v', 'copy',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-movflags', '+faststart',
          '-loglevel', 'warning',
          outputPath,
        ]);

        ff.on('error', (err) => {
          console.error('[ClipStream] ffmpeg HLS error:', err.message);
          resolve();
        });

        ff.on('close', () => {
          finalizeClip();
          resolve();
        });

        setTimeout(() => { try { ff.kill('SIGTERM'); } catch {} }, (duration + 10) * 1000);
      });
    } else {
      console.error('[ClipStream] No HLS URL available and streamlink not found. Install streamlink: https://streamlink.github.io');
      notifyUser('⚠️ ClipStream', 'Could not capture clip. Install streamlink from streamlink.github.io');
    }
  }
}

// ─── Webhooks ────────────────────────────────────────────────────────────────
async function fireWebhooks(clip, settings) {
  const { default: nodeFetch } = await import('node-fetch');

  // Discord webhook
  if (settings.discordWebhook) {
    try {
      const score = clip.hypeScore ?? 0;
      const emoji = score >= 80 ? '🔥' : score >= 60 ? '⚡' : '🎬';
      const color = score >= 80 ? 0xa855f7 : score >= 60 ? 0xfbbf24 : 0x3b82f6;
      await nodeFetch(settings.discordWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'ClipStream',
          embeds: [{
            title: `${emoji} New clip — ${clip.streamerName}`,
            description: `**Platform:** ${clip.platform}\n**Hype Score:** ${score}%\n**Reason:** ${clip.reason ?? 'hype moment'}`,
            color,
            footer: { text: `ClipStream AI · ${new Date(clip.createdAt).toLocaleString()}` },
          }],
        }),
      });
      console.log('[ClipStream] Discord webhook posted');
    } catch (e) {
      console.error('[ClipStream] Discord webhook error:', e.message);
    }
  }

  // Generic webhook
  if (settings.webhookUrl) {
    try {
      await nodeFetch(settings.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'clip.created',
          clip: {
            id: clip.id,
            streamer: clip.streamerName,
            platform: clip.platform,
            hypeScore: clip.hypeScore,
            reason: clip.reason,
            duration: clip.duration,
            createdAt: clip.createdAt,
          },
        }),
      });
      console.log('[ClipStream] Generic webhook posted');
    } catch (e) {
      console.error('[ClipStream] Generic webhook error:', e.message);
    }
  }
}

function generateThumbnail(videoPath, clipData) {
  // Store thumbnails in app userData — NOT in the user's clips folder
  const thumbFilename = `${clipData.id}.jpg`;
  const thumbPath = path.join(thumbnailsDir(), thumbFilename);
  exec(`"${ffmpegPath}" -i "${videoPath}" -ss 00:00:02 -vframes 1 -q:v 2 "${thumbPath}" -y`, (err) => {
    if (!err && fs.existsSync(thumbPath)) {
      const clips = store.get('recentClips', []);
      const idx = clips.findIndex(c => c.id === clipData.id);
      if (idx !== -1) {
        clips[idx].thumbnail = thumbPath;
        store.set('recentClips', clips);
        sendToRenderer('clip:thumbnail', { id: clipData.id, thumbnail: thumbPath });
      }
    }
  });
}

// ─── Clips IPC ───────────────────────────────────────────────────────────────
ipcMain.handle('clips:list', async () => {
  return store.get('recentClips', []);
});

ipcMain.handle('clips:open', async (event, clipPath) => {
  shell.showItemInFolder(clipPath);
  return { success: true };
});

ipcMain.handle('clips:delete', async (event, clipId) => {
  const clips = store.get('recentClips', []);
  const clip = clips.find(c => c.id === clipId);
  if (clip) {
    try {
      if (fs.existsSync(clip.path)) fs.unlinkSync(clip.path);
      if (clip.thumbnail && fs.existsSync(clip.thumbnail)) fs.unlinkSync(clip.thumbnail);
    } catch {}
    store.set('recentClips', clips.filter(c => c.id !== clipId));
  }
  return { success: true };
});

ipcMain.handle('clips:openFolder', async () => {
  const dir = store.get('settings.outputDir');
  shell.openPath(dir);
  return { success: true };
});

// Save a staged clip to the user's clips folder
ipcMain.handle('clips:save', async (event, clipId) => {
  const clips = store.get('recentClips', []);
  const idx = clips.findIndex(c => c.id === clipId);
  if (idx === -1) return { success: false, error: 'Clip not found' };

  const clip = clips[idx];
  if (!clip.staged) return { success: true }; // already saved

  try {
    // Show a save dialog so the user chooses exactly where the clip goes
    const defaultName = `${clip.streamerName}_${new Date(clip.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).replace(' ', '-')}.mp4`;
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Clip',
      defaultPath: path.join(require('os').homedir(), 'Downloads', defaultName),
      filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
      buttonLabel: 'Save Clip',
    });

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }

    const destPath = result.filePath;
    const settings = store.get('settings');

    // Audio normalization — re-encode with loudnorm filter if enabled
    if (settings.normalizeAudio !== false) {
      await new Promise((resolve) => {
        const ff = spawn(ffmpegPath, [
          '-y', '-i', clip.path,
          '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
          '-c:v', 'copy',
          '-c:a', 'aac', '-b:a', '192k',
          '-movflags', '+faststart',
          '-loglevel', 'warning',
          destPath,
        ]);
        ff.on('close', resolve);
        ff.on('error', () => {
          try { fs.copyFileSync(clip.path, destPath); } catch {}
          resolve();
        });
      });
    } else {
      fs.copyFileSync(clip.path, destPath);
    }

    // Mark as saved and reveal in Finder/Explorer
    clips[idx] = { ...clip, staged: false, path: destPath };
    store.set('recentClips', clips);
    sendToRenderer('clip:updated', clips[idx]);
    shell.showItemInFolder(destPath);
    return { success: true, path: destPath };
  } catch (e) {
    console.error('[ClipStream] clips:save error:', e.message);
    return { success: false, error: e.message };
  }
});

// Save ALL staged clips — user picks one folder, all clips land there
ipcMain.handle('clips:saveAll', async () => {
  const clips = store.get('recentClips', []);
  const staged = clips.filter(c => c.staged);
  if (!staged.length) return { success: true, saved: 0 };

  const result = await dialog.showOpenDialog(mainWindow, {
    title: `Choose folder to save ${staged.length} clip${staged.length > 1 ? 's' : ''}`,
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: 'Save Here',
  });

  if (result.canceled || !result.filePaths[0]) return { success: false, canceled: true };

  const destDir = result.filePaths[0];
  const settings = store.get('settings');
  let saved = 0;

  for (const clip of staged) {
    try {
      const defaultName = `${clip.streamerName}_${new Date(clip.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).replace(' ', '-')}_${saved + 1}.mp4`;
      const destPath = path.join(destDir, defaultName);

      if (settings.normalizeAudio !== false) {
        await new Promise((resolve) => {
          const ff = spawn(ffmpegPath, [
            '-y', '-i', clip.path,
            '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
            '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
            '-movflags', '+faststart', '-loglevel', 'warning',
            destPath,
          ]);
          ff.on('close', resolve);
          ff.on('error', () => { try { fs.copyFileSync(clip.path, destPath); } catch {} resolve(); });
        });
      } else {
        fs.copyFileSync(clip.path, destPath);
      }

      const allClips = store.get('recentClips', []);
      const idx = allClips.findIndex(c => c.id === clip.id);
      if (idx !== -1) {
        allClips[idx] = { ...clip, staged: false, path: destPath };
        store.set('recentClips', allClips);
        sendToRenderer('clip:updated', allClips[idx]);
      }
      saved++;
    } catch (e) {
      console.error('[ClipStream] saveAll error for clip:', clip.id, e.message);
    }
  }

  if (saved > 0) shell.openPath(destDir);
  return { success: true, saved };
});

// ─── Social Export IPC ───────────────────────────────────────────────────────
// Exports a clip to a specific social format using ffmpeg
ipcMain.handle('clips:export', async (event, { clipId, format, trimStart, trimEnd }) => {
  const clips = store.get('recentClips', []);
  const clip = clips.find(c => c.id === clipId);
  if (!clip) return { success: false, error: 'Clip not found' };

  const formatConfigs = {
    tiktok:  { suffix: '_tiktok',  vf: 'crop=ih*9/16:ih,scale=1080:1920', maxDuration: 60,  note: 'TikTok (9:16 vertical)' },
    shorts:  { suffix: '_shorts',  vf: 'crop=ih*9/16:ih,scale=1080:1920', maxDuration: 60,  note: 'YouTube Shorts (9:16)' },
    twitter: { suffix: '_twitter', vf: 'scale=1280:720',                   maxDuration: 140, note: 'Twitter/X (16:9)' },
    trim:    { suffix: '_trim',    vf: null,                                maxDuration: null, note: 'Trimmed clip' },
  };

  const cfg = formatConfigs[format];
  if (!cfg) return { success: false, error: 'Unknown format' };

  // Pick save location via dialog
  const result = await dialog.showSaveDialog(mainWindow, {
    title: `Export for ${cfg.note}`,
    defaultPath: path.join(
      store.get('settings.outputDir'),
      path.basename(clip.filename, '.mp4') + cfg.suffix + '.mp4'
    ),
    filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
  });
  if (result.canceled || !result.filePath) return { success: false, error: 'Cancelled' };

  const outputPath = result.filePath;
  const inputPath  = clip.path;

  const args = ['-y'];
  if (trimStart != null) args.push('-ss', String(trimStart));
  args.push('-i', inputPath);
  if (trimEnd != null && trimStart != null) args.push('-t', String(trimEnd - trimStart));
  else if (cfg.maxDuration) args.push('-t', String(cfg.maxDuration));

  if (cfg.vf) {
    args.push('-vf', cfg.vf);
    args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '23');
  } else {
    args.push('-c:v', 'copy');
  }
  args.push('-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-loglevel', 'warning', outputPath);

  return new Promise((resolve) => {
    const ff = spawn(ffmpegPath, args);
    ff.on('error', (err) => resolve({ success: false, error: err.message }));
    ff.on('close', (code) => {
      if (code === 0) {
        shell.showItemInFolder(outputPath);
        resolve({ success: true, path: outputPath });
      } else {
        resolve({ success: false, error: `ffmpeg exited with code ${code}` });
      }
    });
  });
});

// ─── Clip Trim IPC ───────────────────────────────────────────────────────────
// clips:trim is handled by clips:export with format='trim' — no separate handler needed

// ─── Settings IPC ────────────────────────────────────────────────────────────
ipcMain.handle('settings:get', async () => store.get('settings'));
ipcMain.handle('settings:set', async (event, settings) => {
  store.set('settings', settings);
  ensureOutputDir();
  return { success: true };
});

ipcMain.handle('apikeys:get', async () => {
  const keys = store.get('apiKeys');
  // Mask secrets
  return { ...keys, twitchClientSecret: keys.twitchClientSecret ? '••••••••' : '' };
});

ipcMain.handle('apikeys:set', async (event, keys) => {
  const existing = store.get('apiKeys');
  store.set('apiKeys', {
    ...existing,
    ...keys,
    twitchClientSecret: keys.twitchClientSecret === '••••••••' ? existing.twitchClientSecret : keys.twitchClientSecret,
  });
  return { success: true };
});

ipcMain.handle('settings:selectDir', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Raw Clips folder',
  });
  if (!result.canceled && result.filePaths[0]) {
    store.set('settings.outputDir', result.filePaths[0]);
    return { path: result.filePaths[0] };
  }
  return { path: null };
});

// ─── Subscription IPC ────────────────────────────────────────────────────────
ipcMain.handle('subscription:get', async () => store.get('subscription'));
ipcMain.handle('subscription:set', async (event, sub) => {
  store.set('subscription', sub);

  // Send welcome receipt if this is a paid activation
  if (sub.active && sub.plan !== 'promo_free' && sub.email) {
    const nextDate = new Date(sub.expiresAt + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    sendReceiptEmail(sub.email, '49.99', nextDate, false);
  }

  return { success: true };
});
ipcMain.handle('subscription:check', async () => {
  const sub = store.get('subscription');
  if (!sub.active) return { active: false };
  if (sub.expiresAt && Date.now() > sub.expiresAt) {
    store.set('subscription', { ...sub, active: false });
    return { active: false };
  }
  return { active: true, plan: sub.plan, expiresAt: sub.expiresAt };
});

// ─── Twitch Search IPC ───────────────────────────────────────────────────────
ipcMain.handle('search:streamers', async (event, { query, platform }) => {
  const apiKeys = store.get('apiKeys');
  const { default: fetch } = await import('node-fetch');

  try {
    if (platform === 'twitch' || platform === 'all') {
      if (!apiKeys.twitchClientId || !apiKeys.twitchClientSecret) {
        return { results: [], error: 'Twitch API keys not configured' };
      }
      // Get access token
      const tokenRes = await fetch(
        `https://id.twitch.tv/oauth2/token?client_id=${apiKeys.twitchClientId}&client_secret=${apiKeys.twitchClientSecret}&grant_type=client_credentials`,
        { method: 'POST' }
      );
      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;

      const searchRes = await fetch(
        `https://api.twitch.tv/helix/search/channels?query=${encodeURIComponent(query)}&first=20`,
        { headers: { 'Client-ID': apiKeys.twitchClientId, Authorization: `Bearer ${accessToken}` } }
      );
      const searchData = await searchRes.json();

      return {
        results: (searchData.data || []).map(ch => ({
          id: ch.id,
          login: ch.broadcaster_login,
          displayName: ch.display_name,
          platform: 'twitch',
          isLive: ch.is_live,
          gameTitle: ch.game_name,
          thumbnailUrl: ch.thumbnail_url,
          viewerCount: ch.viewer_count || 0,
          _accessToken: accessToken,
        })),
      };
    }

    if (platform === 'youtube') {
      if (!apiKeys.youtubeApiKey) return { results: [], error: 'YouTube API key not configured' };
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=channel&maxResults=20&key=${apiKeys.youtubeApiKey}`
      );
      const data = await res.json();
      return {
        results: (data.items || []).map(item => ({
          id: item.snippet.channelId,
          login: item.snippet.channelTitle.toLowerCase().replace(/\s/g, ''),
          displayName: item.snippet.channelTitle,
          platform: 'youtube',
          thumbnailUrl: item.snippet.thumbnails?.default?.url,
          isLive: false,
        })),
      };
    }

    if (platform === 'kick') {
      // Use Electron's net.fetch (Chromium networking stack) — bypasses Cloudflare blocks
      const kickFetch = (url) => net.fetch(url, {
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://kick.com/',
          'Origin': 'https://kick.com',
          'x-requested-with': 'XMLHttpRequest',
        },
      });

      const mapChannel = (ch) => ({
        id: String(ch.id),
        login: ch.slug,
        displayName: ch.user?.username || ch.slug,
        platform: 'kick',
        isLive: !!ch.livestream,
        thumbnailUrl: ch.user?.profile_pic,
        viewerCount: ch.livestream?.viewer_count || 0,
        _chatroomId: ch.chatroom?.id,
      });

      // 1. Try v1 search (returns list of matching channels)
      try {
        const res = await kickFetch(
          `https://kick.com/api/v1/search?type=channel&query=${encodeURIComponent(query)}`
        );
        if (res.ok) {
          const data = await res.json();
          const channels = data.channels?.data || data.channels || [];
          if (channels.length > 0) {
            return { results: channels.slice(0, 20).map(mapChannel) };
          }
        }
      } catch (e) {
        console.error('[Kick] v1 search error:', e.message);
      }

      // 2. Fallback: exact slug lookup
      try {
        const slug = query.toLowerCase().trim().replace(/\s+/g, '');
        const res = await kickFetch(`https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`);
        if (res.ok) {
          const ch = await res.json();
          if (ch && ch.id) return { results: [mapChannel(ch)] };
        }
      } catch (e) {
        console.error('[Kick] v2 channel error:', e.message);
      }

      return { results: [], error: 'No Kick channels found. Try typing the exact channel name (e.g. "xqc").' };
    }

    return { results: [] };
  } catch (err) {
    return { results: [], error: err.message };
  }
});

// ─── SMTP Settings IPC ───────────────────────────────────────────────────────
ipcMain.handle('smtp:get', async () => {
  const s = store.get('smtp', {});
  return { ...s, pass: s.pass ? '••••••••' : '' }; // mask password
});
ipcMain.handle('smtp:set', async (event, cfg) => {
  const existing = store.get('smtp', {});
  store.set('smtp', {
    ...existing,
    ...cfg,
    pass: cfg.pass === '••••••••' ? existing.pass : cfg.pass,
  });
  return { success: true };
});

// ─── Auth IPC ────────────────────────────────────────────────────────────────
ipcMain.handle('auth:register', async (event, { email, password }) => {
  try {
    const crypto = require('crypto');
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    store.set('account', { email, passwordHash, createdAt: Date.now() });
    store.set('auth.loggedIn', true);
    return { success: true, email };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('auth:login', async (event, { email, password }) => {
  try {
    const crypto = require('crypto');
    const account = store.get('account');
    if (!account || !account.email) {
      return { success: false, error: 'No account found. Please sign up first.' };
    }
    if (account.email.toLowerCase() !== email.toLowerCase()) {
      return { success: false, error: 'Invalid email or password.' };
    }
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    if (hash !== account.passwordHash) {
      return { success: false, error: 'Invalid email or password.' };
    }
    store.set('auth.loggedIn', true);
    return { success: true, email: account.email };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('auth:logout', async () => {
  store.set('auth.loggedIn', false);
  return { success: true };
});

ipcMain.handle('auth:status', async () => {
  const account = store.get('account');
  const loggedIn = store.get('auth.loggedIn', false);
  if (!account || !account.email) return { hasAccount: false, loggedIn: false };
  return { hasAccount: true, loggedIn, email: account.email };
});

// ─── Email Receipt ────────────────────────────────────────────────────────────
async function sendReceiptEmail(email, amount, nextBillingDate, isRenewal = false) {
  const smtp = store.get('smtp', {});
  if (!smtp.host || !smtp.user || !smtp.pass) return; // SMTP not configured

  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: Number(smtp.port) || 587,
      secure: Number(smtp.port) === 465,
      auth: { user: smtp.user, pass: smtp.pass },
    });

    const subject = isRenewal
      ? '🎬 ClipStream — Monthly Renewal Confirmed'
      : '🎬 ClipStream — Welcome! Your Subscription Receipt';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #08080f; color: #f1f1f8; margin: 0; padding: 0; }
          .container { max-width: 520px; margin: 40px auto; background: #0e0e1a; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); overflow: hidden; }
          .header { background: linear-gradient(135deg, #7c3aed, #2563eb); padding: 32px; text-align: center; }
          .logo { font-size: 28px; font-weight: 800; color: white; letter-spacing: -0.5px; margin: 0; }
          .logo span { opacity: 0.7; }
          .body { padding: 32px; }
          h2 { color: #f1f1f8; margin: 0 0 8px; font-size: 20px; }
          p { color: #8b8ba8; margin: 0 0 16px; line-height: 1.6; font-size: 14px; }
          .receipt-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 14px; }
          .receipt-row:last-child { border-bottom: none; }
          .receipt-label { color: #8b8ba8; }
          .receipt-value { color: #f1f1f8; font-weight: 500; }
          .total-row { background: rgba(124,58,237,0.1); border-radius: 8px; padding: 14px 16px; margin: 16px 0; display: flex; justify-content: space-between; font-size: 16px; font-weight: 600; }
          .total-label { color: #a78bfa; }
          .total-value { color: #f1f1f8; }
          .footer { padding: 20px 32px; border-top: 1px solid rgba(255,255,255,0.06); text-align: center; }
          .footer p { color: #4a4a6a; font-size: 12px; margin: 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <p class="logo">Clip<span>Forge</span></p>
          </div>
          <div class="body">
            <h2>${isRenewal ? 'Subscription Renewed' : 'Welcome to ClipStream Pro!'}</h2>
            <p>${isRenewal
              ? 'Your ClipStream Pro subscription has been automatically renewed. Here is your receipt.'
              : 'Thank you for subscribing to ClipStream Pro! Your account is now active. Here is your receipt.'}</p>

            <div>
              <div class="receipt-row">
                <span class="receipt-label">Plan</span>
                <span class="receipt-value">ClipStream Pro — Monthly</span>
              </div>
              <div class="receipt-row">
                <span class="receipt-label">Billed to</span>
                <span class="receipt-value">${email}</span>
              </div>
              <div class="receipt-row">
                <span class="receipt-label">Date</span>
                <span class="receipt-value">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
              <div class="receipt-row">
                <span class="receipt-label">Next billing date</span>
                <span class="receipt-value">${nextBillingDate}</span>
              </div>
            </div>

            <div class="total-row">
              <span class="total-label">Amount charged</span>
              <span class="total-value">$${amount}</span>
            </div>

            <p style="font-size:12px; color:#4a4a6a;">To cancel or manage your subscription, open ClipStream and go to Settings. Questions? Reply to this email.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} ClipStream · You're receiving this because you subscribed at ${email}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: `"${smtp.fromName || 'ClipStream'}" <${smtp.user}>`,
      to: email,
      subject,
      html,
    });
    console.log('[ClipStream] Receipt email sent to', email);
  } catch (err) {
    console.error('[ClipStream] Email send error:', err.message);
  }
}

// ─── Monthly Renewal Scheduler ────────────────────────────────────────────────
function scheduleRenewalCheck() {
  // Check every hour whether a subscription is about to expire and renew it
  setInterval(() => {
    const sub = store.get('subscription', {});
    if (!sub.active || !sub.expiresAt || sub.plan === 'promo_free') return;

    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;

    // If expiry is within the next hour, renew
    if (sub.expiresAt > now && sub.expiresAt - now < oneHour) {
      const newExpiry = sub.expiresAt + thirtyDays;
      store.set('subscription.expiresAt', newExpiry);

      const account = store.get('account', {});
      if (account.email) {
        const nextDate = new Date(newExpiry + thirtyDays).toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric',
        });
        sendReceiptEmail(account.email, '49.99', nextDate, true);
      }

      // Notify the renderer to refresh subscription state
      sendToRenderer('subscription:renewed', { expiresAt: newExpiry });
    }
  }, 60 * 60 * 1000); // every hour
}

// ─── Daily Digest Email ──────────────────────────────────────────────────────
function scheduleDailyDigest() {
  const checkDigest = () => {
    const now = new Date();
    if (now.getHours() !== 8 || now.getMinutes() > 5) return; // only fire ~8:00 AM

    const smtp = store.get('smtp', {});
    if (!smtp.host || !smtp.user) return; // no SMTP configured

    const account = store.get('account', {});
    const email = account.email;
    if (!email) return;

    const lastDigest = store.get('lastDigestSent', 0);
    const today = new Date().setHours(0, 0, 0, 0);
    if (lastDigest >= today) return; // already sent today

    // Collect yesterday's clips
    const yesterday = today - 86400000;
    const clips = store.get('recentClips', []);
    const yesterdayClips = clips.filter(c => c.createdAt >= yesterday && c.createdAt < today);
    if (yesterdayClips.length === 0) return;

    store.set('lastDigestSent', Date.now());
    sendDailyDigest(email, yesterdayClips, smtp);
  };

  // Check every 5 minutes
  setInterval(checkDigest, 5 * 60 * 1000);
  checkDigest();
}

async function sendDailyDigest(toEmail, clips, smtp) {
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: smtp.host, port: smtp.port || 587, secure: smtp.port === 465,
      auth: { user: smtp.user, pass: smtp.pass },
    });

    const totalClips  = clips.length;
    const avgHype     = Math.round(clips.reduce((s, c) => s + (c.hypeScore ?? 0), 0) / totalClips);
    const bestClip    = clips.reduce((a, b) => (b.hypeScore ?? 0) > (a.hypeScore ?? 0) ? b : a);
    const date        = new Date(Date.now() - 86400000).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    const clipsHtml = clips.slice(0, 10).map(c => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #1e2030;font-size:13px;color:#c4b5fd;">${c.streamerName}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #1e2030;font-size:13px;color:#9ca3af;text-transform:capitalize;">${c.platform}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #1e2030;font-size:13px;font-weight:700;color:${(c.hypeScore ?? 0) >= 70 ? '#a78bfa' : '#fbbf24'};">${c.hypeScore ?? 0}%</td>
        <td style="padding:8px 12px;border-bottom:1px solid #1e2030;font-size:11px;color:#6b7280;">${new Date(c.createdAt).toLocaleTimeString()}</td>
      </tr>
    `).join('');

    await transporter.sendMail({
      from: `"${smtp.fromName || 'ClipStream'}" <${smtp.user}>`,
      to: toEmail,
      subject: `🎬 ClipStream Daily Digest — ${totalClips} clip${totalClips !== 1 ? 's' : ''} from ${date}`,
      html: `
        <div style="background:#0a0a0f;padding:32px;font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h1 style="color:#a78bfa;font-size:22px;margin:0 0 4px;">🎬 ClipStream Daily Digest</h1>
          <p style="color:#6b7280;font-size:13px;margin:0 0 24px;">${date}</p>

          <div style="display:flex;gap:16px;margin-bottom:24px;">
            <div style="flex:1;background:#13141f;border:1px solid #1e2030;border-radius:10px;padding:16px;text-align:center;">
              <div style="font-size:28px;font-weight:800;color:#a78bfa;">${totalClips}</div>
              <div style="font-size:12px;color:#6b7280;margin-top:4px;">Clips captured</div>
            </div>
            <div style="flex:1;background:#13141f;border:1px solid #1e2030;border-radius:10px;padding:16px;text-align:center;">
              <div style="font-size:28px;font-weight:800;color:#fbbf24;">${avgHype}%</div>
              <div style="font-size:12px;color:#6b7280;margin-top:4px;">Avg hype score</div>
            </div>
            <div style="flex:1;background:#13141f;border:1px solid #1e2030;border-radius:10px;padding:16px;text-align:center;">
              <div style="font-size:28px;font-weight:800;color:#4ade80;">${bestClip.hypeScore ?? 0}%</div>
              <div style="font-size:12px;color:#6b7280;margin-top:4px;">Best clip</div>
            </div>
          </div>

          <table style="width:100%;border-collapse:collapse;background:#13141f;border-radius:10px;overflow:hidden;">
            <thead>
              <tr style="background:#1e2030;">
                <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">Streamer</th>
                <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">Platform</th>
                <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">Hype</th>
                <th style="padding:10px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;">Time</th>
              </tr>
            </thead>
            <tbody>${clipsHtml}</tbody>
          </table>

          ${clips.length > 10 ? `<p style="color:#6b7280;font-size:12px;text-align:center;margin-top:12px;">+${clips.length - 10} more clips in ClipStream</p>` : ''}

          <p style="color:#374151;font-size:11px;text-align:center;margin-top:24px;">ClipStream AI · Sent automatically each morning</p>
        </div>
      `,
    });

    console.log(`[ClipStream] Daily digest sent to ${toEmail} — ${totalClips} clips`);
  } catch (e) {
    console.error('[ClipStream] Daily digest error:', e.message);
  }
}

// ─── Window Controls IPC ─────────────────────────────────────────────────────
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('window:close', () => mainWindow?.close());

// ─── Per-streamer settings ───────────────────────────────────────────────────
ipcMain.handle('streamerSettings:get', async (event, streamerId) => {
  return store.get(`streamerSettings.${streamerId}`, {});
});
ipcMain.handle('streamerSettings:set', async (event, { streamerId, settings }) => {
  store.set(`streamerSettings.${streamerId}`, settings);
  return { success: true };
});

// ─── Clip ratings ────────────────────────────────────────────────────────────
ipcMain.handle('clips:rate', async (event, { clipId, rating }) => {
  const clips = store.get('recentClips', []);
  const idx = clips.findIndex(c => c.id === clipId);
  if (idx === -1) return { success: false };
  clips[idx] = { ...clips[idx], rating };
  store.set('recentClips', clips);

  // Update per-streamer sensitivity nudge based on ratings
  const clip = clips[idx];
  const skey = `streamerSettings.${clip.streamerId}`;
  const sSettings = store.get(skey, {});
  // Track average rating to influence detection — high ratings = keep current, low = tighten
  const streamerClips = clips.filter(c => c.streamerId === clip.streamerId && c.rating);
  if (streamerClips.length >= 5) {
    const avgRating = streamerClips.reduce((s, c) => s + c.rating, 0) / streamerClips.length;
    // avgRating 1-5: if < 2.5 tighten, if > 3.5 loosen slightly
    sSettings.ratingFeedbackSensitivity = Math.round(avgRating * 10); // 10-50 nudge value
    store.set(skey, sSettings);
  }

  sendToRenderer('clip:updated', clips[idx]);
  return { success: true };
});

// ─── Disk usage ──────────────────────────────────────────────────────────────
ipcMain.handle('disk:usage', async () => {
  const clips = store.get('recentClips', []);
  let stagingBytes = 0, savedBytes = 0;
  for (const clip of clips) {
    try {
      const stat = fs.existsSync(clip.path) ? fs.statSync(clip.path) : null;
      if (stat) {
        if (clip.staged) stagingBytes += stat.size;
        else savedBytes += stat.size;
      }
    } catch {}
  }
  return { stagingBytes, savedBytes, totalBytes: stagingBytes + savedBytes, clipCount: clips.length };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

function notifyUser(title, body) {
  if (store.get('settings.notifications')) {
    new Notification({ title, body, icon: path.join(__dirname, 'assets', 'icon.png') }).show();
  }
}

function stopAllMonitors() {
  for (const [, session] of activeMonitors) {
    session.destroy();
  }
  activeMonitors.clear();
}

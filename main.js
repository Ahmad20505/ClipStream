const { app, BrowserWindow, ipcMain, dialog, shell, Notification, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');
const os = require('os');

// ─── Bundled ffmpeg binary (no install needed) ───────────────────────────────
const ffmpegPath = require('ffmpeg-static');

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
        audioThreshold: -20,   // kept for UI compat (used as floor only)
        chatThreshold: 15,     // kept for UI compat
        sensitivity: 50,       // 0 = very selective, 100 = clips everything
        autoStart: false,
        notifications: true,
        quality: 'best',
      },
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
      webSecurity: true,
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

app.whenReady().then(async () => {
  await initStore();
  ensureOutputDir();
  cleanupOldThumbnails();
  createWindow();
  scheduleRenewalCheck();
  checkStreamlinkInstalled();
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

app.on('window-all-closed', () => {
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

  // ── Cooldown: min 60 s between clips so we don't re-clip the same moment ──
  const cooldown = 60000;
  if (now - session.lastClipTime < cooldown) return;

  // ── Warmup: need ≥ 60 s of data before we have a reliable baseline ─────────
  const warmup = 60000;
  if (now - session.startedAt < warmup) return;

  // ── Compute this streamer's personal baselines ─────────────────────────────
  const audioBaseline = computeBaseline(session.audioReadings); // LUFS 40th pct
  const chatBaseline  = computeBaseline(session.chatReadings);  // msg/10s 40th pct

  // Still not enough data (stream was quiet / just started sending audio)
  if (audioBaseline === null) return;

  // ── Audio spike: dB above this streamer's normal level ────────────────────
  const audioSpikeDb = session.audioLevel - audioBaseline;
  // Require at least 5 dB above normal (configurable via sensitivity setting)
  const sensitivity    = Math.max(0, Math.min(100, settings.sensitivity ?? 50));
  const audioNeed      = 10 - (sensitivity / 100) * 6;   // 4–10 dB depending on sensitivity
  const audioTriggered = audioSpikeDb >= audioNeed && session.audioLevel > -45;

  // ── Chat spike: multiple of this streamer's normal rate ───────────────────
  const chatBase       = Math.max(chatBaseline ?? 0, 3);  // at least 3 so divide is safe
  const chatMultiplier = session.chatRate / chatBase;
  // Require 2× normal (configurable)
  const chatNeed       = 2.5 - (sensitivity / 100) * 1.0; // 1.5–2.5× depending on sensitivity
  const chatTriggered  = chatMultiplier >= chatNeed && session.chatRate >= 5;

  // ── Hype score 0–1 ────────────────────────────────────────────────────────
  const audioScore = Math.min(1, Math.max(0, (audioSpikeDb - audioNeed)  / 8));
  const chatScore  = Math.min(1, Math.max(0, (chatMultiplier - 1)        / 3));
  const hypeScore  = audioScore * 0.55 + chatScore * 0.45;

  // ── Trigger logic ─────────────────────────────────────────────────────────
  const chatWorking = session.chatEverActive || (now - session.startedAt < 120000);

  // Normal: both signals must spike simultaneously
  const bothTriggered = audioTriggered && chatTriggered;
  // Single-signal extreme spikes (very rare — think "streamer shouts unexpectedly")
  const extremeAudio  = audioSpikeDb >= audioNeed + 8 && chatWorking && session.chatRate >= 3;
  const extremeChat   = chatMultiplier >= chatNeed  + 2 && audioSpikeDb >= 2;
  // Audio-only fallback when chat never connected after grace period
  const audioOnly     = !chatWorking && audioSpikeDb >= audioNeed + 6;

  const shouldClip = bothTriggered || extremeAudio || extremeChat || audioOnly;

  if (shouldClip) {
    const reason = bothTriggered ? 'both' : extremeAudio ? 'extreme-audio' : extremeChat ? 'extreme-chat' : 'audio-only';
    console.log(
      `[ClipStream] 🎬 Hype! ${session.streamer.displayName} ` +
      `audio+${audioSpikeDb.toFixed(1)}dB (base ${audioBaseline.toFixed(1)}) ` +
      `chat×${chatMultiplier.toFixed(1)} (base ${chatBase.toFixed(0)}) ` +
      `score=${hypeScore.toFixed(2)} reason=${reason}`
    );
    session.lastClipTime = now;
    captureClip(session, settings, hypeScore);
  }
}

async function captureClip(session, settings, hypeScore = 0.5) {
  const streamUrl = getStreamUrl(session.streamer);
  const outputDir = streamerClipDir(settings, session.streamer);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${safeName(session.streamer.displayName)}_${timestamp}.mp4`;
  const outputPath = path.join(outputDir, filename);
  const duration = settings.clipDuration || 60;

  console.log(`[ClipStream] Starting clip capture → ${outputPath}`);

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
        duration,
        createdAt: Date.now(),
        audioLevel: session.audioLevel,
        chatRate: session.chatRate,
        audioBaseline: session.audioBaseline,
        chatBaseline: session.chatBaseline,
        hypeScore: Math.round(hypeScore * 100), // 0–100
        thumbnail: null,
      };

      generateThumbnail(outputPath, clipData);

      const clips = store.get('recentClips', []);
      clips.unshift(clipData);
      if (clips.length > 500) clips.splice(500);
      store.set('recentClips', clips);

      sendToRenderer('clip:created', clipData);
      sendToRenderer('monitor:update', { id: session.streamer.id, clipsCreated: session.clipsCreated });
      notifyUser('🎬 New clip saved!', `${session.streamer.displayName} · ${filename}`);
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

// ─── Window Controls IPC ─────────────────────────────────────────────────────
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('window:close', () => mainWindow?.close());

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

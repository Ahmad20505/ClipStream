const { contextBridge, ipcRenderer } = require('electron');

// Expose safe API surface to renderer process
contextBridge.exposeInMainWorld('clipforge', {
  // Monitor controls
  monitor: {
    start: (streamer) => ipcRenderer.invoke('monitor:start', streamer),
    stop: (streamerId) => ipcRenderer.invoke('monitor:stop', streamerId),
    list: () => ipcRenderer.invoke('monitor:list'),
    status: (streamerId) => ipcRenderer.invoke('monitor:status', streamerId),
    onUpdate: (callback) => {
      ipcRenderer.on('monitor:update', (_, data) => callback(data));
      return () => ipcRenderer.removeAllListeners('monitor:update');
    },
    onMetrics: (callback) => {
      ipcRenderer.on('monitor:metrics', (_, data) => callback(data));
      return () => ipcRenderer.removeAllListeners('monitor:metrics');
    },
  },

  // Clip management
  clips: {
    list: () => ipcRenderer.invoke('clips:list'),
    open: (clipPath) => ipcRenderer.invoke('clips:open', clipPath),
    delete: (clipId) => ipcRenderer.invoke('clips:delete', clipId),
    openFolder: () => ipcRenderer.invoke('clips:openFolder'),
    onCreate: (callback) => {
      ipcRenderer.on('clip:created', (_, data) => callback(data));
      return () => ipcRenderer.removeAllListeners('clip:created');
    },
    onThumbnail: (callback) => {
      ipcRenderer.on('clip:thumbnail', (_, data) => callback(data));
      return () => ipcRenderer.removeAllListeners('clip:thumbnail');
    },
  },

  // Search
  search: {
    streamers: (query, platform) => ipcRenderer.invoke('search:streamers', { query, platform }),
  },

  // Settings
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (settings) => ipcRenderer.invoke('settings:set', settings),
    selectDir: () => ipcRenderer.invoke('settings:selectDir'),
  },

  // API Keys
  apiKeys: {
    get: () => ipcRenderer.invoke('apikeys:get'),
    set: (keys) => ipcRenderer.invoke('apikeys:set', keys),
  },

  // Subscription
  subscription: {
    get: () => ipcRenderer.invoke('subscription:get'),
    set: (sub) => ipcRenderer.invoke('subscription:set', sub),
    check: () => ipcRenderer.invoke('subscription:check'),
  },

  // SMTP
  smtp: {
    get: () => ipcRenderer.invoke('smtp:get'),
    set: (cfg) => ipcRenderer.invoke('smtp:set', cfg),
  },

  // Auth
  auth: {
    register: (data) => ipcRenderer.invoke('auth:register', data),
    login: (data) => ipcRenderer.invoke('auth:login', data),
    logout: () => ipcRenderer.invoke('auth:logout'),
    status: () => ipcRenderer.invoke('auth:status'),
  },

  // Window controls (custom titlebar)
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
  },

  // Platform info
  platform: process.platform,
});

# 🎬 ClipStream — AI-Powered Stream Clipper

**ClipStream** is a desktop app that automatically monitors Twitch, YouTube Live, and Kick streams, detects hype moments using AI (audio + chat analysis), and saves clips directly to a `Raw Clips` folder on your computer.

**Subscription:** $49.99/month

---

## Quick Start

### Prerequisites

Install these tools on your computer before running ClipStream:

1. **Node.js 18+** — https://nodejs.org
2. **FFmpeg** — https://ffmpeg.org/download.html
   - macOS: `brew install ffmpeg`
   - Windows: Download from https://www.gyan.dev/ffmpeg/builds/ and add to PATH
3. **Streamlink** — https://streamlink.github.io
   - macOS: `brew install streamlink`
   - Windows: `pip install streamlink`

### Install & Run (Development)

```bash
cd ClipStream
npm install
npm run dev
```

### Build for Distribution

```bash
# Build for macOS
npm run build:mac

# Build for Windows
npm run build:win

# Build for both
npm run build
```

Built installers will appear in `dist-electron/`.

---

## API Key Setup

ClipStream requires API keys to search and monitor streams. All keys are stored **locally on your machine only**.

### Twitch (Required for Twitch features)

1. Go to https://dev.twitch.tv/console
2. Click **Register Your Application**
3. Set **OAuth Redirect URL** to `http://localhost`
4. Copy your **Client ID** and **Client Secret**
5. Paste both into ClipStream → **Settings → API Keys**

### YouTube (Required for YouTube features)

1. Go to https://console.cloud.google.com
2. Create a new project (or use an existing one)
3. Enable the **YouTube Data API v3**
4. Go to **Credentials → Create API Key**
5. Paste it into ClipStream → **Settings → API Keys**

### Kick (No key required)

Kick works out of the box — no API key needed.

---

## Subscription & Payments

ClipStream uses Stripe for subscription management.

### Setting Up Stripe (for Developers/Operators)

1. Create a Stripe account at https://stripe.com
2. Get your **Publishable Key** from the Stripe Dashboard
3. Paste it into **Settings → API Keys**

For production deployments, you'll want to:
- Create a backend endpoint that creates Stripe Checkout Sessions
- Handle webhooks for subscription lifecycle events (`customer.subscription.created`, `.updated`, `.deleted`)
- Replace the simulated payment flow in `SubscriptionGate.jsx` with a real Stripe Elements integration

### Test Mode

During development, use Stripe test card: `4242 4242 4242 4242` with any future expiry and any 3-digit CVV.

---

## How the AI Clipper Works

ClipStream detects "hype moments" by combining two signals:

| Signal | How it works | Default threshold |
|--------|-------------|-------------------|
| **Audio Spike** | FFmpeg analyzes live audio levels from the stream | > -20 dB |
| **Chat Explosion** | IRC/WebSocket monitors messages per second | > 15 msg/s |

When **both** signals spike simultaneously, ClipStream:
1. Captures the stream via Streamlink → FFmpeg
2. Records a clip of the configured duration (default: 60s)
3. Generates a thumbnail
4. Saves to `~/Raw Clips/<platform>/<streamer>/`
5. Sends a desktop notification

You can tune both thresholds in **Settings → Clip Detection**.

---

## Project Structure

```
ClipStream/
├── main.js              # Electron main process (stream capture, IPC)
├── preload.js           # Secure bridge between main ↔ renderer
├── index.html           # App HTML entry point
├── vite.config.js       # Vite bundler config
├── package.json         # Dependencies & build scripts
└── src/
    ├── main.jsx         # React entry point
    ├── App.jsx          # Root component & routing
    ├── styles/
    │   └── index.css    # Dark theme / glassmorphism styles
    └── components/
        ├── TitleBar.jsx          # Custom window titlebar
        ├── Sidebar.jsx           # Navigation sidebar
        ├── Dashboard.jsx         # Stats & overview
        ├── StreamerSearch.jsx    # Search across all platforms
        ├── ActiveMonitors.jsx    # Real-time monitor cards
        ├── ClipGallery.jsx       # Browse & manage clips
        ├── Settings.jsx          # App & API key settings
        └── SubscriptionGate.jsx  # Subscription paywall & checkout
```

---

## Customization

### Adding More Platforms

To add a new platform (e.g., Rumble, Trovo):

1. Add an entry in `src/components/StreamerSearch.jsx` → `PLATFORMS` array
2. Add a URL handler in `main.js` → `getStreamUrl()`
3. Add a chat monitor in `main.js` → `startChatMonitor()`
4. Add a live-check in `main.js` → `checkIfLive()`

### Adjusting AI Sensitivity

Fine-tune from **Settings → Clip Detection**:
- Lower **Audio Threshold** (more negative) = fewer audio triggers
- Higher **Chat Threshold** = requires more chat activity per second
- Cooldown between clips is hardcoded at 30 seconds in `main.js`

---

## Deployment Checklist (for selling the app)

- [ ] Register your app on Twitch Developer Console
- [ ] Set up Stripe with real product + price IDs
- [ ] Build a backend to verify Stripe subscriptions (don't rely only on client-side)
- [ ] Set up code signing for macOS (Apple Developer Program, ~$99/yr)
- [ ] Set up code signing for Windows (EV certificate, ~$300/yr)
- [ ] Set up auto-update server (electron-updater compatible)
- [ ] Create a landing page / marketing site
- [ ] Set up Stripe billing portal for cancellations

---

## License

Proprietary — All rights reserved. Not for redistribution.

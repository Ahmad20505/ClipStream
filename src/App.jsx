import { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar.jsx';
import TitleBar from './components/TitleBar.jsx';
import Dashboard from './components/Dashboard.jsx';
import StreamerSearch from './components/StreamerSearch.jsx';
import ActiveMonitors from './components/ActiveMonitors.jsx';
import ClipGallery from './components/ClipGallery.jsx';
import Settings from './components/Settings.jsx';
import SubscriptionGate from './components/SubscriptionGate.jsx';
import SignIn from './components/SignIn.jsx';

const api = window.clipforge;

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [subscription, setSubscription] = useState(null);
  const [monitors, setMonitors] = useState([]);
  const [clips, setClips] = useState([]);
  const [settings, setSettingsState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  // Auth state: null = unknown, 'signed-in', 'signed-out', 'no-account'
  const [authState, setAuthState] = useState(null);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        // Check auth first
        const auth = await api.auth.status();
        if (!auth.hasAccount) {
          setAuthState('no-account');
          setLoading(false);
          return;
        }
        if (!auth.loggedIn) {
          setAuthState('signed-out');
          setLoading(false);
          return;
        }
        setAuthState('signed-in');

        const [sub, monList, clipList, cfg] = await Promise.all([
          api.subscription.check(),
          api.monitor.list(),
          api.clips.list(),
          api.settings.get(),
        ]);
        setSubscription(sub);
        setMonitors(monList);
        setClips(clipList);
        setSettingsState(cfg);
      } catch (err) {
        console.error('Init error:', err);
        setAuthState('no-account');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // ── Real-time events ──────────────────────────────────────────────────────
  useEffect(() => {
    if (authState !== 'signed-in') return;

    const offUpdate = api.monitor.onUpdate((data) => {
      setMonitors(prev => prev.map(m => m.id === data.id ? { ...m, ...data } : m));
    });
    const offCreate = api.clips.onCreate((clip) => {
      setClips(prev => [clip, ...prev]);
      showToast(`🎬 Clip saved: ${clip.filename}`, 'success');
    });
    const offThumb = api.clips.onThumbnail(({ id, thumbnail }) => {
      setClips(prev => prev.map(c => c.id === id ? { ...c, thumbnail } : c));
    });
    return () => { offUpdate?.(); offCreate?.(); offThumb?.(); };
  }, [authState]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const handleSubscribe = useCallback(async (sub) => {
    await api.subscription.set(sub);
    setSubscription({ active: true, ...sub });

    // Load app data and transition into the main app
    try {
      const [monList, clipList, cfg] = await Promise.all([
        api.monitor.list(),
        api.clips.list(),
        api.settings.get(),
      ]);
      setMonitors(monList);
      setClips(clipList);
      setSettingsState(cfg);
    } catch (e) {
      console.error('Post-subscribe init error:', e);
    }
    setAuthState('signed-in');
  }, []);

  const handleStartMonitor = useCallback(async (streamer) => {
    const result = await api.monitor.start(streamer);
    if (result.success) {
      setMonitors(prev => [...prev, {
        id: streamer.id, streamer, status: 'connecting',
        clipsCreated: 0, startedAt: Date.now(), isLive: false, audioLevel: -60, chatRate: 0,
      }]);
      showToast(`Started monitoring ${streamer.displayName}`, 'success');
      setPage('monitors');
    } else {
      showToast(result.error || 'Failed to start monitor', 'error');
    }
  }, [showToast]);

  const handleStopMonitor = useCallback(async (streamerId) => {
    await api.monitor.stop(streamerId);
    setMonitors(prev => prev.filter(m => m.id !== streamerId));
    showToast('Monitor stopped', 'info');
  }, [showToast]);

  const handleDeleteClip = useCallback(async (clipId) => {
    await api.clips.delete(clipId);
    setClips(prev => prev.filter(c => c.id !== clipId));
    showToast('Clip deleted', 'info');
  }, [showToast]);

  const handleSaveSettings = useCallback(async (newSettings) => {
    await api.settings.set(newSettings);
    setSettingsState(newSettings);
    showToast('Settings saved', 'success');
  }, [showToast]);

  const handleSignIn = useCallback(async (authResult) => {
    setLoading(true);
    try {
      const [sub, monList, clipList, cfg] = await Promise.all([
        api.subscription.check(),
        api.monitor.list(),
        api.clips.list(),
        api.settings.get(),
      ]);
      setSubscription(sub);
      setMonitors(monList);
      setClips(clipList);
      setSettingsState(cfg);
      setAuthState('signed-in');
    } catch (e) {
      console.error('Post sign-in init error:', e);
      setAuthState('signed-in');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogout = useCallback(() => {
    setAuthState('signed-out');
    setSubscription(null);
    setMonitors([]);
    setClips([]);
    setPage('dashboard');
    showToast('Signed out successfully', 'info');
  }, [showToast]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-logo">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <path d="M8 24L24 8L40 24L24 40L8 24Z" fill="url(#grad)" />
            <path d="M18 22L22 26L30 18" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <defs>
              <linearGradient id="grad" x1="8" y1="8" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                <stop stopColor="#7c3aed" />
                <stop offset="1" stopColor="#2563eb" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <p className="loading-text">Loading ClipForge...</p>
        <div className="loading-spinner" />
      </div>
    );
  }

  // ── Sign In (returning user) ───────────────────────────────────────────────
  if (authState === 'signed-out') {
    return (
      <div className="app-root">
        <TitleBar />
        <SignIn
          onSignIn={handleSignIn}
          onGoToSignUp={() => setAuthState('no-account')}
        />
      </div>
    );
  }

  // ── Subscription Gate (new user / not subscribed) ─────────────────────────
  if (authState === 'no-account' || !subscription?.active) {
    return (
      <div className="app-root">
        <TitleBar />
        <SubscriptionGate
          onSubscribe={handleSubscribe}
          onGoToSignIn={() => setAuthState('signed-out')}
        />
      </div>
    );
  }

  // ── Main App ──────────────────────────────────────────────────────────────
  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <Dashboard monitors={monitors} clips={clips} onNavigate={setPage} />;
      case 'search':
        return <StreamerSearch onMonitor={handleStartMonitor} monitors={monitors} />;
      case 'monitors':
        return <ActiveMonitors monitors={monitors} onStop={handleStopMonitor} onNavigate={setPage} />;
      case 'clips':
        return <ClipGallery clips={clips} onDelete={handleDeleteClip} onOpenFolder={() => api.clips.openFolder()} />;
      case 'settings':
        return <Settings settings={settings} onSave={handleSaveSettings} subscription={subscription} onLogout={handleLogout} />;
      default:
        return <Dashboard monitors={monitors} clips={clips} onNavigate={setPage} />;
    }
  };

  return (
    <div className="app-root">
      <TitleBar />
      <div className="app-body">
        <Sidebar page={page} onNavigate={setPage} monitorCount={monitors.length} clips={clips} />
        <main className="app-main">
          <div className="page-container">
            {renderPage()}
          </div>
        </main>
      </div>
      {toast && (
        <div className={`toast toast-${toast.type}`} key={toast.id}>
          <span className="toast-icon">
            {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'ℹ'}
          </span>
          {toast.message}
        </div>
      )}
    </div>
  );
}

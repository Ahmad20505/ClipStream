import { useState, useEffect } from 'react';

const api = window.clipforge;

function AudioMeter({ level }) {
  // level is in dB, typically -60 to 0
  const pct = Math.max(0, Math.min(100, ((level + 60) / 60) * 100));
  const color = level > -20 ? '#22c55e' : level > -35 ? '#f59e0b' : '#6b7280';
  return (
    <div className="meter-wrap">
      <div className="meter-bar">
        <div className="meter-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="meter-label">{level.toFixed(0)} dB</span>
    </div>
  );
}

function ChatMeter({ rate, threshold = 15 }) {
  const pct = Math.min(100, (rate / (threshold * 3)) * 100);
  const color = rate >= threshold ? '#22c55e' : rate >= threshold / 2 ? '#f59e0b' : '#6b7280';
  return (
    <div className="meter-wrap">
      <div className="meter-bar">
        <div className="meter-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="meter-label">{rate} msg/s</span>
    </div>
  );
}

function MonitorCard({ monitor, onStop }) {
  const [metrics, setMetrics] = useState({ audioLevel: monitor.audioLevel || -60, chatRate: monitor.chatRate || 0 });
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    const off = api.monitor.onMetrics((data) => {
      if (data.id === monitor.id) {
        setMetrics({ audioLevel: data.audioLevel, chatRate: data.chatRate });
      }
    });
    return off;
  }, [monitor.id]);

  const handleStop = async () => {
    setStopping(true);
    await onStop(monitor.id);
  };

  const statusConfig = {
    live: { color: '#22c55e', label: 'LIVE', bgColor: '#22c55e18' },
    offline: { color: '#6b7280', label: 'Offline', bgColor: '#6b728018' },
    connecting: { color: '#f59e0b', label: 'Connecting…', bgColor: '#f59e0b18' },
    reconnecting: { color: '#f59e0b', label: 'Reconnecting…', bgColor: '#f59e0b18' },
    error: { color: '#ef4444', label: 'Error', bgColor: '#ef444418' },
    checking: { color: '#8b5cf6', label: 'Checking…', bgColor: '#8b5cf618' },
  };

  const cfg = statusConfig[monitor.status] || statusConfig.offline;
  const platformColors = { twitch: '#9146ff', youtube: '#ff0000', kick: '#53fc18' };
  const platform = monitor.streamer?.platform;
  const platformColor = platformColors[platform] || '#888';

  const uptime = () => {
    const s = Math.floor((Date.now() - monitor.startedAt) / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div className="monitor-card" style={{ borderColor: monitor.isLive ? `${platformColor}44` : 'transparent' }}>
      {/* Header */}
      <div className="monitor-card-header">
        <div className="monitor-avatar-wrap">
          {monitor.streamer?.thumbnailUrl ? (
            <img className="monitor-avatar" src={monitor.streamer.thumbnailUrl} alt="" />
          ) : (
            <div className="avatar-placeholder large">{monitor.streamer?.displayName?.[0] || '?'}</div>
          )}
          {monitor.isLive && <span className="pulse-ring" style={{ borderColor: platformColor }} />}
        </div>

        <div className="monitor-card-info">
          <div className="monitor-name-row">
            <h3 className="monitor-name">{monitor.streamer?.displayName}</h3>
            <span className="platform-chip small" style={{ background: `${platformColor}22`, color: platformColor, borderColor: `${platformColor}44` }}>
              {platform}
            </span>
          </div>
          <div className="monitor-status-row">
            <span className="status-badge" style={{ background: cfg.bgColor, color: cfg.color, borderColor: `${cfg.color}44` }}>
              {monitor.isLive && <span className="status-pulse" style={{ background: cfg.color }} />}
              {cfg.label}
            </span>
            <span className="monitor-uptime">⏱ {uptime()}</span>
          </div>
        </div>

        <button
          className="btn-ghost btn-danger"
          onClick={handleStop}
          disabled={stopping}
        >
          {stopping ? <span className="btn-spinner" /> : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
              </svg>
              Stop
            </>
          )}
        </button>
      </div>

      {/* Metrics */}
      <div className="monitor-metrics">
        <div className="metric-section">
          <div className="metric-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
            Audio Level
          </div>
          <AudioMeter level={metrics.audioLevel} />
        </div>
        <div className="metric-section">
          <div className="metric-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Chat Activity
          </div>
          <ChatMeter rate={metrics.chatRate} />
        </div>
      </div>

      {/* Footer */}
      <div className="monitor-card-footer">
        <div className="monitor-stat">
          <span className="monitor-stat-value">{monitor.clipsCreated}</span>
          <span className="monitor-stat-label">Clips saved</span>
        </div>
        <div className="monitor-stat">
          <span className="monitor-stat-value">{monitor.isLive ? 'Yes' : 'No'}</span>
          <span className="monitor-stat-label">Currently live</span>
        </div>
        <div className="monitor-stat">
          <span className="monitor-stat-value">{uptime()}</span>
          <span className="monitor-stat-label">Uptime</span>
        </div>
      </div>
    </div>
  );
}

export default function ActiveMonitors({ monitors, onStop, onNavigate }) {
  if (monitors.length === 0) {
    return (
      <div className="page">
        <div className="page-header">
          <div>
            <h1 className="page-title">Active Monitors</h1>
            <p className="page-subtitle">Real-time stream monitoring and AI detection</p>
          </div>
        </div>
        <div className="empty-state centered tall">
          <div className="empty-icon large">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <p className="empty-title">No active monitors</p>
          <p className="empty-sub">Start by searching for a streamer and clicking "Monitor"</p>
          <button className="btn-primary" onClick={() => onNavigate('search')}>
            Find Streamers
          </button>
        </div>
      </div>
    );
  }

  const liveCount = monitors.filter(m => m.isLive).length;
  const totalClips = monitors.reduce((acc, m) => acc + m.clipsCreated, 0);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Active Monitors</h1>
          <p className="page-subtitle">{monitors.length} monitor{monitors.length !== 1 ? 's' : ''} · {liveCount} live · {totalClips} clips today</p>
        </div>
        <button className="btn-primary" onClick={() => onNavigate('search')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add More
        </button>
      </div>

      {/* How AI Works Banner */}
      <div className="ai-banner">
        <div className="ai-banner-item">
          <div className="ai-banner-icon audio">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
          </div>
          <div>
            <p className="ai-banner-label">Audio Detection</p>
            <p className="ai-banner-desc">Volume spike triggers clip</p>
          </div>
        </div>
        <div className="ai-banner-plus">+</div>
        <div className="ai-banner-item">
          <div className="ai-banner-icon chat">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div>
            <p className="ai-banner-label">Chat Activity</p>
            <p className="ai-banner-desc">Chat explosion triggers clip</p>
          </div>
        </div>
        <div className="ai-banner-equals">=</div>
        <div className="ai-banner-item">
          <div className="ai-banner-icon clip">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 10 5 5-5 5" /><path d="M4 4v7a4 4 0 0 0 4 4h12" />
            </svg>
          </div>
          <div>
            <p className="ai-banner-label">Auto Clip Saved</p>
            <p className="ai-banner-desc">To your Raw Clips folder</p>
          </div>
        </div>
      </div>

      {/* Monitor Cards */}
      <div className="monitors-grid">
        {monitors.map(monitor => (
          <MonitorCard key={monitor.id} monitor={monitor} onStop={onStop} />
        ))}
      </div>
    </div>
  );
}

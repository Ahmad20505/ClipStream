import { useMemo } from 'react';

const platformColor = { twitch: '#9146ff', youtube: '#ff0000', kick: '#53fc18' };

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ── Stat Card ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, gradient, glow }) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      padding: '20px 22px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      transition: 'border-color 0.2s, transform 0.15s',
      cursor: 'default',
    }}
    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.3)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <div style={{
        width: 46, height: 46, borderRadius: 12, flexShrink: 0,
        background: gradient,
        boxShadow: glow,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'white',
      }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginTop: 3 }}>{label}</p>
        {sub && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</p>}
      </div>
    </div>
  );
}

// ── Monitor Row ────────────────────────────────────────────────────────────────
function MonitorRow({ monitor, onNavigate }) {
  const cfg = {
    live:         { color: '#22c55e', label: 'LIVE',         pulse: true  },
    offline:      { color: '#6b7280', label: 'Offline',      pulse: false },
    connecting:   { color: '#f59e0b', label: 'Connecting…',  pulse: true  },
    reconnecting: { color: '#f59e0b', label: 'Reconnecting…',pulse: true  },
    error:        { color: '#ef4444', label: 'Error',        pulse: false },
    checking:     { color: '#8b5cf6', label: 'Checking…',    pulse: true  },
  }[monitor.status] || { color: '#6b7280', label: 'Offline', pulse: false };

  const pc = platformColor[monitor.streamer?.platform] || '#888';

  return (
    <div
      onClick={() => onNavigate('monitors')}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '11px 0',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        cursor: 'pointer',
        borderRadius: 0,
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
    >
      {/* Avatar */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', overflow: 'hidden',
          border: `2px solid ${monitor.isLive ? pc : 'rgba(255,255,255,0.08)'}`,
          background: 'var(--bg-elevated)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)',
        }}>
          {monitor.streamer?.thumbnailUrl
            ? <img src={monitor.streamer.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : monitor.streamer?.displayName?.[0] || '?'}
        </div>
        {cfg.pulse && (
          <span style={{
            position: 'absolute', bottom: 0, right: 0,
            width: 10, height: 10, borderRadius: '50%',
            background: cfg.color,
            border: '2px solid var(--bg-surface)',
            boxShadow: `0 0 6px ${cfg.color}`,
          }} />
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {monitor.streamer?.displayName}
        </p>
        <p style={{ fontSize: 11, color: pc, fontWeight: 600, textTransform: 'capitalize', marginTop: 1 }}>
          {monitor.streamer?.platform}
        </p>
      </div>

      {/* Status + clips */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
          background: `${cfg.color}18`, color: cfg.color,
          border: `1px solid ${cfg.color}30`,
          letterSpacing: '0.03em',
        }}>
          {cfg.label}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {monitor.clipsCreated} clip{monitor.clipsCreated !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
}

// ── Clip Row ───────────────────────────────────────────────────────────────────
function ClipRow({ clip }) {
  const pc = platformColor[clip.platform] || '#888';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 0',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
      {/* Thumb */}
      <div style={{
        width: 48, height: 30, borderRadius: 6, overflow: 'hidden', flexShrink: 0,
        background: 'var(--bg-elevated)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        {clip.thumbnail
          ? <img src={`file://${clip.thumbnail}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.35"><polygon points="5 3 19 12 5 21 5 3" /></svg>}
        <div style={{ position: 'absolute', bottom: 2, left: 2, width: 5, height: 5, borderRadius: '50%', background: pc }} />
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {clip.streamerName}
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
          {clip.filename}
        </p>
      </div>

      <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{timeAgo(clip.createdAt)}</span>
    </div>
  );
}

// ── Glass Panel ────────────────────────────────────────────────────────────────
function Panel({ title, action, onAction, children, minHeight = 200 }) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', margin: 0 }}>{title}</h2>
        {action && (
          <button onClick={onAction} style={{ background: 'none', border: 'none', color: 'var(--accent-purple)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '3px 0' }}>
            {action} →
          </button>
        )}
      </div>
      <div style={{ padding: '4px 20px 12px', minHeight }}>{children}</div>
    </div>
  );
}

function EmptyState({ icon, title, sub, btnLabel, onBtn }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '28px 16px', gap: 8, textAlign: 'center' }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', marginBottom: 4 }}>{icon}</div>
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{title}</p>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: 200 }}>{sub}</p>
      {btnLabel && <button className="btn-primary btn-sm" onClick={onBtn} style={{ marginTop: 6 }}>{btnLabel}</button>}
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function Dashboard({ monitors, clips, onNavigate }) {
  const stats = useMemo(() => {
    const liveCount   = monitors.filter(m => m.isLive).length;
    const today       = new Date().setHours(0, 0, 0, 0);
    const todayClips  = clips.filter(c => c.createdAt >= today).length;
    const streamers   = new Set(monitors.map(m => m.id)).size;
    const totalClips  = clips.length;
    return { liveCount, totalClips, todayClips, streamers };
  }, [monitors, clips]);

  const isFirstTime = monitors.length === 0 && clips.length === 0;

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            {stats.liveCount > 0
              ? `${stats.liveCount} stream${stats.liveCount > 1 ? 's' : ''} live — ClipForge is watching 👀`
              : 'Your AI clipping command center'}
          </p>
        </div>
        <button className="btn-primary" onClick={() => onNavigate('search')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Streamer
        </button>
      </div>

      {/* ── Getting started banner (first-time only) */}
      {isFirstTime && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(124,58,237,0.12), rgba(37,99,235,0.08))',
          border: '1px solid rgba(124,58,237,0.25)',
          borderRadius: 16,
          padding: '24px 28px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 24,
        }}>
          <div style={{ fontSize: 36 }}>🚀</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, fontFamily: 'var(--font-display)' }}>
              Welcome to ClipForge!
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Search for a streamer on Twitch, YouTube, or Kick — hit <strong style={{ color: 'var(--text-primary)' }}>Monitor</strong> and ClipForge will automatically clip their best moments as they happen.
            </p>
          </div>
          <button className="btn-primary" onClick={() => onNavigate('search')} style={{ flexShrink: 0 }}>
            Find Streamers →
          </button>
        </div>
      )}

      {/* ── Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatCard
          label="Active Monitors"
          value={monitors.length}
          sub={monitors.length > 0 ? `${stats.liveCount} live right now` : 'None added yet'}
          gradient="linear-gradient(135deg,#7c3aed,#6d28d9)"
          glow="0 4px 16px rgba(124,58,237,0.35)"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>}
        />
        <StatCard
          label="Clips Today"
          value={stats.todayClips}
          sub={stats.totalClips > 0 ? `${stats.totalClips} total clips` : 'None yet'}
          gradient="linear-gradient(135deg,#2563eb,#1d4ed8)"
          glow="0 4px 16px rgba(37,99,235,0.35)"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 10 5 5-5 5"/><path d="M4 4v7a4 4 0 0 0 4 4h12"/></svg>}
        />
        <StatCard
          label="Live Streams"
          value={stats.liveCount}
          sub={stats.liveCount > 0 ? 'Currently capturing' : 'Waiting for streams'}
          gradient={stats.liveCount > 0 ? "linear-gradient(135deg,#16a34a,#15803d)" : "linear-gradient(135deg,#374151,#1f2937)"}
          glow={stats.liveCount > 0 ? "0 4px 16px rgba(34,197,94,0.3)" : "none"}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/></svg>}
        />
        <StatCard
          label="Streamers Tracked"
          value={stats.streamers}
          sub="across all platforms"
          gradient="linear-gradient(135deg,#d97706,#b45309)"
          glow="0 4px 16px rgba(217,119,6,0.3)"
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
        />
      </div>

      {/* ── Content panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Monitors panel */}
        <Panel title="Active Monitors" action={monitors.length > 0 ? 'View all' : null} onAction={() => onNavigate('monitors')}>
          {monitors.length === 0 ? (
            <EmptyState
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>}
              title="No monitors yet"
              sub="Add a streamer to start auto-clipping their live moments"
              btnLabel="Find Streamers"
              onBtn={() => onNavigate('search')}
            />
          ) : (
            monitors.slice(0, 5).map(m => <MonitorRow key={m.id} monitor={m} onNavigate={onNavigate} />)
          )}
        </Panel>

        {/* Recent clips panel */}
        <Panel title="Recent Clips" action={clips.length > 0 ? 'View all' : null} onAction={() => onNavigate('clips')}>
          {clips.length === 0 ? (
            <EmptyState
              icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m15 10 5 5-5 5"/><path d="M4 4v7a4 4 0 0 0 4 4h12"/></svg>}
              title="No clips yet"
              sub="ClipForge will automatically save clips when it detects hype moments"
            />
          ) : (
            clips.slice(0, 6).map(c => <ClipRow key={c.id} clip={c} />)
          )}
        </Panel>
      </div>

      {/* ── How it works footer */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 32,
      }}>
        {[
          { step: '1', icon: '🔍', title: 'Find a Streamer', desc: 'Search Twitch, YouTube or Kick and hit Monitor' },
          { step: '2', icon: '📡', title: 'AI Monitors Live', desc: 'ClipForge watches audio spikes + chat explosions' },
          { step: '3', icon: '🎬', title: 'Clip Auto-Saved', desc: 'Hype moments are clipped and saved automatically' },
        ].map((s, i, arr) => (
          <div key={s.step} style={{ display: 'flex', alignItems: 'center', gap: 32, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{s.icon}</div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{s.title}</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>{s.desc}</p>
              </div>
            </div>
            {i < arr.length - 1 && (
              <div style={{ color: 'var(--text-muted)', fontSize: 16, flexShrink: 0 }}>→</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

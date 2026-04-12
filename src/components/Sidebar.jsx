const NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    id: 'search',
    label: 'Find Streamers',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
      </svg>
    ),
  },
  {
    id: 'monitors',
    label: 'Active Monitors',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
    badge: true,
  },
  {
    id: 'clips',
    label: 'Clip Gallery',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m15 10 5 5-5 5" /><path d="M4 4v7a4 4 0 0 0 4 4h12" />
      </svg>
    ),
    clipBadge: true,
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
      </svg>
    ),
  },
  {
    id: 'help',
    label: 'Help',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
];

const PLATFORM_CONFIG = [
  { id: 'kick',    label: 'Kick',    color: '#53fc18', dot: '#53fc18' },
  { id: 'twitch',  label: 'Twitch',  color: '#9146ff', dot: '#9146ff' },
  { id: 'youtube', label: 'YouTube', color: '#ff0000', dot: '#ff0000' },
];

export default function Sidebar({ page, onNavigate, monitorCount, clips = [] }) {
  const liveCount    = monitorCount;
  const clipsToday   = clips.filter(c => c.createdAt >= new Date().setHours(0,0,0,0)).length;

  return (
    <aside className="sidebar">

      {/* ── Logo ───────────────────────────────────────────── */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <svg width="22" height="22" viewBox="0 0 48 48" fill="none">
            <path d="M8 24L24 8L40 24L24 40L8 24Z" fill="url(#sg)" />
            <path d="M18 22L22 26L30 18" stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
            <defs>
              <linearGradient id="sg" x1="8" y1="8" x2="40" y2="40">
                <stop stopColor="#7c3aed" /><stop offset="1" stopColor="#2563eb" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div>
          <p className="sidebar-logo-text">ClipStream</p>
          <p className="sidebar-logo-sub">AI Stream Clipper</p>
        </div>
      </div>

      {/* ── Live status pill ────────────────────────────────── */}
      <div style={{
        margin: '0 12px 16px',
        padding: '9px 14px',
        borderRadius: 10,
        background: liveCount > 0 ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${liveCount > 0 ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)'}`,
        display: 'flex', alignItems: 'center', gap: 9,
        transition: 'all 0.3s',
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: liveCount > 0 ? '#22c55e' : '#374151',
          boxShadow: liveCount > 0 ? '0 0 8px #22c55e' : 'none',
          animation: liveCount > 0 ? 'status-pulse 2s ease-in-out infinite' : 'none',
        }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: liveCount > 0 ? '#4ade80' : 'var(--text-muted)' }}>
          {liveCount > 0 ? `${liveCount} live now` : 'No live streams'}
        </span>
        {clipsToday > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#a78bfa', background: 'rgba(124,58,237,0.15)', borderRadius: 6, padding: '2px 7px' }}>
            {clipsToday} clips
          </span>
        )}
      </div>

      {/* ── Nav ─────────────────────────────────────────────── */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(item => {
          const isActive = page === item.id;
          return (
            <button
              key={item.id}
              className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              <span className="sidebar-nav-icon">{item.icon}</span>
              <span className="sidebar-nav-label">{item.label}</span>
              {item.badge && monitorCount > 0 && (
                <span className="sidebar-badge">{monitorCount}</span>
              )}
              {item.clipBadge && clipsToday > 0 && (
                <span className="sidebar-badge" style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa', borderColor: 'rgba(124,58,237,0.3)' }}>
                  {clipsToday}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ── Platforms ───────────────────────────────────────── */}
      <div style={{ marginTop: 'auto', padding: '0 12px 8px' }}>
        <p className="sidebar-section-label" style={{ marginBottom: 8 }}>PLATFORMS</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {PLATFORM_CONFIG.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.02)' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: p.color, boxShadow: `0 0 6px ${p.color}88`, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{p.label}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: p.color, fontWeight: 700, opacity: 0.8 }}>✓</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Version footer ──────────────────────────────────── */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 8 }}>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>ClipStream v1.0 · AI Edition</p>
      </div>

    </aside>
  );
}

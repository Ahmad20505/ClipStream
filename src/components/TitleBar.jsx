const api = window.clipforge;

export default function TitleBar() {
  const isMac = api?.platform === 'darwin';

  return (
    <div className="titlebar" style={{ WebkitAppRegion: 'drag' }}>
      {isMac && <div className="titlebar-mac-space" />}
      <div className="titlebar-logo">
        <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
          <path d="M8 24L24 8L40 24L24 40L8 24Z" fill="url(#tgrad)" />
          <path d="M18 22L22 26L30 18" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <defs>
            <linearGradient id="tgrad" x1="8" y1="8" x2="40" y2="40" gradientUnits="userSpaceOnUse">
              <stop stopColor="#7c3aed" />
              <stop offset="1" stopColor="#2563eb" />
            </linearGradient>
          </defs>
        </svg>
        <span className="titlebar-name">ClipForge</span>
      </div>

      {!isMac && (
        <div className="titlebar-controls" style={{ WebkitAppRegion: 'no-drag' }}>
          <button className="titlebar-btn" onClick={() => api.window.minimize()} title="Minimize">
            <svg width="12" height="1" viewBox="0 0 12 1"><line x1="0" y1="0.5" x2="12" y2="0.5" stroke="currentColor" strokeWidth="1.5" /></svg>
          </button>
          <button className="titlebar-btn" onClick={() => api.window.maximize()} title="Maximize">
            <svg width="11" height="11" viewBox="0 0 11 11"><rect x="0.5" y="0.5" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" /></svg>
          </button>
          <button className="titlebar-btn titlebar-close" onClick={() => api.window.close()} title="Close">
            <svg width="11" height="11" viewBox="0 0 11 11">
              <line x1="0.5" y1="0.5" x2="10.5" y2="10.5" stroke="currentColor" strokeWidth="1.5" />
              <line x1="10.5" y1="0.5" x2="0.5" y2="10.5" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

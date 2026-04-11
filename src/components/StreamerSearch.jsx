import { useState, useCallback, useRef } from 'react';

const PLATFORMS = [
  { id: 'all', label: 'All' },
  { id: 'twitch', label: 'Twitch', color: '#9146ff' },
  { id: 'youtube', label: 'YouTube', color: '#ff0000' },
  { id: 'kick', label: 'Kick', color: '#53fc18' },
];

const platformColors = { twitch: '#9146ff', youtube: '#ff0000', kick: '#53fc18' };

function StreamerCard({ streamer, onMonitor, isMonitored }) {
  const [loading, setLoading] = useState(false);

  const handleMonitor = async () => {
    setLoading(true);
    await onMonitor(streamer);
    setLoading(false);
  };

  return (
    <div className="streamer-card">
      <div className="streamer-card-avatar">
        {streamer.thumbnailUrl ? (
          <img src={streamer.thumbnailUrl} alt={streamer.displayName} />
        ) : (
          <div className="avatar-placeholder large">{streamer.displayName[0]}</div>
        )}
        {streamer.isLive && <span className="live-badge">LIVE</span>}
      </div>

      <div className="streamer-card-body">
        <div className="streamer-card-header">
          <p className="streamer-name">{streamer.displayName}</p>
          <span
            className="platform-chip"
            style={{ background: `${platformColors[streamer.platform]}22`, color: platformColors[streamer.platform], borderColor: `${platformColors[streamer.platform]}44` }}
          >
            {streamer.platform}
          </span>
        </div>

        {streamer.gameTitle && (
          <p className="streamer-game">{streamer.gameTitle}</p>
        )}

        {streamer.viewerCount > 0 && (
          <p className="streamer-viewers">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
            </svg>
            {streamer.viewerCount.toLocaleString()} viewers
          </p>
        )}
      </div>

      <button
        className={`streamer-card-btn ${isMonitored ? 'monitored' : ''}`}
        onClick={handleMonitor}
        disabled={isMonitored || loading}
      >
        {loading ? (
          <span className="btn-spinner" />
        ) : isMonitored ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Monitoring
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Monitor
          </>
        )}
      </button>
    </div>
  );
}

export default function StreamerSearch({ onMonitor, monitors }) {
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState('twitch');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef(null);

  const monitoredIds = new Set(monitors.map(m => m.id));

  const handleSearch = useCallback(async (q, p) => {
    if (!q.trim()) { setResults([]); setSearched(false); return; }
    setLoading(true);
    setError(null);
    try {
      const { results: res, error: err } = await window.clipforge.search.streamers(q.trim(), p);
      if (err) setError(err);
      setResults(res || []);
      setSearched(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const onQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => handleSearch(val, platform), 500);
  };

  const onPlatformChange = (p) => {
    setPlatform(p);
    if (query.trim()) handleSearch(query, p);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      clearTimeout(debounceRef.current);
      handleSearch(query, platform);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Find Streamers</h1>
          <p className="page-subtitle">Search across Twitch, YouTube, and Kick</p>
        </div>
      </div>

      {/* Search Input */}
      <div className="search-box">
        <div className="search-input-wrap">
          <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            className="search-input"
            type="text"
            placeholder="Search for a streamer..."
            value={query}
            onChange={onQueryChange}
            onKeyDown={onKeyDown}
            autoFocus
          />
          {loading && <span className="search-spinner" />}
        </div>

        {/* Platform Filter */}
        <div className="platform-tabs">
          {PLATFORMS.map(p => (
            <button
              key={p.id}
              className={`platform-tab ${platform === p.id ? 'active' : ''}`}
              onClick={() => onPlatformChange(p.id)}
              style={platform === p.id && p.color ? { borderColor: p.color, color: p.color } : {}}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="error-banner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error.includes('API keys') ? (
            <span>{error} — Go to <strong>Settings → API Keys</strong> to configure them.</span>
          ) : (
            <span>{error}</span>
          )}
        </div>
      )}

      {/* Results */}
      {!loading && searched && results.length === 0 && !error && (
        <div className="empty-state centered">
          <div className="empty-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          </div>
          <p className="empty-title">No streamers found</p>
          <p className="empty-sub">Try a different name or platform</p>
        </div>
      )}

      {!searched && !loading && (
        <div className="search-hint">
          <div className="search-hint-grid">
            {[
              { title: 'Twitch', examples: ['xQc', 'Ninja', 'pokimane', 'shroud'], color: '#9146ff' },
              { title: 'YouTube', examples: ['MrBeast', 'Dream', 'Valkyrae', 'Sykkuno'], color: '#ff0000' },
              { title: 'Kick', examples: ['xQc', 'HasanAbi', 'Trainwreckstv'], color: '#53fc18' },
            ].map(p => (
              <div key={p.title} className="hint-card" style={{ borderColor: `${p.color}33` }}>
                <p className="hint-platform" style={{ color: p.color }}>{p.title}</p>
                <div className="hint-examples">
                  {p.examples.map(name => (
                    <button
                      key={name}
                      className="hint-pill"
                      onClick={() => {
                        setQuery(name);
                        setPlatform(p.title.toLowerCase());
                        handleSearch(name, p.title.toLowerCase());
                      }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="results-grid">
          {results.map(streamer => (
            <StreamerCard
              key={`${streamer.platform}-${streamer.id}`}
              streamer={streamer}
              onMonitor={onMonitor}
              isMonitored={monitoredIds.has(streamer.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

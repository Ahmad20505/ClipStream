import { useState, useMemo, useEffect, useRef } from 'react';

const platformColors = { twitch: '#9146ff', youtube: '#ff0000', kick: '#53fc18' };

function formatDuration(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/* ── In-app video player modal ───────────────────────────────────────── */
function ClipPlayer({ clip, onClose }) {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Auto-play on open
  useEffect(() => {
    const v = videoRef.current;
    if (v) {
      v.play().then(() => setPlaying(true)).catch(() => {});
    }
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    setCurrentTime(v.currentTime);
    setProgress(v.duration ? (v.currentTime / v.duration) * 100 : 0);
  };

  const handleLoaded = () => {
    const v = videoRef.current;
    if (v) setDuration(v.duration);
  };

  const handleSeek = (e) => {
    const v = videoRef.current;
    if (!v) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    v.currentTime = pct * v.duration;
  };

  const handleVolume = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) videoRef.current.volume = val;
    setMuted(val === 0);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const toggleFullscreen = () => {
    const v = videoRef.current;
    if (!v) return;
    if (!document.fullscreenElement) {
      v.requestFullscreen().then(() => setFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setFullscreen(false)).catch(() => {});
    }
  };

  const formatTime = (s) => {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  const color = platformColors[clip.platform] || '#888';

  return (
    <div className="player-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="player-modal">
        {/* Header */}
        <div className="player-header">
          <div className="player-header-info">
            <span className="player-platform-badge" style={{ background: color }}>{clip.platform}</span>
            <span className="player-streamer">{clip.streamerName}</span>
            <span className="player-filename">{clip.filename}</span>
          </div>
          <button className="player-close-btn" onClick={onClose} title="Close (Esc)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Video */}
        <div className="player-video-wrap" onClick={togglePlay}>
          <video
            ref={videoRef}
            src={`file://${clip.path}`}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoaded}
            onEnded={() => setPlaying(false)}
            className="player-video"
          />
          {!playing && (
            <div className="player-big-play">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="white">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="player-controls">
          {/* Progress bar */}
          <div className="player-progress-wrap">
            <span className="player-time">{formatTime(currentTime)}</span>
            <div className="player-progress-bar" onClick={handleSeek}>
              <div className="player-progress-fill" style={{ width: `${progress}%` }} />
              <div className="player-progress-thumb" style={{ left: `${progress}%` }} />
            </div>
            <span className="player-time">{formatTime(duration)}</span>
          </div>

          {/* Buttons */}
          <div className="player-btns">
            {/* Play/Pause */}
            <button className="player-btn" onClick={togglePlay} title={playing ? 'Pause' : 'Play'}>
              {playing ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              )}
            </button>

            {/* Volume */}
            <button className="player-btn" onClick={toggleMute} title="Mute">
              {muted || volume === 0 ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              )}
            </button>
            <input
              type="range" min="0" max="1" step="0.05"
              value={muted ? 0 : volume}
              onChange={handleVolume}
              className="player-volume-slider"
              title="Volume"
            />

            <div style={{ flex: 1 }} />

            {/* Open in folder */}
            <button className="player-btn" onClick={() => window.clipforge.clips.open(clip.path)} title="Show in Finder">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </button>

            {/* Fullscreen */}
            <button className="player-btn" onClick={toggleFullscreen} title="Fullscreen">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Clip card ───────────────────────────────────────────────────────── */
function ClipCard({ clip, onDelete, onOpenFolder, onWatch }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const color = platformColors[clip.platform] || '#888';

  return (
    <div className="clip-card">
      {/* Thumbnail — click to watch in app */}
      <div className="clip-thumb" onClick={() => onWatch(clip)}>
        {clip.thumbnail ? (
          <img src={`file://${clip.thumbnail}`} alt="" />
        ) : (
          <div className="clip-thumb-bg">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4">
              <path d="m15 10 5 5-5 5" /><path d="M4 4v7a4 4 0 0 0 4 4h12" />
            </svg>
          </div>
        )}
        <div className="clip-thumb-overlay">
          <div className="play-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
        </div>
        <span className="clip-duration">{formatDuration(clip.duration || 60)}</span>
        <span className="clip-platform-badge" style={{ background: color }}>{clip.platform}</span>
      </div>

      {/* Info */}
      <div className="clip-info">
        <p className="clip-streamer">{clip.streamerName}</p>
        <p className="clip-filename" title={clip.filename}>{clip.filename}</p>
        <div className="clip-meta">
          <span className="clip-time">{timeAgo(clip.createdAt)}</span>
          {clip.hypeScore != null ? (
            <span style={{
              fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
              background: clip.hypeScore >= 70 ? 'rgba(124,58,237,0.18)' : clip.hypeScore >= 40 ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.06)',
              color: clip.hypeScore >= 70 ? '#a78bfa' : clip.hypeScore >= 40 ? '#fbbf24' : 'var(--text-muted)',
              border: `1px solid ${clip.hypeScore >= 70 ? 'rgba(124,58,237,0.3)' : clip.hypeScore >= 40 ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.08)'}`,
            }}>
              {clip.hypeScore >= 70 ? '🔥' : clip.hypeScore >= 40 ? '⚡' : '📹'} {clip.hypeScore}%
            </span>
          ) : clip.chatRate > 0 ? (
            <span className="clip-chat-rate">💬 {clip.chatRate}/s</span>
          ) : null}
        </div>
      </div>

      {/* Actions */}
      <div className="clip-actions">
        {/* Watch in app */}
        <button className="clip-action-btn watch-btn" onClick={() => onWatch(clip)} title="Watch in app">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Watch
        </button>

        {/* Show in folder */}
        <button className="clip-action-btn" onClick={() => onOpenFolder(clip.path)} title="Show in Finder">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        </button>

        {/* Delete */}
        {confirmDelete ? (
          <div className="delete-confirm">
            <button className="clip-action-btn danger" onClick={() => onDelete(clip.id)}>✕ Delete</button>
            <button className="clip-action-btn" onClick={() => setConfirmDelete(false)}>Cancel</button>
          </div>
        ) : (
          <button className="clip-action-btn" onClick={() => setConfirmDelete(true)} title="Delete clip">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6M9 6V4h6v2" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Main gallery ────────────────────────────────────────────────────── */
export default function ClipGallery({ clips, onDelete, onOpenFolder }) {
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [filterStreamer, setFilterStreamer] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [search, setSearch] = useState('');
  const [watchingClip, setWatchingClip] = useState(null);

  const streamers = useMemo(() => {
    const names = [...new Set(clips.map(c => c.streamerName))].sort();
    return names;
  }, [clips]);

  const filtered = useMemo(() => {
    let result = [...clips];
    if (filterPlatform !== 'all') result = result.filter(c => c.platform === filterPlatform);
    if (filterStreamer !== 'all') result = result.filter(c => c.streamerName === filterStreamer);
    if (search) result = result.filter(c =>
      c.streamerName.toLowerCase().includes(search.toLowerCase()) ||
      c.filename.toLowerCase().includes(search.toLowerCase())
    );
    if (sortBy === 'newest') result.sort((a, b) => b.createdAt - a.createdAt);
    else if (sortBy === 'oldest') result.sort((a, b) => a.createdAt - b.createdAt);
    else if (sortBy === 'streamer') result.sort((a, b) => a.streamerName.localeCompare(b.streamerName));
    return result;
  }, [clips, filterPlatform, filterStreamer, sortBy, search]);

  return (
    <div className="page">
      {/* In-app player modal */}
      {watchingClip && (
        <ClipPlayer clip={watchingClip} onClose={() => setWatchingClip(null)} />
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Clip Gallery</h1>
          <p className="page-subtitle">{clips.length} clip{clips.length !== 1 ? 's' : ''} saved automatically by AI</p>
        </div>
        <button className="btn-ghost" onClick={onOpenFolder}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          Open Folder
        </button>
      </div>

      {clips.length === 0 ? (
        <div className="empty-state centered tall">
          <div className="empty-icon large">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="m15 10 5 5-5 5" /><path d="M4 4v7a4 4 0 0 0 4 4h12" />
            </svg>
          </div>
          <p className="empty-title">No clips yet</p>
          <p className="empty-sub">Start monitoring streamers and ClipStream AI will automatically<br />detect and save hype moments for you</p>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="gallery-filters">
            <div className="filter-search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Search clips..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <select className="filter-select" value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)}>
              <option value="all">All Platforms</option>
              <option value="twitch">Twitch</option>
              <option value="youtube">YouTube</option>
              <option value="kick">Kick</option>
            </select>

            <select className="filter-select" value={filterStreamer} onChange={e => setFilterStreamer(e.target.value)}>
              <option value="all">All Streamers</option>
              {streamers.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <select className="filter-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="streamer">By Streamer</option>
            </select>

            <span className="filter-count">{filtered.length} clip{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state centered">
              <p className="empty-title">No clips match your filters</p>
              <button className="btn-ghost btn-sm" onClick={() => { setFilterPlatform('all'); setFilterStreamer('all'); setSearch(''); }}>
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="clip-grid">
              {filtered.map(clip => (
                <ClipCard
                  key={clip.id}
                  clip={clip}
                  onDelete={onDelete}
                  onOpenFolder={(path) => window.clipforge.clips.open(path)}
                  onWatch={setWatchingClip}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

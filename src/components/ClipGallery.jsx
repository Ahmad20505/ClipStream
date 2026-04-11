import { useState, useMemo } from 'react';

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

function ClipCard({ clip, onDelete, onOpen }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const color = platformColors[clip.platform] || '#888';

  return (
    <div className="clip-card">
      {/* Thumbnail */}
      <div className="clip-thumb" onClick={() => onOpen(clip.path)}>
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
        <button className="clip-action-btn" onClick={() => onOpen(clip.path)} title="Show in folder">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        </button>
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

export default function ClipGallery({ clips, onDelete, onOpenFolder }) {
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [filterStreamer, setFilterStreamer] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [search, setSearch] = useState('');

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

  const handleOpen = (clipPath) => {
    window.clipforge.clips.open(clipPath);
  };

  return (
    <div className="page">
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
          <p className="empty-sub">Start monitoring streamers and ClipForge AI will automatically<br />detect and save hype moments for you</p>
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
                <ClipCard key={clip.id} clip={clip} onDelete={onDelete} onOpen={handleOpen} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

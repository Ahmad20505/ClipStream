import { useState, useMemo, useEffect, useRef, useCallback } from 'react';

const platformColors = { twitch: '#9146ff', youtube: '#ff0000', kick: '#53fc18' };

// Convert a local file path to a clipfile:// URL safe for use in src attributes.
// The clipfile:// scheme is handled in main.js with a path-jail so the renderer
// cannot read arbitrary files even if compromised.
const toClipUrl = (filePath) => {
  if (!filePath) return '';
  // Encode each segment to handle spaces in paths like "Application Support"
  return 'clipfile://' + filePath.split('/').map(seg => encodeURIComponent(seg)).join('/');
};

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

// Format clip timestamp into a human-friendly name like "Apr 14 · 6:29 PM"
function friendlyClipName(createdAt) {
  const d = new Date(createdAt);
  const month = d.toLocaleString('en-US', { month: 'short' });
  const day   = d.getDate();
  const time  = d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${month} ${day} · ${time}`;
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
  const [trimStart, setTrimStart] = useState(null);
  const [trimEnd, setTrimEnd] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [exporting, setExporting] = useState(null);

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

  const setTrimHere = (which) => {
    const v = videoRef.current;
    if (!v) return;
    if (which === 'start') setTrimStart(v.currentTime);
    else { setTrimEnd(v.currentTime); }
  };

  const clearTrim = () => { setTrimStart(null); setTrimEnd(null); };

  const handleExport = async (format) => {
    setExporting(format);
    try {
      await window.clipforge.clips.export(
        clip.id, format,
        trimStart ?? null,
        trimEnd ?? null
      );
    } catch {}
    setExporting(null);
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
            <span className="player-filename" title={clip.filename}>{friendlyClipName(clip.createdAt)}</span>
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
            src={toClipUrl(clip.path)}
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

            {/* Trim buttons */}
            <button className="player-btn" onClick={() => setTrimHere('start')} title="Set trim start here" style={{ fontSize: 11, padding: '4px 8px', color: trimStart != null ? '#4ade80' : undefined }}>
              ⌥ In
            </button>
            <button className="player-btn" onClick={() => setTrimHere('end')} title="Set trim end here" style={{ fontSize: 11, padding: '4px 8px', color: trimEnd != null ? '#f87171' : undefined }}>
              Out ⌥
            </button>
            {(trimStart != null || trimEnd != null) && (
              <button className="player-btn" onClick={clearTrim} title="Clear trim" style={{ fontSize: 10, color: '#9ca3af' }}>✕</button>
            )}

            <div style={{ flex: 1 }} />

            {/* Export button */}
            <button
              className="player-btn"
              onClick={() => setShowExport(s => !s)}
              title="Export / Share"
              style={{ background: showExport ? 'rgba(124,58,237,0.2)' : undefined, color: showExport ? '#a78bfa' : undefined, fontSize: 11, padding: '4px 10px', fontWeight: 700 }}
            >
              ↗ Export
            </button>

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

          {/* Trim indicator on progress bar */}
          {(trimStart != null || trimEnd != null) && duration > 0 && (
            <div style={{ position: 'relative', height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', marginTop: 6 }}>
              <div style={{
                position: 'absolute', top: 0, bottom: 0,
                left: `${((trimStart ?? 0) / duration) * 100}%`,
                right: `${100 - ((trimEnd ?? duration) / duration) * 100}%`,
                background: 'rgba(124,58,237,0.6)', borderRadius: 2,
              }} />
              <div style={{ position: 'absolute', top: -8, left: `${((trimStart ?? 0) / duration) * 100}%`, fontSize: 9, color: '#4ade80', transform: 'translateX(-50%)' }}>▼</div>
              <div style={{ position: 'absolute', top: -8, left: `${((trimEnd ?? duration) / duration) * 100}%`, fontSize: 9, color: '#f87171', transform: 'translateX(-50%)' }}>▼</div>
              <div style={{ textAlign: 'center', fontSize: 10, color: '#a78bfa', marginTop: 6 }}>
                Trim: {formatTime(trimStart ?? 0)} → {formatTime(trimEnd ?? duration)} ({formatTime((trimEnd ?? duration) - (trimStart ?? 0))})
              </div>
            </div>
          )}

          {/* Export panel */}
          {showExport && (
            <div style={{ marginTop: 10, padding: '12px 16px', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa', marginBottom: 10 }}>
                Export {(trimStart != null || trimEnd != null) ? '(trimmed)' : '(full clip)'}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  { format: 'tiktok',  label: '🎵 TikTok',        sub: '9:16 vertical · 60s max' },
                  { format: 'shorts',  label: '▶ YouTube Shorts',  sub: '9:16 vertical · 60s max' },
                  { format: 'twitter', label: '𝕏 Twitter/X',       sub: '16:9 · 2:20 max' },
                  { format: 'trim',    label: '✂️ Save Trimmed',    sub: 'Same format, trimmed' },
                ].map(({ format, label, sub }) => (
                  <button
                    key={format}
                    onClick={() => handleExport(format)}
                    disabled={exporting !== null}
                    style={{
                      flex: 1, minWidth: 120, padding: '10px 12px', borderRadius: 8, cursor: exporting ? 'wait' : 'pointer',
                      background: exporting === format ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'var(--font-body)', textAlign: 'left',
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                      {exporting === format ? '⏳ Exporting…' : label}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{sub}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Clip card ───────────────────────────────────────────────────────── */
function ClipCard({ clip, onDelete, onOpenFolder, onWatch, onSave, onRate, focused, onFocus }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hoveringThumb, setHoveringThumb] = useState(false);
  const color = platformColors[clip.platform] || '#888';

  const handleSave = async () => {
    setSaving(true);
    const result = await onSave(clip.id);
    setSaving(false);
    // Only show "Saved" if the user actually completed the dialog (not canceled)
    if (result?.success) setSaved(true);
  };

  return (
    <div
      className="clip-card"
      onClick={onFocus}
      style={{
        outline: focused ? '2px solid rgba(124,58,237,0.7)' : clip.staged ? '1.5px solid rgba(124,58,237,0.35)' : 'none',
        cursor: 'default',
      }}
    >
      {/* Thumbnail — click to watch in app, hover for preview */}
      <div
        className="clip-thumb"
        onClick={() => onWatch(clip)}
        onMouseEnter={() => setHoveringThumb(true)}
        onMouseLeave={() => setHoveringThumb(false)}
      >
        {clip.thumbnail ? (
          <img src={toClipUrl(clip.thumbnail)} alt="" />
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
        {clip.staged && (
          <span
            title="Watch this clip then choose Save to keep it or Discard to delete it"
            style={{
              position: 'absolute', top: 8, left: 8,
              background: 'rgba(124,58,237,0.9)', color: 'white',
              fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
              cursor: 'help',
            }}>👁 REVIEW</span>
        )}
        {/* Platform color dot always visible */}
        <span style={{
          position: 'absolute', bottom: 8, right: 8,
          width: 8, height: 8, borderRadius: '50%',
          background: color, boxShadow: `0 0 6px ${color}`,
        }} />
        {/* Hover preview — muted autoplay on hover */}
        {hoveringThumb && (
          <video
            src={toClipUrl(clip.path)}
            autoPlay muted loop
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
          />
        )}
      </div>

      {/* Info */}
      <div className="clip-info">
        <p className="clip-streamer">{clip.streamerName}</p>
        <p className="clip-filename" title={clip.filename}>{friendlyClipName(clip.createdAt)}</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          {clip.reason ? <ReasonTag reason={clip.reason} /> : <span />}
          <StarRating rating={clip.rating ?? 0} onRate={(r) => onRate(clip.id, r)} />
        </div>
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

      {/* Action bar — full width, clearly separated buttons */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.07)',
        padding: '10px 12px',
        display: 'flex',
        gap: 8,
      }} onClick={e => e.stopPropagation()}>

        {/* Watch — always the primary action */}
        <button
          onClick={() => onWatch(clip)}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '9px 0', borderRadius: 8, cursor: 'pointer', border: 'none',
            background: 'rgba(255,255,255,0.07)', color: 'var(--text-primary)',
            fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-body)',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.13)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Watch
        </button>

        {clip.staged ? (
          /* Staged: Download + Discard side by side */
          <>
            <button
              onClick={handleSave}
              disabled={saving || saved}
              style={{
                flex: 1.2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '9px 0', borderRadius: 8, cursor: saving ? 'wait' : saved ? 'default' : 'pointer',
                border: 'none', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 700,
                background: saved ? 'rgba(34,197,94,0.18)' : 'rgba(124,58,237,0.2)',
                color: saved ? '#4ade80' : '#c4b5fd',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (!saved && !saving) e.currentTarget.style.background = 'rgba(124,58,237,0.32)'; }}
              onMouseLeave={e => { if (!saved && !saving) e.currentTarget.style.background = 'rgba(124,58,237,0.2)'; }}
            >
              {saved ? (
                <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> Saved</>
              ) : saving ? '…' : (
                <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download</>
              )}
            </button>

            {!saved && (
              <button
                onClick={() => onDelete(clip.id)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  padding: '9px 0', borderRadius: 8, cursor: 'pointer',
                  border: 'none', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600,
                  background: 'rgba(239,68,68,0.12)', color: '#fca5a5',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.25)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.12)'}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/>
                </svg>
                Discard
              </button>
            )}
          </>
        ) : (
          /* Saved: Show in Finder + Delete */
          <>
            <button
              onClick={() => onOpenFolder(clip.path)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '9px 0', borderRadius: 8, cursor: 'pointer',
                border: 'none', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600,
                background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              Show File
            </button>

            {confirmDelete ? (
              <>
                <button
                  onClick={() => onDelete(clip.id)}
                  style={{
                    flex: 1, padding: '9px 0', borderRadius: 8, cursor: 'pointer', border: 'none',
                    background: 'rgba(239,68,68,0.25)', color: '#fca5a5',
                    fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-body)',
                  }}
                >✕ Confirm</button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  style={{
                    flex: 1, padding: '9px 0', borderRadius: 8, cursor: 'pointer', border: 'none',
                    background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)',
                    fontSize: 13, fontFamily: 'var(--font-body)',
                  }}
                >Cancel</button>
              </>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                style={{
                  width: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '9px 0', borderRadius: 8, cursor: 'pointer',
                  border: 'none', background: 'rgba(255,255,255,0.04)', color: '#6b7280',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.color = '#f87171'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#6b7280'; }}
                title="Delete clip"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/>
                </svg>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Reason tag ──────────────────────────────────────────────────────── */
function ReasonTag({ reason }) {
  const map = {
    'both':          { label: '⚡ Audio + Chat', bg: 'rgba(124,58,237,0.18)', color: '#a78bfa', border: 'rgba(124,58,237,0.3)' },
    'extreme-audio': { label: '🔊 Audio Spike',  bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: 'rgba(245,158,11,0.3)' },
    'extreme-chat':  { label: '💬 Chat Explosion',bg: 'rgba(37,99,235,0.18)',  color: '#60a5fa', border: 'rgba(37,99,235,0.3)'  },
    'audio-only':    { label: '🎙️ Audio Only',    bg: 'rgba(107,114,128,0.15)',color: '#9ca3af', border: 'rgba(107,114,128,0.3)' },
  };
  const t = map[reason] || map['both'];
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: t.bg, color: t.color, border: `1px solid ${t.border}`, whiteSpace: 'nowrap' }}>
      {t.label}
    </span>
  );
}

/* ── Star rating ─────────────────────────────────────────────────────── */
function StarRating({ rating, onRate, size = 14 }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div style={{ display: 'flex', gap: 2 }} onClick={e => e.stopPropagation()}>
      {[1,2,3,4,5].map(star => (
        <button
          key={star}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onRate(star === rating ? 0 : star)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 1, fontSize: size, lineHeight: 1, color: star <= (hovered || rating || 0) ? '#fbbf24' : 'rgba(255,255,255,0.2)', transition: 'color 0.1s' }}
          title={`Rate ${star} star${star > 1 ? 's' : ''}`}
        >★</button>
      ))}
    </div>
  );
}

/* ── Main gallery ────────────────────────────────────────────────────── */
export default function ClipGallery({ clips: initialClips, onDelete, onOpenFolder, onNavigate }) {
  const [clips, setClips] = useState(initialClips);
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [filterStreamer, setFilterStreamer] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [search, setSearch] = useState('');
  const [watchingClip, setWatchingClip] = useState(null);
  const [focusedIdx, setFocusedIdx] = useState(null);
  const [savingAll, setSavingAll] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterRating, setFilterRating] = useState(0);

  // Sync when parent updates clips
  useEffect(() => { setClips(initialClips); }, [initialClips]);

  // Listen for clip:updated (staged → saved)
  useEffect(() => {
    const unsub = window.clipforge.clips.onUpdate?.((updated) => {
      setClips(prev => prev.map(c => c.id === updated.id ? updated : c));
    });
    return () => unsub?.();
  }, []);

  const handleSave = async (clipId) => {
    return await window.clipforge.clips.save(clipId);
  };

  const handleRate = useCallback(async (clipId, rating) => {
    await window.clipforge.clips.rate(clipId, rating);
    setClips(prev => prev.map(c => c.id === clipId ? { ...c, rating } : c));
  }, []);

  // Listen for auto-cleanup refresh
  useEffect(() => {
    const unsub = window.clipforge.clips.onRefresh?.((refreshed) => {
      setClips(refreshed);
    });
    return () => unsub?.();
  }, []);

  const handleSaveAll = async () => {
    setSavingAll(true);
    // Opens a folder picker once — all clips go into that folder
    await window.clipforge.clips.saveAll();
    setSavingAll(false);
  };

  const handleDiscardAll = () => {
    const staged = clips.filter(c => c.staged);
    staged.forEach(c => onDelete(c.id));
  };

  const streamers = useMemo(() => {
    const names = [...new Set(clips.map(c => c.streamerName))].sort();
    return names;
  }, [clips]);

  const filtered = useMemo(() => {
    let result = [...clips];
    if (filterPlatform !== 'all') result = result.filter(c => c.platform === filterPlatform);
    if (filterStreamer !== 'all') result = result.filter(c => c.streamerName === filterStreamer);
    if (filterRating > 0) result = result.filter(c => (c.rating ?? 0) >= filterRating);
    if (dateFrom) result = result.filter(c => c.createdAt >= new Date(dateFrom).getTime());
    if (dateTo)   result = result.filter(c => c.createdAt <= new Date(dateTo).getTime() + 86399999);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.streamerName.toLowerCase().includes(q) ||
        c.platform.toLowerCase().includes(q) ||
        friendlyClipName(c.createdAt).toLowerCase().includes(q) ||
        c.filename.toLowerCase().includes(q)
      );
    }
    // Staged (review) clips always first, then sort within groups
    if (sortBy === 'newest')  result.sort((a, b) => (b.staged ? 1 : 0) - (a.staged ? 1 : 0) || b.createdAt - a.createdAt);
    else if (sortBy === 'hype')    result.sort((a, b) => (b.staged ? 1 : 0) - (a.staged ? 1 : 0) || (b.hypeScore ?? 0) - (a.hypeScore ?? 0));
    else if (sortBy === 'rating')  result.sort((a, b) => (b.staged ? 1 : 0) - (a.staged ? 1 : 0) || (b.rating ?? 0) - (a.rating ?? 0));
    else if (sortBy === 'oldest')  result.sort((a, b) => (b.staged ? 1 : 0) - (a.staged ? 1 : 0) || a.createdAt - b.createdAt);
    else if (sortBy === 'streamer')result.sort((a, b) => (b.staged ? 1 : 0) - (a.staged ? 1 : 0) || a.streamerName.localeCompare(b.streamerName));
    return result;
  }, [clips, filterPlatform, filterStreamer, sortBy, search, filterRating, dateFrom, dateTo]);

  const stagedCount = clips.filter(c => c.staged).length;

  // Keyboard shortcuts: S = save, D = discard, Space = play focused clip
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (focusedIdx === null || !filtered[focusedIdx]) return;
      const clip = filtered[focusedIdx];
      if (e.key === 's' || e.key === 'S') { if (clip.staged) handleSave(clip.id); }
      if (e.key === 'd' || e.key === 'D') { onDelete(clip.id); }
      if (e.key === ' ') { e.preventDefault(); setWatchingClip(clip); }
      if (e.key === 'ArrowRight') setFocusedIdx(i => Math.min((i ?? 0) + 1, filtered.length - 1));
      if (e.key === 'ArrowLeft')  setFocusedIdx(i => Math.max((i ?? 0) - 1, 0));
      if (e.key === 'Escape')     setFocusedIdx(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [focusedIdx, filtered]);

  return (
    <div className="page">
      {/* In-app player modal */}
      {watchingClip && (
        <ClipPlayer clip={watchingClip} onClose={() => setWatchingClip(null)} />
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Clip Gallery</h1>
          <p className="page-subtitle">
            {stagedCount > 0
              ? `${stagedCount} awaiting review · ${clips.filter(c => !c.staged).length} saved`
              : `${clips.length} clip${clips.length !== 1 ? 's' : ''} saved`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {stagedCount > 0 && (
            <>
              <button
                onClick={handleSaveAll}
                disabled={savingAll}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9, border: '1px solid rgba(124,58,237,0.4)', background: 'rgba(124,58,237,0.15)', color: '#a78bfa', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
              >
                ⬇ Download All ({stagedCount})
              </button>
              <button
                onClick={handleDiscardAll}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 9, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#f87171', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
              >
                ✕ Discard All
              </button>
            </>
          )}
          {clips.length > 0 && (
            <button className="btn-ghost" onClick={() => onNavigate?.('timeline')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
              Timeline
            </button>
          )}
          <button className="btn-ghost" onClick={onOpenFolder} title="Open the export default folder (for TikTok/Shorts exports)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            Export Folder
          </button>
        </div>
      </div>

      {/* Keyboard hint — only show relevant shortcuts */}
      {clips.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <span>Click a clip to focus it, then:</span>
          {stagedCount > 0 && <span><kbd style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 4, fontSize: 10 }}>S</kbd> Download</span>}
          {stagedCount > 0 && <span><kbd style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 4, fontSize: 10 }}>D</kbd> Discard</span>}
          <span><kbd style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 4, fontSize: 10 }}>Space</kbd> Watch</span>
          <span><kbd style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 4, fontSize: 10 }}>← →</kbd> Navigate</span>
        </div>
      )}

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
          {/* Filters — primary row */}
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
              <option value="hype">Best Hype Score</option>
              <option value="rating">Highest Rated</option>
              <option value="oldest">Oldest First</option>
              <option value="streamer">By Streamer</option>
            </select>

            <span className="filter-count">{filtered.length} clip{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Filters — secondary row (ratings + date range) */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>Filter:</span>
            <select className="filter-select" style={{ width: 'auto' }} value={filterRating} onChange={e => setFilterRating(Number(e.target.value))}>
              <option value={0}>Any Rating</option>
              <option value={5}>★★★★★ Only</option>
              <option value={4}>★★★★+</option>
              <option value={3}>★★★+</option>
            </select>
            <input type="date" className="filter-select" style={{ width: 'auto', colorScheme: 'dark' }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="From date" />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>→</span>
            <input type="date" className="filter-select" style={{ width: 'auto', colorScheme: 'dark' }} value={dateTo} onChange={e => setDateTo(e.target.value)} title="To date" />
            {(dateFrom || dateTo || filterRating > 0) && (
              <button className="btn-ghost btn-sm" onClick={() => { setDateFrom(''); setDateTo(''); setFilterRating(0); }}>✕ Clear</button>
            )}
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
              {filtered.map((clip, idx) => (
                <ClipCard
                  key={clip.id}
                  clip={clip}
                  focused={focusedIdx === idx}
                  onFocus={() => setFocusedIdx(idx)}
                  onDelete={onDelete}
                  onOpenFolder={(path) => window.clipforge.clips.open(path)}
                  onWatch={setWatchingClip}
                  onSave={handleSave}
                  onRate={handleRate}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

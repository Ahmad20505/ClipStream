import { useMemo, useState } from 'react';

const platformColors = { twitch: '#9146ff', youtube: '#ff0000', kick: '#53fc18' };

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function StreamTimeline({ clips, onWatchClip, onNavigate }) {
  const [selectedStreamer, setSelectedStreamer] = useState('all');
  const [selectedDate, setSelectedDate] = useState('');

  // Group clips by streamer+date sessions
  const sessions = useMemo(() => {
    let filtered = [...clips];
    if (selectedStreamer !== 'all') filtered = filtered.filter(c => c.streamerName === selectedStreamer);
    if (selectedDate) {
      const d = new Date(selectedDate);
      const start = d.setHours(0, 0, 0, 0);
      const end   = d.setHours(23, 59, 59, 999);
      filtered = filtered.filter(c => c.createdAt >= start && c.createdAt <= end);
    }

    // Group by streamer + day
    const groups = {};
    for (const clip of filtered) {
      const day = new Date(clip.createdAt).toDateString();
      const key = `${clip.streamerName}__${day}`;
      if (!groups[key]) groups[key] = { streamer: clip.streamerName, platform: clip.platform, day, clips: [] };
      groups[key].clips.push(clip);
    }

    return Object.values(groups)
      .sort((a, b) => b.clips[0].createdAt - a.clips[0].createdAt)
      .map(g => {
        const times = g.clips.map(c => c.createdAt);
        const start = Math.min(...times);
        const end   = Math.max(...times);
        return { ...g, start, end, spanMs: end - start || 1 };
      });
  }, [clips, selectedStreamer, selectedDate]);

  const streamers = useMemo(() => [...new Set(clips.map(c => c.streamerName))].sort(), [clips]);

  if (clips.length === 0) return null;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Stream Timeline</h1>
          <p className="page-subtitle">See exactly when during each stream your clips were triggered</p>
        </div>
        <button className="btn-ghost" onClick={() => onNavigate('clips')}>← Back to Gallery</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <select className="filter-select" value={selectedStreamer} onChange={e => setSelectedStreamer(e.target.value)}>
          <option value="all">All Streamers</option>
          {streamers.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="date" className="filter-select" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ colorScheme: 'dark' }} />
        {selectedDate && <button className="btn-ghost btn-sm" onClick={() => setSelectedDate('')}>✕ Clear date</button>}
      </div>

      {sessions.length === 0 ? (
        <div className="empty-state centered"><p className="empty-title">No clips match your filters</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {sessions.map((session, si) => {
            const color = platformColors[session.platform] || '#888';
            const spanMin = Math.max(session.spanMs / 60000, 1);
            return (
              <div key={si} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
                {/* Session header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{session.streamer}</span>
                  <span style={{ fontSize: 12, color: color, fontWeight: 600, textTransform: 'capitalize' }}>{session.platform}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>{session.day}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
                    {session.clips.length} clip{session.clips.length !== 1 ? 's' : ''} · {Math.round(spanMin)}min span
                  </span>
                </div>

                {/* Timeline */}
                <div style={{ padding: '20px 24px' }}>
                  {/* Time axis */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatTime(session.start)}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatTime(session.end)}</span>
                  </div>

                  {/* Track */}
                  <div style={{ position: 'relative', height: 40, background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                    {/* Hype bar — fills based on clip density */}
                    {session.clips.map((clip, ci) => {
                      const pct = session.spanMs > 0 ? ((clip.createdAt - session.start) / session.spanMs) * 100 : 50;
                      const h = clip.hypeScore ?? 50;
                      const barColor = h >= 80 ? '#a78bfa' : h >= 60 ? '#fbbf24' : '#60a5fa';
                      return (
                        <button
                          key={clip.id}
                          onClick={() => onWatchClip(clip)}
                          title={`${clip.streamerName} · ${h}% hype · ${formatTime(clip.createdAt)}`}
                          style={{
                            position: 'absolute',
                            left: `${Math.min(pct, 96)}%`,
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: Math.max(8, h / 10),
                            height: Math.max(8, h / 10),
                            borderRadius: '50%',
                            background: barColor,
                            boxShadow: `0 0 ${Math.max(4, h / 12)}px ${barColor}`,
                            border: '2px solid rgba(0,0,0,0.5)',
                            cursor: 'pointer',
                            zIndex: 1,
                            transition: 'transform 0.1s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.5)'}
                          onMouseLeave={e => e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)'}
                        />
                      );
                    })}
                  </div>

                  {/* Clip list below timeline */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, overflowX: 'auto', paddingBottom: 4 }}>
                    {session.clips.sort((a, b) => a.createdAt - b.createdAt).map(clip => (
                      <button
                        key={clip.id}
                        onClick={() => onWatchClip(clip)}
                        style={{
                          flexShrink: 0, padding: '6px 10px', borderRadius: 8, cursor: 'pointer',
                          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                          fontFamily: 'var(--font-body)', textAlign: 'left',
                        }}
                      >
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatTime(clip.createdAt)}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: (clip.hypeScore ?? 0) >= 70 ? '#a78bfa' : 'var(--text-secondary)' }}>
                          {clip.hypeScore ?? 0}% hype
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

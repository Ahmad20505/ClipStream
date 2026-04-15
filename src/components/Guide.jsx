import { useState } from 'react';

const SECTIONS = [
  {
    id: 'start',
    icon: '🚀',
    title: 'Getting Started',
    color: '#7c3aed',
    steps: [
      {
        title: 'What is ClipStream?',
        body: 'ClipStream monitors live streams 24/7 and automatically detects highlight moments using AI — analyzing audio volume spikes and chat explosion speed in real time. When something exciting happens, it captures the clip and puts it in your Clip Gallery for you to review.',
      },
      {
        title: '1. Find a Streamer',
        body: 'Click "Find Streamers" in the sidebar. Search by username and select Twitch, YouTube, or Kick. Click "Add & Monitor" — ClipStream immediately starts watching for when they go live.',
        tip: 'You can monitor unlimited streamers at the same time.',
      },
      {
        title: '2. ClipStream Goes to Work',
        body: 'Once a streamer goes live, ClipStream connects to their stream and begins learning their "normal" audio and chat baseline. After about 90 seconds of learning, it starts actively detecting hype moments.',
        tip: 'On repeat streams, ClipStream remembers the baseline from last time and starts detecting immediately.',
      },
      {
        title: '3. Review Your Clips',
        body: 'Every detected highlight lands in the Clip Gallery marked "REVIEW". Watch each clip inside the app, then Download the ones you want to keep or Discard the ones you don\'t. Nothing ever saves to your computer without your approval.',
      },
    ],
  },
  {
    id: 'detection',
    icon: '🧠',
    title: 'AI Detection',
    color: '#2563eb',
    steps: [
      {
        title: 'How the AI Works',
        body: 'ClipStream uses two signals: Audio Level (volume spikes in dB above the streamer\'s normal baseline) and Chat Activity (messages per second vs. their normal chat speed). Both must spike simultaneously for a clip to trigger — this prevents false positives from a single loud sound or a brief chat burst.',
      },
      {
        title: 'Sensitivity Presets',
        body: 'Go to Settings → Detection to choose a preset:\n\n🎯 Conservative — ~5–10 clips per stream. Only the biggest, most undeniable moments.\n\n⚖️ Balanced — ~10–20 clips per stream. Clear hype moments with some buffer.\n\n🔥 Aggressive — ~20–35 clips per stream. Catches more moments, may include some mid ones.',
        tip: 'You can also set a different sensitivity for each individual streamer in their Active Monitor card.',
      },
      {
        title: 'Clip Trigger Types',
        body: 'Each clip is tagged with what triggered it:\n\n⚡ Audio + Chat — Both spiked together. Most reliable clips.\n🔊 Audio Spike — Extreme audio alone (e.g. sudden loud moment).\n💬 Chat Explosion — Extreme chat surge alone.\n🎙️ Audio Only — Chat wasn\'t available, audio used as fallback.',
      },
      {
        title: 'Variable Clip Length',
        body: 'When the hype is massive, ClipStream automatically extends the clip to capture the full moment — up to 3× the base duration. A 60-second base clip might become 2 minutes for a comeback moment. Toggle this in Settings → Integrations.',
      },
    ],
  },
  {
    id: 'gallery',
    icon: '🎬',
    title: 'Clip Gallery',
    color: '#0891b2',
    steps: [
      {
        title: 'The Review Flow',
        body: 'Every clip starts in "REVIEW" mode. Hover over the thumbnail to see a silent preview. Click Watch to play the full clip inside the app. Then either Download (pick where to save it) or Discard (delete it permanently). Nothing touches your computer until you explicitly download it.',
      },
      {
        title: 'Download All at Once',
        body: 'Use the "Download All" button in the top-right of the gallery to handle all pending clips at once. A folder picker opens — all clips land in the folder you choose, named with the streamer name and date.',
      },
      {
        title: 'Star Ratings',
        body: 'Rate any clip 1–5 stars by clicking the stars below the clip info. Over time, ClipStream tracks your ratings per streamer and uses them to nudge the AI sensitivity — if you consistently discard clips from a streamer, it tightens detection for them.',
        tip: 'Sort by "Highest Rated" in the gallery to quickly find your best clips.',
      },
      {
        title: 'Filters & Search',
        body: 'Search clips by streamer name, filter by platform, sort by newest/oldest/hype score/rating, filter by star rating, or use the date range pickers to find clips from a specific stream session.',
      },
      {
        title: 'Stream Timeline',
        body: 'Click the Timeline button in the gallery header to see a visual map of when during each stream your clips were triggered. Dots on the timeline are sized by hype score — bigger = more intense moment. Great for finding if there was a dead stretch in the stream.',
      },
      {
        title: 'Keyboard Shortcuts',
        body: 'Click a clip to focus it, then use keyboard shortcuts:\n\nS — Download the focused clip\nD — Discard the focused clip\nSpace — Watch the focused clip\n← → — Navigate between clips',
      },
    ],
  },
  {
    id: 'player',
    icon: '✂️',
    title: 'Video Player & Trimmer',
    color: '#059669',
    steps: [
      {
        title: 'In-App Player',
        body: 'Click Watch on any clip to open the full-screen player. Controls include play/pause, volume, scrubber bar, fullscreen, and the Export panel. Press Escape to close.',
      },
      {
        title: 'Trimming a Clip',
        body: 'While the clip is playing, use the In and Out buttons to mark trim points at exactly the current timestamp. A purple bar shows your selected range. This lets you cut out the boring part before the action starts.',
        tip: 'Trim first, then export — all social export formats will use your trim points.',
      },
      {
        title: 'Social Export',
        body: 'Click Export in the player to choose a format:\n\n🎵 TikTok — auto-crops to vertical 9:16, max 60 seconds\n▶ YouTube Shorts — same 9:16 vertical format\n𝕏 Twitter/X — standard 16:9, max 2:20\n✂️ Save Trimmed — same format as original, just trimmed\n\nA save dialog opens so you choose exactly where the file goes.',
      },
    ],
  },
  {
    id: 'monitors',
    icon: '📡',
    title: 'Active Monitors',
    color: '#d97706',
    steps: [
      {
        title: 'Reading the Meters',
        body: 'Each monitor card shows two real-time meters:\n\nAudio Level — current loudness in dB. The bar fills as volume increases above -60dB.\n\nChat Activity — messages per second from the stream\'s live chat.',
        tip: 'The app is detecting all the time even when you\'re not looking — it runs in the background.',
      },
      {
        title: 'Per-Streamer Sensitivity',
        body: 'Click the "🎯 Use global sensitivity" toggle in any monitor card to set a custom sensitivity for that specific streamer. Perfect for having xQc on Aggressive while a chess streamer stays on Conservative.',
      },
      {
        title: 'System Tray Mode',
        body: 'Close the ClipStream window — if System Tray mode is on (Settings → Integrations), the app keeps running silently in your menu bar. A tray icon shows how many streams are live and how many clips need review. Monitoring never stops.',
      },
    ],
  },
  {
    id: 'integrations',
    icon: '🔗',
    title: 'Integrations',
    color: '#5865f2',
    steps: [
      {
        title: 'Discord Auto-Post',
        body: 'Go to Settings → Integrations → Discord and paste your channel\'s Webhook URL. Every time a clip is detected, ClipStream automatically posts to your Discord with the streamer name, hype score, and what triggered it.',
        tip: 'Get a webhook URL from Discord: Channel Settings → Integrations → Webhooks → New Webhook.',
      },
      {
        title: 'Custom Webhook',
        body: 'Add any HTTPS endpoint to receive a POST request every time a clip is created. Payload includes: event, streamer name, platform, hype score, trigger reason, duration, and timestamp. Works with Zapier, Make, or your own server.',
      },
      {
        title: 'Audio Normalization',
        body: 'When enabled (Settings → Integrations), ClipStream re-encodes the audio to -16 LUFS when you download a clip. All your clips end up at the same volume level — no more clips that are weirdly quiet or loud compared to each other.',
      },
      {
        title: 'Auto-Cleanup',
        body: 'Set an auto-cleanup timer (3/7/14/30 days) in Settings → Integrations → Storage & Cleanup. Clips you never reviewed will be automatically discarded after that many days so they don\'t pile up.',
      },
    ],
  },
];

export default function Guide() {
  const [activeSection, setActiveSection] = useState('start');
  const [expandedStep, setExpandedStep] = useState(null);

  const section = SECTIONS.find(s => s.id === activeSection);

  return (
    <div className="page" style={{ maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title">📖 ClipStream Guide</h1>
          <p className="page-subtitle">Everything you need to know — always here when you need it</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20 }}>

        {/* Section nav */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => { setActiveSection(s.id); setExpandedStep(null); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderRadius: 10, cursor: 'pointer', border: 'none',
                background: activeSection === s.id ? `${s.color}20` : 'transparent',
                borderLeft: activeSection === s.id ? `3px solid ${s.color}` : '3px solid transparent',
                color: activeSection === s.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: activeSection === s.id ? 700 : 500,
                textAlign: 'left', transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 16 }}>{s.icon}</span>
              {s.title}
            </button>
          ))}
        </div>

        {/* Section content */}
        <div>
          {/* Section header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '18px 24px',
            background: `linear-gradient(135deg, ${section.color}18, ${section.color}08)`,
            border: `1px solid ${section.color}30`,
            borderRadius: 14, marginBottom: 16,
          }}>
            <span style={{ fontSize: 32 }}>{section.icon}</span>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', margin: 0 }}>
                {section.title}
              </h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                {section.steps.length} topic{section.steps.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Steps */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {section.steps.map((step, i) => {
              const isOpen = expandedStep === i;
              return (
                <div
                  key={i}
                  style={{
                    background: 'var(--bg-surface)',
                    border: `1px solid ${isOpen ? section.color + '40' : 'var(--border)'}`,
                    borderRadius: 12,
                    overflow: 'hidden',
                    transition: 'border-color 0.15s',
                  }}
                >
                  {/* Step header — always visible */}
                  <button
                    onClick={() => setExpandedStep(isOpen ? null : i)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                      padding: '14px 18px', cursor: 'pointer', border: 'none',
                      background: 'transparent', textAlign: 'left', fontFamily: 'var(--font-body)',
                    }}
                  >
                    <span style={{
                      width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                      background: isOpen ? section.color : 'rgba(255,255,255,0.07)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 800, color: isOpen ? 'white' : 'var(--text-muted)',
                      transition: 'all 0.15s',
                    }}>
                      {i + 1}
                    </span>
                    <span style={{
                      flex: 1, fontSize: 14, fontWeight: 600,
                      color: isOpen ? 'var(--text-primary)' : 'var(--text-secondary)',
                    }}>
                      {step.title}
                    </span>
                    <svg
                      width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2"
                      style={{
                        color: 'var(--text-muted)', flexShrink: 0,
                        transform: isOpen ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.2s',
                      }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {/* Step body — expands on click */}
                  {isOpen && (
                    <div style={{ padding: '0 18px 18px 60px' }}>
                      <p style={{
                        fontSize: 14, color: 'var(--text-secondary)',
                        lineHeight: 1.75, margin: 0, whiteSpace: 'pre-line',
                      }}>
                        {step.body}
                      </p>
                      {step.tip && (
                        <div style={{
                          marginTop: 12, padding: '10px 14px',
                          background: `${section.color}12`,
                          border: `1px solid ${section.color}30`,
                          borderRadius: 8, display: 'flex', gap: 8, alignItems: 'flex-start',
                        }}>
                          <span style={{ fontSize: 14, flexShrink: 0 }}>💡</span>
                          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                            {step.tip}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Navigation between sections */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
            {(() => {
              const idx = SECTIONS.findIndex(s => s.id === activeSection);
              const prev = SECTIONS[idx - 1];
              const next = SECTIONS[idx + 1];
              return (
                <>
                  {prev ? (
                    <button
                      onClick={() => { setActiveSection(prev.id); setExpandedStep(null); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 9, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-body)' }}
                    >← {prev.icon} {prev.title}</button>
                  ) : <div />}
                  {next ? (
                    <button
                      onClick={() => { setActiveSection(next.id); setExpandedStep(null); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 9, cursor: 'pointer', border: 'none', background: 'linear-gradient(135deg,#7c3aed,#2563eb)', color: 'white', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-body)' }}
                    >{next.icon} {next.title} →</button>
                  ) : (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      🎉 You know everything — go clip something!
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';

const api = window.clipforge;

// ── Icons ─────────────────────────────────────────────────────────────────────
const Icon = {
  user: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>,
  detection: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>,
  api: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
  mail: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>,
  eye: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  eyeOff: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  folder: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
  check: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
  logout: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  crown: <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M2 19l2-9 5 5 3-8 3 8 5-5 2 9H2z"/></svg>,
};

// ── Reusable sub-components ───────────────────────────────────────────────────
function Toggle({ checked, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
        background: checked ? 'linear-gradient(135deg,#7c3aed,#2563eb)' : 'rgba(255,255,255,0.1)',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: checked ? 23 : 3,
        width: 18, height: 18, borderRadius: '50%', background: 'white',
        transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
      }} />
    </button>
  );
}

function PasswordInput({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        className="sf-input"
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{ paddingRight: 40 }}
      />
      <button
        onClick={() => setShow(s => !s)}
        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
      >
        {show ? Icon.eyeOff : Icon.eye}
      </button>
    </div>
  );
}

function Slider({ value, onChange, min, max, step = 1, format }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, position: 'relative', height: 6 }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 3, background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${pct}%`, borderRadius: 3, background: 'linear-gradient(90deg,#7c3aed,#2563eb)' }} />
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{ position: 'absolute', inset: 0, width: '100%', opacity: 0, cursor: 'pointer', height: '100%' }}
        />
      </div>
      <span style={{ minWidth: 52, textAlign: 'right', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
        {format ? format(value) : value}
      </span>
    </div>
  );
}

function SettingRow({ label, hint, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</div>
        {hint && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.4 }}>{hint}</div>}
      </div>
      <div style={{ flexShrink: 0, minWidth: 160 }}>{children}</div>
    </div>
  );
}

function SliderRow({ label, hint, value, onChange, min, max, step, format }) {
  return (
    <div style={{ padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</div>
          {hint && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{hint}</div>}
        </div>
      </div>
      <Slider value={value} onChange={onChange} min={min} max={max} step={step} format={format} />
    </div>
  );
}

function SectionCard({ children }) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: '0 24px',
      marginBottom: 16,
    }}>
      {children}
    </div>
  );
}

function SectionHeader({ icon, title, subtitle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 0 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{
        width: 34, height: 34, borderRadius: 10,
        background: 'linear-gradient(135deg,rgba(124,58,237,0.2),rgba(37,99,235,0.15))',
        border: '1px solid rgba(124,58,237,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#a78bfa', flexShrink: 0,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{subtitle}</div>}
      </div>
    </div>
  );
}

// ── TABS ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'account',   label: 'Account',    icon: Icon.user },
  { id: 'detection', label: 'Detection',  icon: Icon.detection },
  { id: 'api',       label: 'API Keys',   icon: Icon.api },
  { id: 'receipts',  label: 'Receipts',   icon: Icon.mail },
];

// ── Main Component ────────────────────────────────────────────────────────────
export default function Settings({ settings, onSave, subscription, onLogout }) {
  const [tab, setTab] = useState('account');
  const [form, setForm] = useState({
    outputDir: settings?.outputDir || '',
    clipDuration: settings?.clipDuration || 60,
    clipBuffer: settings?.clipBuffer || 30,
    audioThreshold: settings?.audioThreshold ?? -20,
    chatThreshold: settings?.chatThreshold ?? 15,
    sensitivity: settings?.sensitivity ?? 50,
    notifications: settings?.notifications ?? true,
    quality: settings?.quality || 'best',
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPass: '',
    smtpFromName: 'ClipForge',
    twitchClientId: '',
    twitchClientSecret: '',
    youtubeApiKey: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [authStatus, setAuthStatus] = useState(null);

  useEffect(() => {
    api.auth.status().then(setAuthStatus).catch(() => {});
    api.apiKeys.get().then(keys => {
      if (keys) setForm(f => ({ ...f, twitchClientId: keys.twitchClientId || '', twitchClientSecret: keys.twitchClientSecret || '', youtubeApiKey: keys.youtubeApiKey || '' }));
    }).catch(() => {});
    api.smtp?.get().then(s => {
      if (s) setForm(f => ({ ...f, smtpHost: s.host || '', smtpPort: s.port || 587, smtpUser: s.user || '', smtpPass: s.pass || '', smtpFromName: s.fromName || 'ClipForge' }));
    }).catch(() => {});
  }, []);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ ...form });
      await api.apiKeys.set({ twitchClientId: form.twitchClientId, twitchClientSecret: form.twitchClientSecret, youtubeApiKey: form.youtubeApiKey });
      await api.smtp?.set({ host: form.smtpHost, port: form.smtpPort, user: form.smtpUser, pass: form.smtpPass, fromName: form.smtpFromName });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const handleBrowse = async () => {
    const result = await api.settings.selectDir();
    if (result?.path) set('outputDir', result.path);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try { await api.auth.logout(); onLogout(); }
    catch { setLoggingOut(false); setShowLogoutConfirm(false); }
  };

  const planLabel = subscription?.active
    ? subscription.plan === 'promo_free' ? 'Free Access (Promo)' : 'Pro · $49.99/mo'
    : 'No Active Plan';

  const initials = authStatus?.email ? authStatus.email[0].toUpperCase() : '?';

  return (
    <div className="page" style={{ maxWidth: 760, margin: '0 auto' }}>
      {/* Page header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your account, detection sensitivity, and integrations</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 22px', borderRadius: 10, cursor: saving ? 'not-allowed' : 'pointer',
            background: saved ? 'rgba(34,197,94,0.15)' : 'linear-gradient(135deg,#7c3aed,#2563eb)',
            border: saved ? '1px solid rgba(34,197,94,0.35)' : '1px solid transparent',
            color: saved ? '#4ade80' : 'white',
            fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-body)',
            transition: 'all 0.2s', opacity: saving ? 0.6 : 1,
            boxShadow: saved ? 'none' : '0 4px 16px rgba(124,58,237,0.3)',
          }}
        >
          {saved ? <>{Icon.check} Saved!</> : saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 4 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              padding: '9px 14px', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 600,
              fontFamily: 'var(--font-body)',
              background: tab === t.id ? 'linear-gradient(135deg,rgba(124,58,237,0.25),rgba(37,99,235,0.18))' : 'transparent',
              color: tab === t.id ? '#c4b5fd' : 'var(--text-secondary)',
              border: tab === t.id ? '1px solid rgba(124,58,237,0.3)' : '1px solid transparent',
              transition: 'all 0.15s',
            }}
          >
            <span style={{ opacity: tab === t.id ? 1 : 0.6 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── ACCOUNT TAB ── */}
      {tab === 'account' && (
        <>
          {/* Profile card */}
          <div style={{
            background: 'linear-gradient(135deg,rgba(124,58,237,0.1),rgba(37,99,235,0.08))',
            border: '1px solid rgba(124,58,237,0.2)',
            borderRadius: 'var(--radius-lg)',
            padding: 24, marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 18,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg,#7c3aed,#2563eb)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 800, color: 'white',
              boxShadow: '0 4px 20px rgba(124,58,237,0.4)',
            }}>{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {authStatus?.email || 'Not signed in'}
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 5, fontSize: 12, fontWeight: 600, color: '#a78bfa', background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 20, padding: '3px 10px' }}>
                {Icon.crown} {planLabel}
              </div>
            </div>
            <button
              onClick={() => setShowLogoutConfirm(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 9, color: '#f87171', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)', flexShrink: 0 }}
            >
              {Icon.logout} Sign Out
            </button>
          </div>

          {/* Subscription info */}
          <SectionCard>
            <SectionHeader icon={Icon.crown} title="Subscription" subtitle="Your current plan and billing" />
            <SettingRow label="Status" hint="Your ClipForge subscription">
              <div style={{ textAlign: 'right' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: subscription?.active ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.12)', color: subscription?.active ? '#4ade80' : '#9ca3af', border: `1px solid ${subscription?.active ? 'rgba(34,197,94,0.3)' : 'rgba(107,114,128,0.2)'}` }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
                  {subscription?.active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </SettingRow>
            <SettingRow label="Plan" hint={subscription?.expiresAt ? `Renews ${new Date(subscription.expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` : ''}>
              <div style={{ textAlign: 'right', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{planLabel}</div>
            </SettingRow>
          </SectionCard>

          {/* Notifications */}
          <SectionCard>
            <SectionHeader icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>} title="Notifications" subtitle="Desktop alerts for live streams and clips" />
            <SettingRow label="Desktop notifications" hint="Get notified when a streamer goes live or a clip is saved">
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Toggle checked={form.notifications} onChange={v => set('notifications', v)} />
              </div>
            </SettingRow>
          </SectionCard>
        </>
      )}

      {/* ── DETECTION TAB ── */}
      {tab === 'detection' && (
        <>
          <SectionCard>
            <SectionHeader icon={Icon.folder} title="Clip Storage" subtitle="Where your clips are saved on disk" />
            <div style={{ padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>Output folder</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="sf-input"
                  value={form.outputDir}
                  onChange={e => set('outputDir', e.target.value)}
                  placeholder="~/Raw Clips"
                  style={{ flex: 1 }}
                />
                <button onClick={handleBrowse} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap' }}>
                  {Icon.folder} Browse
                </button>
              </div>
            </div>
            <SliderRow
              label="Clip Duration"
              hint="How long each auto-saved clip will be"
              value={form.clipDuration}
              onChange={v => set('clipDuration', v)}
              min={15} max={180} step={5}
              format={v => `${v}s`}
            />
            <SliderRow
              label="Pre-roll Buffer"
              hint="Seconds of stream to include before the trigger moment"
              value={form.clipBuffer}
              onChange={v => set('clipBuffer', v)}
              min={5} max={60} step={5}
              format={v => `${v}s`}
            />
          </SectionCard>

          <SectionCard>
            <SectionHeader icon={Icon.detection} title="AI Detection Sensitivity" subtitle="ClipForge learns each streamer's baseline, then clips only genuine spike moments" />

            {/* Sensitivity slider */}
            <SliderRow
              label="Clip Sensitivity"
              hint={
                form.sensitivity < 30 ? "Very selective — only clips massive, unmistakable hype moments" :
                form.sensitivity < 55 ? "Balanced — clips clear spikes above the streamer's normal energy level" :
                form.sensitivity < 75 ? "Eager — clips moderate spikes, may include some false positives" :
                "Maximum — clips anything above the streamer's baseline (may produce many clips)"
              }
              value={form.sensitivity}
              onChange={v => set('sensitivity', v)}
              min={0} max={100} step={5}
              format={v => {
                if (v < 30) return 'Selective';
                if (v < 55) return 'Balanced';
                if (v < 75) return 'Eager';
                return 'Maximum';
              }}
            />

            {/* How it works explanation */}
            <div style={{ padding: '14px 0 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                <strong style={{ color: 'var(--text-secondary)' }}>How it works:</strong> ClipForge spends the first 60 seconds of each stream learning that streamer's <em>normal</em> audio level and chat speed. It only clips when both spike significantly above their personal baseline — so a loud creator like RampageJackson won't get clipped every second, only during real hype moments.
              </div>
            </div>

            {/* Sensitivity preview cards */}
            <div style={{ padding: '16px 0 4px', display: 'flex', gap: 10 }}>
              {[
                { label: 'Typical moment', audioSpike: 2, chatMult: 1.2, desc: 'Stream running normally' },
                { label: 'Hype spike',     audioSpike: 8, chatMult: 2.8, desc: 'Chat explodes + loud reaction' },
                { label: 'Mega moment',    audioSpike: 14, chatMult: 4.5, desc: 'Something insane just happened' },
              ].map(ex => {
                // Mirror the main.js spike-detection math
                const audioNeed = 10 - (form.sensitivity / 100) * 6;
                const chatNeed  = 2.5 - (form.sensitivity / 100) * 1.0;
                const aHit = ex.audioSpike >= audioNeed;
                const cHit = ex.chatMult  >= chatNeed;
                const clips = aHit && cHit;
                return (
                  <div key={ex.label} style={{
                    flex: 1,
                    background: clips ? 'rgba(124,58,237,0.1)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${clips ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 10, padding: '12px 14px',
                    transition: 'all 0.2s',
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: clips ? '#a78bfa' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                      {ex.label}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>
                      Audio: <span style={{ color: aHit ? '#4ade80' : 'var(--text-muted)', fontWeight: 600 }}>+{ex.audioSpike} dB above normal</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                      Chat: <span style={{ color: cHit ? '#4ade80' : 'var(--text-muted)', fontWeight: 600 }}>{ex.chatMult}× normal rate</span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: clips ? '#a78bfa' : 'var(--text-muted)' }}>
                      {clips ? '🎬 Clip!' : '✕ Skip'}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quality */}
            <SettingRow label="Stream quality" hint="Higher quality = more CPU and bandwidth during monitoring">
              <select
                value={form.quality}
                onChange={e => set('quality', e.target.value)}
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 9, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-body)', cursor: 'pointer', width: '100%' }}
              >
                <option value="best">Best (1080p60)</option>
                <option value="1080p">1080p</option>
                <option value="720p60">720p60</option>
                <option value="720p">720p</option>
                <option value="480p">480p</option>
                <option value="worst">Lowest</option>
              </select>
            </SettingRow>
          </SectionCard>
        </>
      )}

      {/* ── API KEYS TAB ── */}
      {tab === 'api' && (
        <>
          <div style={{ padding: '12px 16px', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 10, marginBottom: 16, fontSize: 13, color: '#a78bfa', lineHeight: 1.5 }}>
            💡 Kick works without any API keys. Twitch and YouTube require keys for live status detection and chat monitoring.
          </div>

          <SectionCard>
            <SectionHeader
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9146ff" strokeWidth="2"><path d="M21 2H3v16h5v4l4-4h5l4-4V2zm-10 9V7m5 4V7"/></svg>}
              title="Twitch"
              subtitle="Get keys at dev.twitch.tv/console"
            />
            <div style={{ padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Client ID</div>
              <input className="sf-input" value={form.twitchClientId} onChange={e => set('twitchClientId', e.target.value)} placeholder="abc123..." />
            </div>
            <div style={{ padding: '16px 0' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Client Secret</div>
              <PasswordInput value={form.twitchClientSecret} onChange={e => set('twitchClientSecret', e.target.value)} placeholder="••••••••••••••" />
            </div>
          </SectionCard>

          <SectionCard>
            <SectionHeader
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff0000" strokeWidth="2"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white" stroke="none"/></svg>}
              title="YouTube"
              subtitle="Get your key at console.cloud.google.com"
            />
            <div style={{ padding: '16px 0' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>API Key</div>
              <PasswordInput value={form.youtubeApiKey} onChange={e => set('youtubeApiKey', e.target.value)} placeholder="AIza••••••••••" />
            </div>
          </SectionCard>

          <SectionCard>
            <SectionHeader
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#53fc18" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></svg>}
              title="Kick"
              subtitle="No API key needed — works out of the box"
            />
            <div style={{ padding: '16px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#53fc18', boxShadow: '0 0 8px #53fc18' }} />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Fully supported · No configuration required</span>
            </div>
          </SectionCard>
        </>
      )}

      {/* ── RECEIPTS TAB ── */}
      {tab === 'receipts' && (
        <>
          <div style={{ padding: '12px 16px', background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: 10, marginBottom: 16, fontSize: 13, color: '#93c5fd', lineHeight: 1.5 }}>
            📧 ClipForge will automatically email you a receipt every time your subscription renews. Fill in your SMTP details below to enable this.
          </div>
          <SectionCard>
            <SectionHeader icon={Icon.mail} title="SMTP Configuration" subtitle="Used to send your monthly renewal receipts" />
            <div style={{ padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>SMTP Host</div>
                  <input className="sf-input" value={form.smtpHost} onChange={e => set('smtpHost', e.target.value)} placeholder="smtp.gmail.com" />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Port</div>
                  <input className="sf-input" type="number" value={form.smtpPort} onChange={e => set('smtpPort', parseInt(e.target.value))} />
                </div>
              </div>
            </div>
            <div style={{ padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Username / Email</div>
              <input className="sf-input" value={form.smtpUser} onChange={e => set('smtpUser', e.target.value)} placeholder="you@gmail.com" />
            </div>
            <div style={{ padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Password / App Password</div>
              <PasswordInput value={form.smtpPass} onChange={e => set('smtpPass', e.target.value)} placeholder="App password (not your main password)" />
            </div>
            <div style={{ padding: '16px 0' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Sender Name</div>
              <input className="sf-input" value={form.smtpFromName} onChange={e => set('smtpFromName', e.target.value)} placeholder="ClipForge" />
            </div>
          </SectionCard>

          <div style={{ padding: '14px 18px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--text-secondary)' }}>Using Gmail?</strong> Go to your Google Account → Security → 2-Step Verification → App Passwords. Generate one for "ClipForge" and use it here instead of your regular password.
          </div>
        </>
      )}

      {/* Logout confirm modal */}
      {showLogoutConfirm && (
        <div className="modal-overlay">
          <div className="modal-card logout-confirm">
            <h3>Sign out of ClipForge?</h3>
            <p>You'll need to sign back in with your email and password to use the app.</p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowLogoutConfirm(false)} disabled={loggingOut}>Cancel</button>
              <button className="btn-danger" onClick={handleLogout} disabled={loggingOut}>
                {loggingOut ? 'Signing out…' : 'Sign Out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

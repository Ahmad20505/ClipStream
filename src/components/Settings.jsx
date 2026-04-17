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
  { id: 'account',      label: 'Account',       icon: Icon.user },
  { id: 'detection',    label: 'Detection',     icon: Icon.detection },
  { id: 'integrations', label: 'Integrations',  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> },
  { id: 'api',          label: 'API Keys',      icon: Icon.api },
  { id: 'receipts',     label: 'Emails',        icon: Icon.mail },
];

// ── Main Component ────────────────────────────────────────────────────────────
export default function Settings({ settings, onSave, subscription, onLogout, onAccountDeleted }) {
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
    discordWebhook: settings?.discordWebhook || '',
    webhookUrl: settings?.webhookUrl || '',
    normalizeAudio: settings?.normalizeAudio ?? true,
    autoCleanupDays: settings?.autoCleanupDays ?? 0,
    systemTray: settings?.systemTray ?? true,
    variableClipLength: settings?.variableClipLength ?? true,
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPass: '',
    smtpFromName: 'ClipStream',
    twitchClientId: '',
    twitchClientSecret: '',
    youtubeApiKey: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [authStatus, setAuthStatus] = useState(null);
  const [diskUsage, setDiskUsage] = useState(null);

  useEffect(() => {
    api.auth.status().then(setAuthStatus).catch(() => {});
    api.apiKeys.get().then(keys => {
      if (keys) setForm(f => ({ ...f, twitchClientId: keys.twitchClientId || '', twitchClientSecret: keys.twitchClientSecret || '', youtubeApiKey: keys.youtubeApiKey || '' }));
    }).catch(() => {});
    api.disk?.usage().then(setDiskUsage).catch(() => {});
    api.smtp?.get().then(s => {
      if (s) setForm(f => ({ ...f, smtpHost: s.host || '', smtpPort: s.port || 587, smtpUser: s.user || '', smtpPass: s.pass || '', smtpFromName: s.fromName || 'ClipStream' }));
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

  // Harder-hitting variant of logout: also wipes the local account record so
  // the app returns to its "never been signed up" state. Used when switching
  // to a different email on the same device — with the single-account-per-
  // install guard, a plain sign-out isn't enough.
  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      if (api.auth.deleteAccount) await api.auth.deleteAccount();
      else await api.auth.logout();   // fallback if running an older preload
      onAccountDeleted ? onAccountDeleted() : onLogout();
    } catch {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
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
            <SettingRow label="Status" hint="Your ClipStream subscription">
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

          {/* Danger zone — used primarily to switch accounts on the same device.
              ClipStream is single-account-per-install; to sign up with a
              different email you have to clear the current account first. */}
          <SectionCard>
            <SectionHeader
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
              title="Danger zone"
              subtitle="Destructive actions — please read before clicking"
            />
            <SettingRow
              label="Delete account from this device"
              hint="Removes the stored email + password hash. Your clips, settings, and subscription are kept (subscription is tied to your email on the server). You'll need to sign up again or sign in from another device."
            >
              <button
                onClick={() => setShowDeleteConfirm(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 9, color: '#f87171', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
              >
                Delete local account
              </button>
            </SettingRow>
          </SectionCard>
        </>
      )}

      {/* ── DETECTION TAB ── */}
      {tab === 'detection' && (
        <>
          <SectionCard>
            <SectionHeader icon={Icon.folder} title="Export Default Folder" subtitle="Default location for TikTok, Shorts, and Twitter exports (clips are downloaded wherever you choose)" />
            <div style={{ padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 10 }}>Default export folder</div>
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
            <SectionHeader icon={Icon.detection} title="AI Detection Sensitivity" subtitle="ClipStream learns each streamer's baseline, then clips only genuine spike moments" />

            {/* Preset buttons */}
            <div style={{ padding: '16px 0 8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 12 }}>Quick Presets</div>
              <div style={{ display: 'flex', gap: 10 }}>
                {[
                  { label: '🎯 Conservative', value: 20, desc: '~5–10 clips/stream · Only the biggest moments' },
                  { label: '⚖️ Balanced',     value: 45, desc: '~10–20 clips/stream · Clear hype moments' },
                  { label: '🔥 Aggressive',   value: 70, desc: '~20–35 clips/stream · Catches more moments' },
                ].map(p => {
                  const active = Math.abs(form.sensitivity - p.value) < 8;
                  return (
                    <button
                      key={p.label}
                      onClick={() => set('sensitivity', p.value)}
                      style={{
                        flex: 1, padding: '12px 10px', borderRadius: 10, cursor: 'pointer',
                        fontFamily: 'var(--font-body)', textAlign: 'left',
                        background: active ? 'linear-gradient(135deg,rgba(124,58,237,0.2),rgba(37,99,235,0.15))' : 'rgba(255,255,255,0.03)',
                        border: active ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.07)',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 700, color: active ? '#c4b5fd' : 'var(--text-primary)', marginBottom: 4 }}>{p.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{p.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Fine-tune slider */}
            <SliderRow
              label="Fine Tune"
              hint={
                form.sensitivity < 30 ? "Very selective — only clips massive, unmistakable hype moments" :
                form.sensitivity < 55 ? "Balanced — clips clear spikes above the streamer's normal energy level" :
                form.sensitivity < 75 ? "Eager — clips moderate spikes, may include some false positives" :
                "Maximum — clips anything above the streamer's baseline (may produce many clips)"
              }
              value={form.sensitivity}
              onChange={v => set('sensitivity', v)}
              min={0} max={100} step={5}
              format={v => `${v}%`}
            />

            {/* How it works explanation */}
            <div style={{ padding: '14px 0 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                <strong style={{ color: 'var(--text-secondary)' }}>How it works:</strong> ClipStream spends the first 60 seconds of each stream learning that streamer's <em>normal</em> audio level and chat speed. It only clips when both spike significantly above their personal baseline — so a loud creator like RampageJackson won't get clipped every second, only during real hype moments.
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

      {/* ── INTEGRATIONS TAB ── */}
      {tab === 'integrations' && (
        <>
          {/* Discord */}
          <SectionCard>
            <SectionHeader
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="#5865F2"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.034.054a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>}
              title="Discord"
              subtitle="Auto-post clips to a Discord channel when they're created"
            />
            <div style={{ padding: '16px 0' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Webhook URL</div>
              <input className="sf-input" value={form.discordWebhook} onChange={e => set('discordWebhook', e.target.value)} placeholder="https://discord.com/api/webhooks/..." />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>In Discord: Channel Settings → Integrations → Webhooks → New Webhook → Copy Webhook URL</div>
            </div>
          </SectionCard>

          {/* Generic webhook */}
          <SectionCard>
            <SectionHeader
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>}
              title="Custom Webhook"
              subtitle="POST clip data to any URL when a clip is created (for custom integrations)"
            />
            <div style={{ padding: '16px 0' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Endpoint URL</div>
              <input className="sf-input" value={form.webhookUrl} onChange={e => set('webhookUrl', e.target.value)} placeholder="https://your-server.com/webhook" />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Receives a POST with: event, streamer, platform, hypeScore, reason, duration, createdAt</div>
            </div>
          </SectionCard>

          {/* App behaviour */}
          <SectionCard>
            <SectionHeader icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>} title="App Behaviour" subtitle="How ClipStream runs in the background" />
            <SettingRow label="System tray mode" hint="Keep ClipStream running in the system tray when you close the window">
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Toggle checked={form.systemTray} onChange={v => set('systemTray', v)} /></div>
            </SettingRow>
            <SettingRow label="Variable clip length" hint="Automatically extend clips during sustained hype moments (up to 3× base duration)">
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Toggle checked={form.variableClipLength} onChange={v => set('variableClipLength', v)} /></div>
            </SettingRow>
            <SettingRow label="Normalize audio on save" hint="Auto-balance clip volume to -16 LUFS when saving — consistent loudness across all clips">
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Toggle checked={form.normalizeAudio} onChange={v => set('normalizeAudio', v)} /></div>
            </SettingRow>
          </SectionCard>

          {/* Disk & cleanup */}
          <SectionCard>
            <SectionHeader icon={Icon.folder} title="Storage & Cleanup" subtitle="Manage disk space used by ClipStream" />
            {diskUsage && (
              <div style={{ padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                {[
                  { label: 'In Review', bytes: diskUsage.stagingBytes, color: '#a78bfa' },
                  { label: 'Saved Clips', bytes: diskUsage.savedBytes, color: '#4ade80' },
                  { label: 'Total', bytes: diskUsage.totalBytes, color: 'var(--text-secondary)' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center', padding: '10px 0', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: s.color, fontFamily: 'var(--font-display)' }}>{(s.bytes / 1024 / 1024).toFixed(0)} MB</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}
            <SettingRow label="Auto-discard old review clips" hint="Automatically remove unreviewed clips from staging after this many days (0 = never)">
              <select className="filter-select" value={form.autoCleanupDays} onChange={e => set('autoCleanupDays', Number(e.target.value))} style={{ width: '100%' }}>
                <option value={0}>Never</option>
                <option value={3}>After 3 days</option>
                <option value={7}>After 7 days</option>
                <option value={14}>After 14 days</option>
                <option value={30}>After 30 days</option>
              </select>
            </SettingRow>
          </SectionCard>
        </>
      )}

      {/* ── EMAILS TAB ── */}
      {tab === 'receipts' && (
        <>
          <SectionCard>
            <SectionHeader icon={Icon.mail} title="Automatic Emails" subtitle="ClipStream emails you automatically — no setup needed" />
            <div style={{ padding: '16px 0' }}>
              {[
                { icon: '👋', label: 'Welcome email', desc: 'Sent instantly when you create your account' },
                { icon: '🧾', label: 'Renewal receipts', desc: 'Sent automatically each time your subscription renews' },
                { icon: '🎬', label: 'Daily clip digest', desc: 'Sent every morning at 8 AM with yesterday\'s highlights' },
              ].map((item, i, arr) => (
                <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '14px 0', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <span style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>{item.icon}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.desc}</div>
                  </div>
                  <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#4ade80', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 6, padding: '3px 8px', flexShrink: 0 }}>Auto</span>
                </div>
              ))}
            </div>
          </SectionCard>

          <div style={{ padding: '14px 18px', background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 10, fontSize: 13, color: '#a78bfa', lineHeight: 1.6 }}>
            📬 All emails are sent to <strong>{authStatus?.email || 'your registered email'}</strong> — the address you signed up with. No configuration needed.
          </div>
        </>
      )}

      {/* Logout confirm modal */}
      {showLogoutConfirm && (
        <div className="modal-overlay">
          <div className="modal-card logout-confirm">
            <h3>Sign out of ClipStream?</h3>
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

      {/* Delete local account confirm modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-card logout-confirm">
            <h3>Delete local account?</h3>
            <p>
              This removes <strong>{authStatus?.email || 'the current account'}</strong> from this device.
              You'll see the sign-up screen next time the app opens.
            </p>
            <p style={{ marginTop: 8, fontSize: 13, color: 'var(--text-muted)' }}>
              Your subscription stays active (tied to your email on the server). Clips, settings, and API keys on this device are <em>not</em> deleted.
            </p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>Cancel</button>
              <button className="btn-danger" onClick={handleDeleteAccount} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete local account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

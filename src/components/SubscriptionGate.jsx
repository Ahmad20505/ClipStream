import { useState, useEffect, useRef } from 'react';

const PROMO_CODES = {
  'FORGEFREE': { discount: 100, label: '100% off — Free Access!' },
  'CLIP50':    { discount: 50,  label: '50% off applied!' },
  'LAUNCH25':  { discount: 25,  label: '25% off applied!' },
};

const BASE_PRICE = 49.99;

const FEATURES = [
  { icon: '🎬', text: 'Unlimited automatic clip detection' },
  { icon: '🤖', text: 'AI audio + chat hype detection' },
  { icon: '📡', text: 'Monitor unlimited streamers simultaneously' },
  { icon: '🎮', text: 'Works with Twitch, YouTube, and Kick' },
  { icon: '💾', text: 'Auto-save clips to your Raw Clips folder' },
  { icon: '🖥️', text: 'Native Windows & Mac desktop app' },
  { icon: '🔔', text: 'Desktop notifications for live & clips' },
  { icon: '⚙️', text: 'Fully customizable detection sensitivity' },
];

const api = window.clipforge;

export default function SubscriptionGate({ onSubscribe, onGoToSignIn }) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState('plan'); // 'plan' | 'checkout' | 'waiting'
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(null);
  const pollTimer = useRef(null);

  const isFree = promoApplied?.discount === 100;
  const finalPrice = promoApplied
    ? (BASE_PRICE * (1 - promoApplied.discount / 100)).toFixed(2)
    : BASE_PRICE.toFixed(2);

  // Poll the Worker for subscription activation while on the 'waiting' screen.
  // User pays in an external browser tab; we can't observe that directly, so we
  // poll until the webhook has updated KV and /subscription reports active.
  useEffect(() => {
    if (step !== 'waiting') {
      if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
      return;
    }
    const tick = async () => {
      try {
        const result = await api.subscription.check();
        if (result && result.active) {
          clearInterval(pollTimer.current);
          pollTimer.current = null;
          onSubscribe({
            active: true,
            plan: result.plan || 'pro_monthly',
            expiresAt: result.expiresAt,
            email,
          });
        }
      } catch {}
    };
    pollTimer.current = setInterval(tick, 3000);
    tick();
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
  }, [step, email, onSubscribe]);

  const handleApplyPromo = () => {
    const code = promoCode.trim().toUpperCase();
    if (PROMO_CODES[code]) {
      setPromoApplied({ code, ...PROMO_CODES[code] });
      setError('');
    } else {
      setPromoApplied(null);
      setError('Invalid promo code.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email) { setError('Please enter your email.'); return; }
    if (!password) { setError('Please create a password.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }

    setLoading(true);
    try {
      // Create the account first so we have a stable identity to tie the
      // subscription to. Register is idempotent-ish: it refuses overwrite, so
      // re-submits don't clobber anything.
      const regResult = await api.auth.register({ email, password });
      if (!regResult.success) {
        setError(regResult.error || 'Failed to create account.');
        setLoading(false);
        return;
      }

      if (isFree) {
        // Promo code path: skip Stripe entirely.
        const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
        onSubscribe({
          active: true,
          plan: 'promo_free',
          expiresAt,
          email,
          promoCode: promoApplied?.code || null,
        });
        return;
      }

      // Paid path: ask the Worker to create a Stripe Checkout session and
      // open it in the user's default browser. We then move to the waiting
      // screen and poll for activation.
      const co = await api.subscription.startCheckout();
      if (!co.success) {
        setError(co.error || 'Could not start checkout. Please try again.');
        setLoading(false);
        return;
      }
      setStep('waiting');
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualRecheck = async () => {
    setError('');
    try {
      const result = await api.subscription.check();
      if (result && result.active) {
        onSubscribe({
          active: true,
          plan: result.plan || 'pro_monthly',
          expiresAt: result.expiresAt,
          email,
        });
      } else {
        setError("We don't see an active subscription yet. If you just paid, give it a few more seconds.");
      }
    } catch {
      setError('Could not reach the subscription server. Check your internet connection.');
    }
  };

  // ── Plan Screen ─────────────────────────────────────────
  if (step === 'plan') {
    return (
      <div className="sub-gate">
        <div className="sub-gate-content">
          <div className="sub-hero">
            <div className="sub-hero-icon">
              <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
                <path d="M8 24L24 8L40 24L24 40L8 24Z" fill="url(#subgrad)" />
                <path d="M18 22L22 26L30 18" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <defs>
                  <linearGradient id="subgrad" x1="8" y1="8" x2="40" y2="40">
                    <stop stopColor="#7c3aed" /><stop offset="1" stopColor="#2563eb" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <h1 className="sub-hero-title">ClipStream Pro</h1>
            <p className="sub-hero-subtitle">The only fully automatic AI stream clipper on the market</p>
          </div>

          <div className="pricing-card">
            <div className="pricing-badge">MOST POPULAR</div>
            <div className="pricing-amount">
              <span className="pricing-currency">$</span>
              <span className="pricing-number">49</span>
              <span className="pricing-cents">.99</span>
              <span className="pricing-period">/month</span>
            </div>
            <p className="pricing-desc">Full access to all features, unlimited monitors, and auto-clipping</p>

            <ul className="feature-list">
              {FEATURES.map((f, i) => (
                <li key={i} className="feature-item">
                  <span className="feature-icon">{f.icon}</span>
                  <span>{f.text}</span>
                </li>
              ))}
            </ul>

            <button className="btn-subscribe" onClick={() => setStep('checkout')}>
              Start Clipping Now →
            </button>
            <p className="pricing-note">Cancel anytime · No hidden fees · Secure payment via Stripe</p>
          </div>

          {onGoToSignIn && (
            <p className="auth-switch" style={{ marginTop: 20 }}>
              Already have an account?{' '}
              <button className="auth-link" onClick={onGoToSignIn}>Sign in</button>
            </p>
          )}

          <div className="social-proof">
            <div className="testimonial">
              <p className="testimonial-text">"ClipStream caught moments I would've completely missed. It's a game changer for content creators."</p>
              <p className="testimonial-author">— @xample_streamer, 50K followers</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Waiting Screen (user is paying in their browser) ────
  if (step === 'waiting') {
    return (
      <div className="sub-gate">
        <div className="sub-gate-content">
          <div className="checkout-card">
            <h2 className="checkout-title">Complete payment in your browser</h2>
            <p className="checkout-subtitle" style={{ marginBottom: 24 }}>
              We opened Stripe Checkout in a new browser tab. Complete your payment there, then come back — ClipStream will unlock automatically within a few seconds.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0' }}>
              <div className="btn-spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
              <p style={{ marginTop: 16, color: '#9ca3af', fontSize: 14 }}>Waiting for Stripe to confirm your payment…</p>
            </div>

            {error && <p className="form-error">{error}</p>}

            <button type="button" className="btn-subscribe" onClick={handleManualRecheck} style={{ marginTop: 12 }}>
              I've paid — check now
            </button>

            <button
              type="button"
              className="auth-link"
              onClick={() => { setStep('checkout'); setError(''); }}
              style={{ marginTop: 16, display: 'block', margin: '16px auto 0' }}
            >
              ← Back to checkout
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Checkout Screen ──────────────────────────────────────
  return (
    <div className="sub-gate">
      <div className="sub-gate-content">
        <div className="checkout-card">
          <button className="checkout-back" onClick={() => { setStep('plan'); setPromoApplied(null); setPromoCode(''); setError(''); }}>
            ← Back
          </button>
          <h2 className="checkout-title">Create your account</h2>

          <div className="checkout-price-row">
            {promoApplied ? (
              <>
                <span className="checkout-price-original">${BASE_PRICE}/mo</span>
                <span className="checkout-price-final" style={{ color: isFree ? '#22c55e' : '#a78bfa' }}>
                  {isFree ? 'FREE' : `$${finalPrice}/mo`}
                </span>
              </>
            ) : (
              <span className="checkout-subtitle">ClipStream Pro · $49.99/month</span>
            )}
          </div>

          <div className="promo-row">
            <input
              className="promo-input"
              type="text"
              placeholder="Promo code"
              value={promoCode}
              onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoApplied(null); }}
              onKeyDown={e => e.key === 'Enter' && handleApplyPromo()}
            />
            <button className="btn-promo" onClick={handleApplyPromo} type="button">Apply</button>
          </div>

          {promoApplied && (
            <div className="promo-success">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {promoApplied.label}
            </div>
          )}

          <form className="checkout-form" onSubmit={handleSubmit}>
            <div className="form-field">
              <label>Email address</label>
              <input
                type="email"
                placeholder="you@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-field">
              <label>Create password</label>
              <input
                type="password"
                placeholder="Min. 8 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              <span className="password-hint">You'll use this to sign back in</span>
            </div>

            <div className="form-field">
              <label>Confirm password</label>
              <input
                type="password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            {isFree && (
              <div className="free-access-banner">
                🎉 Promo code applied — no payment required!
              </div>
            )}

            {error && <p className="form-error">{error}</p>}

            <button type="submit" className="btn-subscribe" disabled={loading}>
              {loading ? (
                <><span className="btn-spinner" /> Processing…</>
              ) : isFree ? (
                <>🎉 Activate Free Access</>
              ) : (
                <>Continue to payment →</>
              )}
            </button>

            {!isFree && (
              <div className="checkout-security">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Payments handled by Stripe · Card details never touch ClipStream
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

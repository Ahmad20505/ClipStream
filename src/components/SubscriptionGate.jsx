import { useState } from 'react';

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
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState('plan');
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(null);

  const isFree = promoApplied?.discount === 100;
  const finalPrice = promoApplied
    ? (BASE_PRICE * (1 - promoApplied.discount / 100)).toFixed(2)
    : BASE_PRICE.toFixed(2);

  const formatCard = (val) => {
    const digits = val.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(.{4})/g, '$1 ').trim();
  };

  const formatExpiry = (val) => {
    const digits = val.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return digits;
  };

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

  const handleCheckout = async (e) => {
    e.preventDefault();
    setError('');

    if (!email) { setError('Please enter your email.'); return; }

    if (!password) { setError('Please create a password.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }

    // If free via promo, skip card details
    if (!isFree && (!cardNumber || !expiry || !cvv || !name)) {
      setError('Please fill in all payment fields.');
      return;
    }

    setLoading(true);
    try {
      await new Promise(res => setTimeout(res, 1200));

      // Register the account with hashed password
      const regResult = await api.auth.register({ email, password });
      if (!regResult.success) {
        setError(regResult.error || 'Failed to create account.');
        setLoading(false);
        return;
      }

      const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
      onSubscribe({
        active: true,
        plan: isFree ? 'promo_free' : 'pro_monthly',
        expiresAt,
        customerId: `cus_${Math.random().toString(36).slice(2)}`,
        email,
        promoCode: promoApplied?.code || null,
      });
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
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
            <p className="pricing-note">Cancel anytime · No hidden fees · 3-day free trial</p>
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

  // ── Checkout Screen ──────────────────────────────────────
  return (
    <div className="sub-gate">
      <div className="sub-gate-content">
        <div className="checkout-card">
          <button className="checkout-back" onClick={() => { setStep('plan'); setPromoApplied(null); setPromoCode(''); setError(''); }}>
            ← Back
          </button>
          <h2 className="checkout-title">Complete your subscription</h2>

          {/* Price display */}
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

          {/* Promo Code */}
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

          <form className="checkout-form" onSubmit={handleCheckout}>
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

            {/* Only show card fields if not 100% free */}
            {!isFree && (
              <>
                <div className="form-field">
                  <label>Cardholder name</label>
                  <input
                    type="text"
                    placeholder="John Smith"
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label>Card number</label>
                  <div className="card-input-wrap">
                    <input
                      type="text"
                      placeholder="1234 5678 9012 3456"
                      value={cardNumber}
                      onChange={e => setCardNumber(formatCard(e.target.value))}
                      maxLength={19}
                    />
                    <svg className="card-icon" width="24" height="16" viewBox="0 0 24 16" fill="none">
                      <rect width="24" height="16" rx="2" fill="#1a1a2e" />
                      <rect y="4" width="24" height="5" fill="#2a2a3e" />
                      <rect x="3" y="11" width="7" height="2" rx="1" fill="#7c3aed" />
                    </svg>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label>Expiry</label>
                    <input
                      type="text"
                      placeholder="MM/YY"
                      value={expiry}
                      onChange={e => setExpiry(formatExpiry(e.target.value))}
                      maxLength={5}
                    />
                  </div>
                  <div className="form-field">
                    <label>CVV</label>
                    <input
                      type="text"
                      placeholder="123"
                      value={cvv}
                      onChange={e => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      maxLength={4}
                    />
                  </div>
                </div>
              </>
            )}

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
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
                  </svg>
                  Pay ${finalPrice}/month
                </>
              )}
            </button>

            {!isFree && (
              <div className="checkout-security">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Payments secured by Stripe · Cancel anytime
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

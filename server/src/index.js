// ClipStream subscription verification Worker
//
// Three endpoints:
//   GET  /subscription?email=<email>  — ClipStream polls this to check entitlement
//   POST /checkout                    — creates a Stripe Checkout session
//   POST /webhook/stripe              — Stripe posts subscription lifecycle events here
//
// Source of truth lives in Cloudflare KV under `email:<lowercase-email>`, written
// by the webhook handler and read by the subscription handler. The ClipStream
// client never touches the writer path — only Stripe (signature-verified) does.

import Stripe from 'stripe';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Stripe-Signature',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    try {
      if (url.pathname === '/subscription' && request.method === 'GET') {
        return handleSubscriptionLookup(request, env, cors);
      }
      if (url.pathname === '/checkout' && request.method === 'POST') {
        return handleCheckoutCreate(request, env, cors);
      }
      if (url.pathname === '/webhook/stripe' && request.method === 'POST') {
        return handleStripeWebhook(request, env);
      }
      if (url.pathname === '/success' && request.method === 'GET') {
        return htmlResponse(SUCCESS_HTML);
      }
      if (url.pathname === '/cancel' && request.method === 'GET') {
        return htmlResponse(CANCEL_HTML);
      }
      if (url.pathname === '/' && request.method === 'GET') {
        return jsonResponse({ service: 'clipstream-subscription', ok: true }, 200, cors);
      }
      return new Response('Not found', { status: 404, headers: cors });
    } catch (err) {
      console.error('[Worker] Error:', err.stack || err.message);
      return jsonResponse({ error: err.message }, 500, cors);
    }
  },
};

// GET /subscription?email=<email>
// ClipStream polls this. Read-only; never writes. Returns {active, plan, expiresAt}.
async function handleSubscriptionLookup(request, env, cors) {
  const url = new URL(request.url);
  const email = (url.searchParams.get('email') || '').toLowerCase().trim();
  if (!email || !email.includes('@') || email.length > 320) {
    return jsonResponse({ active: false, error: 'Missing or invalid email' }, 400, cors);
  }
  const record = await env.SUBSCRIPTIONS.get(`email:${email}`, { type: 'json' });
  if (!record) {
    return jsonResponse({ active: false }, 200, cors);
  }
  // Defence-in-depth: even if webhook missed the expiry event, never report
  // active once current_period_end has passed.
  const expired = record.expiresAt && Date.now() > record.expiresAt;
  if (expired) {
    return jsonResponse({ active: false, expired: true, plan: record.plan }, 200, cors);
  }
  return jsonResponse({
    active: !!record.active,
    plan: record.plan,
    expiresAt: record.expiresAt,
    status: record.status,
  }, 200, cors);
}

// POST /checkout  { email }
// Creates a Stripe Checkout Session pre-filled with the ClipStream account email
// so the signed-up email matches the paying customer email. Returns the URL to open.
async function handleCheckoutCreate(request, env, cors) {
  const stripe = stripeClient(env);
  const body = await safeJson(request);
  const email = (body.email || '').toLowerCase().trim();
  if (!email || !email.includes('@') || email.length > 320) {
    return jsonResponse({ error: 'Missing or invalid email' }, 400, cors);
  }
  const origin = new URL(request.url).origin;
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: email,
    line_items: [{ price: env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${origin}/success`,
    cancel_url: `${origin}/cancel`,
    metadata: { app_email: email },
    subscription_data: { metadata: { app_email: email } },
  });
  return jsonResponse({ url: session.url }, 200, cors);
}

// POST /webhook/stripe
// Stripe sends subscription lifecycle events here. The incoming request includes
// a Stripe-Signature header; we verify it against STRIPE_WEBHOOK_SECRET before
// trusting anything. Never accept unsigned requests — they're trivial to forge.
async function handleStripeWebhook(request, env) {
  const stripe = stripeClient(env);
  const signature = request.headers.get('Stripe-Signature');
  const body = await request.text();
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[Worker] Webhook signature verification failed:', err.message);
    return new Response('Invalid signature', { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed':
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await upsertSubscription(stripe, env, event);
      break;
    case 'customer.subscription.deleted':
      await markCanceled(stripe, env, event);
      break;
    default:
      // Ignore unhandled event types but still 200 so Stripe doesn't retry them.
      break;
  }

  return jsonResponse({ received: true }, 200);
}

async function upsertSubscription(stripe, env, event) {
  const object = event.data.object;
  const subscription = object.object === 'subscription'
    ? object
    : await stripe.subscriptions.retrieve(object.subscription);
  const customer = await stripe.customers.retrieve(subscription.customer);
  const email = (customer.email || subscription.metadata?.app_email || '').toLowerCase();
  if (!email) {
    console.warn('[Worker] Subscription event without resolvable email:', subscription.id);
    return;
  }
  const active = subscription.status === 'active' || subscription.status === 'trialing';
  const record = {
    active,
    plan: subscription.items.data[0]?.price?.id || null,
    customerId: subscription.customer,
    subscriptionId: subscription.id,
    expiresAt: subscription.current_period_end ? subscription.current_period_end * 1000 : null,
    status: subscription.status,
    updatedAt: Date.now(),
  };
  await env.SUBSCRIPTIONS.put(`email:${email}`, JSON.stringify(record));
  console.log(`[Worker] ${event.type} for ${email}: ${record.status}`);
}

async function markCanceled(stripe, env, event) {
  const subscription = event.data.object;
  const customer = await stripe.customers.retrieve(subscription.customer);
  const email = (customer.email || subscription.metadata?.app_email || '').toLowerCase();
  if (!email) return;
  const record = {
    active: false,
    plan: null,
    customerId: subscription.customer,
    subscriptionId: subscription.id,
    expiresAt: subscription.current_period_end ? subscription.current_period_end * 1000 : null,
    status: 'canceled',
    updatedAt: Date.now(),
  };
  await env.SUBSCRIPTIONS.put(`email:${email}`, JSON.stringify(record));
  console.log(`[Worker] subscription canceled for ${email}`);
}

function stripeClient(env) {
  return new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  });
}

async function safeJson(request) {
  try { return await request.json(); } catch { return {}; }
}

function jsonResponse(obj, status = 200, cors = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

const SUCCESS_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>ClipStream — Payment Successful</title><style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a0f;color:#e5e7eb;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
.card{max-width:480px;text-align:center;background:#111827;padding:40px;border-radius:16px;border:1px solid #1f2937}
h1{margin:0 0 16px;font-size:24px}
p{color:#9ca3af;line-height:1.6}
.check{width:64px;height:64px;background:#10b981;border-radius:50%;margin:0 auto 24px;display:flex;align-items:center;justify-content:center;font-size:32px}
</style></head><body><div class="card"><div class="check">✓</div><h1>Payment successful</h1><p>Your ClipStream Pro subscription is now active. You can close this tab and return to the ClipStream app — it will unlock automatically within a few seconds.</p></div></body></html>`;

const CANCEL_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>ClipStream — Checkout Canceled</title><style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a0f;color:#e5e7eb;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
.card{max-width:480px;text-align:center;background:#111827;padding:40px;border-radius:16px;border:1px solid #1f2937}
h1{margin:0 0 16px;font-size:24px}
p{color:#9ca3af;line-height:1.6}
</style></head><body><div class="card"><h1>Checkout canceled</h1><p>No charge was made. You can close this tab and try again from the ClipStream app whenever you're ready.</p></div></body></html>`;

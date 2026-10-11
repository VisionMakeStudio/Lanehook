// Starts Stripe Checkout and the Stripe billing portal for a signed-in person.
// Needs STRIPE_SECRET_KEY and SUPABASE_SERVICE_ROLE_KEY.
const { signedInUser } = require('./lib/auth');
const { getSettings, accountRow } = require('./lib/sb');
const stripe = require('./lib/stripe');
const json = (s, b) => ({ statusCode: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(b) });

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method' });
  const user = await signedInUser(event);
  if (!user) return json(401, { error: 'sign_in' });
  let b; try { b = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'bad_body' }); }
  const host = event.headers.host || event.headers.Host || 'lanehook.com';
  const origin = 'https://' + host.replace(/^localhost.*/, 'lanehook.com');
  try {
    const row = await accountRow(user.id);
    if (b.action === 'checkout') {
      const s = await getSettings();
      const plan = String(b.plan || ''), p = s.plans && s.plans[plan];
      if (s.earlyAccess) return json(400, { error: 'early_access' });
      if (!p || plan === 'free' || !p.available || !(p.price > 0)) return json(400, { error: 'bad_plan' });
      if (row && ['active', 'trialing', 'past_due'].includes(row.sub_status)) return json(409, { error: 'already_subscribed' });
      const params = {
        mode: 'subscription', client_reference_id: user.id, allow_promotion_codes: true,
        line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: Math.round(p.price * 100), recurring: { interval: 'month' }, product_data: { name: 'LaneHook ' + p.name } } }],
        metadata: { uid: user.id, plan }, subscription_data: { metadata: { uid: user.id, plan } },
        success_url: origin + '/app/?billing=success#/settings', cancel_url: origin + '/app/#/settings'
      };
      if (row && row.stripe_customer_id) params.customer = row.stripe_customer_id; else params.customer_email = user.email;
      const sess = await stripe.call('POST', 'checkout/sessions', params);
      return json(200, { url: sess.url });
    }
    if (b.action === 'portal') {
      if (!row || !row.stripe_customer_id) return json(400, { error: 'no_customer' });
      const sess = await stripe.call('POST', 'billing_portal/sessions', { customer: row.stripe_customer_id, return_url: origin + '/app/#/settings' });
      return json(200, { url: sess.url });
    }
    return json(400, { error: 'bad_action' });
  } catch (e) {
    return json(e.status === 503 ? 503 : 502, { error: e.message === 'not_configured' ? 'not_configured' : 'billing_failed' });
  }
};

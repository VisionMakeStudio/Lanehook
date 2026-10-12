// Starts Stripe Checkout, moves a subscription to a bigger plan, and opens the Stripe billing portal for a signed-in person.
// Needs STRIPE_SECRET_KEY and SUPABASE_SERVICE_ROLE_KEY.
const { signedInUser } = require('./lib/auth');
const { getSettings, accountRow, upsertAccount } = require('./lib/sb');
const stripe = require('./lib/stripe');
const json = (s, b) => ({ statusCode: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(b) });

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method' });
  const user = await signedInUser(event);
  if (!user) return json(401, { error: 'sign_in' });
  let b; try { b = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'bad_body' }); }
  const host = event.headers.host || event.headers.Host || 'lanehook.com';
  const origin = 'https://' + host.replace(/^localhost.*/, 'lanehook.com');
  const home = b.ret === 'dispatch' ? { ok: origin + '/dispatch/?billing=success', back: origin + '/dispatch/' } : { ok: origin + '/app/?billing=success#/settings', back: origin + '/app/#/settings' };
  try {
    const row = await accountRow(user.id);
    if (b.action === 'checkout') {
      const s = await getSettings();
      const plan = String(b.plan || ''), p = s.plans && s.plans[plan];
      if (s.earlyAccess) return json(400, { error: 'early_access' });
      if (!p || plan === 'free' || !p.available || !(p.price > 0)) return json(400, { error: 'bad_plan' });
      if (row && ['active', 'trialing', 'past_due'].includes(row.sub_status)) return json(409, { error: 'already_subscribed' });
      const trial = (!row || !row.stripe_subscription_id) ? Math.max(0, Math.min(30, parseInt(s.trialDays, 10) || 0)) : 0; // one trial per person
      const params = {
        mode: 'subscription', client_reference_id: user.id, allow_promotion_codes: true,
        line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: Math.round(p.price * 100), recurring: { interval: 'month' }, product_data: { name: 'LaneHook ' + p.name } } }],
        metadata: { uid: user.id, plan }, subscription_data: Object.assign({ metadata: { uid: user.id, plan } }, trial ? { trial_period_days: trial } : {}),
        success_url: home.ok, cancel_url: home.back
      };
      if (row && row.stripe_customer_id) params.customer = row.stripe_customer_id; else params.customer_email = user.email;
      const sess = await stripe.call('POST', 'checkout/sessions', params);
      return json(200, { url: sess.url });
    }
    if (b.action === 'change') {
      // move an active subscription up to a bigger plan, prorated by Stripe
      const s = await getSettings();
      const plan = String(b.plan || ''), p = s.plans && s.plans[plan];
      if (s.earlyAccess) return json(400, { error: 'early_access' });
      if (!p || !['crew', 'fleet'].includes(plan) || !p.available || !(p.price > 0)) return json(400, { error: 'bad_plan' });
      if (!row || !row.stripe_subscription_id || !['active', 'trialing', 'past_due'].includes(row.sub_status)) return json(409, { error: 'no_subscription' });
      if (row.plan === plan) return json(409, { error: 'same_plan' });
      const cents = Math.round(p.price * 100);
      if (cents <= Number(row.plan_amount || 0)) return json(409, { error: 'not_an_upgrade' });
      const sub = await stripe.call('GET', 'subscriptions/' + row.stripe_subscription_id);
      const item = sub.items && sub.items.data && sub.items.data[0];
      if (!item || ['canceled', 'incomplete_expired'].includes(sub.status)) return json(409, { error: 'no_subscription' });
      const prod = await stripe.call('POST', 'products', { name: 'LaneHook ' + p.name, metadata: { plan } });
      const upd = { items: [{ id: item.id, price_data: { currency: 'usd', product: prod.id, unit_amount: cents, recurring: { interval: 'month' } } }], proration_behavior: 'create_prorations', metadata: { uid: user.id, plan } };
      if (sub.cancel_at_period_end) upd.cancel_at_period_end = false;
      await stripe.call('POST', 'subscriptions/' + sub.id, upd);
      await upsertAccount(user.id, { plan, plan_amount: cents, cancel_at_period_end: false });
      return json(200, { ok: true });
    }
    if (b.action === 'portal') {
      if (!row || !row.stripe_customer_id) return json(400, { error: 'no_customer' });
      const sess = await stripe.call('POST', 'billing_portal/sessions', { customer: row.stripe_customer_id, return_url: home.back });
      return json(200, { url: sess.url });
    }
    return json(400, { error: 'bad_action' });
  } catch (e) {
    console.error('billing failed', e.status, e.message);
    return json(e.status === 503 ? 503 : 502, { error: e.message === 'not_configured' ? 'not_configured' : 'billing_failed', detail: e.message === 'not_configured' ? undefined : String(e.message || '').slice(0, 140) });
  }
};

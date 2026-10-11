// Receives Stripe events and keeps each account's plan, status and payments up to date.
// Needs STRIPE_WEBHOOK_SECRET, STRIPE_SECRET_KEY and SUPABASE_SERVICE_ROLE_KEY.
const crypto = require('crypto');
const { rest, accountRow, upsertAccount } = require('./lib/sb');
const stripe = require('./lib/stripe');
const ok = (b) => ({ statusCode: 200, body: JSON.stringify(b || { received: true }) });

function verify(raw, header, secret, tol = 300) {
  if (!header || !secret) return false;
  const parts = {}; String(header).split(',').forEach(p => { const i = p.indexOf('='); if (i > 0) (parts[p.slice(0, i)] = parts[p.slice(0, i)] || []).push(p.slice(i + 1)); });
  const t = (parts.t || [])[0]; if (!t || Math.abs(Date.now() / 1000 - Number(t)) > tol) return false;
  const exp = crypto.createHmac('sha256', secret).update(t + '.' + raw).digest('hex');
  return (parts.v1 || []).some(v => v.length === exp.length && crypto.timingSafeEqual(Buffer.from(v), Buffer.from(exp)));
}
const custId = c => (c && typeof c === 'object') ? c.id : c;
async function uidByCustomer(c) {
  if (!c) return null;
  const r = await rest('account_admin?stripe_customer_id=eq.' + encodeURIComponent(c) + '&select=user_id');
  const j = await r.json(); return (Array.isArray(j) && j[0] && j[0].user_id) || null;
}
async function uidForInvoice(o) {
  const sd = o.subscription_details || (o.parent && o.parent.subscription_details) || {};
  if (sd.metadata && sd.metadata.uid) return sd.metadata.uid;
  const byCust = await uidByCustomer(custId(o.customer)); if (byCust) return byCust;
  const sid = o.subscription || sd.subscription;
  if (sid) { try { const sub = await stripe.call('GET', 'subscriptions/' + (typeof sid === 'object' ? sid.id : sid)); return (sub.metadata && sub.metadata.uid) || null; } catch (e) { } }
  return null;
}
function subFields(sub, plan) {
  const item = sub.items && sub.items.data && sub.items.data[0];
  const unit = (item && item.price && item.price.unit_amount) || 0, qty = (item && item.quantity) || 1;
  const pe = sub.current_period_end || (item && item.current_period_end);
  const f = {
    stripe_customer_id: custId(sub.customer), stripe_subscription_id: sub.id, sub_status: sub.status,
    plan_amount: unit * qty, period_end: pe ? new Date(pe * 1000).toISOString() : null, cancel_at_period_end: !!sub.cancel_at_period_end
  };
  if (plan) f.plan = plan;
  return f;
}
async function addPayment(row) {
  const r = await rest('payments?on_conflict=id', { method: 'POST', headers: { prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(row) });
  if (!r.ok) throw new Error('db_' + r.status);
}

async function handle(ev) {
  const o = ev.data.object;
  switch (ev.type) {
    case 'checkout.session.completed': {
      if (o.mode !== 'subscription' || !o.subscription) return;
      const uid = o.client_reference_id || (o.metadata && o.metadata.uid); if (!uid) return;
      const sub = await stripe.call('GET', 'subscriptions/' + o.subscription);
      await upsertAccount(uid, subFields(sub, (o.metadata && o.metadata.plan) || (sub.metadata && sub.metadata.plan)));
      return;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const uid = (o.metadata && o.metadata.uid) || await uidByCustomer(custId(o.customer)); if (!uid) return;
      if (['canceled', 'incomplete_expired'].includes(o.status)) { await upsertAccount(uid, { ...subFields(o), plan: 'free', sub_status: 'canceled', plan_amount: 0, cancel_at_period_end: false }); return; }
      await upsertAccount(uid, subFields(o, o.metadata && o.metadata.plan));
      return;
    }
    case 'customer.subscription.deleted': {
      const uid = (o.metadata && o.metadata.uid) || await uidByCustomer(custId(o.customer)); if (!uid) return;
      await upsertAccount(uid, { plan: 'free', sub_status: 'canceled', plan_amount: 0, cancel_at_period_end: false });
      return;
    }
    case 'invoice.paid': {
      if (!(o.amount_paid > 0)) return;
      const uid = await uidForInvoice(o);
      const line = o.lines && o.lines.data && o.lines.data[0];
      const when = (o.status_transitions && o.status_transitions.paid_at) || o.created;
      await addPayment({ id: o.id, user_id: uid, amount: o.amount_paid, currency: o.currency || 'usd', kind: 'payment', note: (line && line.description) || 'Subscription', created_at: new Date(when * 1000).toISOString() });
      return;
    }
    case 'invoice.payment_failed': {
      const uid = await uidByCustomer(custId(o.customer)); if (!uid) return;
      const row = await accountRow(uid); if (row && row.sub_status !== 'canceled') await upsertAccount(uid, { sub_status: 'past_due' });
      return;
    }
    case 'charge.refunded': {
      const uid = await uidByCustomer(custId(o.customer));
      await addPayment({ id: 'refund_' + o.id, user_id: uid, amount: -(o.amount_refunded || 0), currency: o.currency || 'usd', kind: 'refund', note: 'Refund', created_at: new Date((o.created || Date.now() / 1000) * 1000).toISOString() });
      return;
    }
  }
}

exports.verify = verify;
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'method' };
  const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
  const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  if (!verify(raw, sig, process.env.STRIPE_WEBHOOK_SECRET)) return { statusCode: 400, body: 'bad signature' };
  let ev; try { ev = JSON.parse(raw); } catch (e) { return { statusCode: 400, body: 'bad body' }; }
  try { await handle(ev); return ok(); }
  catch (e) { console.error('webhook failed', ev.type, e.message); return { statusCode: 500, body: 'retry' }; }
};

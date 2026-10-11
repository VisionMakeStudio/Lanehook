// Owner-only account management for LaneHook. Needs SUPABASE_SERVICE_ROLE_KEY in Netlify.
// Optional: ADMIN_EMAILS (comma separated). Defaults to the studio email.
const { signedInUser } = require('./lib/auth');
const stripe = require('./lib/stripe');
const { getSettings, accountRow } = require('./lib/sb');
const SB = 'https://hsjmtkqzdkcpyfaygxpb.supabase.co';
const json = (s, b) => ({ statusCode: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(b) });
const PLANS = ['free', 'solo', 'crew', 'fleet', 'comped'];


const str = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n);
function cleanSettings(d) {
  const out = { earlyAccess: !!d.earlyAccess, trialDays: Math.max(0, Math.min(30, parseInt(d.trialDays, 10) || 0)), plans: {} };
  let pop = false;
  ['solo', 'crew', 'fleet'].forEach(k => {
    const p = (d.plans || {})[k] || {};
    const feats = (Array.isArray(p.features) ? p.features : []).map(f => str(f, 80)).filter(Boolean).slice(0, 10);
    const popular = !!p.popular && !pop; if (popular) pop = true;
    out.plans[k] = {
      name: str(p.name, 24) || k[0].toUpperCase() + k.slice(1),
      price: Math.max(1, Math.min(9999, Math.round(Number(p.price) || 1))),
      tagline: str(p.tagline, 60), available: !!p.available, popular, features: feats
    };
  });
  const ga = String(d.gaId || '').trim().toUpperCase(); out.gaId = /^G-[A-Z0-9]{6,14}$/.test(ga) ? ga : '';
  return out;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method' });
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!svc) return json(503, { error: 'not_configured' });
  const me = await signedInUser(event);
  if (!me) return json(401, { error: 'sign_in' });
  const admins = (process.env.ADMIN_EMAILS || 'info@visionmakestudio.com').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!me.email || !admins.includes(me.email.toLowerCase()) || !(me.email_confirmed_at || me.confirmed_at)) return json(403, { error: 'not_admin' });

  let b; try { b = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'bad_body' }); }
  // New-style secret keys (sb_secret_...) are not JWTs, so they go in the apikey header only.
  const H = { apikey: svc, 'content-type': 'application/json' };
  if (!svc.startsWith('sb_secret_')) H.authorization = 'Bearer ' + svc;
  const id = String(b.id || '');
  const needId = () => /^[0-9a-f-]{36}$/i.test(id);

  try {
    if (b.action === 'list' || b.action === 'overview') {
      let users = [];
      for (let page = 1; page <= 10; page++) {
        const r = await fetch(SB + '/auth/v1/admin/users?page=' + page + '&per_page=200', { headers: H });
        if (!r.ok) return json(502, { error: 'auth_' + r.status });
        const d = await r.json(); const u = d.users || [];
        users = users.concat(u); if (u.length < 200) break;
      }
      const ov = await fetch(SB + '/rest/v1/rpc/admin_overview', { method: 'POST', headers: H, body: '{}' });
      if (!ov.ok) return json(502, { error: 'overview_' + ov.status });
      const map = {}; (await ov.json()).forEach(o => { map[o.user_id] = o; });
      const now = Date.now();
      const out = {
        me: me.email,
        alerts: !!process.env.RESEND_API_KEY, stripe: { key: !!process.env.STRIPE_SECRET_KEY, webhook: !!process.env.STRIPE_WEBHOOK_SECRET, test: /^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY || '') },
        users: users.map(u => { const o = map[u.id] || {}; return {
          id: u.id, email: u.email, created: u.created_at, last: u.last_sign_in_at, confirmed: !!u.email_confirmed_at,
          disabled: !!(u.banned_until && Date.parse(u.banned_until) > now),
          synced: o.state_updated_at || null, loads: o.loads || 0, docs: o.docs || 0, biz: o.biz || '', mc: o.mc || '', plan: o.plan || 'free', notes: o.notes || '',
          status: o.sub_status || '', amount: o.plan_amount || 0, renews: o.period_end || null, cancels: !!o.cancel_at_period_end, customer: o.stripe_customer_id || ''
        }; })
      };
      if (b.action === 'overview') {
        out.settings = await getSettings();
        const pr = await fetch(SB + '/rest/v1/payments?select=id,user_id,amount,currency,kind,note,created_at&order=created_at.desc&limit=500', { headers: H });
        out.payments = pr.ok ? await pr.json() : [];
      }
      return json(200, out);
    }
    if (b.action === 'settings_save') {
      const c = cleanSettings(b.settings || {});
      const r = await fetch(SB + '/rest/v1/site_settings?on_conflict=id', { method: 'POST', headers: { ...H, prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id: 1, data: c, updated_at: new Date().toISOString() }) });
      return r.ok ? json(200, { ok: true, settings: c }) : json(502, { error: 'db_' + r.status });
    }
    if (b.action === 'gift') {
      const em = String(b.email || '').trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(em) || em.length > 120) return json(400, { error: 'bad_email' });
      let uid = null;
      const cr = await fetch(SB + '/auth/v1/admin/users', { method: 'POST', headers: H, body: JSON.stringify({ email: em, email_confirm: true, app_metadata: { signup_notified: true } }) });
      if (cr.ok) { const u = await cr.json(); uid = u.id; }
      else {
        for (let page = 1; page <= 10 && !uid; page++) {
          const lr = await fetch(SB + '/auth/v1/admin/users?page=' + page + '&per_page=200', { headers: H }); if (!lr.ok) break;
          const lj = await lr.json(); const u = (lj.users || []).find(x => (x.email || '').toLowerCase() === em); if (u) uid = u.id; if (!(lj.users || []).length) break;
        }
      }
      if (!uid) return json(502, { error: 'gift_failed' });
      const r = await fetch(SB + '/rest/v1/account_admin?on_conflict=user_id', { method: 'POST', headers: { ...H, prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ user_id: uid, plan: 'comped', updated_at: new Date().toISOString() }) });
      if (!r.ok) return json(502, { error: 'db_' + r.status });
      if (b.send) await fetch(SB + '/auth/v1/otp', { method: 'POST', headers: { apikey: process.env.SUPABASE_ANON_KEY || 'sb_publishable_a0uKjOLnATsVJ4G-Iti7Cg_jbVgHcxZ', 'content-type': 'application/json' }, body: JSON.stringify({ email: em, create_user: false }) }).catch(() => {});
      return json(200, { ok: true, id: uid });
    }
    if (!needId()) return json(400, { error: 'bad_id' });

    if (b.action === 'plan') {
      if (!['free', 'comped'].includes(b.plan)) return json(400, { error: 'bad_plan' });
      const r = await fetch(SB + '/rest/v1/account_admin?on_conflict=user_id', { method: 'POST', headers: { ...H, prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ user_id: id, plan: b.plan, updated_at: new Date().toISOString() }) });
      return r.ok ? json(200, { ok: true }) : json(502, { error: 'db_' + r.status });
    }
    if (b.action === 'note') {
      const r = await fetch(SB + '/rest/v1/account_admin?on_conflict=user_id', { method: 'POST', headers: { ...H, prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ user_id: id, notes: String(b.notes || '').slice(0, 2000), updated_at: new Date().toISOString() }) });
      return r.ok ? json(200, { ok: true }) : json(502, { error: 'db_' + r.status });
    }
    if (b.action === 'disable' || b.action === 'enable') {
      if (id === me.id) return json(400, { error: 'self' });
      const r = await fetch(SB + '/auth/v1/admin/users/' + id, { method: 'PUT', headers: H, body: JSON.stringify({ ban_duration: b.action === 'disable' ? '876000h' : 'none' }) });
      return r.ok ? json(200, { ok: true }) : json(502, { error: 'auth_' + r.status });
    }
    if (b.action === 'mail') {
      // normal sign-in email, sent to the subscriber; nothing is handed to the admin
      const r = await fetch(SB + '/auth/v1/otp', { method: 'POST', headers: { apikey: process.env.SUPABASE_ANON_KEY || 'sb_publishable_a0uKjOLnATsVJ4G-Iti7Cg_jbVgHcxZ', 'content-type': 'application/json' }, body: JSON.stringify({ email: String(b.email || ''), create_user: false }) });
      return r.ok ? json(200, { ok: true }) : json(502, { error: 'auth_' + r.status });
    }
    if (b.action === 'cancel_sub') {
      const row = await accountRow(id);
      if (!row || !row.stripe_subscription_id) return json(400, { error: 'no_subscription' });
      await stripe.call('POST', 'subscriptions/' + row.stripe_subscription_id, { cancel_at_period_end: true });
      await fetch(SB + '/rest/v1/account_admin?user_id=eq.' + id, { method: 'PATCH', headers: H, body: JSON.stringify({ cancel_at_period_end: true }) });
      return json(200, { ok: true });
    }
    if (b.action === 'delete') {
      try { const row = await accountRow(id); if (row && row.stripe_subscription_id && ['active', 'trialing', 'past_due'].includes(row.sub_status)) await stripe.call('DELETE', 'subscriptions/' + row.stripe_subscription_id); } catch (e) { /* keep going: the account is still deleted */ }
      if (id === me.id) return json(400, { error: 'self' });
      // remove stored photos and documents first
      const ls = await fetch(SB + '/storage/v1/object/list/files', { method: 'POST', headers: H, body: JSON.stringify({ prefix: id, limit: 1000 }) });
      if (ls.ok) { const names = (await ls.json()).map(o => id + '/' + o.name); if (names.length) await fetch(SB + '/storage/v1/object/files', { method: 'DELETE', headers: H, body: JSON.stringify({ prefixes: names }) }); }
      await fetch(SB + '/rest/v1/user_state?user_id=eq.' + id, { method: 'DELETE', headers: H });
      const r = await fetch(SB + '/auth/v1/admin/users/' + id, { method: 'DELETE', headers: H });
      return r.ok ? json(200, { ok: true }) : json(502, { error: 'auth_' + r.status });
    }
    return json(400, { error: 'bad_action' });
  } catch (e) { return json(e.message === 'not_configured' ? 503 : 502, { error: e.message === 'not_configured' ? 'stripe_not_configured' : 'failed' }); }
};

'use strict';
/* LaneHook driver portal: plans, free-plan limit, and Stripe checkout */
(function () {
  try { const p = new URLSearchParams(location.search).get('plan'); if (/^(solo|crew|fleet)$/.test(p || '')) localStorage.setItem('lh-want-plan', p); } catch (e) { }
  const billingBack = (() => { try { return new URLSearchParams(location.search).get('billing') === 'success'; } catch (e) { return false; } })();

  const P = LH.plans = { cfg: null, mine: null, loaded: false };
  const money = n => '$' + (Number(n) % 1 ? Number(n).toFixed(2) : Number(n) || 0);
  const when = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

  P.load = async function () {
    if (!LH.auth || !LH.auth.sb || !LH.auth.user) return;
    const sb = LH.auth.sb, before = JSON.stringify([P.cfg, P.mine]);
    try {
      const [a, b] = await Promise.all([sb.from('site_settings').select('data').eq('id', 1).maybeSingle(), sb.rpc('my_plan')]);
      if (a && a.data && a.data.data) P.cfg = a.data.data;
      const row = b && b.data && (Array.isArray(b.data) ? b.data[0] : b.data);
      if (row) P.mine = row;
    } catch (e) { }
    P.loaded = true;
    if (JSON.stringify([P.cfg, P.mine]) !== before) P.refreshView();
  };
  P.refreshView = function () {
    const r = LH.route && LH.route(), ae = document.activeElement;
    if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return;
    if (r && (r.name === 'settings' || r.name === 'home' || (r.name === 'load' && r.id === 'new'))) LH.render();
  };

  /* is this person allowed paid features right now? Fails open if we cannot tell. */
  P.early = () => !P.cfg || P.cfg.earlyAccess !== false;
  P.paid = () => {
    const m = P.mine; if (!m) return false;
    return m.plan === 'comped' || (m.plan && m.plan !== 'free' && ['active', 'trialing', 'past_due'].includes(m.sub_status));
  };
  P.loadsThisMonth = () => {
    const d = new Date(); const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    return (LH.S.loads || []).filter(l => (l.created || 0) >= start).length;
  };
  P.limit = () => (P.cfg && Number(P.cfg.freeLoadLimit)) || 0;
  P.limitReached = () => !P.early() && !P.paid() && P.limit() > 0 && P.loadsThisMonth() >= P.limit();
  LH.isPaid = P.paid; LH.freeLimitReached = P.limitReached;

  P.paidPlans = () => ['solo', 'crew', 'fleet'].filter(k => P.cfg && P.cfg.plans && P.cfg.plans[k] && P.cfg.plans[k].available && P.cfg.plans[k].price > 0);

  P.go = async function (action, plan) {
    LH.toast('One moment…', 6000);
    try {
      const res = await fetch('/.netlify/functions/billing', { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, await LH.auth.headers()), body: JSON.stringify({ action, plan }) });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.url) { location.href = j.url; return; }
      LH.toast({ already_subscribed: 'You already have a plan. Use Manage billing.', early_access: 'Everything is free right now.', not_configured: 'Billing is not set up yet.', no_customer: 'No billing account yet.' }[j.error] || 'Could not open billing. Try again in a minute.', 4000);
    } catch (e) { LH.toast('You appear to be offline.', 3500); }
  };
  P.start = async function () {
    let want = null; try { want = localStorage.getItem('lh-want-plan'); } catch (e) { }
    if (billingBack) { LH.toast('Thanks. Your plan is being activated.', 5000); [3000, 8000, 15000].forEach(t => setTimeout(() => P.load(), t)); }
    await P.load();
    if (!want) return;
    try { localStorage.removeItem('lh-want-plan'); } catch (e) { }
    if (P.early() || P.paid() || !P.paidPlans().includes(want)) return;
    P.go('checkout', want);
  };

  P.sheet = function (why) {
    const ps = P.paidPlans();
    const body = (why ? `<p class="muted" style="margin:0 0 14px">${esc(why)}</p>` : '') + (ps.length ? ps.map(k => {
      const p = P.cfg.plans[k];
      return `<div class="card" style="margin-bottom:10px"><div class="row"><div class="t sp"><b>${esc(p.name)}</b> ${p.popular ? '<span class="badge blue">Most popular</span>' : ''}<div class="muted" style="font-size:14px">${esc(p.tagline || '')}</div></div><b style="font-size:20px">${money(p.price)}<span class="muted" style="font-size:13px;font-weight:500">/mo</span></b></div>
        <ul class="muted" style="margin:10px 0 12px;padding-left:18px;font-size:14px;line-height:1.6">${(p.features || []).map(f => `<li>${esc(f)}</li>`).join('')}</ul>
        <button class="btn pri block" data-act="checkout" data-plan="${k}">Choose ${esc(p.name)}</button></div>`;
    }).join('') : '<p class="muted">No paid plans are open right now.</p>') + '<p class="muted" style="font-size:13px;margin:6px 0 0">Secure payment by Stripe. Cancel any time from Settings.</p>';
    LH.openSheet('Choose a plan', body, { noFocus: true });
  };
  LH.acts.upgrade = () => P.sheet();
  LH.acts.checkout = el => { LH.closeSheet(); P.go('checkout', el.dataset.plan); };
  LH.acts.manageBilling = () => P.go('portal');

  /* plan card shown in Settings under the account card */
  P.card = function () {
    if (!LH.auth || LH.auth.local || !LH.auth.user || !P.cfg) return '';
    const m = P.mine || {}, plans = P.cfg.plans || {}, key = m.plan || 'free', p = plans[key] || { name: key === 'comped' ? 'Complimentary' : 'Free' };
    let line, badge = '';
    if (key === 'comped') { line = 'Full access, on us.'; badge = '<span class="badge ok">Active</span>'; }
    else if (key === 'free' || !m.sub_status) {
      line = P.early() ? 'Everything is free while LaneHook is in early access.' : `${P.loadsThisMonth()} of ${P.limit() || 'unlimited'} loads used this month.`;
    } else if (m.cancel_at_period_end) { line = 'Cancels on ' + when(m.period_end) + '. You keep access until then.'; badge = '<span class="badge warn">Canceling</span>'; }
    else if (m.sub_status === 'past_due') { line = 'Your last payment did not go through. Update your card to keep access.'; badge = '<span class="badge bad">Payment issue</span>'; }
    else if (['active', 'trialing'].includes(m.sub_status)) { line = 'Renews ' + when(m.period_end) + '.'; badge = '<span class="badge ok">Active</span>'; }
    else { line = 'Your plan ended.'; badge = '<span class="badge">Ended</span>'; }
    const acts = [];
    if (m.has_customer) acts.push('<button class="btn sm" data-act="manageBilling">Manage billing</button>');
    if (!P.early() && !P.paid() && P.paidPlans().length) acts.push('<button class="btn sm pri" data-act="upgrade">Upgrade</button>');
    return `<div class="card"><h3>Your plan</h3><div class="row"><div class="t sp"><b>${esc(p.name)}</b> ${badge}<div class="muted" style="font-size:14px">${esc(line)}</div></div></div>${acts.length ? `<div class="row wrap" style="margin-top:12px">${acts.join('')}</div>` : ''}</div>`;
  };
  const baseCard = LH.accountCard;
  LH.accountCard = function () { const a = baseCard(); return a ? a + P.card() : a; };

  /* new-load screen when the free limit is used up */
  const baseLoad = LH.pages.load;
  LH.pages.load = function (r) {
    if (r.id === 'new' && P.limitReached()) {
      const ps = P.paidPlans();
      return { title: 'New load', back: 'loads', html: LH.empty('You have used your free loads', `The Free plan includes ${P.limit()} loads a month. ${ps.length ? 'Upgrade to keep adding loads.' : 'Your count starts over next month.'}`, (ps.length ? '<button class="btn pri" data-act="upgrade">See plans</button> ' : '') + '<a class="btn" href="#/loads">Back to loads</a>') };
    }
    return baseLoad(r);
  };
})();

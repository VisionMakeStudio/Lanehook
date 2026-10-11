'use strict';
/* LaneHook driver portal: plans, free trial, and Stripe checkout. No free plan: when early access is off, a plan is needed to use the portal. */
(function () {
  try { const p = new URLSearchParams(location.search).get('plan'); if (/^(solo|crew|fleet)$/.test(p || '')) localStorage.setItem('lh-want-plan', p); } catch (e) { }
  const billingBack = (() => { try { return new URLSearchParams(location.search).get('billing') === 'success'; } catch (e) { return false; } })();
  const P = LH.plans = { cfg: null, mine: null, loaded: false, activating: billingBack, uid: null };
  const money = n => '$' + (Number(n) % 1 ? Number(n).toFixed(2) : Number(n) || 0);
  const when = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const ckey = () => 'lh-open-' + (LH.auth.user && LH.auth.user.id);

  P.early = () => !P.cfg || P.cfg.earlyAccess !== false;
  P.paid = () => {
    const m = P.mine; if (!m) return false;
    return m.plan === 'comped' || (['solo', 'crew', 'fleet'].includes(m.plan) && ['active', 'trialing', 'past_due'].includes(m.sub_status));
  };
  P.trialDays = () => Math.max(0, parseInt(P.cfg && P.cfg.trialDays, 10) || 0);
  P.trialEligible = () => P.trialDays() > 0 && !(P.mine && P.mine.has_customer);
  P.paidPlans = () => ['solo', 'crew', 'fleet'].filter(k => P.cfg && P.cfg.plans && P.cfg.plans[k] && P.cfg.plans[k].available && P.cfg.plans[k].price > 0);
  LH.isPaid = P.paid;

  /* 'unknown' until we have asked the server, then 'open' or 'locked'. Fails open if we cannot tell. */
  P.state = () => {
    if (!LH.auth || LH.auth.local || !LH.auth.user) return 'open';
    if (P.uid !== LH.auth.user.id) { P.uid = LH.auth.user.id; P.known = null; P.mine = null; }
    if (P.known) return P.known;
    let c = null; try { c = localStorage.getItem(ckey()); } catch (e) { }
    return c === '1' ? 'open' : 'unknown';
  };
  P.settle = () => {
    P.known = (!P.cfg || P.early() || P.paid()) ? 'open' : 'locked';
    try { if (P.known === 'open') localStorage.setItem(ckey(), '1'); else localStorage.removeItem(ckey()); } catch (e) { }
  };

  P.load = async function () {
    if (!LH.auth || !LH.auth.sb || !LH.auth.user) return;
    const sb = LH.auth.sb, before = P.state() + JSON.stringify([P.cfg, P.mine]);
    try {
      const run = Promise.all([sb.from('site_settings').select('data').eq('id', 1).maybeSingle(), sb.rpc('my_plan')]);
      const [a, b] = await Promise.race([run, new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 4000))]);
      if (a && a.data && a.data.data) P.cfg = a.data.data;
      const row = b && b.data && (Array.isArray(b.data) ? b.data[0] : b.data);
      if (row) P.mine = row;
    } catch (e) { }
    P.loaded = true; P.settle();
    if (P.state() + JSON.stringify([P.cfg, P.mine]) !== before) P.refreshView();
  };
  P.refreshView = function () {
    const ae = document.activeElement;
    if (P.state() === 'open' && ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return;
    LH.render();
  };

  P.go = async function (action, plan) {
    LH.toast('One moment…', 6000);
    try {
      const res = await fetch('/.netlify/functions/billing', { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, await LH.auth.headers()), body: JSON.stringify({ action, plan }) });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.url) { location.href = j.url; return; }
      LH.toast({ already_subscribed: 'You already have a plan. Use Manage billing.', early_access: 'Everything is free right now.', not_configured: 'Billing is not set up yet.', no_customer: 'No billing account yet.' }[j.error] || 'Could not open billing. Try again in a minute.', 4500);
    } catch (e) { LH.toast('You appear to be offline.', 3500); }
  };
  P.start = async function () {
    P.known = null; let want = null; try { want = localStorage.getItem('lh-want-plan'); } catch (e) { }
    const meta = LH.auth.user && LH.auth.user.user_metadata && LH.auth.user.user_metadata.want_plan;
    if (!want && /^(solo|crew|fleet)$/.test(meta || '')) want = meta;
    if (billingBack) { [3000, 6000, 10000, 15000, 22000, 30000].forEach(t => setTimeout(async () => { if (P.state() !== 'open') await P.load(); }, t)); setTimeout(() => { P.activating = false; if (P.state() !== 'open') LH.render(); }, 40000); }
    await P.load();
    if (!want) return;
    try { localStorage.removeItem('lh-want-plan'); } catch (e) { }
    if (meta) { try { LH.auth.sb.auth.updateUser({ data: { want_plan: null } }); } catch (e) { } }
    if (P.early() || P.paid() || !P.paidPlans().includes(want) || P.activating) return;
    P.go('checkout', want);
  };

  /* ---------- full-screen screens shown instead of the portal ---------- */
  const logo = () => (document.documentElement.dataset.theme === 'light' ? 'icons/wordmark-nav-dark.svg' : 'icons/wordmark-nav.svg');
  const shell = body => { $('#app').innerHTML = `<div class="auth"><div class="auth-card"><img class="auth-logo" src="${logo()}" alt="LaneHook">${body}</div></div>`; };
  P.showLoading = () => shell('<p class="muted"><span class="spin"></span> Loading your account…</p>');
  P.showWall = function () {
    if (P.activating) { shell('<h1>Setting up your plan</h1><p class="muted"><span class="spin"></span> This takes a few seconds. You will go straight in.</p>'); return; }
    const ps = P.paidPlans(), trial = P.trialEligible(), td = P.trialDays();
    const list = ps.map(k => {
      const p = P.cfg.plans[k];
      return `<div class="card" style="margin:0 0 12px"><div class="row"><div class="t sp"><b>${esc(p.name)}</b> ${p.popular ? '<span class="badge blue">Most popular</span>' : ''}<div class="muted" style="font-size:14px">${esc(p.tagline || '')}</div></div><b style="font-size:22px">${money(p.price)}<span class="muted" style="font-size:13px;font-weight:500">/mo</span></b></div>
        <ul class="muted" style="margin:10px 0 14px;padding-left:18px;font-size:14px;line-height:1.6">${(p.features || []).map(f => `<li>${esc(f)}</li>`).join('')}</ul>
        <button class="btn pri block" data-act="checkout" data-plan="${k}">${trial ? `Start ${td}-day free trial` : 'Subscribe to ' + esc(p.name)}</button></div>`;
    }).join('');
    const ended = P.mine && P.mine.has_customer;
    shell(`<h1>${trial ? 'Start your free trial' : (ended ? 'Welcome back' : 'Choose a plan')}</h1>
      <p class="muted" style="margin:0 0 18px">${trial ? `Try LaneHook free for ${td} days. You enter a card now and are charged after the trial. Cancel any time before then and you pay nothing.` : 'Pick a plan to use LaneHook. Cancel any time.'}</p>
      ${list || '<div class="card"><b>Plans are not open yet.</b><p class="muted" style="margin:6px 0 0">Check back soon.</p></div>'}
      <p class="muted" style="font-size:13px;margin:4px 0 14px">Secure payment by Stripe. Signed in as ${esc((LH.auth.user && LH.auth.user.email) || '')}.</p>
      <div class="row wrap">${ended ? '<button class="btn sm" data-act="manageBilling">Manage billing</button>' : ''}<button class="btn sm" data-act="signOut">Sign out</button></div>`);
  };
  /* called at the top of LH.render: returns true when it drew a screen instead of the portal */
  P.gate = function () {
    const s = P.state();
    if (s === 'open') return false;
    if (s === 'unknown') { P.showLoading(); if (!P.loaded) P.load(); return true; }
    P.showWall(); return true;
  };

  LH.acts.upgrade = () => { if (P.state() === 'locked') P.showWall(); };
  LH.acts.checkout = el => { LH.closeSheet(); P.go('checkout', el.dataset.plan); };
  LH.acts.manageBilling = () => P.go('portal');

  /* plan card shown in Settings */
  P.card = function () {
    if (!LH.auth || LH.auth.local || !LH.auth.user || !P.cfg) return '';
    const m = P.mine || {}, plans = P.cfg.plans || {}, key = m.plan || 'free', p = plans[key] || { name: key === 'comped' ? 'Complimentary' : 'No plan' };
    let line, badge = '';
    if (key === 'comped') { line = 'Full access, on us.'; badge = '<span class="badge ok">Active</span>'; }
    else if (m.sub_status === 'trialing') { line = (m.cancel_at_period_end ? 'Your trial ends ' : 'Free trial ends ') + when(m.period_end) + (m.cancel_at_period_end ? '. You will not be charged.' : '. Then ' + money(p.price) + ' a month.'); badge = '<span class="badge blue">Free trial</span>'; }
    else if (!m.sub_status || key === 'free') { line = P.early() ? 'Everything is free while LaneHook is in early access.' : 'No plan yet.'; }
    else if (m.cancel_at_period_end) { line = 'Cancels on ' + when(m.period_end) + '. You keep access until then.'; badge = '<span class="badge warn">Canceling</span>'; }
    else if (m.sub_status === 'past_due') { line = 'Your last payment did not go through. Update your card to keep access.'; badge = '<span class="badge bad">Payment issue</span>'; }
    else if (m.sub_status === 'active') { line = 'Renews ' + when(m.period_end) + '.'; badge = '<span class="badge ok">Active</span>'; }
    else { line = 'Your plan ended.'; badge = '<span class="badge">Ended</span>'; }
    return `<div class="card"><h3>Your plan</h3><div class="row"><div class="t sp"><b>${esc(p.name)}</b> ${badge}<div class="muted" style="font-size:14px">${esc(line)}</div></div></div>${m.has_customer ? '<div class="row wrap" style="margin-top:12px"><button class="btn sm" data-act="manageBilling">Manage billing</button></div>' : ''}</div>`;
  };
  const baseCard = LH.accountCard;
  LH.accountCard = function () { const a = baseCard(); return a ? a + P.card() : a; };
})();

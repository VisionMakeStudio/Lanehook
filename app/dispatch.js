'use strict';
/* LaneHook driver portal: loads from your dispatcher, and joining a company with a code */
(function () {
  try { const c = new URLSearchParams(location.search).get('join'); if (/^[A-Za-z0-9]{4,10}$/.test(c || '')) localStorage.setItem('lh-join-code', c.toUpperCase()); } catch (e) { }
  const D = LH.disp = { data: null, joining: false, busy: false };
  const money = n => '$' + (Number(n) % 1 ? Number(n).toFixed(2) : Number(n) || 0);
  const ERR = { bad_code: 'That code was not found. Check it with your dispatcher.', in_company: 'You are already in a company. Leave it first.', company_full: 'That company has no open driver seats right now.', company_inactive: 'That company\'s plan is not active.', own_company: 'That is your own company code.', locked: 'That load has already moved on.', not_found: 'That load is no longer available.', sign_in: 'Please sign in again.' };
  const msg = e => ERR[(e && e.message) || ''] || 'Something went wrong. Try again.';
  const STATUS = { assigned: ['New', 'blue'], accepted: ['Accepted', 'ok'], picked_up: ['Picked up', 'warn'], delivered: ['Delivered', 'ok'], canceled: ['Canceled', 'bad'], open: ['Open', ''] };
  const when = s => { const d = s ? new Date(s) : null; return d && !isNaN(d) ? d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''; };

  async function rpc(name, args) {
    if (!LH.auth || !LH.auth.sb) return { error: { message: 'sign_in' } };
    try { return await LH.auth.sb.rpc(name, args || {}); } catch (e) { return { error: { message: 'network' } }; }
  }
  function apply(r) {
    if (r && r.data) { D.data = r.data; const rt = LH.route(); if (rt.name === 'dispatch') LH.render(); }
  }
  D.load = async function () { if (!LH.auth || !LH.auth.user) return; const r = await rpc('driver_overview'); apply(r); };
  D.join = async function (code) {
    code = String(code || '').trim().toUpperCase(); if (!code) { LH.toast('Enter the code from your dispatcher'); return false; }
    D.busy = true; const r = await rpc('join_company', { p_code: code }); D.busy = false;
    if (r.error) { LH.toast(msg(r.error), 4500); return false; }
    D.data = r.data; LH.toast('You joined ' + ((r.data.company || {}).name || 'the company')); if (LH.plans && LH.plans.load) await LH.plans.load(); return true;
  };
  D.start = async function () {
    let code = null; try { code = localStorage.getItem('lh-join-code'); } catch (e) { }
    if (code) {
      D.joining = true; try { localStorage.removeItem('lh-join-code'); } catch (e) { }
      const ok = await D.join(code); D.joining = false;
      if (ok) { location.hash = '#/dispatch'; return; }
    }
    D.load();
  };

  /* ---------- page ---------- */
  function loadCard(l) {
    const d = l.data || {}, st = STATUS[l.status] || ['', ''];
    const mine = (LH.S.loads || []).some(x => x.dispatchId === l.id);
    const acts = [];
    if (l.status === 'assigned') acts.push(`<button class="btn sm pri" data-act="dispStatus" data-id="${esc(l.id)}" data-v="accepted">Accept</button>`, `<button class="btn sm" data-act="dispDecline" data-id="${esc(l.id)}">Decline</button>`);
    if (l.status === 'accepted') acts.push(`<button class="btn sm pri" data-act="dispStatus" data-id="${esc(l.id)}" data-v="picked_up">Picked up</button>`);
    if (l.status === 'picked_up') acts.push(`<button class="btn sm pri" data-act="dispStatus" data-id="${esc(l.id)}" data-v="delivered">Delivered</button>`);
    if (['accepted', 'picked_up', 'delivered'].includes(l.status) && !mine) acts.push(`<button class="btn sm" data-act="dispImport" data-id="${esc(l.id)}">Add to my loads</button>`);
    if (mine) acts.push('<span class="badge ok">In my loads</span>');
    const route = [d.pickCity, d.delivCity].filter(Boolean).join(' → ');
    return `<div class="card" style="margin:0 0 12px"><div class="row"><div class="t sp"><b>${esc(route || 'Load')}</b>${d.ref ? ` <span class="muted">#${esc(d.ref)}</span>` : ''}<div class="muted" style="font-size:14px">${esc([d.broker, d.rate ? money(d.rate) : '', d.miles ? d.miles + ' mi' : ''].filter(Boolean).join(' · '))}</div></div><span class="badge ${st[1]}">${esc(st[0])}</span></div>
      <div class="muted" style="font-size:14px;margin-top:8px;line-height:1.55">${d.pickTime ? 'Pickup ' + esc(when(d.pickTime)) + (d.pickAddr ? ' · ' + esc(d.pickAddr) : '') + '<br>' : ''}${d.delivTime ? 'Delivery ' + esc(when(d.delivTime)) + (d.delivAddr ? ' · ' + esc(d.delivAddr) : '') : ''}${d.brokerPhone ? '<br>Broker ' + esc(d.brokerPhone) : ''}${d.notes ? '<br>' + esc(d.notes) : ''}</div>
      ${acts.length ? `<div class="row wrap" style="margin-top:12px">${acts.join('')}</div>` : ''}</div>`;
  }
  LH.pages.dispatch = () => {
    const d = D.data;
    if (!d) return { title: 'Dispatch', html: '<p class="muted"><span class="spin"></span> Loading…</p>', after: () => D.load() };
    if (!d.company) return { title: 'Dispatch', html: `<div class="card"><h3>Join a company</h3><p class="muted" style="margin:6px 0 14px">If you drive for a company, enter the code your dispatcher gave you. Your dispatcher can then send you loads here.</p>
      <form id="joinForm" class="row"><input name="code" id="joinCode" autocomplete="off" autocapitalize="characters" maxlength="10" placeholder="Company code" aria-label="Company code" style="letter-spacing:.15em;text-transform:uppercase" required><button class="btn pri" type="submit">Join</button></form></div>
      <p class="muted" style="font-size:14px">Your own loads, invoices and documents stay private. Your dispatcher only sees loads they send you.</p>` };
    const ls = d.loads || [], active = ls.filter(l => ['assigned', 'accepted', 'picked_up'].includes(l.status)), done = ls.filter(l => !['assigned', 'accepted', 'picked_up'].includes(l.status));
    return { title: 'Dispatch', html: `<div class="card"><div class="row"><div class="t sp"><b>${esc(d.company.name)}</b><div class="muted" style="font-size:14px">${d.company.dispatcher_email ? 'Dispatcher ' + esc(d.company.dispatcher_email) : 'Your dispatcher'}</div></div>${d.company.active === false ? '<span class="badge bad">Inactive</span>' : ''}</div>
      <div class="row wrap" style="margin-top:12px"><button class="btn sm" data-act="dispLeave">Leave company</button></div></div>
      <div class="sec"><h2>Your loads from dispatch</h2></div>${active.length ? active.map(loadCard).join('') : LH.empty('Nothing assigned right now', 'Loads your dispatcher sends you will show up here.')}
      ${done.length ? `<div class="sec"><h2>Finished</h2></div>${done.slice(0, 20).map(loadCard).join('')}` : ''}` };
  };
  document.addEventListener('submit', e => { if (e.target.id !== 'joinForm') return; e.preventDefault(); LH.acts.joinCode(null, e.target.elements.code.value); });
  LH.acts.joinCode = async (el, code) => {
    if (code == null) { const i = $('#wallCode'); code = i ? i.value : ''; }
    const ok = await D.join(code);
    if (ok) { if (LH.plans) LH.plans.refreshView(); else LH.render(); }
  };
  LH.acts.dispStatus = async el => { const r = await rpc('driver_set_status', { p_id: el.dataset.id, p_status: el.dataset.v }); if (r.error) { LH.toast(msg(r.error), 3500); D.load(); } else { apply(r); LH.toast('Updated'); } };
  LH.acts.dispDecline = el => LH.ask('Decline this load?', 'It goes back to your dispatcher to give to someone else.', 'Decline', async () => { const r = await rpc('driver_decline', { p_id: el.dataset.id }); if (r.error) { LH.toast(msg(r.error), 3500); D.load(); } else apply(r); });
  LH.acts.dispLeave = () => LH.ask('Leave this company?', 'Loads you have not finished go back to your dispatcher. Your own loads stay.', 'Leave', async () => { const r = await rpc('leave_company'); if (r.error) LH.toast(msg(r.error), 3500); else { apply(r); if (LH.plans) await LH.plans.load(); } });
  LH.acts.dispImport = el => {
    const l = ((D.data && D.data.loads) || []).find(x => x.id === el.dataset.id); if (!l) return;
    const d = l.data || {}, t = s => { const n = s ? new Date(s).getTime() : 0; return isNaN(n) ? 0 : n; };
    const n = { id: uid(), created: Date.now(), stage: l.status === 'delivered' ? 'delivered' : l.status === 'picked_up' ? 'picked' : 'booked', photos: [], detention: [], extras: [], dispatchId: l.id,
      ref: d.ref || '', brokerName: d.broker || '', brokerMc: '', brokerEmail: '', brokerPhone: d.brokerPhone || '', rate: Number(d.rate) || 0, terms: 30, freeHours: 2, detRate: '', loaded: Number(d.miles) || 0, dead: 0, tolls: 0, otherCost: 0, notes: d.notes || '',
      pick: { name: '', city: d.pickCity || '', addr: d.pickAddr || '', time: t(d.pickTime) }, deliv: { name: '', city: d.delivCity || '', addr: d.delivAddr || '', time: t(d.delivTime) } };
    LH.S.loads.push(n); LH.save(); LH.toast('Added to your loads'); LH.go('load/' + n.id);
  };
})();

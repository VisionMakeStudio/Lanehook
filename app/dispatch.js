'use strict';
/* LaneHook driver portal: loads from your dispatcher, and joining a company with a code */
(function () {
  try { const c = new URLSearchParams(location.search).get('join'); if (/^[A-Za-z0-9]{4,10}$/.test(c || '')) localStorage.setItem('lh-join-code', c.toUpperCase()); } catch (e) { }
  const D = LH.disp = { data: null, joining: false, busy: false, ck: false };
  const money = n => '$' + (Number(n) % 1 ? Number(n).toFixed(2) : Number(n) || 0);
  const ERR = { too_fast: 'You just checked in. Wait a moment before you check in again.', bad_location: 'We could not read your location. Try again.', fleet_required: 'Check-ins are not turned on for your company.', company_inactive_chat: 'Messages are paused because the company plan is not active.', slow_down: 'Slow down a little, then send again.', bad_code: 'That code was not found. Check it with your dispatcher.', in_company: 'You are already in a company. Leave it first.', company_full: 'That company is full right now. Ask your dispatcher to upgrade their plan so you can join.', company_inactive: 'That company\'s plan is not active.', own_company: 'That is your own company code.', locked: 'That load has already moved on.', not_found: 'That load is no longer available.', sign_in: 'Please sign in again.' };
  const msg = e => ERR[(e && e.message) || ''] || 'Something went wrong. Try again.';
  const STATUS = { assigned: ['New', 'blue'], accepted: ['Accepted', 'ok'], picked_up: ['Picked up', 'warn'], delivered: ['Delivered', 'ok'], canceled: ['Canceled', 'bad'], open: ['Open', ''] };
  const when = s => { const d = s ? new Date(s) : null; return d && !isNaN(d) ? d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''; };

  async function rpc(name, args) {
    if (!LH.auth || !LH.auth.sb) return { error: { message: 'sign_in' } };
    try { return await LH.auth.sb.rpc(name, args || {}); } catch (e) { return { error: { message: 'network' } }; }
  }
  function apply(r) {
    if (r && r.data) { D.data = r.data; D.cleanShared(); const rt = LH.route(); if (rt.name === 'dispatch') LH.render(); }
  }
  D.load = async function () { if (!LH.auth || !LH.auth.user) return; const r = await rpc('driver_overview'); apply(r); D.loadCk(); };
  D.loadCk = async function () { if (!LH.auth || !LH.auth.user || !D.data || !D.data.company) { D.ck = false; return; } const r = await rpc('checkin_enabled'); const on = !r.error && r.data === true; if (on !== D.ck) { D.ck = on; const rt = LH.route(); if (rt.name === 'dispatch') LH.render(); } };
  D.join = async function (code) {
    code = String(code || '').trim().toUpperCase(); if (!code) { LH.toast('Enter the code from your dispatcher'); return false; }
    D.busy = true; const r = await rpc('join_company', { p_code: code }); D.busy = false;
    if (r.error) { LH.toast(msg(r.error), 4500); return false; }
    D.data = r.data; D.pollUnread(true); LH.toast('You joined ' + ((r.data.company || {}).name || 'the company')); if (LH.plans && LH.plans.load) await LH.plans.load(); return true;
  };
  D.start = async function () {
    let code = null; try { code = localStorage.getItem('lh-join-code'); } catch (e) { }
    if (code) {
      D.joining = true; try { localStorage.removeItem('lh-join-code'); } catch (e) { }
      const ok = await D.join(code); D.joining = false;
      if (ok) { location.hash = '#/dispatch'; return; }
    }
    await D.load(); D.pollUnread(true);
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
      ${D.ck ? `<div class="card"><h3>Check in</h3><p class="muted" style="margin:6px 0 12px;font-size:14px;line-height:1.5">Tap to tell your dispatcher where you are right now. It shares your location one time. LaneHook does not track you.</p><div class="row wrap"><button class="btn pri" data-act="dispCheckin">Check in</button><button class="btn sm" data-act="dispCkDelete">Delete my check-ins</button></div></div>` : ''}
      <div class="card chat"><h3>Messages</h3><div class="chat-log" id="chatLog" aria-live="polite"></div>
        <form id="chatForm" class="chat-form"><input name="body" id="chatBody" maxlength="1000" autocomplete="off" placeholder="Message your dispatcher" aria-label="Message your dispatcher"><button class="btn pri" type="submit">Send</button></form></div>
      <div class="sec"><h2>Your loads from dispatch</h2></div>${active.length ? active.map(loadCard).join('') : LH.empty('Nothing assigned right now', 'Loads your dispatcher sends you will show up here.')}
      ${done.length ? `<div class="sec"><h2>Finished</h2></div>${done.slice(0, 20).map(loadCard).join('')}` : ''}`, after: () => D.chatOpen() };
  };
  document.addEventListener('submit', e => { if (e.target.id !== 'joinForm') return; e.preventDefault(); LH.acts.joinCode(null, e.target.elements.code.value); });
  LH.acts.joinCode = async (el, code) => {
    if (code == null) { const i = $('#wallCode'); code = i ? i.value : ''; }
    const ok = await D.join(code);
    if (ok) { if (LH.plans) LH.plans.refreshView(); else LH.render(); }
  };
  LH.acts.dispStatus = async el => { const r = await rpc('driver_set_status', { p_id: el.dataset.id, p_status: el.dataset.v }); if (r.error) { LH.toast(msg(r.error), 3500); D.load(); } else { apply(r); LH.toast('Updated'); if (D.ck && (el.dataset.v === 'picked_up' || el.dataset.v === 'delivered')) setTimeout(() => LH.ask('Check in now?', 'Let your dispatcher see where you are.', 'Check in', () => D.checkin(el.dataset.v === 'picked_up' ? 'pickup' : 'delivery', el.dataset.id), false), 600); } };
  D.checkin = function (kind, loadId) {
    const s = LH.openSheet('Check in', `<p class="muted" style="margin:0 0 12px;font-size:14px;line-height:1.5">Your phone will ask to share your location. It is sent one time to your dispatcher, who can see it for 30 days. You can delete your check-ins anytime.</p>
      <label class="f"><span>Note (optional)</span><input id="ckNote" maxlength="200" placeholder="Loaded, heading out"></label>
      <label class="f"><span>ETA (optional)</span><input id="ckEta" maxlength="40" placeholder="3:30 PM"></label>
      <div class="grid2" style="margin-top:12px"><button class="btn" data-act="closeSheet">Cancel</button><button class="btn pri" id="ckGo">Share my location</button></div><p class="muted" id="ckMsg" style="font-size:14px;margin:10px 0 0"></p>`, { noFocus: true });
    const go = $('#ckGo', s), m = $('#ckMsg', s);
    go.onclick = () => {
      if (!navigator.geolocation) { m.textContent = 'This device cannot share its location.'; return; }
      go.disabled = true; m.textContent = 'Getting your location…';
      navigator.geolocation.getCurrentPosition(async pos => {
        const r = await rpc('driver_checkin', { p_lat: pos.coords.latitude, p_lng: pos.coords.longitude, p_note: $('#ckNote', s).value.trim(), p_eta: $('#ckEta', s).value.trim(), p_kind: kind || 'manual', p_load: loadId || null });
        if (r.error) { go.disabled = false; m.textContent = msg(r.error); return; }
        LH.closeSheet(); LH.toast('Checked in. Your dispatcher can see it.');
      }, err => { go.disabled = false; m.textContent = err && err.code === 1 ? 'Location is blocked. Allow location for this site in your phone settings, then try again.' : 'We could not get your location. Move to an open area and try again.'; }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 });
    };
  };
  LH.acts.dispCheckin = () => D.checkin('manual');
  LH.acts.dispCkDelete = () => LH.ask('Delete your check-ins?', 'This removes every check-in you have shared. Your dispatcher will no longer see them.', 'Delete', async () => { const r = await rpc('delete_my_checkins'); LH.toast(r.error ? msg(r.error) : 'Check-ins deleted', 3000); });
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

  /* ---------- sharing a load you booked yourself ---------- */
  const inCompany = () => !!(D.data && D.data.company);
  const iso = n => { const t = Number(n); return t ? new Date(t).toISOString() : ''; };
  D.canShare = l => inCompany() && !l.dispatchId;
  D.payload = l => {
    const st = LH.stage(l), status = st === 'booked' ? 'accepted' : st === 'picked' ? 'picked_up' : 'delivered';
    const data = { ref: l.ref || '', broker: l.brokerName || '', brokerPhone: l.brokerPhone || '', rate: Number(l.rate) || 0, miles: Number(l.loaded) || 0,
      pickCity: (l.pick || {}).city || '', pickAddr: (l.pick || {}).addr || '', pickTime: iso((l.pick || {}).time),
      delivCity: (l.deliv || {}).city || '', delivAddr: (l.deliv || {}).addr || '', delivTime: iso((l.deliv || {}).time) };
    return { data, status, sig: JSON.stringify([data, status]) };
  };
  D.share = async l => {
    const p = D.payload(l), r = await rpc('driver_share_load', { p_local: l.id, p_data: p.data, p_status: p.status });
    if (r.error) return r.error.message;
    l.shared = { sig: p.sig, at: Date.now() }; LH.persist(); return '';
  };
  D.unshare = async id => { await rpc('driver_unshare_load', { p_local: id }); };
  let syncT = null, syncing = false;
  D.scheduleShare = () => { clearTimeout(syncT); syncT = setTimeout(D.syncShared, 1500); };
  D.syncShared = async () => {
    if (syncing || !inCompany()) return; syncing = true;
    try {
      for (const l of (LH.S.loads || [])) {
        if (!l.shared || l.dispatchId) continue;
        const p = D.payload(l); if (l.shared.sig === p.sig) continue;
        const e = await D.share(l);
        if (e === 'no_company') { D.cleanShared(true); break; }
        if (e) break;
      }
    } finally { syncing = false; }
  };
  D.cleanShared = force => {
    if (!LH.S || !LH.S.loads) return; let ch = false;
    const keep = new Set(inCompany() && !force ? ((D.data && D.data.shared) || []) : []);
    LH.S.loads.forEach(l => { if (l.shared && !keep.has(l.id)) { delete l.shared; ch = true; } });
    if (ch) LH.persist();
  };
  const save0 = LH.save;
  LH.save = function () { save0.apply(this, arguments); if (inCompany()) D.scheduleShare(); };
  LH.acts.shareLoad = el => {
    const l = LH.load(el.dataset.id); if (!l) return;
    LH.ask('Share this load with your dispatcher?', 'They will see the route, broker, rate, miles, times and status, and it updates as you move the load along. Your notes, costs, profit, invoices and photos stay private.', 'Share', async () => {
      const e = await D.share(l);
      if (e) { LH.toast(e === 'company_inactive' ? msg({ message: 'company_inactive' }) : e === 'too_many' ? 'You have shared the maximum number of loads.' : msg({ message: e }), 4000); return; }
      LH.toast('Shared with your dispatcher'); LH.render();
    }, false);
  };
  LH.acts.unshareLoad = async el => {
    const l = LH.load(el.dataset.id); if (!l) return;
    await D.unshare(l.id); delete l.shared; LH.persist(); LH.toast('Stopped sharing'); LH.render();
  };

  /* ---------- chat with your dispatcher ---------- */
  D.msgs = []; D.draft = ''; D.unread = 0;
  const hm = s => { const d = s ? new Date(s) : null; return d && !isNaN(d) ? d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''; };
  D.paintNb = () => {
    $$('.nb').forEach(x => x.remove());
    if (!D.unread) return;
    const label = D.unread > 9 ? '9+' : String(D.unread);
    $$('.side a[href="#/dispatch"], .list a[href="#/dispatch"], .tabs a[href="#/more"]').forEach(a => { const b = document.createElement('b'); b.className = 'nb'; b.textContent = label; b.setAttribute('aria-label', D.unread + ' unread'); a.appendChild(b); });
  };
  D.setUnread = n => { n = Number(n) || 0; if (n !== D.unread) { D.unread = n; D.paintNb(); } };
  let upT = null;
  D.pollUnread = start => {
    if (start && !upT) upT = setInterval(() => D.pollUnread(), 20000);
    if (!inCompany() || document.hidden || !LH.auth || !LH.auth.user) return;
    if (LH.route().name === 'dispatch') return;
    rpc('chat_unread').then(r => { if (r && r.data) D.setUnread(r.data.total); });
  };
  const bubble = m => {
    const ld = m.load_id && ((D.data && D.data.loads) || []).find(x => x.id === m.load_id), dd = ld && ld.data;
    const re = dd ? `<span class="re">Re: ${esc([dd.pickCity, dd.delivCity].filter(Boolean).join(' → ') || 'load')}${dd.ref ? ' #' + esc(dd.ref) : ''}</span>` : '';
    return `<div class="bub ${m.mine ? 'me' : ''}">${re}${esc(m.body)}<small>${esc(hm(m.created_at))}</small></div>`;
  };
  D.paintChat = () => {
    const el = $('#chatLog'); if (!el) return;
    const atEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 60 || !el.children.length;
    el.innerHTML = D.msgs.length ? D.msgs.map(bubble).join('') : '<p class="muted" style="margin:0">No messages yet. Say hello to your dispatcher.</p>';
    if (atEnd) el.scrollTop = el.scrollHeight;
  };
  let chatT = null;
  D.chatPoll = async () => {
    if (LH.route().name !== 'dispatch' || !$('#chatLog')) { clearInterval(chatT); chatT = null; return; }
    if (document.hidden || !inCompany()) return;
    const last = D.msgs.length ? D.msgs[D.msgs.length - 1].id : 0;
    const r = await rpc('chat_messages', { p_driver: null, p_after: last, p_mark: true });
    if (r.error || !r.data) return;
    const fresh = (r.data.messages || []).filter(m => !D.msgs.some(x => x.id === m.id));
    if (fresh.length) { D.msgs = D.msgs.concat(fresh).slice(-200); D.paintChat(); }
    D.setUnread(0);
  };
  D.chatOpen = () => {
    const i = $('#chatBody'); if (i) { i.value = D.draft; i.addEventListener('input', () => { D.draft = i.value; }); }
    D.paintChat(); D.chatPoll();
    if (!chatT) chatT = setInterval(D.chatPoll, 4000);
  };
  document.addEventListener('submit', async e => {
    if (e.target.id !== 'chatForm') return; e.preventDefault();
    const i = e.target.elements.body, body = i.value.trim(), btn = e.target.querySelector('button'); if (!body || D.sending) return;
    D.sending = true; btn.disabled = true;
    const r = await rpc('chat_send', { p_driver: null, p_body: body, p_load: null });
    D.sending = false; btn.disabled = false;
    if (r.error) { const k = r.error.message; LH.toast(k === 'company_inactive' ? ERR.company_inactive_chat : (ERR[k] || 'Message not sent. Try again.'), 4000); return; }
    i.value = ''; D.draft = ''; await D.chatPoll(); i.focus();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { D.pollUnread(); D.chatPoll(); } });
})();

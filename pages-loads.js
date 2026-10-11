'use strict';
/* LaneHook driver portal: Home, Loads, load form, load detail, detention, paperwork, invoice, payment */
const toLocalInput = ts => { if (!ts) return ''; const d = new Date(ts), z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4); return z.toISOString().slice(0, 16); };
const fromLocalInput = v => v ? new Date(v).getTime() : 0;
LH.gps = () => new Promise(res => {
  if (!navigator.geolocation) return res(null);
  navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) }), () => res(null), { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 });
});
const stageBadge = l => { const s = LH.stage(l); return `<span class="badge ${s === 'paid' ? 'ok' : (s === 'delivered' ? 'warn' : (s === 'invoiced' ? 'blue' : ''))}">${LH.STAGE_LABEL[s]}</span>`; };
const loadRow = l => {
  const inv = LH.invoiceStatus(l), amt = l.invoice ? LH.invoiceTotal(l) : num(l.rate) + LH.extrasTotal(l);
  return `<a class="item" href="#/load/${l.id}"><div class="t"><b>${esc(LH.routeLabel(l))}</b><small>${esc(LH.loadLabel(l))}${l.brokerName ? ' · ' + esc(l.brokerName) : ''}${l.pick && l.pick.time ? ' · ' + fmtDay(isoDay(new Date(l.pick.time))) : ''}</small></div>
    <div style="text-align:end"><div class="amt mono">${money0(amt)}</div>${inv && inv.k !== 'paid' ? `<span class="badge ${inv.cls}">${esc(inv.label)}</span>` : stageBadge(l)}</div></a>`;
};

/* ---------------- HOME ---------------- */
LH.pages.home = () => {
  const S = LH.S, out = LH.outstanding(), over = out.filter(l => daysFrom(l.invoice.due) < 0);
  const outSum = out.reduce((s, l) => s + LH.invoiceTotal(l), 0), overSum = over.reduce((s, l) => s + LH.invoiceTotal(l), 0);
  const active = S.loads.filter(l => ['booked', 'picked'].includes(LH.stage(l)));
  const alerts = LH.alerts(), ad = LH.activeDetention();
  const mo = isoDay().slice(0, 7), paidMo = S.loads.filter(l => l.paidDate && l.paidDate.startsWith(mo)).reduce((s, l) => s + num(l.paidAmount || LH.invoiceTotal(l)), 0);
  const needSetup = !S.settings.bizName;
  const first = S.loads.length === 0;
  const quick = `<div class="grid2" style="margin-bottom:12px"><a class="btn pri" href="#/load/new">${ic('plus', 18)}New load</a><a class="btn" href="#/guard">${ic('shield', 18)}Check a broker</a></div>`;
  let html = '';
  html += `<div style="margin:2px 0 16px"><h1>${S.settings.bizName ? esc(S.settings.bizName) : 'Welcome'}</h1><div class="muted">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div></div>`;
  if (ad) {
    const e = ad.ev;
    html += `<a class="card link" href="#/load/${ad.load.id}" style="border-color:var(--bad)"><div class="row"><span class="badge bad">Detention running</span><span class="sp"></span><span class="muted">${esc(LH.loadLabel(ad.load))}</span></div><div class="timer" data-tick="${e.arrive}" style="margin-top:6px">${clock(Date.now() - e.arrive)}</div><div class="muted">Since ${fmtDT(e.arrive)} at ${e.stop === 'pick' ? 'pickup' : 'delivery'}</div></a>`;
  }
  html += quick;
  if (needSetup) html += `<a class="alert" href="#/settings"><i></i><div><b>Add your business details</b><small>Your name, MC number, and payment info go on every invoice.</small></div></a>`;
  html += `<div class="grid2 stats4" style="margin:8px 0 4px"><div class="stat"><span>Owed to you</span><b class="mono">${money0(outSum)}</b></div><div class="stat"><span>Overdue</span><b class="mono" style="${over.length ? 'color:var(--bad)' : ''}">${money0(overSum)}</b></div><div class="stat"><span>Active loads</span><b>${active.length}</b></div><div class="stat"><span>Paid this month</span><b class="mono">${money0(paidMo)}</b></div></div>`;
  if (alerts.length) html += `<div class="sec"><h2>Needs attention</h2><span class="muted">${alerts.length}</span></div>` + alerts.slice(0, 8).map(a => `<a class="alert ${a.cls}" href="${a.href}"><i></i><div><b>${esc(a.t)}</b><small>${esc(a.s)}</small></div></a>`).join('');
  if (active.length) html += `<div class="sec"><h2>Active loads</h2><a href="#/loads">All loads</a></div><div class="list">${active.slice(0, 4).map(loadRow).join('')}</div>`;
  if (first) html += LH.empty('No loads yet', 'Photograph a rate confirmation to add your first load. LaneHook checks the broker and starts tracking from there.', `<a class="btn pri" href="#/load/new">Add your first load</a>`);
  return { title: 'Home', logo: true, html, top: `<button class="icon-btn" data-act="toggleTheme" aria-label="Switch light or dark">${ic('sun')}</button>` };
};

/* ---------------- LOADS LIST ---------------- */
LH.loadFilter = 'active';
LH.acts.loadFilter = el => { LH.loadFilter = el.dataset.v; LH.render(); };
LH.pages.loads = () => {
  const F = [['active', 'Active'], ['toinv', 'To invoice'], ['unpaid', 'Unpaid'], ['paid', 'Paid'], ['all', 'All']];
  const pick = {
    active: l => ['booked', 'picked'].includes(LH.stage(l)), toinv: l => LH.stage(l) === 'delivered', unpaid: l => LH.stage(l) === 'invoiced', paid: l => LH.stage(l) === 'paid', all: () => true
  }[LH.loadFilter];
  const ls = LH.S.loads.filter(pick).sort((a, b) => (b.created || 0) - (a.created || 0));
  const chips = `<div class="chips" role="tablist">${F.map(f => `<button class="chip ${LH.loadFilter === f[0] ? 'on' : ''}" role="tab" aria-selected="${LH.loadFilter === f[0]}" data-act="loadFilter" data-v="${f[0]}">${f[1]}${f[0] !== 'all' ? ' ' + LH.S.loads.filter({ active: l => ['booked', 'picked'].includes(LH.stage(l)), toinv: l => LH.stage(l) === 'delivered', unpaid: l => LH.stage(l) === 'invoiced', paid: l => LH.stage(l) === 'paid' }[f[0]]).length : ''}</button>`).join('')}</div>`;
  const body = ls.length ? `<div class="list">${ls.map(loadRow).join('')}</div>` : LH.empty(LH.S.loads.length ? 'Nothing here' : 'No loads yet', LH.S.loads.length ? 'No loads match this filter.' : 'Add a load from a rate confirmation photo or by typing it in.', LH.S.loads.length ? '' : `<a class="btn pri" href="#/load/new">Add a load</a>`);
  return { title: 'Loads', html: chips + body, top: `<a class="btn pri sm" href="#/load/new">${ic('plus', 16)}New</a>` };
};

/* ---------------- LOAD FORM ---------------- */
LH.pendingRC = null;
const F = (name, label, v = '', o = {}) => `<label class="f"><span>${label}</span><input name="${name}" value="${esc(v)}" ${o.type ? `type="${o.type}"` : ''} ${o.mode ? `inputmode="${o.mode}"` : ''} ${o.ph ? `placeholder="${esc(o.ph)}"` : ''} ${o.step ? `step="${o.step}"` : ''} ${o.auto ? `autocomplete="${o.auto}"` : 'autocomplete="off"'} ${o.req ? 'required' : ''}></label>`;
const dec = v => (v === undefined || v === null || v === '' || num(v) === 0) ? '' : String(v);
function loadForm(l, isNew) {
  const s = LH.S.settings, p = l.pick || {}, d = l.deliv || {};
  return `<form id="loadForm" data-live="loadForm" autocomplete="off">
  ${isNew ? `<div class="card"><div class="row"><div class="t sp"><b>Scan the rate confirmation</b><div class="muted" style="font-size:14px">Take a photo or pick a PDF. LaneHook fills in what it can read. Check every field before saving.</div></div></div>
    <div class="row" style="margin-top:12px"><label class="btn blue" for="rcFile">${ic('cam', 18)}Scan or upload</label><input id="rcFile" type="file" accept="image/*,application/pdf" data-change="scanRC"><span id="rcState" class="muted"></span></div></div>` : ''}
  <div class="card"><h3>Broker</h3>
    ${F('brokerName', 'Company name', l.brokerName, { auto: 'organization' })}
    <div class="grid2">${F('brokerMc', 'MC number', l.brokerMc, { mode: 'numeric' })}${F('ref', 'Load / confirmation #', l.ref)}</div>
    <div class="grid2">${F('brokerEmail', 'Billing email', l.brokerEmail, { type: 'email', mode: 'email' })}${F('brokerPhone', 'Phone', l.brokerPhone, { type: 'tel', mode: 'tel' })}</div>
    <button type="button" class="btn sm" data-act="formGuard">${ic('shield', 16)}Check this broker</button><div id="formGuard" style="margin-top:12px"></div></div>
  <div class="card"><h3>Pickup</h3>${F('pickName', 'Place', p.name)}<div class="grid2 s1">${F('pickCity', 'City, state', p.city)}${F('pickTime', 'Appointment', toLocalInput(p.time), { type: 'datetime-local' })}</div>${F('pickAddr', 'Address (optional)', p.addr)}</div>
  <div class="card"><h3>Delivery</h3>${F('delivName', 'Place', d.name)}<div class="grid2 s1">${F('delivCity', 'City, state', d.city)}${F('delivTime', 'Appointment', toLocalInput(d.time), { type: 'datetime-local' })}</div>${F('delivAddr', 'Address (optional)', d.addr)}</div>
  <div class="card"><h3>Pay and terms</h3>
    <div class="grid2">${F('rate', 'Rate ($)', dec(l.rate), { mode: 'decimal', req: 1 })}${F('terms', 'Payment terms (days)', l.terms || s.terms || 30, { mode: 'numeric' })}</div>
    <div class="grid2">${F('freeHours', 'Free time (hours)', l.freeHours === undefined ? (s.defFree || 2) : l.freeHours, { mode: 'decimal' })}${F('detRate', 'Detention ($/hour)', dec(l.detRate === undefined ? s.defDet : l.detRate), { mode: 'decimal', ph: 'Not stated' })}</div>
    <div class="hint">If the rate confirmation does not mention detention, leave the rate empty and ask the broker before you accept.</div></div>
  <div class="card"><h3>Miles and costs</h3>
    <div class="grid2">${F('loaded', 'Loaded miles', dec(l.loaded), { mode: 'decimal' })}${F('dead', 'Empty miles to pickup', dec(l.dead), { mode: 'decimal' })}</div>
    <div class="grid2">${F('tolls', 'Tolls ($)', dec(l.tolls), { mode: 'decimal' })}${F('otherCost', 'Other costs ($)', dec(l.otherCost), { mode: 'decimal' })}</div>
    <div id="pp"></div></div>
  <label class="f"><span>Notes</span><textarea name="notes">${esc(l.notes || '')}</textarea></label>
  <button class="btn pri block" type="submit">${isNew ? 'Save load' : 'Save changes'}</button></form>`;
}
LH.pages.load = r => {
  if (r.id === 'new') { LH.pendingRC = LH.pendingRC && LH.pendingRC.keep ? LH.pendingRC : null; return { title: 'New load', back: 'loads', html: loadForm({}, true), after: () => LH.live.loadForm($('#loadForm')) }; }
  const l = LH.load(r.id); if (!l) return { title: 'Load', back: 'loads', html: LH.empty('Load not found', 'It may have been deleted.', '<a class="btn" href="#/loads">Back to loads</a>') };
  if (r.sub === 'edit') return { title: 'Edit load', back: 'load/' + l.id, html: loadForm(l, false), after: () => LH.live.loadForm($('#loadForm')) };
  return loadDetail(l);
};
LH.live = {
  loadForm(f) {
    if (!f) return; const o = LH.form(f), s = LH.S.settings;
    const p = LH.profit({ rate: o.rate, loaded: o.loaded, dead: o.dead, mpg: s.mpg, fuelPrice: s.fuelPrice, cpm: s.costPerMile, tolls: o.tolls, other: o.otherCost });
    const el = $('#pp', f); if (!el) return;
    if (!num(o.rate)) { el.innerHTML = ''; return; }
    const note = [];
    if (!p.miles) note.push('Add miles to see profit');
    else { if (!num(s.fuelPrice)) note.push('Set a fuel price in Settings for accurate profit'); }
    el.innerHTML = `<div class="stat" style="background:var(--surface2)"><span>Estimated profit</span><b class="mono" style="color:${p.profit < 0 ? 'var(--bad)' : 'var(--ok)'}">${p.miles ? money(p.profit) : '–'}</b><div class="muted" style="font-size:13px">${p.miles ? money(p.perMile) + '/mile · rate ' + money(p.revPerMile) + '/mile · fuel ' + money0(p.fuel) : ''}${note.length ? ' ' + esc(note.join('. ')) : ''}</div></div>`;
  }
};
document.addEventListener('input', e => { const f = e.target.closest('[data-live]'); if (f && LH.live[f.dataset.live]) LH.live[f.dataset.live](f); });
document.addEventListener('change', e => { const el = e.target.closest('[data-change]'); if (el && LH.acts[el.dataset.change]) LH.acts[el.dataset.change](el, e); });

LH.acts.scanRC = async el => {
  const file = el.files && el.files[0]; if (!file) return;
  const st = $('#rcState'); st.innerHTML = '<span class="spin"></span> Reading…';
  try {
    const { blob, type } = await LH.prepFile(file, 1700);
    LH.pendingRC = { blob, type, name: file.name || 'Rate confirmation', keep: true };
    const data = await LH.fileToBase64(blob);
    const res = await fetch('/.netlify/functions/ratecon', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data, media: type }) });
    if (res.status === 404) { st.textContent = 'Auto-read is not set up yet. The file is attached. Type the details in.'; return; }
    const j = await res.json().catch(() => null);
    if (!res.ok || !j || !j.ok) { st.textContent = (j && j.error === 'not_configured') ? 'Auto-read is not set up yet. The file is attached. Type the details in.' : 'Could not read that file. It is attached. Type the details in.'; return; }
    const x = j.data || {}, f = $('#loadForm'), set = (n, v) => { if (v !== undefined && v !== null && v !== '' && f.elements[n]) f.elements[n].value = v; };
    set('brokerName', x.broker_name); set('brokerMc', cleanMC(x.broker_mc)); set('brokerEmail', x.broker_email); set('brokerPhone', x.broker_phone); set('ref', x.load_number);
    set('pickName', x.pickup_name); set('pickCity', x.pickup_city); set('pickAddr', x.pickup_address); set('pickTime', x.pickup_time && x.pickup_time.slice(0, 16));
    set('delivName', x.delivery_name); set('delivCity', x.delivery_city); set('delivAddr', x.delivery_address); set('delivTime', x.delivery_time && x.delivery_time.slice(0, 16));
    set('rate', x.rate); set('loaded', x.miles); set('freeHours', x.free_hours); set('detRate', x.detention_rate); set('terms', x.payment_terms_days);
    if (x.notes) set('notes', x.notes);
    LH.live.loadForm(f); st.textContent = 'Read complete. Check every field.';
    if (cleanMC(x.broker_mc)) LH.acts.formGuard();
  } catch (e) { st.textContent = 'Could not read that file. It is attached. Type the details in.'; }
};
LH.acts.formGuard = async () => {
  const f = $('#loadForm'), box = $('#formGuard'), mc = cleanMC(f.elements.brokerMc.value);
  if (!mc) { box.innerHTML = '<div class="muted">Enter the MC number first.</div>'; return; }
  box.innerHTML = '<span class="spin"></span> Checking MC ' + esc(mc) + '…';
  const r = await LH.runGuard(mc, f.elements.brokerName.value);
  box.innerHTML = LH.guardSummary(r, mc);
  if (r.snap && r.snap.phone && !f.elements.brokerPhone.value) { }
};

document.addEventListener('submit', e => {
  const f = e.target; if (f.id !== 'loadForm') return;
  e.preventDefault(); saveLoadForm(f);
});
async function saveLoadForm(f) {
  const o = LH.form(f), r = LH.route(), isNew = r.id === 'new';
  if (!num(o.rate)) { toast('Enter the rate'); return; }
  const l = isNew ? { id: uid(), created: Date.now(), stage: 'booked', photos: [], detention: [], extras: [] } : LH.load(r.id);
  Object.assign(l, {
    ref: o.ref, brokerName: o.brokerName, brokerMc: cleanMC(o.brokerMc), brokerEmail: o.brokerEmail, brokerPhone: o.brokerPhone,
    rate: num(o.rate), terms: num(o.terms) || 30, freeHours: o.freeHours === '' ? 2 : num(o.freeHours), detRate: o.detRate === '' ? '' : num(o.detRate),
    loaded: num(o.loaded), dead: num(o.dead), tolls: num(o.tolls), otherCost: num(o.otherCost), notes: o.notes,
    pick: { name: o.pickName, city: o.pickCity, addr: o.pickAddr, time: fromLocalInput(o.pickTime) || 0 },
    deliv: { name: o.delivName, city: o.delivCity, addr: o.delivAddr, time: fromLocalInput(o.delivTime) || 0 }
  });
  if (isNew) {
    LH.S.loads.push(l);
    if (LH.pendingRC) { const id = uid(); await LH.putBlob(id, LH.pendingRC.blob); l.photos.push({ id, kind: 'Rate con', ts: Date.now(), type: LH.pendingRC.type, name: LH.pendingRC.name }); LH.pendingRC = null; }
  }
  if (l.brokerMc) {
    const b = LH.S.brokers[l.brokerMc] || (LH.S.brokers[l.brokerMc] = { mc: l.brokerMc });
    b.name = b.name || l.brokerName; b.email = b.email || l.brokerEmail; b.phone = b.phone || l.brokerPhone;
  }
  LH.save(); toast(isNew ? 'Load saved' : 'Changes saved'); LH.go('load/' + l.id);
}

/* ---------------- LOAD DETAIL ---------------- */
function loadDetail(l) {
  const st = LH.stage(l), si = LH.stageIdx(l), inv = LH.invoiceStatus(l), pr = LH.loadProfit(l), mcs = cleanMC(l.brokerMc), bk = LH.S.brokers[mcs];
  const next = { booked: ['Mark picked up', 'picked'], picked: ['Mark delivered', 'delivered'], delivered: ['Create invoice', 'invoice'], invoiced: ['Mark paid', 'paid'] }[st];
  const menu = [{ label: 'Edit load', act: 'goEdit', id: l.id, icon: 'edit' }, { label: 'Add extra charge', act: 'addExtra', id: l.id, icon: 'plus' }, { label: 'Check broker', act: 'guardLoad', id: l.id, icon: 'shield' }, st !== 'booked' && !l.invoice ? { label: 'Move back one step', act: 'stageBack', id: l.id, icon: 'back' } : null, { label: 'Delete load', act: 'delLoad', id: l.id, icon: 'trash', bad: 1 }];
  const hdr = `<div class="card">
    <div class="row"><h2 class="sp">${esc(LH.routeLabel(l))}</h2>${stageBadge(l)}</div>
    <div class="steps" aria-hidden="true">${LH.STAGES.map((s, i) => `<i class="${i <= si ? 'on' : ''}"></i>`).join('')}</div>
    <dl class="kv"><dt>Load</dt><dd>${esc(l.ref || '–')}</dd><dt>Broker</dt><dd>${esc(l.brokerName || '–')}${mcs ? ' · MC ' + esc(mcs) : ''}</dd>
    <dt>Pickup</dt><dd>${esc((l.pick && l.pick.name) || '–')}${l.pick && l.pick.time ? '<br><small class="muted">' + fmtDT(l.pick.time) + '</small>' : ''}</dd>
    <dt>Delivery</dt><dd>${esc((l.deliv && l.deliv.name) || '–')}${l.deliv && l.deliv.time ? '<br><small class="muted">' + fmtDT(l.deliv.time) + '</small>' : ''}</dd>
    <dt>Rate</dt><dd class="mono">${money(l.rate)}${LH.extrasTotal(l) ? ' + ' + money(LH.extrasTotal(l)) + ' extra' : ''}</dd></dl>
    ${(l.extras || []).length ? `<div style="margin-top:10px">${l.extras.map((x, i) => `<div class="row" style="min-height:36px"><span class="sp">${esc(x.label)}</span><b class="mono">${money(x.amount)}</b><button class="icon-btn" style="width:36px;height:36px" data-act="delExtra" data-id="${l.id}" data-v="${i}" aria-label="Remove">${ic('x', 16)}</button></div>`).join('')}</div>` : ''}
    <div class="row wrap" style="margin-top:12px">${mcs ? `<button class="btn sm" data-act="guardLoad" data-id="${l.id}">${ic('shield', 16)}${bk && bk.checkedAt ? 'Checked ' + fmtDay(isoDay(new Date(bk.checkedAt))) : 'Check broker'}</button>` : ''}${bk && bk.flag ? `<span class="badge ${bk.flag === 'good' ? 'ok' : (bk.flag === 'slow' ? 'warn' : 'bad')}">${{ good: 'Good payer', slow: 'Slow payer', avoid: 'Avoid' }[bk.flag]}</span>` : ''}</div>
    ${next ? `<button class="btn pri block" style="margin-top:14px" data-act="advance" data-id="${l.id}">${next[0]}</button>` : ''}
    ${st === 'delivered' && !(l.photos || []).some(p => p.kind === 'POD') ? `<div class="hint" style="margin:10px 0 0">Add a photo of the signed POD before you invoice.</div>` : ''}</div>`;
  const profit = `<div class="card"><h3>Profit on this load</h3>
    <div class="big mono" style="color:${pr.profit < 0 ? 'var(--bad)' : 'var(--ok)'}">${pr.miles ? money(pr.profit) : '–'}</div>
    <div class="muted">${pr.miles ? money(pr.perMile) + ' per mile over ' + Math.round(pr.miles).toLocaleString() + ' miles' : 'Edit the load and add miles to see profit.'}</div>
    ${pr.miles ? `<dl class="kv" style="margin-top:12px"><dt>Revenue</dt><dd class="mono">${money(pr.rev)}</dd><dt>Fuel</dt><dd class="mono">${pr.mpgMissing ? 'Set MPG' : '−' + money(pr.fuel)}</dd><dt>Tolls and other</dt><dd class="mono">−${money(pr.tolls + pr.other)}</dd>${pr.run ? `<dt>Running cost</dt><dd class="mono">−${money(pr.run)}</dd>` : ''}</dl>` : ''}</div>`;
  return { title: LH.loadLabel(l), back: 'loads', top: LH.menuBtn(menu), html: `<div class="cols"><div>${hdr}${detentionCard(l)}</div><div>${invoiceCard(l, inv)}${paperworkCard(l)}${profit}${l.notes ? `<div class="card"><h3>Notes</h3><div style="white-space:pre-wrap">${esc(l.notes)}</div></div>` : ''}</div></div>` };
}
LH.acts.goEdit = el => LH.go('load/' + el.dataset.id + '/edit');
LH.acts.guardLoad = async el => { const l = LH.load(el.dataset.id); if (!l.brokerMc) { toast('Add the broker MC number first'); LH.go('load/' + l.id + '/edit'); return; } LH.guardSheet(cleanMC(l.brokerMc), l.brokerName, l.id); };
LH.acts.stageBack = el => { const l = LH.load(el.dataset.id), i = LH.STAGES.indexOf(l.stage || 'booked'); if (i > 0) { l.stage = LH.STAGES[i - 1]; LH.save(); LH.render(); } };
LH.acts.delLoad = el => ask('Delete this load?', 'The load, its photos, and its detention record will be removed from this device. This cannot be undone.', 'Delete', async () => {
  const l = LH.load(el.dataset.id); for (const p of (l.photos || [])) await LH.delBlob(p.id);
  LH.S.loads = LH.S.loads.filter(x => x.id !== l.id); LH.save(); toast('Load deleted'); LH.go('loads');
});
LH.acts.advance = el => {
  const l = LH.load(el.dataset.id), st = LH.stage(l);
  if (st === 'booked') { l.stage = 'picked'; l.pickedAt = Date.now(); } else if (st === 'picked') { l.stage = 'delivered'; l.deliveredAt = Date.now(); }
  else if (st === 'delivered') return LH.invoiceSheet(l); else if (st === 'invoiced') return LH.paidSheet(l);
  LH.save(); LH.render();
};
LH.acts.addExtra = el => {
  const l = LH.load(el.dataset.id);
  const s = openSheet('Extra charge', `<form id="exForm"><label class="f"><span>What for</span><select name="label"><option>Lumper</option><option>Layover</option><option>TONU (truck ordered, not used)</option><option>Extra stop</option><option>Fuel surcharge</option><option>Other</option></select></label><label class="f"><span>Amount ($)</span><input name="amount" inputmode="decimal" required></label><button class="btn pri block">Add charge</button></form>`);
  $('#exForm', s).onsubmit = e => { e.preventDefault(); const o = LH.form(e.target); if (!num(o.amount)) return; (l.extras = l.extras || []).push({ label: o.label, amount: num(o.amount) }); LH.save(); closeSheet(); LH.render(); };
};
LH.acts.delExtra = el => { const l = LH.load(el.dataset.id); l.extras.splice(+el.dataset.v, 1); LH.save(); LH.render(); };

/* ---------------- DETENTION ---------------- */
function detentionCard(l) {
  const d = LH.detention(l), noTerms = !(num(l.detRate) > 0);
  const stop = (key, label) => {
    const ev = d.events.find(e => e.stop === key), name = l[key] && l[key].name;
    let body;
    if (!ev) body = `<button class="btn block" data-act="arrive" data-id="${l.id}" data-v="${key}">${ic('pin', 18)}I've arrived</button>`;
    else if (ev.active) {
      const inFree = ev.ms < d.free;
      body = `<div class="timer" data-tick="${ev.arrive}">${clock(Date.now() - ev.arrive)}</div>
        <div class="muted" style="margin-bottom:12px">${inFree ? 'Free time ends ' + fmtDT(ev.arrive + d.free) : 'Detention started ' + fmtDT(ev.arrive + d.free)}${ev.arriveGps ? ' · GPS saved' : ''}</div>
        <button class="btn pri block" data-act="depart" data-id="${l.id}" data-v="${key}">${ic('check', 18)}I'm leaving</button>`;
    } else body = `<dl class="kv"><dt>Arrived</dt><dd>${fmtDT(ev.arrive)}</dd><dt>Left</dt><dd>${fmtDT(ev.depart)}</dd><dt>Time there</dt><dd>${fmtHM(ev.ms)}</dd><dt>Billable</dt><dd>${fmtHM(ev.billMs)}</dd><dt>Owed</dt><dd class="mono" style="color:${ev.owed > 0 ? 'var(--ok)' : 'inherit'}">${money(ev.owed)}</dd></dl>
        <div class="row" style="margin-top:8px"><span class="muted">${ev.arriveGps ? 'GPS saved' : 'No GPS reading'}</span><span class="sp"></span><button class="btn sm" data-act="editDet" data-id="${l.id}" data-v="${ev.i}">Edit times</button></div>`;
    return `<div style="padding:12px 0;border-top:1px solid var(--border)"><div class="row" style="margin-bottom:8px"><b class="sp">${label}${name ? ' · ' + esc(name) : ''}</b></div>${body}</div>`;
  };
  const done = d.events.some(e => !e.active);
  return `<div class="card"><div class="row"><h3 class="sp" style="margin:0">Detention</h3>${d.owed > 0 ? `<span class="badge ok">${money(d.owed)}</span>` : ''}</div>
    <div class="muted" style="font-size:14px;margin-top:4px">${num(l.freeHours)} hr free${noTerms ? '. No hourly rate on this load, so ask the broker before relying on it' : ', then ' + money(d.rate) + ' per hour'}.</div>
    <div style="margin-top:10px">${stop('pick', 'Pickup')}${stop('deliv', 'Delivery')}</div>
    ${done ? `<div class="row wrap" style="margin-top:6px"><button class="btn sm" data-act="copyClaim" data-id="${l.id}">Copy claim</button><button class="btn sm" data-act="shareClaim" data-id="${l.id}">${ic('send', 16)}Share</button></div>` : ''}</div>`;
}
LH.acts.arrive = async el => {
  const l = LH.load(el.dataset.id), key = el.dataset.v;
  if ((l.detention || []).some(e => e.stop === key)) return;
  const ev = { stop: key, arrive: Date.now(), depart: 0 }; (l.detention = l.detention || []).push(ev); LH.save(); LH.render();
  const g = await LH.gps(); if (g) { ev.arriveGps = g; LH.save(); }
};
LH.acts.depart = async el => {
  const l = LH.load(el.dataset.id), ev = l.detention.find(e => e.stop === el.dataset.v); if (!ev || ev.depart) return;
  ev.depart = Date.now(); LH.save(); LH.render(); const g = await LH.gps(); if (g) { ev.departGps = g; LH.save(); }
  const d = LH.detention(l); if (d.owed > 0) toast('Detention owed so far: ' + money(d.owed));
};
LH.acts.editDet = el => {
  const l = LH.load(el.dataset.id), ev = l.detention[+el.dataset.v];
  const s = openSheet('Edit times', `<form id="detForm"><label class="f"><span>Arrived</span><input type="datetime-local" name="a" value="${toLocalInput(ev.arrive)}" required></label><label class="f"><span>Left</span><input type="datetime-local" name="d" value="${toLocalInput(ev.depart)}" required></label><p class="hint">Edited times are marked as edited in the claim, so a broker can see they were changed.</p><div class="grid2"><button type="button" class="btn bad" id="detDel">Remove</button><button class="btn pri">Save</button></div></form>`);
  $('#detForm', s).onsubmit = e => { e.preventDefault(); const o = LH.form(e.target), a = fromLocalInput(o.a), dd = fromLocalInput(o.d); if (dd <= a) { toast('Leaving time must be after arrival'); return; } if (a !== ev.arrive || dd !== ev.depart) ev.edited = true; ev.arrive = a; ev.depart = dd; LH.save(); closeSheet(); LH.render(); };
  $('#detDel', s).onclick = () => { l.detention.splice(+el.dataset.v, 1); LH.save(); closeSheet(); LH.render(); };
};
const claimOf = l => LH.claimText(l) + ((l.detention || []).some(e => e.edited) ? '\n\nNote: some times were edited by the driver.' : '');
LH.acts.copyClaim = async el => { const t = claimOf(LH.load(el.dataset.id)); try { await navigator.clipboard.writeText(t); toast('Claim copied'); } catch (e) { const s = openSheet('Detention claim', `<textarea style="min-height:260px" readonly>${esc(t)}</textarea>`); } };
LH.acts.shareClaim = async el => { const t = claimOf(LH.load(el.dataset.id)); if (navigator.share) { try { await navigator.share({ title: 'Detention claim', text: t }); } catch (e) { } } else LH.acts.copyClaim(el); };

/* ---------------- PAPERWORK ---------------- */
const PHOTO_KINDS = ['BOL', 'POD', 'Rate con', 'Pickup photo', 'Delivery photo', 'Damage', 'Receipt', 'Other'];
function paperworkCard(l) {
  const ps = l.photos || [];
  return `<div class="card"><div class="row"><h3 class="sp" style="margin:0">Paperwork and photos</h3><button class="btn sm" data-act="addPhoto" data-id="${l.id}">${ic('cam', 16)}Add</button></div>
    ${ps.length ? `<div class="thumbs" style="margin-top:12px">${ps.map(p => `<button class="thumb" data-act="viewPhoto" data-id="${l.id}" data-v="${p.id}" aria-label="${esc(p.kind)}">${p.type === 'application/pdf' ? '<div class="pdfmark">PDF</div>' : `<img alt="" data-blob="${p.id}">`}<small>${esc(p.kind)}</small></button>`).join('')}</div>
    <div class="row wrap" style="margin-top:12px"><button class="btn sm" data-act="sharePaper" data-id="${l.id}">${ic('send', 16)}Share paperwork</button></div>` : `<div class="muted" style="margin-top:6px">Scan the BOL at pickup and the signed POD at delivery. Photos of damage go here too.</div>`}</div>`;
}
LH.acts.addPhoto = el => {
  const l = LH.load(el.dataset.id), def = LH.stage(l) === 'booked' ? 'Pickup photo' : (LH.stage(l) === 'picked' ? 'BOL' : 'POD');
  const s = openSheet('Add photo', `<label class="f"><span>What is it</span><select id="phKind">${PHOTO_KINDS.map(k => `<option ${k === def ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
    <label class="f" id="phNoteWrap" style="display:none"><span>Describe the damage</span><input id="phNote"></label>
    <div class="grid2"><label class="btn pri" for="phCam">${ic('cam', 18)}Take photo</label><label class="btn" for="phFile">Choose file</label></div>
    <input id="phCam" type="file" accept="image/*" capture="environment"><input id="phFile" type="file" accept="image/*,application/pdf" multiple>`, { noFocus: true });
  const kind = $('#phKind', s); kind.onchange = () => { $('#phNoteWrap', s).style.display = kind.value === 'Damage' ? 'block' : 'none'; };
  const go = async inp => {
    const files = [...inp.files]; if (!files.length) return; s.querySelector('.sheet').insertAdjacentHTML('beforeend', '<div class="muted" style="margin-top:12px"><span class="spin"></span> Saving…</div>');
    for (const f of files) { const { blob, type } = await LH.prepFile(f); const id = uid(); await LH.putBlob(id, blob); (l.photos = l.photos || []).push({ id, kind: kind.value, ts: Date.now(), type, name: f.name || kind.value, note: $('#phNote', s).value.trim() }); }
    LH.save(); closeSheet(); toast('Saved'); LH.render();
  };
  $('#phCam', s).onchange = e => go(e.target); $('#phFile', s).onchange = e => go(e.target);
};
LH.acts.viewPhoto = async el => {
  const l = LH.load(el.dataset.id), p = l.photos.find(x => x.id === el.dataset.v); if (!p) return;
  const s = openSheet(p.kind, `${p.type === 'application/pdf' ? `<a class="btn block" target="_blank" rel="noopener" data-blob-href="${p.id}">Open PDF</a>` : `<img style="width:100%;border-radius:12px" alt="${esc(p.kind)}" data-blob="${p.id}">`}
    <div class="muted" style="margin:10px 0">${fmtDT(p.ts)}${p.note ? ' · ' + esc(p.note) : ''}</div><div class="grid2"><a class="btn" download="${esc((l.ref || 'load') + '-' + p.kind + (p.type === 'application/pdf' ? '.pdf' : '.jpg'))}" data-blob-href="${p.id}">${ic('down', 16)}Save</a><button class="btn bad" id="phDel">Delete</button></div>`, { noFocus: true });
  $('#phDel', s).onclick = async () => { await LH.delBlob(p.id); l.photos = l.photos.filter(x => x.id !== p.id); LH.save(); closeSheet(); LH.render(); };
};
LH.acts.sharePaper = async el => {
  const l = LH.load(el.dataset.id), files = [];
  for (const p of (l.photos || []).filter(x => ['BOL', 'POD', 'Rate con'].includes(x.kind))) { const b = await LH.getBlob(p.id); if (b) files.push(new File([b], (l.ref || 'load') + '-' + p.kind + (p.type === 'application/pdf' ? '.pdf' : '.jpg'), { type: p.type })); }
  if (!files.length) { toast('No BOL, POD, or rate confirmation to share yet'); return; }
  if (navigator.canShare && navigator.canShare({ files })) { try { await navigator.share({ files, title: 'Paperwork for load ' + (l.ref || ''), text: 'Paperwork for load ' + (l.ref || '') }); } catch (e) { } }
  else toast('Sharing files is not available here. Open each photo and save it.');
};

/* ---------------- INVOICE ---------------- */
function invoiceCard(l, inv) {
  if (!l.invoice) {
    const ready = LH.stage(l) === 'delivered';
    return `<div class="card"><h3>Invoice and payment</h3><div class="muted">${ready ? 'This load is delivered. Create the invoice and send it today.' : 'You can invoice once the load is delivered.'}</div>${ready ? `<button class="btn pri block" style="margin-top:12px" data-act="advance" data-id="${l.id}">Create invoice</button>` : ''}</div>`;
  }
  return `<div class="card"><div class="row"><h3 class="sp" style="margin:0">Invoice ${esc(l.invoice.no)}</h3><span class="badge ${inv.cls}">${esc(inv.label)}</span></div>
    <div class="big mono" style="margin:8px 0 4px">${money(LH.invoiceTotal(l))}</div>
    <dl class="kv"><dt>Issued</dt><dd>${fmtDay(l.invoice.date)}</dd><dt>Due</dt><dd>${fmtDay(l.invoice.due)}</dd><dt>Sent</dt><dd>${l.invoice.sent ? fmtDay(isoDay(new Date(l.invoice.sent))) : 'Not yet'}</dd>${l.paidDate ? `<dt>Paid</dt><dd>${fmtDay(l.paidDate)} · ${money(l.paidAmount)}</dd>` : ''}</dl>
    <div class="row wrap" style="margin-top:12px"><button class="btn sm" data-act="viewInvoice" data-id="${l.id}">View and send</button>${!l.paidDate ? `<button class="btn sm" data-act="remind" data-id="${l.id}">Payment reminder</button><button class="btn sm pri" data-act="paidNow" data-id="${l.id}">Mark paid</button>` : ''}</div></div>`;
}
LH.acts.paidNow = el => LH.paidSheet(LH.load(el.dataset.id));
LH.acts.viewInvoice = el => LH.invoiceView(LH.load(el.dataset.id));
LH.invoiceSheet = function (l) {
  const s = LH.S.settings, d = LH.detention(l);
  const warn = [];
  if (!s.bizName) warn.push('Add your business name in Settings so it appears on the invoice.');
  if (!(l.photos || []).some(p => p.kind === 'POD')) warn.push('No signed POD is attached. Brokers often will not pay without it.');
  const sh = openSheet('Create invoice', `<form id="invForm">
    ${warn.length ? `<div class="alert"><i></i><div><b>Before you send</b><small>${warn.map(esc).join('<br>')}</small></div></div>` : ''}
    <div class="grid2"><label class="f"><span>Invoice date</span><input type="date" name="date" value="${isoDay()}" required></label><label class="f"><span>Terms (days)</span><input name="terms" inputmode="numeric" value="${l.terms || s.terms || 30}"></label></div>
    ${d.owed > 0 ? `<label class="row" style="min-height:48px;margin-bottom:12px"><input type="checkbox" name="det" checked style="width:22px;min-height:22px"><span class="sp">Include detention <b class="mono">${money(d.owed)}</b></span></label>` : ''}
    <div class="stat" style="margin-bottom:14px"><span>Total</span><b class="mono" id="invTot">${money(num(l.rate) + LH.extrasTotal(l) + d.owed)}</b></div>
    <button class="btn pri block">Create invoice</button></form>`, { noFocus: true });
  const f = $('#invForm', sh); f.oninput = () => { const o = LH.form(f); $('#invTot', sh).textContent = money(num(l.rate) + LH.extrasTotal(l) + (o.det ? d.owed : 0)); };
  f.onsubmit = e => {
    e.preventDefault(); const o = LH.form(f), n = num(o.terms) || 30;
    l.invoice = { no: 'LH-' + String(LH.S.settings.nextInv++).padStart(4, '0'), date: o.date, due: addDays(o.date, n), terms: n, withDetention: !!o.det, sent: 0 };
    LH.save(); closeSheet(); LH.render(); LH.invoiceView(l);
  };
};
function invoiceHTML(l) {
  const s = LH.S.settings, inv = l.invoice, d = LH.detention(l);
  const rows = [[`Freight charge${l.ref ? ', load ' + esc(l.ref) : ''}`, num(l.rate)]].concat((l.extras || []).map(x => [esc(x.label), num(x.amount)]));
  if (inv.withDetention && d.owed > 0) rows.push([`Detention (${num(l.freeHours)} hr free, ${money(d.rate)}/hr)<br><small>${d.events.filter(e => !e.active && e.owed > 0).map(e => (e.stop === 'pick' ? 'Pickup' : 'Delivery') + ': in ' + fmtDT(e.arrive) + ', out ' + fmtDT(e.depart) + ', billable ' + fmtHM(e.billMs)).join('<br>')}</small>`, d.owed]);
  const docs = (l.photos || []).filter(p => ['BOL', 'POD'].includes(p.kind)).map(p => p.kind);
  return `<div class="paper"><div class="meta"><div><h2>Invoice</h2><div><b>${esc(inv.no)}</b></div><small>Issued ${fmtDay(inv.date)} · Due ${fmtDay(inv.due)} (net ${inv.terms})</small></div>
    <div style="text-align:right"><b>${esc(s.bizName || 'Your business')}</b><br><small>${esc(s.address || '').replace(/\n/g, '<br>')}${s.address ? '<br>' : ''}${esc([s.mc && 'MC ' + s.mc, s.dot && 'USDOT ' + s.dot].filter(Boolean).join(' · '))}<br>${esc(s.phone || '')} ${esc(s.email || '')}</small></div></div>
    <div style="margin-top:14px"><small>Bill to</small><br><b>${esc(l.brokerName || '')}</b>${l.brokerMc ? '<br><small>MC ' + esc(l.brokerMc) + '</small>' : ''}${l.brokerEmail ? '<br><small>' + esc(l.brokerEmail) + '</small>' : ''}</div>
    <div style="margin-top:10px"><small>Load</small><br>${esc(LH.routeLabel(l))}${l.pick && l.pick.time ? '<br><small>Picked up ' + fmtDT(l.pick.time) + (l.deliv && l.deliv.time ? ', delivered ' + fmtDT(l.deliv.time) : '') + '</small>' : ''}</div>
    <table><thead><tr><th>Description</th><th>Amount</th></tr></thead><tbody>${rows.map(r => `<tr><td>${r[0]}</td><td>${money(r[1])}</td></tr>`).join('')}</tbody></table>
    <div style="text-align:right" class="tot">Total due ${money(LH.invoiceTotal(l))}</div>
    ${s.payInfo ? `<div style="margin-top:14px"><small>Payment instructions</small><br>${esc(s.payInfo).replace(/\n/g, '<br>')}</div>` : ''}
    ${docs.length ? `<div style="margin-top:12px"><small>Attached: ${docs.join(', ')}</small></div>` : ''}</div>`;
}
LH.invoiceView = function (l) {
  const sh = openSheet('Invoice ' + l.invoice.no, invoiceHTML(l) + `<div class="noprint" style="margin-top:14px">
    <div class="grid2"><button class="btn" data-act="printInv">Print or save PDF</button><button class="btn pri" data-act="emailInv" data-id="${l.id}">${ic('send', 16)}Email broker</button></div>
    <div class="row wrap" style="margin-top:10px"><button class="btn sm" data-act="sharePaper" data-id="${l.id}">Share BOL and POD</button><button class="btn sm" data-act="markSent" data-id="${l.id}">Mark as sent</button></div>
    <p class="hint" style="margin-top:10px">Email opens with the invoice details filled in. To attach the invoice, choose Print, then Save as PDF, and attach that file.</p></div>`, { noFocus: true });
};
LH.acts.printInv = () => window.print();
LH.acts.markSent = el => { const l = LH.load(el.dataset.id); l.invoice.sent = Date.now(); LH.save(); toast('Marked as sent'); LH.render(); };
LH.acts.emailInv = el => {
  const l = LH.load(el.dataset.id), s = LH.S.settings, inv = l.invoice;
  const body = `Hello,\n\nPlease find invoice ${inv.no} for load ${l.ref || ''} (${LH.routeLabel(l)}).\nAmount due: ${money(LH.invoiceTotal(l))}\nDue date: ${fmtDay(inv.due)}\n\nThe signed POD and BOL are attached.\n\nThank you,\n${s.bizName || ''}${s.mc ? '\nMC ' + s.mc : ''}${s.phone ? '\n' + s.phone : ''}`;
  location.href = 'mailto:' + encodeURIComponent(l.brokerEmail || '') + '?subject=' + encodeURIComponent('Invoice ' + inv.no + ' · Load ' + (l.ref || '')) + '&body=' + encodeURIComponent(body);
  if (!inv.sent) { inv.sent = Date.now(); LH.save(); }
};
LH.acts.remind = el => {
  const l = LH.load(el.dataset.id), s = LH.S.settings, inv = l.invoice, late = daysFrom(inv.due) < 0;
  const body = `Hello,\n\n${late ? 'This is a reminder that' : 'A friendly note that'} invoice ${inv.no} for load ${l.ref || ''} for ${money(LH.invoiceTotal(l))} ${late ? 'was due on ' + fmtDay(inv.due) + ' and has not been received' : 'is due on ' + fmtDay(inv.due)}.\n\nPlease confirm the payment date.\n\nThank you,\n${s.bizName || ''}`;
  location.href = 'mailto:' + encodeURIComponent(l.brokerEmail || '') + '?subject=' + encodeURIComponent('Payment reminder · Invoice ' + inv.no) + '&body=' + encodeURIComponent(body);
};
LH.paidSheet = function (l) {
  const d = LH.detention(l), hasDet = l.invoice && l.invoice.withDetention && d.owed > 0;
  const sh = openSheet('Mark paid', `<form id="paidForm"><div class="grid2"><label class="f"><span>Date received</span><input type="date" name="date" value="${isoDay()}" required></label><label class="f"><span>Amount received ($)</span><input name="amt" inputmode="decimal" value="${LH.invoiceTotal(l).toFixed(2)}" required></label></div>
    ${hasDet ? `<label class="f"><span>Was the detention paid?</span><select name="det"><option value="yes">Yes, in full</option><option value="no">No, short paid</option></select></label>` : ''}
    <button class="btn pri block">Save</button></form>`, { noFocus: true });
  $('#paidForm', sh).onsubmit = e => { e.preventDefault(); const o = LH.form(e.target); l.paidDate = o.date; l.paidAmount = num(o.amt); if (hasDet) l.detentionPaid = o.det === 'yes'; LH.save(); closeSheet(); toast('Marked paid'); LH.render(); };
};

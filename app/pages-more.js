'use strict';
/* LaneHook driver portal: Load Guard, Brokers, Money, Documents, Calculator, Truck care, Settings, More, boot */

/* ---------------- LOAD GUARD ---------------- */
LH.runGuard = async function (mc, enteredName) {
  const r = await LH.lookup(mc);
  if (!r.ok || !r.found) return r;
  const b = LH.S.brokers[mc] || (LH.S.brokers[mc] = { mc }), prev = b.snap || null;
  r.flags = LH.guardFlags(r.snap, prev, enteredName);
  const chg = r.flags.find(f => f.t.startsWith('Changed since'));
  if (chg) (b.changes = b.changes || []).push({ ts: Date.now(), text: chg.t.replace('Changed since you last checked: ', '') });
  b.snap = r.snap; b.checkedAt = Date.now(); b.name = b.name || r.snap.name; LH.save();
  return r;
};
LH.guardSummary = function (r, mc) {
  const link = `<a class="btn sm" href="${LH.fmcsaURL(mc)}" target="_blank" rel="noopener">Open FMCSA record</a>`;
  if (!r.ok) {
    const msg = { upgrade: 'Live broker checks are part of a paid plan.', signin: 'Please sign in again to run broker checks.', offline: 'You appear to be offline. Try again when you have a connection.', not_configured: 'The live FMCSA check is not connected yet. Open the FMCSA record and look at authority status, bond, and company name yourself.' }[r.reason] || 'The lookup did not work. Try again, or open the FMCSA record.';
    return `<div class="alert"><i></i><div><b>Could not check MC ${esc(mc)}</b><small>${esc(msg)}</small></div></div><div style="margin-top:8px">${link}</div>`;
  }
  if (!r.found) return `<div class="alert bad"><i></i><div><b>No FMCSA record for MC ${esc(mc)}</b><small>Do not book until the broker explains this. Check the number against their rate confirmation.</small></div></div><div style="margin-top:8px">${link}</div>`;
  const s = r.snap, b = LH.S.brokers[mc] || {}, st = LH.brokerStats(mc);
  const recent = (b.changes || []).filter(c => Date.now() - c.ts < 60 * 864e5);
  const auth = (k, v) => `<span class="badge ${v === 'A' ? 'ok' : 'warn'}">${k} ${v === 'A' ? 'active' : (v === 'I' ? 'inactive' : (v === 'N' ? 'none' : (v || 'none')))}</span>`;
  return `<div class="card" style="margin:0 0 10px"><b style="font-size:17px">${esc(s.name)}</b>${s.dba ? `<div class="muted">dba ${esc(s.dba)}</div>` : ''}
    <div class="muted" style="font-size:14px;margin-top:4px">MC ${esc(mc)}${s.dot ? ' · USDOT ' + esc(s.dot) : ''}</div>
    <div class="row wrap" style="margin:10px 0">${auth('Broker', s.broker)}${auth('Carrier', s.common)}<span class="badge ${s.bondOnFile ? 'ok' : 'warn'}">${s.bondOnFile ? 'Bond on file' : 'No bond on file'}</span></div>
    <dl class="kv" style="font-size:14px"><dt>Address</dt><dd>${esc(s.addr || '–')}</dd><dt>Phone</dt><dd>${esc(s.phone || '–')}</dd></dl></div>
    ${r.flags.map(f => `<div class="alert ${f.cls}"><i></i><div><b>${esc(f.t)}</b></div></div>`).join('')}
    ${!r.flags.some(f => f.t.startsWith('Changed since')) && recent.length ? `<div class="alert"><i></i><div><b>Details changed ${fmtDay(isoDay(new Date(recent[recent.length - 1].ts)))}</b><small>${esc(recent[recent.length - 1].text)}</small></div></div>` : ''}
    ${st.count ? `<div class="alert ${st.late ? '' : 'ok'}"><i></i><div><b>Your history: ${st.count} load${st.count === 1 ? '' : 's'}${st.avgDays != null ? ', pays in ' + st.avgDays + ' days on average' : ''}</b><small>${st.late ? st.late + ' paid or still unpaid after the due date.' : 'No late payments so far.'}</small></div></div>` : ''}
    ${b.flag ? `<div class="alert ${b.flag === 'good' ? 'ok' : (b.flag === 'avoid' ? 'bad' : '')}"><i></i><div><b>Your mark: ${{ good: 'Good payer', slow: 'Slow payer', avoid: 'Avoid' }[b.flag]}</b>${b.notes ? `<small>${esc(b.notes)}</small>` : ''}</div></div>` : ''}
    <div class="row wrap" style="margin-top:8px"><button class="btn sm" data-act="openBroker" data-id="${esc(mc)}">Notes and rating</button>${link}</div>
    <p class="hint" style="margin-top:12px">This check uses public FMCSA records. It cannot prove who is on the phone. Call the number FMCSA lists, not one from an email.</p>`;
};
LH.guardSheet = async function (mc, name) {
  const s = openSheet('Broker check', `<div id="gs"><span class="spin"></span> Checking MC ${esc(mc)}…</div>`, { noFocus: true });
  const r = await LH.runGuard(mc, name); if (sheetEl) $('#gs', s).innerHTML = LH.guardSummary(r, mc);
};
LH.pages.guard = () => {
  const recent = Object.values(LH.S.brokers).filter(b => b.checkedAt).sort((a, b) => b.checkedAt - a.checkedAt).slice(0, 8);
  return {
    title: 'Load Guard', html: `<div class="cols"><div><form class="card" id="guardForm"><h3>Check a broker before you book</h3>
    <label class="f"><span>MC number</span><input name="mc" inputmode="numeric" placeholder="123456" required autocomplete="off"></label>
    <label class="f"><span>Company name on your paperwork (optional)</span><input name="name" autocomplete="off"></label>
    <p class="hint">Entering the name lets LaneHook catch a mismatch, a common sign of identity fraud.</p>
    <button class="btn pri block">${ic('shield', 18)}Check</button></form>
    <div class="card"><h3>Before you accept any load</h3><div class="muted" style="font-size:14px">Call the broker at the number on FMCSA, not the one in the email.<br>Confirm detention terms in writing.<br>Be careful with a rate far above the market, a rush to book, or a changed pickup contact.</div></div></div>
    <div><div id="guardOut"></div>${recent.length ? `<div class="sec" style="margin-top:0"><h2>Recent checks</h2></div><div class="list">${recent.map(b => `<button class="item" data-act="recheck" data-id="${esc(b.mc)}"><div class="t"><b>${esc(b.name || (b.snap && b.snap.name) || 'MC ' + b.mc)}</b><small>MC ${esc(b.mc)} · ${fmtDay(isoDay(new Date(b.checkedAt)))}</small></div><span class="chev">${ic('chev', 18)}</span></button>`).join('')}</div>` : ''}</div></div>`
  };
};
document.addEventListener('submit', async e => {
  if (e.target.id !== 'guardForm') return; e.preventDefault();
  const o = LH.form(e.target), mc = cleanMC(o.mc), out = $('#guardOut'); if (!mc) return;
  out.innerHTML = `<div class="card"><span class="spin"></span> Checking MC ${esc(mc)}…</div>`;
  const r = await LH.runGuard(mc, o.name); out.innerHTML = LH.guardSummary(r, mc);
});
LH.acts.recheck = el => LH.guardSheet(el.dataset.id, '');

/* ---------------- BROKERS ---------------- */
LH.pages.brokers = () => {
  const bs = LH.brokerList();
  return {
    title: 'Brokers', html: bs.length ? `<div class="list">${bs.map(b => `<button class="item" data-act="openBroker" data-id="${esc(b.mc)}"><div class="t"><b>${esc(b.name || (b.snap && b.snap.name) || 'MC ' + b.mc)}</b><small>MC ${esc(b.mc)}${b.stats.count ? ' · ' + b.stats.count + ' load' + (b.stats.count === 1 ? '' : 's') : ''}${b.stats.avgDays != null ? ' · pays in ' + b.stats.avgDays + ' days' : ''}</small></div>${b.flag ? `<span class="badge ${b.flag === 'good' ? 'ok' : (b.flag === 'slow' ? 'warn' : 'bad')}">${{ good: 'Good', slow: 'Slow', avoid: 'Avoid' }[b.flag]}</span>` : ''}<span class="chev">${ic('chev', 18)}</span></button>`).join('')}</div>` : LH.empty('No brokers yet', 'Brokers appear here when you check one or add a load. Rate them as you go and you will know who to avoid.', '<a class="btn pri" href="#/guard">Check a broker</a>')
  };
};
LH.acts.openBroker = el => {
  const mc = el.dataset.id, b = LH.S.brokers[mc] || (LH.S.brokers[mc] = { mc }), st = LH.brokerStats(mc);
  const s = openSheet(b.name || 'MC ' + mc, `<form id="brForm"><div class="muted" style="margin:-6px 0 12px">MC ${esc(mc)}</div>
    <div class="grid3" style="margin-bottom:14px">${[['good', 'Good payer'], ['slow', 'Slow payer'], ['avoid', 'Avoid']].map(f => `<button type="button" class="btn ${b.flag === f[0] ? 'pri' : ''}" data-act="setFlag" data-id="${esc(mc)}" data-v="${f[0]}" style="padding:0 6px">${f[1]}</button>`).join('')}</div>
    <label class="f"><span>Your notes</span><textarea name="notes" placeholder="Paid late twice. Refused detention in March.">${esc(b.notes || '')}</textarea></label>
    <div class="grid2"><label class="f"><span>Email</span><input name="email" type="email" value="${esc(b.email || '')}"></label><label class="f"><span>Phone</span><input name="phone" type="tel" value="${esc(b.phone || '')}"></label></div>
    ${st.count ? `<dl class="kv" style="margin-bottom:14px"><dt>Loads with them</dt><dd>${st.count}</dd><dt>Average days to pay</dt><dd>${st.avgDays != null ? st.avgDays : '–'}</dd><dt>Late payments</dt><dd>${st.late}</dd>${st.detentionUnpaid ? `<dt>Detention short paid</dt><dd>${st.detentionUnpaid}</dd>` : ''}</dl>` : ''}
    ${(b.changes || []).length ? `<div class="hint">Changes seen: ${b.changes.slice(-3).map(c => fmtDay(isoDay(new Date(c.ts))) + ' ' + esc(c.text)).join('; ')}</div>` : ''}
    <div class="grid2"><button type="button" class="btn" data-act="recheck" data-id="${esc(mc)}">Check now</button><button class="btn pri">Save</button></div></form>`, { noFocus: true });
  $('#brForm', s).onsubmit = e => { e.preventDefault(); const o = LH.form(e.target); Object.assign(b, { notes: o.notes, email: o.email, phone: o.phone }); LH.save(); closeSheet(); toast('Saved'); LH.render(); };
};
LH.acts.setFlag = el => { const b = LH.S.brokers[el.dataset.id]; b.flag = b.flag === el.dataset.v ? '' : el.dataset.v; LH.save(); $$('[data-act=setFlag]').forEach(x => x.classList.toggle('pri', x.dataset.v === b.flag)); };

/* ---------------- MONEY ---------------- */
LH.moneyTab = 'invoices';
LH.acts.moneyTab = el => { LH.moneyTab = el.dataset.v; LH.render(); };
const CATS = ['Fuel', 'Tolls', 'Repairs', 'Insurance', 'Lumper', 'Parking', 'Food', 'Permits', 'Other'];
const STATES = 'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');
const curQuarter = () => { const d = new Date(); return d.getFullYear() + '-Q' + (Math.floor(d.getMonth() / 3) + 1); };
const inQuarter = (day, q) => { const y = +q.slice(0, 4), n = +q.slice(-1), d = new Date(day + 'T12:00:00'); return d.getFullYear() === y && Math.floor(d.getMonth() / 3) + 1 === n; };
LH.iftaQ = curQuarter();
LH.acts.iftaQ = el => { LH.iftaQ = el.value; LH.render(); };
LH.pages.money = () => {
  const S = LH.S, T = LH.moneyTab, mo = isoDay().slice(0, 7);
  const out = LH.outstanding(), over = out.filter(l => daysFrom(l.invoice.due) < 0);
  const paidMo = S.loads.filter(l => l.paidDate && l.paidDate.startsWith(mo)).reduce((s, l) => s + num(l.paidAmount), 0);
  const expMo = S.expenses.filter(x => x.date.startsWith(mo)).reduce((s, x) => s + num(x.amount), 0);
  const tiles = `<div class="grid2 stats4"><div class="stat"><span>Owed to you</span><b class="mono">${money0(out.reduce((s, l) => s + LH.invoiceTotal(l), 0))}</b></div><div class="stat"><span>Overdue</span><b class="mono" style="${over.length ? 'color:var(--bad)' : ''}">${money0(over.reduce((s, l) => s + LH.invoiceTotal(l), 0))}</b></div><div class="stat"><span>Expenses this month</span><b class="mono">${money0(expMo)}</b></div><div class="stat"><span>Net this month</span><b class="mono" style="color:${paidMo - expMo < 0 ? 'var(--bad)' : 'var(--ok)'}">${money0(paidMo - expMo)}</b></div></div>`;
  const chips = `<div class="chips" style="margin-top:14px">${[['invoices', 'Invoices'], ['expenses', 'Expenses'], ['ifta', 'IFTA']].map(c => `<button class="chip ${T === c[0] ? 'on' : ''}" data-act="moneyTab" data-v="${c[0]}">${c[1]}</button>`).join('')}</div>`;
  let body = '';
  if (T === 'invoices') {
    const open = out.sort((a, b) => a.invoice.due.localeCompare(b.invoice.due)), paid = S.loads.filter(l => l.paidDate).sort((a, b) => b.paidDate.localeCompare(a.paidDate)).slice(0, 15);
    const days = S.loads.filter(l => l.paidDate && l.invoice).map(l => Math.max(0, Math.round((new Date(l.paidDate + 'T12:00:00') - new Date(l.invoice.date + 'T12:00:00')) / 864e5)));
    body = (open.length ? `<div class="sec" style="margin-top:0"><h2>Waiting for payment</h2></div><div class="list">${open.map(loadRow).join('')}</div>` : '') +
      (paid.length ? `<div class="sec"><h2>Paid</h2>${days.length ? `<span class="muted">Average ${Math.round(days.reduce((a, b) => a + b, 0) / days.length)} days to pay</span>` : ''}</div><div class="list">${paid.map(loadRow).join('')}</div>` : '') +
      (!open.length && !paid.length ? LH.empty('No invoices yet', 'Invoices appear here after you deliver a load and create one.', '<a class="btn" href="#/loads">Go to loads</a>') : '');
  } else if (T === 'expenses') {
    const ex = [...S.expenses].sort((a, b) => b.date.localeCompare(a.date)), by = {};
    ex.forEach(x => { (by[x.date.slice(0, 7)] = by[x.date.slice(0, 7)] || []).push(x); });
    const cats = {}; S.expenses.filter(x => x.date.startsWith(mo)).forEach(x => { cats[x.cat] = (cats[x.cat] || 0) + num(x.amount); });
    body = `<div class="row" style="margin-bottom:10px"><span class="sp muted">${ex.length} expense${ex.length === 1 ? '' : 's'}</span><button class="btn pri sm" data-act="addExpense">${ic('plus', 16)}Add expense</button></div>` +
      (Object.keys(cats).length ? `<div class="card"><h3>This month by category</h3><dl class="kv">${Object.entries(cats).sort((a, b) => b[1] - a[1]).map(c => `<dt>${esc(c[0])}</dt><dd class="mono">${money(c[1])}</dd>`).join('')}</dl></div>` : '') +
      (ex.length ? Object.keys(by).map(m => `<div class="sec"><h2>${new Date(m + '-15').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2><span class="muted mono">${money(by[m].reduce((s, x) => s + num(x.amount), 0))}</span></div><div class="list">${by[m].map(x => `<button class="item" data-act="editExpense" data-id="${x.id}"><div class="t"><b>${esc(x.vendor || x.cat)}</b><small>${fmtDay(x.date)} · ${esc(x.cat)}${x.gallons ? ' · ' + x.gallons + ' gal' : ''}${x.state ? ' · ' + x.state : ''}</small></div><span class="amt mono">${money(x.amount)}</span></button>`).join('')}</div>`).join('') : LH.empty('No expenses yet', 'Log fuel, tolls, and repairs as you go. It makes tax time and IFTA easy, and shows your real cost per mile.'));
  } else {
    const q = LH.iftaQ, qs = []; const y = new Date().getFullYear(); for (let yy = y; yy >= y - 1; yy--) for (let n = 4; n >= 1; n--) if (yy < y || n <= Math.floor(new Date().getMonth() / 3) + 1) qs.push(yy + '-Q' + n);
    const trips = S.trips.filter(t => inQuarter(t.date, q)), fuel = S.expenses.filter(x => x.cat === 'Fuel' && x.state && x.gallons && inQuarter(x.date, q));
    const per = {}; trips.forEach(t => { (per[t.state] = per[t.state] || { mi: 0, gal: 0 }).mi += num(t.miles); }); fuel.forEach(x => { (per[x.state] = per[x.state] || { mi: 0, gal: 0 }).gal += num(x.gallons); });
    const mi = Object.values(per).reduce((s, p) => s + p.mi, 0), gal = Object.values(per).reduce((s, p) => s + p.gal, 0);
    body = `<div class="card"><div class="muted" style="font-size:14px">IFTA usually applies to trucks over 26,000 lb. Many smaller box trucks do not need it. Confirm with your state before you rely on this. LaneHook tracks miles and gallons by state and does not calculate tax.</div></div>
      <div class="row" style="margin-bottom:10px"><select style="width:auto" data-change="iftaQ" aria-label="Quarter">${qs.map(x => `<option ${x === q ? 'selected' : ''}>${x}</option>`).join('')}</select><span class="sp"></span><button class="btn sm" data-act="addTrip">${ic('plus', 16)}Add miles</button></div>
      ${Object.keys(per).length ? `<div class="list">${Object.keys(per).sort().map(st => `<div class="item"><div class="t"><b>${st}</b></div><span class="mono muted">${Math.round(per[st].mi).toLocaleString()} mi</span><span class="mono" style="min-width:76px;text-align:end">${per[st].gal ? per[st].gal.toFixed(1) + ' gal' : '–'}</span></div>`).join('')}<div class="item" style="background:var(--surface2)"><div class="t"><b>Total</b>${gal && mi ? `<small>${(mi / gal).toFixed(2)} mpg</small>` : ''}</div><b class="mono">${Math.round(mi).toLocaleString()} mi</b><b class="mono" style="min-width:76px;text-align:end">${gal.toFixed(1)} gal</b></div></div><button class="btn block" data-act="iftaCSV">${ic('down', 16)}Download CSV</button>` : LH.empty('Nothing logged for ' + q, 'Add miles by state for each trip, and log fuel purchases with the state and gallons.')}
      ${trips.length ? `<div class="sec"><h2>Mileage entries</h2></div><div class="list">${trips.sort((a, b) => b.date.localeCompare(a.date)).map(t => `<button class="item" data-act="editTrip" data-id="${t.id}"><div class="t"><b>${t.state} · ${Math.round(t.miles).toLocaleString()} mi</b><small>${fmtDay(t.date)}${t.note ? ' · ' + esc(t.note) : ''}</small></div><span class="chev">${ic('chev', 18)}</span></button>`).join('')}</div>` : ''}`;
  }
  return { title: 'Money', html: tiles + chips + body };
};
const stateSel = (v, name = 'state') => `<select name="${name}"><option value="">State</option>${STATES.map(s => `<option ${s === v ? 'selected' : ''}>${s}</option>`).join('')}</select>`;
function expenseSheet(x) {
  const isNew = !x; x = x || { date: isoDay(), cat: 'Fuel' };
  const recent = [...LH.S.loads].sort((a, b) => b.created - a.created).slice(0, 15);
  const s = openSheet(isNew ? 'Add expense' : 'Edit expense', `<form id="exForm2"><div class="grid2"><label class="f"><span>Date</span><input type="date" name="date" value="${x.date}" required></label><label class="f"><span>Amount ($)</span><input name="amount" inputmode="decimal" value="${x.amount || ''}" required></label></div>
    <div class="grid2"><label class="f"><span>Category</span><select name="cat" id="exCat">${CATS.map(c => `<option ${c === x.cat ? 'selected' : ''}>${c}</option>`).join('')}</select></label><label class="f"><span>Vendor</span><input name="vendor" value="${esc(x.vendor || '')}"></label></div>
    <div id="fuelBits" style="display:${x.cat === 'Fuel' ? 'block' : 'none'}"><div class="grid3"><label class="f"><span>State</span>${stateSel(x.state)}</label><label class="f"><span>Gallons</span><input name="gallons" inputmode="decimal" value="${x.gallons || ''}"></label><label class="f"><span>Odometer</span><input name="odo" inputmode="numeric" value="${x.odo || ''}"></label></div></div>
    <label class="f"><span>For load (optional)</span><select name="loadId"><option value="">None</option>${recent.map(l => `<option value="${l.id}" ${l.id === x.loadId ? 'selected' : ''}>${esc(LH.loadLabel(l) + ' · ' + LH.routeLabel(l))}</option>`).join('')}</select></label>
    <div class="row" style="margin-bottom:14px"><label class="btn sm" for="exRc">${ic('cam', 16)}${x.receiptId ? 'Replace receipt' : 'Add receipt photo'}</label><input type="file" id="exRc" accept="image/*" capture="environment"><span class="muted" id="exRcN">${x.receiptId ? 'Receipt saved' : ''}</span></div>
    <div class="${isNew ? '' : 'grid2'}">${isNew ? '' : '<button type="button" class="btn bad" id="exDel">Delete</button>'}<button class="btn pri ${isNew ? 'block' : ''}">Save</button></div></form>`, { noFocus: true });
  let rc = null; $('#exCat', s).onchange = e => { $('#fuelBits', s).style.display = e.target.value === 'Fuel' ? 'block' : 'none'; };
  $('#exRc', s).onchange = async e => { if (e.target.files[0]) { rc = await LH.prepFile(e.target.files[0], 1400); $('#exRcN', s).textContent = 'Receipt ready'; } };
  $('#exForm2', s).onsubmit = async e => {
    e.preventDefault(); const o = LH.form(e.target), rec = isNew ? { id: uid() } : x;
    Object.assign(rec, { date: o.date, amount: num(o.amount), cat: o.cat, vendor: o.vendor, loadId: o.loadId, state: o.cat === 'Fuel' ? o.state : '', gallons: o.cat === 'Fuel' ? num(o.gallons) : 0, odo: o.cat === 'Fuel' ? num(o.odo) : 0 });
    if (rc) { if (rec.receiptId) await LH.delBlob(rec.receiptId); rec.receiptId = uid(); await LH.putBlob(rec.receiptId, rc.blob); }
    if (isNew) LH.S.expenses.push(rec); if (rec.odo > num(LH.S.odometer)) LH.S.odometer = rec.odo;
    LH.save(); closeSheet(); toast('Saved'); LH.render();
  };
  const del = $('#exDel', s); if (del) del.onclick = () => ask('Delete expense?', 'This removes it from your records.', 'Delete', async () => { if (x.receiptId) await LH.delBlob(x.receiptId); LH.S.expenses = LH.S.expenses.filter(y => y.id !== x.id); LH.save(); LH.render(); });
}
LH.acts.addExpense = () => expenseSheet();
LH.acts.editExpense = el => expenseSheet(LH.S.expenses.find(x => x.id === el.dataset.id));
function tripSheet(t) {
  const isNew = !t; t = t || { date: isoDay() };
  const s = openSheet(isNew ? 'Add miles' : 'Edit miles', `<form id="trForm"><div class="grid2"><label class="f"><span>Date</span><input type="date" name="date" value="${t.date}" required></label><label class="f"><span>State</span>${stateSel(t.state)}</label></div><div class="grid2"><label class="f"><span>Miles driven in that state</span><input name="miles" inputmode="decimal" value="${t.miles || ''}" required></label><label class="f"><span>Note</span><input name="note" value="${esc(t.note || '')}"></label></div><p class="hint">A trip through three states is three entries.</p><div class="${isNew ? '' : 'grid2'}">${isNew ? '' : '<button type="button" class="btn bad" id="trDel">Delete</button>'}<button class="btn pri ${isNew ? 'block' : ''}">Save</button></div></form>`, { noFocus: true });
  $('#trForm', s).onsubmit = e => { e.preventDefault(); const o = LH.form(e.target); if (!o.state) { toast('Pick a state'); return; } const rec = isNew ? { id: uid() } : t; Object.assign(rec, { date: o.date, state: o.state, miles: num(o.miles), note: o.note }); if (isNew) LH.S.trips.push(rec); LH.save(); closeSheet(); LH.render(); };
  const d = $('#trDel', s); if (d) d.onclick = () => { LH.S.trips = LH.S.trips.filter(y => y.id !== t.id); LH.save(); closeSheet(); LH.render(); };
}
LH.acts.addTrip = () => tripSheet(); LH.acts.editTrip = el => tripSheet(LH.S.trips.find(x => x.id === el.dataset.id));
LH.acts.iftaCSV = () => {
  const q = LH.iftaQ, per = {};
  LH.S.trips.filter(t => inQuarter(t.date, q)).forEach(t => { (per[t.state] = per[t.state] || { mi: 0, gal: 0 }).mi += num(t.miles); });
  LH.S.expenses.filter(x => x.cat === 'Fuel' && x.state && x.gallons && inQuarter(x.date, q)).forEach(x => { (per[x.state] = per[x.state] || { mi: 0, gal: 0 }).gal += num(x.gallons); });
  const csv = 'State,Miles,Gallons\n' + Object.keys(per).sort().map(s => `${s},${per[s].mi.toFixed(1)},${per[s].gal.toFixed(2)}`).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'ifta-' + q + '.csv'; a.click();
};

/* ---------------- DOCUMENTS ---------------- */
LH.pages.vault = () => {
  const ds = [...LH.S.docs].sort((a, b) => (a.expires || '9999').localeCompare(b.expires || '9999'));
  return {
    title: 'Documents', top: `<button class="btn pri sm" data-act="addDoc">${ic('plus', 16)}Add</button>`,
    html: ds.length ? `<div class="list">${ds.map(d => { const s = LH.docState(d); return `<button class="item" data-act="openDoc" data-id="${d.id}"><div class="t"><b>${esc(d.title)}</b><small>${esc(d.type)}${d.number ? ' · ' + esc(d.number) : ''}</small></div><span class="badge ${s.cls}">${esc(s.label)}</span></button>`; }).join('')}</div>` : LH.empty('Keep your papers in one place', 'Add your insurance, registration, authority letter, and W-9. LaneHook warns you before anything expires, and you can send them to a broker in two taps.', `<button class="btn pri" data-act="addDoc">Add a document</button>`)
  };
};
function docSheet(d) {
  const isNew = !d; d = d || {};
  const s = openSheet(isNew ? 'Add document' : 'Edit document', `<form id="dcForm"><label class="f"><span>Type</span><select name="type" id="dcType">${LH.DOC_TYPES.map(t => `<option ${t === d.type ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    <label class="f"><span>Name</span><input name="title" value="${esc(d.title || '')}" placeholder="Progressive truck policy" required></label>
    <div class="grid2"><label class="f"><span>Number (optional)</span><input name="number" value="${esc(d.number || '')}"></label><label class="f"><span>Expires (optional)</span><input type="date" name="expires" value="${d.expires || ''}"></label></div>
    <div class="row wrap" style="margin-bottom:14px"><label class="btn sm" for="dcCam">${ic('cam', 16)}Photo</label><label class="btn sm" for="dcFile">Choose file</label><input type="file" id="dcCam" accept="image/*" capture="environment"><input type="file" id="dcFile" accept="image/*,application/pdf" multiple><span class="muted" id="dcN">${(d.files || []).length ? (d.files.length + ' file' + (d.files.length === 1 ? '' : 's') + ' saved') : ''}</span></div>
    <div class="${isNew ? '' : 'grid2'}">${isNew ? '' : '<button type="button" class="btn bad" id="dcDel">Delete</button>'}<button class="btn pri ${isNew ? 'block' : ''}">Save</button></div></form>`, { noFocus: true });
  const add = []; const pick = async e => { for (const f of e.target.files) add.push(await LH.prepFile(f, 1800).then(r => Object.assign(r, { name: f.name }))); $('#dcN', s).textContent = ((d.files || []).length + add.length) + ' file(s) ready'; };
  $('#dcCam', s).onchange = pick; $('#dcFile', s).onchange = pick;
  $('#dcType', s).onchange = e => { const t = $('[name=title]', s); if (!t.value) t.value = e.target.value; };
  $('#dcForm', s).onsubmit = async e => {
    e.preventDefault(); const o = LH.form(e.target), rec = isNew ? { id: uid(), files: [] } : d;
    Object.assign(rec, { type: o.type, title: o.title, number: o.number, expires: o.expires });
    for (const a of add) { const id = uid(); await LH.putBlob(id, a.blob); rec.files.push({ id, type: a.type, name: a.name || o.title }); }
    if (isNew) LH.S.docs.push(rec); LH.save(); closeSheet(); toast('Saved'); LH.render();
  };
  const del = $('#dcDel', s); if (del) del.onclick = () => ask('Delete document?', 'The file is removed from this device.', 'Delete', async () => { for (const f of d.files || []) await LH.delBlob(f.id); LH.S.docs = LH.S.docs.filter(x => x.id !== d.id); LH.save(); LH.render(); });
}
LH.acts.addDoc = () => docSheet();
LH.acts.openDoc = el => {
  const d = LH.S.docs.find(x => x.id === el.dataset.id), st = LH.docState(d);
  openSheet(d.title, `<div class="row wrap" style="margin-bottom:12px"><span class="badge">${esc(d.type)}</span><span class="badge ${st.cls}">${esc(st.label)}</span>${d.number ? `<span class="muted">${esc(d.number)}</span>` : ''}</div>
    ${(d.files || []).length ? `<div class="thumbs">${d.files.map(f => f.type === 'application/pdf' ? `<a class="thumb" target="_blank" rel="noopener" data-blob-href="${f.id}"><div class="pdfmark">PDF</div></a>` : `<a class="thumb" target="_blank" rel="noopener" data-blob-href="${f.id}"><img alt="" data-blob="${f.id}"></a>`).join('')}</div>` : '<div class="muted">No file attached.</div>'}
    <div class="grid2" style="margin-top:14px"><button class="btn" data-act="editDoc" data-id="${d.id}">${ic('edit', 16)}Edit</button><button class="btn pri" data-act="shareDoc" data-id="${d.id}">${ic('send', 16)}Send to broker</button></div>`, { noFocus: true });
};
LH.acts.editDoc = el => docSheet(LH.S.docs.find(x => x.id === el.dataset.id));
LH.acts.shareDoc = async el => {
  const d = LH.S.docs.find(x => x.id === el.dataset.id), files = [];
  for (const f of d.files || []) { const b = await LH.getBlob(f.id); if (b) files.push(new File([b], d.title.replace(/[^\w\- ]/g, '') + (f.type === 'application/pdf' ? '.pdf' : '.jpg'), { type: f.type })); }
  if (!files.length) { toast('Attach a file first'); return; }
  if (navigator.canShare && navigator.canShare({ files })) { try { await navigator.share({ files, title: d.title }); } catch (e) { } } else toast('Sharing files is not available here. Open the file and save it.');
};

/* ---------------- PROFIT CALCULATOR ---------------- */
LH.calcIn = {};
LH.pages.calc = () => {
  const s = LH.S.settings, c = Object.assign({ mpg: s.mpg, fuelPrice: s.fuelPrice || '', cpm: s.costPerMile || '' }, LH.calcIn), f = (n, l, ph) => `<label class="f"><span>${l}</span><input name="${n}" inputmode="decimal" value="${esc(c[n] === undefined ? '' : c[n])}" ${ph ? `placeholder="${ph}"` : ''}></label>`;
  return {
    title: 'Profit calculator', html: `<div class="cols"><form class="card" id="calcForm" data-live="calc"><h3>Is this load worth it?</h3>${f('rate', 'Rate offered ($)')}<div class="grid2">${f('loaded', 'Loaded miles')}${f('dead', 'Empty miles to pickup')}</div><div class="grid2">${f('mpg', 'Truck MPG')}${f('fuelPrice', 'Fuel price ($/gal)')}</div><div class="grid2">${f('tolls', 'Tolls ($)')}${f('other', 'Other costs ($)')}</div>${f('cpm', 'Other running cost per mile ($)', 'Tires, maintenance, insurance')}${f('target', 'Profit per mile you want ($)', '1.00')}</form>
    <div id="calcOut"></div></div>`, after: () => LH.live.calc($('#calcForm'))
  };
};
LH.live.calc = f => {
  const o = LH.form(f); LH.calcIn = o; const p = LH.profit({ rate: o.rate, loaded: o.loaded, dead: o.dead, mpg: o.mpg, fuelPrice: o.fuelPrice, cpm: o.cpm, tolls: o.tolls, other: o.other }), out = $('#calcOut');
  if (!num(o.rate) || !p.miles) { out.innerHTML = `<div class="card muted">Enter the rate and miles to see your profit.</div>`; return; }
  const tgt = num(o.target), need = p.cost + tgt * p.miles, verdict = p.perMile >= (tgt || 0.01) ? ['ok', 'Worth taking'] : (p.profit > 0 ? ['warn', 'Thin'] : ['bad', 'You lose money']);
  out.innerHTML = `<div class="card"><span class="badge ${verdict[0]}">${verdict[1]}</span><div class="big mono" style="margin-top:8px;color:${p.profit < 0 ? 'var(--bad)' : 'var(--ok)'}">${money(p.profit)}</div><div class="muted">${money(p.perMile)} profit per mile over ${Math.round(p.miles).toLocaleString()} miles</div>
    <dl class="kv" style="margin-top:14px"><dt>Revenue per mile</dt><dd class="mono">${money(p.revPerMile)}</dd><dt>Fuel</dt><dd class="mono">${p.mpgMissing ? 'Enter MPG' : money(p.fuel)}</dd><dt>Tolls and other</dt><dd class="mono">${money(p.tolls + p.other)}</dd>${p.run ? `<dt>Running cost</dt><dd class="mono">${money(p.run)}</dd>` : ''}<dt>Total cost</dt><dd class="mono">${money(p.cost)}</dd>${tgt ? `<dt>Rate for your target</dt><dd class="mono">${money(need)}</dd>` : ''}</dl>
    <p class="hint" style="margin-top:12px">Add detention and lumper risk yourself. If the load has a long wait at the dock, the real profit is lower.</p></div>`;
};

/* ---------------- TRUCK CARE ---------------- */
LH.pages.maint = () => {
  const ms = [...LH.S.maint].sort((a, b) => (LH.maintState(b).over - LH.maintState(a).over) || ((LH.maintState(a).miLeft ?? 1e9) - (LH.maintState(b).miLeft ?? 1e9)));
  return {
    title: 'Truck care', top: `<button class="btn pri sm" data-act="addMaint">${ic('plus', 16)}Add</button>`,
    html: `<div class="card"><div class="row"><div class="t sp"><b>Odometer</b><div class="muted" style="font-size:14px">Update it when you fuel up or each week.</div></div><form id="odoForm" class="row" style="width:170px"><input name="odo" inputmode="numeric" value="${LH.S.odometer || ''}" placeholder="Miles" aria-label="Odometer"><button class="btn sm pri">Save</button></form></div></div>` +
      (ms.length ? `<div class="list">${ms.map(m => { const s = LH.maintState(m); return `<button class="item" data-act="openMaint" data-id="${m.id}"><div class="t"><b>${esc(m.name)}</b><small>${esc(s.label)}</small></div><span class="badge ${s.cls}">${s.over ? 'Due' : (s.soon ? 'Soon' : 'OK')}</span></button>`; }).join('')}</div>` : LH.empty('Nothing tracked yet', 'Add the jobs that keep your truck on the road, like oil changes and inspections. LaneHook tells you when they come due.', `<button class="btn pri" data-act="addMaint">Add a job</button>`))
  };
};
document.addEventListener('submit', e => { if (e.target.id === 'odoForm') { e.preventDefault(); LH.S.odometer = num(LH.form(e.target).odo); LH.save(); toast('Odometer saved'); LH.render(); } });
function maintSheet(m) {
  const isNew = !m; m = m || { lastDate: isoDay(), lastMiles: LH.S.odometer || '' };
  const s = openSheet(isNew ? 'Add a job' : 'Edit job', `<form id="mtForm"><label class="f"><span>Job</span><input name="name" list="mtList" value="${esc(m.name || '')}" placeholder="Oil change" required><datalist id="mtList">${['Oil change', 'Tire rotation', 'Brake inspection', 'DOT annual inspection', 'Air filter', 'Transmission service', 'Coolant flush', 'Registration renewal'].map(x => `<option>${x}</option>`).join('')}</datalist></label>
    <div class="grid2"><label class="f"><span>Every (miles)</span><input name="everyMiles" inputmode="numeric" value="${m.everyMiles || ''}"></label><label class="f"><span>Every (days)</span><input name="everyDays" inputmode="numeric" value="${m.everyDays || ''}"></label></div>
    <div class="grid2"><label class="f"><span>Last done at (miles)</span><input name="lastMiles" inputmode="numeric" value="${m.lastMiles || ''}"></label><label class="f"><span>Last done on</span><input type="date" name="lastDate" value="${m.lastDate || ''}"></label></div>
    <div class="${isNew ? '' : 'grid2'}">${isNew ? '' : '<button type="button" class="btn bad" id="mtDel">Delete</button>'}<button class="btn pri ${isNew ? 'block' : ''}">Save</button></div></form>`, { noFocus: true });
  $('#mtForm', s).onsubmit = e => { e.preventDefault(); const o = LH.form(e.target), rec = isNew ? { id: uid() } : m; Object.assign(rec, { name: o.name, everyMiles: num(o.everyMiles), everyDays: num(o.everyDays), lastMiles: num(o.lastMiles), lastDate: o.lastDate }); if (isNew) LH.S.maint.push(rec); LH.save(); closeSheet(); LH.render(); };
  const d = $('#mtDel', s); if (d) d.onclick = () => { LH.S.maint = LH.S.maint.filter(x => x.id !== m.id); LH.save(); closeSheet(); LH.render(); };
}
LH.acts.addMaint = () => maintSheet();
LH.acts.openMaint = el => {
  const m = LH.S.maint.find(x => x.id === el.dataset.id), st = LH.maintState(m);
  openSheet(m.name, `<div class="muted" style="margin-bottom:12px">${esc(st.label)}. Last done ${m.lastDate ? fmtDay(m.lastDate) : '–'}${m.lastMiles ? ' at ' + Math.round(m.lastMiles).toLocaleString() + ' mi' : ''}.</div>
  <form id="mdForm"><div class="grid2"><label class="f"><span>Cost ($, optional)</span><input name="cost" inputmode="decimal"></label><label class="f"><span>Shop (optional)</span><input name="shop"></label></div><div class="grid2"><button type="button" class="btn" data-act="editMaint" data-id="${m.id}">Edit</button><button class="btn pri">Mark done today</button></div></form>`, { noFocus: true });
  $('#mdForm').onsubmit = e => { e.preventDefault(); const o = LH.form(e.target); m.lastDate = isoDay(); m.lastMiles = num(LH.S.odometer) || m.lastMiles; if (num(o.cost) > 0) LH.S.expenses.push({ id: uid(), date: isoDay(), amount: num(o.cost), cat: 'Repairs', vendor: o.shop || m.name }); LH.save(); closeSheet(); toast('Marked done'); LH.render(); };
};
LH.acts.editMaint = el => maintSheet(LH.S.maint.find(x => x.id === el.dataset.id));

/* ---------------- SETTINGS ---------------- */
LH.pages.settings = () => {
  const s = LH.S.settings, f = (n, l, o = {}) => `<label class="f"><span>${l}</span><input name="${n}" value="${esc(s[n] === undefined || s[n] === 0 && !o.zero ? '' : s[n])}" ${o.mode ? `inputmode="${o.mode}"` : ''} ${o.type ? `type="${o.type}"` : ''} ${o.ph ? `placeholder="${o.ph}"` : ''}></label>`;
  return {
    title: 'Settings', html: LH.accountCard() + `<form id="setForm"><div class="cols"><div><div class="card"><h3>Your business</h3>${f('name', 'Your name')}${f('bizName', 'Business name')}<div class="grid2">${f('mc', 'MC number', { mode: 'numeric' })}${f('dot', 'USDOT number', { mode: 'numeric' })}</div>${f('phone', 'Phone', { type: 'tel' })}${f('email', 'Email', { type: 'email' })}<label class="f"><span>Address</span><textarea name="address">${esc(s.address || '')}</textarea></label><label class="f"><span>Payment instructions on invoices</span><textarea name="payInfo" placeholder="Remit to, or factoring company details">${esc(s.payInfo || '')}</textarea></label></div></div>
    <div><div class="card"><h3>Your numbers</h3><div class="grid2">${f('mpg', 'Truck MPG', { mode: 'decimal' })}${f('fuelPrice', 'Fuel price ($/gal)', { mode: 'decimal' })}</div>${f('costPerMile', 'Other running cost per mile ($)', { mode: 'decimal', ph: 'Tires, maintenance, insurance' })}<div class="grid2">${f('terms', 'Default payment terms (days)', { mode: 'numeric' })}${f('defFree', 'Default free hours', { mode: 'decimal', ph: '2' })}</div>${f('defDet', 'Default detention ($/hour)', { mode: 'decimal', zero: 1 })}</div>
    <button class="btn pri block" style="margin-bottom:12px">Save settings</button></div></div></form>
    <div class="card"><h3>Your data</h3><p class="muted" style="margin:0 0 12px;font-size:14px">Everything is stored on this device only. There is no account or sync yet. Make a backup now and then, and before you clear your browser data or change phones.</p>
    <div class="row wrap"><button class="btn" data-act="exportData">${ic('down', 16)}Back up</button><label class="btn" for="impFile">Restore backup</label><input type="file" id="impFile" accept="application/json" data-change="importData"><button class="btn" data-act="toggleTheme">${ic('sun', 16)}Light or dark</button></div>
    <p class="hint" style="margin-top:12px">To install on iPhone or iPad: tap Share, then Add to Home Screen. On Android: menu, then Install app.</p>
    <button class="btn bad sm" data-act="wipe">Erase all data on this device</button></div>`
  };
};
document.addEventListener('submit', e => {
  if (e.target.id !== 'setForm') return; e.preventDefault(); const o = LH.form(e.target), s = LH.S.settings;
  ['name', 'bizName', 'mc', 'dot', 'phone', 'email', 'address', 'payInfo'].forEach(k => s[k] = o[k]);
  ['mpg', 'fuelPrice', 'costPerMile', 'terms', 'defFree', 'defDet'].forEach(k => s[k] = o[k] === '' ? '' : num(o[k]));
  s.terms = s.terms || 30; LH.save(); toast('Settings saved');
});
LH.acts.exportData = async () => {
  const blobs = {}; const ids = [];
  LH.S.loads.forEach(l => (l.photos || []).forEach(p => ids.push(p.id))); LH.S.docs.forEach(d => (d.files || []).forEach(f => ids.push(f.id))); LH.S.expenses.forEach(x => x.receiptId && ids.push(x.receiptId));
  for (const id of ids) { const b = await LH.getBlob(id); if (b) blobs[id] = { type: b.type, data: await LH.fileToBase64(b) }; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({ app: 'lanehook', v: 1, state: LH.S, blobs })], { type: 'application/json' })); a.download = 'lanehook-backup-' + isoDay() + '.json'; a.click(); toast('Backup downloaded');
};
LH.acts.importData = el => {
  const f = el.files[0]; if (!f) return;
  ask('Restore this backup?', 'This replaces everything on this device with the backup file.', 'Restore', async () => {
    try {
      const j = JSON.parse(await f.text()); if (j.app !== 'lanehook') throw 0;
      for (const [id, b] of Object.entries(j.blobs || {})) { const bin = atob(b.data), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); await LH.putBlob(id, new Blob([u], { type: b.type })); }
      LH.S = Object.assign(JSON.parse(JSON.stringify(LH.S)), j.state); LH.save(); toast('Backup restored'); LH.render();
    } catch (e) { toast('That file is not a LaneHook backup'); }
  });
};
LH.acts.wipe = () => ask('Erase everything?', 'All loads, photos, documents, and settings on this device will be deleted. Back up first if you may need them.', 'Erase all', async () => {
  if (idb) { idb.close(); await new Promise(r => { const q = indexedDB.deleteDatabase('lanehook'); q.onsuccess = q.onerror = q.onblocked = r; }); }
  location.hash = '#/home'; location.reload();
});

/* ---------------- MORE ---------------- */
LH.pages.more = () => ({
  title: 'More', html: `<div class="list">${[['dispatch', 'Dispatch', 'users', 'Loads from your dispatcher'], ['vault', 'Documents', 'doc', 'Insurance, registration, authority'], ['brokers', 'Brokers', 'users', 'Your notes and ratings'], ['calc', 'Profit calculator', 'calc', 'Check a load before you accept'], ['maint', 'Truck care', 'wrench', 'Service reminders and odometer'], ['settings', 'Settings', 'gear', 'Business info and backup']].map(r => `<a class="item" href="#/${r[0]}">${ic(r[2])}<div class="t"><b>${r[1]}</b><small>${r[3]}</small></div><span class="chev">${ic('chev', 18)}</span></a>`).join('')}</div>${LH.auth && LH.auth.user ? `<div class="list"><button class="item" data-act="signOut">${ic('back')}<div class="t"><b>Sign out</b><small>${esc(LH.auth.user.email || '')}</small></div></button></div>` : ''}${window.LHInstall && LHInstall.canShow() ? `<div class="list"><button class="item" data-a2hs>${ic('plus')}<div class="t"><b>Add to home screen</b><small>Open LaneHook like an app</small></div><span class="chev">${ic('chev', 18)}</span></button></div>` : ''}<p class="legal-links"><a href="/terms/" target="_blank" rel="noopener">Terms of Service</a> · <a href="/privacy/" target="_blank" rel="noopener">Privacy Policy</a></p>`
});

/* ---------------- BOOT ---------------- */
(async function () {
  await LH.boot();
  const t = LH.S.settings.theme; if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  try { await LH.auth.init(); } catch (e) { LH.auth.local = true; }
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => { });
  if (!LH.auth.local && !LH.auth.user) {
    /* a sign-in link may be completing (?code=...); give it a moment before showing the form */
    if (new URLSearchParams(location.search).has('code')) { $('#app').innerHTML = '<div class="auth"><div class="auth-card"><span class="spin"></span> Signing you in…</div></div>'; await new Promise(r => setTimeout(r, 4000)); if (LH.auth.user) return; }
    LH.auth.showLogin(); return;
  }
  if (!location.hash) history.replaceState(null, '', '#/home');
  LH.render();
  if (!LH.storageOK) toast('This browser blocked storage. Your data will not be saved.', 6000);
  if (LH.auth.user) { LH.auth.started = true; LH.auth.enter(true); }
})();

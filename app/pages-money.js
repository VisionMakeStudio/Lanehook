'use strict';
/* LaneHook driver portal: money reports, tax summary, CSV, fuel log, detention claim packet and claim status */

/* ---------------- REPORT PERIODS ---------------- */
LH.rep = { p: 'month', off: 0 };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDay = s => { const d = new Date(s + 'T12:00:00'); return MONTHS[d.getMonth()] + ' ' + d.getDate(); };
LH.repRange = function (p, off, now) {
  now = now ? new Date(now) : new Date(); now.setHours(12, 0, 0, 0);
  let a, b, label;
  if (p === 'week') {
    const m = new Date(now); m.setDate(m.getDate() - ((m.getDay() + 6) % 7) + 7 * off);
    a = new Date(m); b = new Date(m); b.setDate(b.getDate() + 6);
    label = shortDay(isoDay(a)) + ' – ' + shortDay(isoDay(b)) + ', ' + b.getFullYear();
  } else if (p === 'year') {
    const y = now.getFullYear() + off; a = new Date(y, 0, 1, 12); b = new Date(y, 11, 31, 12); label = String(y);
  } else {
    a = new Date(now.getFullYear(), now.getMonth() + off, 1, 12); b = new Date(a.getFullYear(), a.getMonth() + 1, 0, 12);
    label = a.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  return { p, off, from: isoDay(a), to: isoDay(b), label };
};
LH.repData = function (r) {
  const inR = d => !!d && d >= r.from && d <= r.to, S = LH.S;
  const paid = S.loads.filter(l => inR(l.paidDate)).sort((a, b) => a.paidDate.localeCompare(b.paidDate));
  const amt = l => num(l.paidAmount || LH.invoiceTotal(l));
  const income = paid.reduce((s, l) => s + amt(l), 0);
  const exp = S.expenses.filter(x => inR(x.date)).sort((a, b) => a.date.localeCompare(b.date));
  const cats = {}; exp.forEach(x => { cats[x.cat] = (cats[x.cat] || 0) + num(x.amount); });
  const expTotal = exp.reduce((s, x) => s + num(x.amount), 0);
  const months = [];
  if (r.p === 'year') for (let m = 0; m < 12; m++) {
    const key = r.from.slice(0, 4) + '-' + String(m + 1).padStart(2, '0');
    const i = paid.filter(l => l.paidDate.startsWith(key)).reduce((s, l) => s + amt(l), 0), e = exp.filter(x => x.date.startsWith(key)).reduce((s, x) => s + num(x.amount), 0);
    months.push({ key, label: MONTHS[m], income: i, exp: e, net: i - e });
  }
  const billed = S.loads.filter(l => l.invoice && inR(l.invoice.date)).reduce((s, l) => s + LH.invoiceTotal(l), 0);
  return {
    r, paid, exp, cats, income, expTotal, net: income - expTotal, months, billed, amt,
    miles: paid.reduce((s, l) => s + num(l.loaded) + num(l.dead), 0),
    gallons: exp.filter(x => x.cat === 'Fuel').reduce((s, x) => s + num(x.gallons), 0),
    detention: paid.filter(l => l.invoice && l.invoice.withDetention).reduce((s, l) => s + (l.detentionPaid === false ? 0 : LH.detention(l).owed), 0)
  };
};
LH.acts.repP = el => { LH.rep = { p: el.dataset.v, off: 0 }; LH.render(); };
LH.acts.repNav = el => { LH.rep.off += +el.dataset.v; LH.render(); };
LH.acts.repNow = () => { LH.rep.off = 0; LH.render(); };

LH.moneyReport = function () {
  const r = LH.repRange(LH.rep.p, LH.rep.off), d = LH.repData(r), top = Math.max(1, ...Object.values(d.cats));
  const chips = `<div class="chips" style="margin:0 0 6px">${[['week', 'Week'], ['month', 'Month'], ['year', 'Year']].map(c => `<button class="chip ${r.p === c[0] ? 'on' : ''}" data-act="repP" data-v="${c[0]}">${c[1]}</button>`).join('')}</div>`;
  const nav = `<div class="row" style="margin-bottom:12px"><button class="icon-btn" data-act="repNav" data-v="-1" aria-label="Earlier">${ic('back')}</button><div class="sp" style="text-align:center"><b id="repLabel">${esc(r.label)}</b>${r.off ? `<div><button class="btn sm" data-act="repNow">Back to this ${r.p}</button></div>` : ''}</div><button class="icon-btn" data-act="repNav" data-v="1" aria-label="Later" style="transform:scaleX(-1)">${ic('back')}</button></div>`;
  const tiles = `<div class="grid2 stats4"><div class="stat"><span>Income (paid)</span><b class="mono" id="repInc">${money0(d.income)}</b></div><div class="stat"><span>Expenses</span><b class="mono" id="repExp">${money0(d.expTotal)}</b></div><div class="stat"><span>Net</span><b class="mono" id="repNet" style="color:${d.net < 0 ? 'var(--bad)' : 'var(--ok)'}">${money0(d.net)}</b></div><div class="stat"><span>Loads paid</span><b class="mono">${d.paid.length}</b></div></div>`;
  const cats = Object.keys(d.cats).length ? `<div class="card"><h3>Expenses by category</h3>${Object.entries(d.cats).sort((a, b) => b[1] - a[1]).map(c => `<div style="margin:8px 0"><div class="row"><span class="sp">${esc(c[0])}</span><b class="mono">${money(c[1])}</b></div><div style="height:6px;border-radius:4px;background:var(--surface2);margin-top:4px"><i style="display:block;height:6px;border-radius:4px;background:var(--orange);width:${Math.round(c[1] / top * 100)}%"></i></div></div>`).join('')}</div>` : '';
  const months = r.p === 'year' ? `<div class="card"><h3>By month</h3><div class="tblx"><table class="tbl" id="repMonths"><thead><tr><th>Month</th><th>Income</th><th>Expenses</th><th>Net</th></tr></thead><tbody>${d.months.map(m => `<tr><td>${m.label}</td><td class="mono">${money0(m.income)}</td><td class="mono">${money0(m.exp)}</td><td class="mono" style="color:${m.net < 0 ? 'var(--bad)' : 'inherit'}">${money0(m.net)}</td></tr>`).join('')}</tbody></table></div></div>` : '';
  const facts = `<div class="card"><dl class="kv"><dt>Invoiced in this period</dt><dd class="mono">${money(d.billed)}</dd><dt>Loaded and empty miles on paid loads</dt><dd class="mono">${Math.round(d.miles).toLocaleString()}</dd><dt>Fuel bought</dt><dd class="mono">${d.gallons ? d.gallons.toFixed(1) + ' gal' : '–'}</dd>${d.income > 0 && d.miles > 0 ? `<dt>Income per mile</dt><dd class="mono">${money(d.income / d.miles)}</dd>` : ''}${d.income > 0 ? `<dt>Expenses as share of income</dt><dd class="mono">${Math.round(d.expTotal / d.income * 100)}%</dd>` : ''}</dl><p class="hint" style="margin-top:8px">Income counts when a load is marked paid, and expenses count on the date you logged them.</p></div>`;
  const acts = `<div class="grid2" style="margin-bottom:12px"><button class="btn" data-act="repPrint">${ic('doc', 16)}Print report</button><button class="btn" data-act="repCSV">${ic('down', 16)}Download CSV</button></div>${r.p === 'year' ? `<button class="btn pri block" style="margin-bottom:12px" data-act="taxSummary">Year-end tax summary</button>` : ''}`;
  return chips + nav + tiles + `<div style="height:12px"></div>` + acts + cats + months + facts;
};
function reportPaper(d, title) {
  const s = LH.S.settings, r = d.r;
  return `<div class="paper"><div class="meta"><div><h2>${esc(title)}</h2><div><b>${esc(r.label)}</b></div><small>${fmtDay(r.from)} to ${fmtDay(r.to)}</small></div><div style="text-align:right"><b>${esc(s.bizName || s.name || 'Your business')}</b><br><small>${esc([s.mc && 'MC ' + s.mc, s.dot && 'USDOT ' + s.dot].filter(Boolean).join(' · '))}</small></div></div>
  <table><thead><tr><th>Summary</th><th>Amount</th></tr></thead><tbody><tr><td>Income received</td><td>${money(d.income)}</td></tr><tr><td>Total expenses</td><td>${money(d.expTotal)}</td></tr><tr><td><b>Net</b></td><td><b>${money(d.net)}</b></td></tr></tbody></table>
  ${Object.keys(d.cats).length ? `<table><thead><tr><th>Expenses by category</th><th>Amount</th></tr></thead><tbody>${Object.entries(d.cats).sort((a, b) => b[1] - a[1]).map(c => `<tr><td>${esc(c[0])}</td><td>${money(c[1])}</td></tr>`).join('')}</tbody></table>` : ''}
  ${d.paid.length ? `<table><thead><tr><th>Paid loads</th><th>Amount</th></tr></thead><tbody>${d.paid.map(l => `<tr><td>${fmtDay(l.paidDate)} · ${esc(LH.loadLabel(l))}${l.brokerName ? ' · ' + esc(l.brokerName) : ''}</td><td>${money(d.amt(l))}</td></tr>`).join('')}</tbody></table>` : ''}
  <small>Prepared with LaneHook on ${fmtDay(isoDay())}. Figures come from the loads and expenses you entered.</small></div>`;
}
LH.acts.repPrint = () => {
  const d = LH.repData(LH.repRange(LH.rep.p, LH.rep.off));
  openSheet('Report', reportPaper(d, 'Income and expense report') + `<div class="noprint" style="margin-top:14px"><button class="btn pri block" data-act="printInv">Print or save PDF</button></div>`, { noFocus: true });
};
LH.reportCSV = function (d) {
  const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const rows = [['Date', 'Type', 'Category', 'Description', 'Amount', 'Load']];
  d.paid.forEach(l => rows.push([l.paidDate, 'Income', 'Freight', (l.brokerName || '') + ' ' + LH.routeLabel(l), d.amt(l).toFixed(2), l.ref || '']));
  d.exp.forEach(x => { const l = x.loadId && LH.load(x.loadId); rows.push([x.date, 'Expense', x.cat, (x.vendor || '') + (x.gallons ? ' ' + x.gallons + ' gal' : '') + (x.state ? ' ' + x.state : ''), num(x.amount).toFixed(2), l ? l.ref || '' : '']); });
  rows.push([], ['', 'Total income', '', '', d.income.toFixed(2)], ['', 'Total expenses', '', '', d.expTotal.toFixed(2)], ['', 'Net', '', '', d.net.toFixed(2)]);
  return rows.map(r => r.map(q).join(',')).join('\n');
};
LH.acts.repCSV = () => {
  const r = LH.repRange(LH.rep.p, LH.rep.off), csv = LH.reportCSV(LH.repData(r));
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'lanehook-' + r.p + '-' + r.from + '.csv'; a.click(); toast('CSV downloaded');
};
LH.acts.taxSummary = () => {
  const r = LH.repRange('year', LH.rep.p === 'year' ? LH.rep.off : 0), d = LH.repData(r), pct = LH.S.settings.taxPct === undefined ? 25 : num(LH.S.settings.taxPct);
  const setAside = Math.max(0, d.net) * pct / 100;
  const s = openSheet('Year-end summary ' + r.label, reportPaper(d, 'Year-end summary for your accountant').replace('<small>Prepared', `<table><tbody><tr><td>Miles on paid loads</td><td>${Math.round(d.miles).toLocaleString()}</td></tr><tr><td>Gallons of fuel bought</td><td>${d.gallons.toFixed(1)}</td></tr><tr><td>Detention collected</td><td>${money(d.detention)}</td></tr></tbody></table><small>Prepared`) + `<div class="noprint">
    <div class="card" style="margin-top:14px"><h3>Tax set-aside</h3><div class="row"><label class="f sp" style="margin:0"><span>Percent of net profit to put aside</span><input id="taxPct" inputmode="decimal" value="${pct}"></label></div><div class="stat" style="margin-top:10px"><span>Planning number</span><b class="mono" id="taxOut">${money0(setAside)}</b></div>
    <p class="hint" style="margin-top:8px">This is a rough planning figure, not tax advice. Meals and per diem have special rules, so ask your accountant how to treat them. Try the <a href="#/tools/per-diem-calculator">per diem calculator</a>.</p></div>
    <div class="grid2" style="margin-top:12px"><button class="btn" data-act="repCSV">${ic('down', 16)}CSV for accountant</button><button class="btn pri" data-act="printInv">Print or save PDF</button></div></div>`, { noFocus: true });
  $('#taxPct', s).oninput = e => { const p = num(e.target.value); LH.S.settings.taxPct = p; LH.save(); $('#taxOut', s).textContent = money0(Math.max(0, d.net) * p / 100); };
};

/* ---------------- FUEL LOG ---------------- */
LH.fuelFills = function () {
  const f = LH.S.expenses.filter(x => x.cat === 'Fuel').sort((a, b) => a.date.localeCompare(b.date) || num(a.odo) - num(b.odo));
  let prev = null;
  f.forEach(x => { x._mpg = null; if (num(x.odo) > 0 && num(x.gallons) > 0) { if (prev && num(x.odo) > num(prev.odo)) x._mpg = (num(x.odo) - num(prev.odo)) / num(x.gallons); prev = x; } });
  return f;
};
LH.fuelStats = function (fills) {
  fills = fills || LH.fuelFills();
  const withO = fills.filter(x => num(x.odo) > 0 && num(x.gallons) > 0).sort((a, b) => num(a.odo) - num(b.odo));
  let mpg = null;
  if (withO.length >= 2) { const mi = num(withO[withO.length - 1].odo) - num(withO[0].odo), gal = withO.slice(1).reduce((s, x) => s + num(x.gallons), 0); if (mi > 0 && gal > 0) mpg = mi / gal; }
  const gal = fills.reduce((s, x) => s + num(x.gallons), 0), spent = fills.reduce((s, x) => s + num(x.amount), 0), gp = fills.filter(x => num(x.gallons) > 0);
  const ppg = gp.length ? gp.reduce((s, x) => s + num(x.amount), 0) / gp.reduce((s, x) => s + num(x.gallons), 0) : null;
  return { mpg, gal, spent, ppg };
};
LH.pages.fuel = () => {
  const fills = LH.fuelFills(), st = LH.fuelStats(fills), mo = isoDay().slice(0, 7), moSpend = fills.filter(x => x.date.startsWith(mo)).reduce((s, x) => s + num(x.amount), 0);
  const last = fills[fills.length - 1], recent = [...fills].reverse().slice(0, 30);
  const form = `<form class="card" id="fuelForm"><h3>Log a fill-up</h3>
    <div class="grid2"><label class="f"><span>Gallons</span><input name="gallons" inputmode="decimal" required autocomplete="off"></label><label class="f"><span>Total paid ($)</span><input name="amount" inputmode="decimal" placeholder="Or price per gallon below" autocomplete="off"></label></div>
    <div class="grid3"><label class="f"><span>Price per gal</span><input name="ppg" inputmode="decimal" autocomplete="off"></label><label class="f"><span>State</span>${stateSel(last && last.state)}</label><label class="f"><span>Odometer</span><input name="odo" inputmode="numeric" value="${LH.S.odometer || ''}" autocomplete="off"></label></div>
    <div class="grid2"><label class="f"><span>Date</span><input type="date" name="date" value="${isoDay()}"></label><label class="f"><span>Station</span><input name="vendor" autocomplete="off"></label></div>
    <div class="row" style="margin-bottom:12px"><label class="btn sm" for="fuRc">${ic('cam', 16)}Receipt photo</label><input type="file" id="fuRc" accept="image/*" capture="environment"><span class="muted" id="fuRcN"></span></div>
    <button class="btn pri block">Save fill-up</button><p class="hint" style="margin-top:8px">Fill the tank each time for an accurate MPG. State and gallons feed your IFTA report automatically.</p></form>`;
  const tiles = `<div class="grid2 stats4"><div class="stat"><span>Average MPG</span><b class="mono" id="fuMpg">${st.mpg ? st.mpg.toFixed(1) : '–'}</b></div><div class="stat"><span>Avg price / gal</span><b class="mono">${st.ppg ? money(st.ppg) : '–'}</b></div><div class="stat"><span>Fuel this month</span><b class="mono">${money0(moSpend)}</b></div><div class="stat"><span>Total gallons</span><b class="mono">${Math.round(st.gal).toLocaleString()}</b></div></div>`;
  const useMpg = st.mpg && Math.abs(st.mpg - num(LH.S.settings.mpg)) > 0.05 ? `<div class="alert"><i></i><div><b>Your logged MPG is ${st.mpg.toFixed(1)}</b><small>Settings has ${num(LH.S.settings.mpg) || 'none'}. Profit estimates use the Settings number.</small><div style="margin-top:8px"><button class="btn sm" data-act="useMpg" data-v="${st.mpg.toFixed(1)}">Use ${st.mpg.toFixed(1)} MPG</button></div></div></div>` : '';
  const list = recent.length ? `<div class="sec"><h2>Recent fill-ups</h2><span class="muted">${fills.length}</span></div><div class="list">${recent.map(x => `<button class="item" data-act="editExpense" data-id="${x.id}"><div class="t"><b>${esc(x.vendor || 'Fuel')}${x.state ? ' · ' + x.state : ''}</b><small>${fmtDay(x.date)}${x.gallons ? ' · ' + num(x.gallons).toFixed(1) + ' gal' : ''}${x.gallons && x.amount ? ' · ' + money(num(x.amount) / num(x.gallons)) + '/gal' : ''}${x._mpg ? ' · ' + x._mpg.toFixed(1) + ' mpg' : ''}</small></div><span class="amt mono">${money(x.amount)}</span></button>`).join('')}</div>` : '';
  return { title: 'Fuel log', back: 'more', top: `<button class="btn sm" data-act="addToll">${ic('plus', 16)}Toll</button>`, html: `<div class="cols"><div>${form}</div><div>${tiles}<div style="height:12px"></div>${useMpg}${list}</div></div>` };
};
LH.acts.useMpg = el => { LH.S.settings.mpg = num(el.dataset.v); LH.save(); toast('MPG updated in Settings'); LH.render(); };
LH.acts.addToll = () => LH.expenseSheet(null, { cat: 'Tolls' });
document.addEventListener('submit', async e => {
  if (e.target.id !== 'fuelForm') return; e.preventDefault();
  const o = LH.form(e.target), gal = num(o.gallons), ppg = num(o.ppg); let amt = num(o.amount);
  if (!amt && gal && ppg) amt = Math.round(gal * ppg * 100) / 100;
  if (!gal) { toast('Enter the gallons'); return; } if (!amt) { toast('Enter the total paid or the price per gallon'); return; }
  const rec = { id: uid(), date: o.date || isoDay(), amount: amt, cat: 'Fuel', vendor: o.vendor, state: o.state, gallons: gal, odo: num(o.odo) };
  const rcInp = $('#fuRc'); if (rcInp && rcInp.files[0]) { const rc = await LH.prepFile(rcInp.files[0], 1400); rec.receiptId = uid(); await LH.putBlob(rec.receiptId, rc.blob); }
  LH.S.expenses.push(rec); if (rec.odo > num(LH.S.odometer)) LH.S.odometer = rec.odo;
  if (!num(LH.S.settings.fuelPrice) && gal) LH.S.settings.fuelPrice = Math.round(amt / gal * 1000) / 1000;
  LH.save(); const f = LH.fuelFills().find(x => x.id === rec.id);
  toast(f && f._mpg ? 'Saved. ' + f._mpg.toFixed(1) + ' MPG since the last fill-up' : 'Fill-up saved'); LH.render();
});
$('body').addEventListener('change', e => { if (e.target.id === 'fuRc') { const n = $('#fuRcN'); if (n) n.textContent = e.target.files[0] ? 'Receipt ready' : ''; } });

/* ---------------- DETENTION CLAIM: packet, status, reminders ---------------- */
const CLAIM = { draft: ['Not sent', ''], sent: ['Sent', 'blue'], paid: ['Paid', 'ok'], denied: ['Denied', 'bad'] };
LH.claimStatus = l => (l.claim && l.claim.status) || 'draft';
LH.claimDays = l => l.claim && l.claim.status === 'sent' && l.claim.sentAt ? Math.floor((Date.now() - l.claim.sentAt) / 864e5) : null;
LH.claimRow = function (l) {
  const d = LH.detention(l); if (!d.events.some(e => !e.active) || !(d.owed > 0)) return '';
  const st = LH.claimStatus(l), days = LH.claimDays(l);
  return `<div style="padding:12px 0;border-top:1px solid var(--border)"><div class="row"><b class="sp">Detention claim</b><span class="badge ${CLAIM[st][1]}">${CLAIM[st][0]}${days != null ? ' · day ' + days : ''}</span></div>
    <div class="row wrap" style="margin-top:8px"><button class="btn sm pri" data-act="claimPacket" data-id="${l.id}">Claim packet</button></div></div>`;
};
function packetHTML(l) {
  const s = LH.S.settings, d = LH.detention(l), docs = (l.photos || []).filter(p => ['BOL', 'POD', 'Rate con'].includes(p.kind));
  const stops = d.events.filter(e => !e.active).map(e => `<tr><td><b>${e.stop === 'pick' ? 'Pickup' : 'Delivery'}</b>${l[e.stop] && l[e.stop].name ? '<br><small>' + esc(l[e.stop].name) + '</small>' : ''}${l[e.stop] && l[e.stop].time ? '<br><small>Appointment ' + fmtDT(l[e.stop].time) + '</small>' : ''}</td><td>In ${fmtDT(e.arrive)}${e.arriveGps ? '<br><small>GPS ' + e.arriveGps.lat.toFixed(5) + ', ' + e.arriveGps.lng.toFixed(5) + '</small>' : ''}<br>Out ${fmtDT(e.depart)}${e.departGps ? '<br><small>GPS ' + e.departGps.lat.toFixed(5) + ', ' + e.departGps.lng.toFixed(5) + '</small>' : ''}${e.edited ? '<br><small>Times edited by the driver</small>' : ''}</td><td>${fmtHM(e.ms)}<br><small>billable ${fmtHM(e.billMs)}</small></td><td>${money(e.owed)}</td></tr>`).join('');
  return `<div class="paper"><div class="meta"><div><h2>Detention claim</h2><div><b>Load ${esc(l.ref || '')}</b></div><small>${esc(LH.routeLabel(l))}</small></div><div style="text-align:right"><b>${esc(s.bizName || 'Your business')}</b><br><small>${esc([s.mc && 'MC ' + s.mc, s.dot && 'USDOT ' + s.dot].filter(Boolean).join(' · '))}<br>${esc(s.phone || '')} ${esc(s.email || '')}</small></div></div>
  <div style="margin-top:12px"><small>To</small><br><b>${esc(l.brokerName || '')}</b>${l.brokerMc ? '<br><small>MC ' + esc(l.brokerMc) + '</small>' : ''}</div>
  <div style="margin-top:10px"><small>Terms on the rate confirmation</small><br>${num(l.freeHours)} hour${num(l.freeHours) === 1 ? '' : 's'} free, then ${money(d.rate)} per hour. Rate confirmation ${(l.photos || []).some(p => p.kind === 'Rate con') ? 'attached' : 'available on request'}.</div>
  <table><thead><tr><th>Stop</th><th>Times</th><th>Time there</th><th>Owed</th></tr></thead><tbody>${stops}</tbody></table>
  <div style="text-align:right" class="tot">Detention due ${money(d.owed)}</div>
  ${docs.length ? `<div style="margin-top:10px"><small>Attached: ${docs.map(p => esc(p.kind)).join(', ')}</small></div>` : ''}
  <div style="margin-top:12px"><small>Please confirm payment or send the date you will pay. Thank you.</small></div></div>`;
}
LH.acts.claimPacket = el => {
  const l = LH.load(el.dataset.id), st = LH.claimStatus(l), days = LH.claimDays(l);
  const s = openSheet('Detention claim', packetHTML(l) + `<div class="noprint" style="margin-top:14px">
    <div class="grid2"><button class="btn" data-act="printInv">Print or save PDF</button><button class="btn pri" data-act="claimEmail" data-id="${l.id}">${ic('send', 16)}Email broker</button></div>
    <div class="row wrap" style="margin-top:10px"><button class="btn sm" data-act="claimFiles" data-id="${l.id}">Share packet and paperwork</button><button class="btn sm" data-act="copyClaim" data-id="${l.id}">Copy text</button></div>
    <div class="card" style="margin-top:14px"><h3>Claim status</h3><div class="chips" style="margin:0 0 4px;padding-bottom:0">${['draft', 'sent', 'paid', 'denied'].map(k => `<button class="chip ${st === k ? 'on' : ''}" data-act="claimSet" data-id="${l.id}" data-v="${k}">${CLAIM[k][0]}</button>`).join('')}</div>
    <div class="muted" style="font-size:14px">${st === 'sent' ? (days >= 14 ? 'Day ' + days + '. Call the broker and follow up in writing.' : 'Sent ' + days + ' day' + (days === 1 ? '' : 's') + ' ago. LaneHook reminds you on days 3, 7 and 14.') : (st === 'draft' ? 'Mark it sent when you send it, and LaneHook will remind you to follow up.' : (st === 'paid' ? 'Collected. Nice work.' : 'Denied. Keep your records and consider asking for a manager.'))}</div></div></div>`, { noFocus: true });
};
LH.acts.claimSet = el => {
  const l = LH.load(el.dataset.id), k = el.dataset.v; l.claim = Object.assign(l.claim || {}, { status: k });
  if (k === 'sent' && !l.claim.sentAt) l.claim.sentAt = Date.now();
  if (k === 'draft') delete l.claim.sentAt;
  if (k === 'paid' || k === 'denied') l.claim.resolvedAt = Date.now();
  if (k === 'paid' && l.invoice && l.invoice.withDetention) l.detentionPaid = true;
  LH.save(); LH.render(); LH.acts.claimPacket({ dataset: { id: l.id } });
};
LH.acts.claimEmail = el => {
  const l = LH.load(el.dataset.id), s = LH.S.settings;
  const body = 'Hello,\n\nI am sending a detention claim for load ' + (l.ref || '') + ' (' + LH.routeLabel(l) + ').\n\n' + LH.claimText(l) + '\n\nThe rate confirmation, BOL and signed POD are attached.\n\nPlease confirm the payment date.\n\nThank you,\n' + (s.bizName || '') + (s.mc ? '\nMC ' + s.mc : '') + (s.phone ? '\n' + s.phone : '');
  l.claim = Object.assign(l.claim || {}, { status: 'sent' }); if (!l.claim.sentAt) l.claim.sentAt = Date.now(); LH.save();
  location.href = 'mailto:' + encodeURIComponent(l.brokerEmail || '') + '?subject=' + encodeURIComponent('Detention claim · Load ' + (l.ref || '')) + '&body=' + encodeURIComponent(body);
};
LH.acts.claimFiles = async el => {
  const l = LH.load(el.dataset.id), files = [];
  const txt = new File([LH.claimText(l)], 'detention-claim-' + (l.ref || 'load') + '.txt', { type: 'text/plain' }); files.push(txt);
  for (const p of (l.photos || []).filter(x => ['BOL', 'POD', 'Rate con'].includes(x.kind))) { const b = await LH.getBlob(p.id); if (b) files.push(new File([b], (l.ref || 'load') + '-' + p.kind + (p.type === 'application/pdf' ? '.pdf' : '.jpg'), { type: p.type })); }
  if (navigator.canShare && navigator.canShare({ files })) { try { await navigator.share({ files, title: 'Detention claim, load ' + (l.ref || ''), text: 'Detention claim for load ' + (l.ref || '') }); } catch (e) { } }
  else toast('Sharing files is not available here. Use Email broker, or Copy text.');
};

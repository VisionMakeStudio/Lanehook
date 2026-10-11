'use strict';
/* LaneHook driver portal: business logic (no DOM) */
LH.STAGES = ['booked', 'picked', 'delivered', 'invoiced', 'paid'];
LH.STAGE_LABEL = { booked: 'Booked', picked: 'Picked up', delivered: 'Delivered', invoiced: 'Invoiced', paid: 'Paid' };
LH.load = id => LH.S.loads.find(l => l.id === id);
LH.stage = l => l.paidDate ? 'paid' : (l.invoice ? 'invoiced' : (l.stage || 'booked'));
LH.stageIdx = l => LH.STAGES.indexOf(LH.stage(l));
LH.loadLabel = l => l.ref ? '#' + l.ref : (l.deliv && l.deliv.name ? l.deliv.name : 'Load');
LH.routeLabel = l => { const a = (l.pick && (l.pick.city || l.pick.name)) || '', b = (l.deliv && (l.deliv.city || l.deliv.name)) || ''; return a && b ? a + ' → ' + b : (a || b || 'No route yet'); };

/* detention: free time counts from arrival at each stop */
LH.detention = function (l, now = Date.now()) {
  const free = num(l.freeHours) * 36e5, rate = num(l.detRate), events = [];
  let owed = 0, billMs = 0;
  (l.detention || []).forEach((d, i) => {
    const end = d.depart || now, ms = Math.max(0, end - d.arrive), b = Math.max(0, ms - free), o = (b / 36e5) * rate;
    events.push(Object.assign({}, d, { i, ms, billMs: b, owed: o, active: !d.depart, freeLeft: Math.max(0, free - ms) }));
    if (d.depart) { owed += o; billMs += b; }
  });
  return { events, owed, billMs, free, rate };
};
LH.activeDetention = () => {
  for (const l of LH.S.loads) { const ev = (l.detention || []).find(d => !d.depart); if (ev) return { load: l, ev }; }
  return null;
};
LH.extrasTotal = l => (l.extras || []).reduce((s, x) => s + num(x.amount), 0);
LH.invoiceTotal = l => num(l.rate) + LH.extrasTotal(l) + (l.invoice && l.invoice.withDetention ? LH.detention(l).owed : 0);

/* profit for a load or the calculator */
LH.profit = function (p) {
  const miles = num(p.loaded) + num(p.dead), mpg = num(p.mpg) || 0;
  const fuel = mpg > 0 ? (miles / mpg) * num(p.fuelPrice) : 0;
  const run = miles * num(p.cpm);
  const rev = num(p.rate) + num(p.detention);
  const cost = fuel + num(p.tolls) + num(p.other) + run;
  const profit = rev - cost;
  return { miles, fuel, run, tolls: num(p.tolls), other: num(p.other), rev, cost, profit, perMile: miles > 0 ? profit / miles : 0, revPerMile: miles > 0 ? rev / miles : 0, mpgMissing: !(mpg > 0) };
};
LH.loadProfit = l => LH.profit({ rate: num(l.rate) + LH.extrasTotal(l), loaded: l.loaded, dead: l.dead, mpg: LH.S.settings.mpg, fuelPrice: LH.S.settings.fuelPrice, cpm: LH.S.settings.costPerMile, tolls: l.tolls, other: l.otherCost, detention: l.invoice && l.invoice.withDetention ? LH.detention(l).owed : 0 });

/* invoices */
LH.invoiceStatus = l => {
  if (!l.invoice) return null;
  if (l.paidDate) return { k: 'paid', label: 'Paid', cls: 'ok' };
  const d = daysFrom(l.invoice.due);
  if (d < 0) return { k: 'overdue', label: Math.abs(d) + (Math.abs(d) === 1 ? ' day' : ' days') + ' overdue', cls: 'bad' };
  if (d <= 3) return { k: 'soon', label: d === 0 ? 'Due today' : 'Due in ' + d + (d === 1 ? ' day' : ' days'), cls: 'warn' };
  return { k: 'open', label: 'Due ' + fmtDay(l.invoice.due), cls: '' };
};
LH.outstanding = () => LH.S.loads.filter(l => l.invoice && !l.paidDate);

/* brokers: own history */
LH.brokerStats = mc => {
  const ls = LH.S.loads.filter(l => cleanMC(l.brokerMc) === mc);
  const paid = ls.filter(l => l.paidDate && l.invoice);
  const days = paid.map(l => Math.max(0, Math.round((new Date(l.paidDate + 'T12:00:00') - new Date(l.invoice.date + 'T12:00:00')) / 864e5)));
  const late = paid.filter(l => l.paidDate > l.invoice.due).length + LH.outstanding().filter(l => cleanMC(l.brokerMc) === mc && daysFrom(l.invoice.due) < 0).length;
  return { loads: ls, count: ls.length, paidCount: paid.length, avgDays: days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null, late, detentionUnpaid: paid.filter(l => l.invoice.withDetention && l.detentionPaid === false).length };
};
LH.brokerList = () => {
  const set = new Set([...Object.keys(LH.S.brokers), ...LH.S.loads.map(l => cleanMC(l.brokerMc)).filter(Boolean)]);
  return [...set].map(mc => {
    const b = LH.S.brokers[mc] || { mc }; const ld = LH.S.loads.find(l => cleanMC(l.brokerMc) === mc);
    return Object.assign({ name: (ld && ld.brokerName) || '' }, b, { mc, stats: LH.brokerStats(mc) });
  }).sort((a, b) => (a.name || a.mc).localeCompare(b.name || b.mc));
};

/* documents */
LH.DOC_TYPES = ['Insurance', 'Registration', 'Operating authority (MC)', 'USDOT number', 'Driver license', 'Medical card', 'Carrier agreement', 'W-9', 'BOC-3', 'UCR', 'Other'];
LH.docState = d => {
  if (!d.expires) return { k: 'none', label: 'No expiry', cls: '' };
  const n = daysFrom(d.expires);
  if (n < 0) return { k: 'expired', label: 'Expired ' + fmtDay(d.expires), cls: 'bad' };
  if (n <= 30) return { k: 'soon', label: n === 0 ? 'Expires today' : 'Expires in ' + n + (n === 1 ? ' day' : ' days'), cls: 'warn' };
  return { k: 'ok', label: 'Valid to ' + fmtDay(d.expires), cls: 'ok' };
};

/* truck care */
LH.maintState = m => {
  const odo = num(LH.S.odometer); let miLeft = null, dayLeft = null;
  if (num(m.everyMiles) > 0) miLeft = num(m.lastMiles) + num(m.everyMiles) - odo;
  if (num(m.everyDays) > 0 && m.lastDate) dayLeft = daysFrom(addDays(m.lastDate, num(m.everyDays)));
  const over = (miLeft != null && miLeft <= 0) || (dayLeft != null && dayLeft <= 0);
  const soon = !over && ((miLeft != null && miLeft <= 500) || (dayLeft != null && dayLeft <= 14));
  const bits = [];
  if (miLeft != null) bits.push(miLeft <= 0 ? Math.abs(Math.round(miLeft)).toLocaleString() + ' mi over' : Math.round(miLeft).toLocaleString() + ' mi left');
  if (dayLeft != null) bits.push(dayLeft <= 0 ? Math.abs(dayLeft) + ' days over' : dayLeft + ' days left');
  return { over, soon, miLeft, dayLeft, label: bits.join(' · ') || 'No interval set', cls: over ? 'bad' : (soon ? 'warn' : 'ok') };
};

/* alerts for Home */
LH.alerts = function () {
  const a = [];
  const ad = LH.activeDetention();
  if (ad) a.push({ cls: 'bad', t: 'Detention clock running', s: LH.loadLabel(ad.load) + ' · ' + (ad.ev.stop === 'pick' ? 'pickup' : 'delivery'), href: '#/load/' + ad.load.id });
  LH.S.loads.filter(l => l.invoice && !l.paidDate).forEach(l => { const s = LH.invoiceStatus(l); if (s.k === 'overdue' || s.k === 'soon') a.push({ cls: s.k === 'overdue' ? 'bad' : '', t: 'Invoice ' + s.label.toLowerCase(), s: LH.loadLabel(l) + ' · ' + money(LH.invoiceTotal(l)) + (l.brokerName ? ' · ' + l.brokerName : ''), href: '#/load/' + l.id }); });
  LH.S.loads.filter(l => LH.stage(l) === 'delivered').forEach(l => a.push({ cls: '', t: 'Delivered, not invoiced', s: LH.loadLabel(l) + ' · ' + money(num(l.rate) + LH.extrasTotal(l)), href: '#/load/' + l.id }));
  LH.S.loads.filter(l => ['delivered', 'invoiced'].includes(LH.stage(l)) && !(l.photos || []).some(p => p.kind === 'POD')).forEach(l => a.push({ cls: '', t: 'No proof of delivery on file', s: LH.loadLabel(l), href: '#/load/' + l.id }));
  LH.S.docs.forEach(d => { const s = LH.docState(d); if (s.k === 'expired' || s.k === 'soon') a.push({ cls: s.k === 'expired' ? 'bad' : '', t: d.title + ' · ' + s.label.toLowerCase(), s: d.type, href: '#/vault' }); });
  LH.S.maint.forEach(m => { const s = LH.maintState(m); if (s.over || s.soon) a.push({ cls: s.over ? 'bad' : '', t: m.name + (s.over ? ' is due' : ' due soon'), s: s.label, href: '#/maint' }); });
  const rank = x => x.cls === 'bad' ? 0 : 1; return a.sort((x, y) => rank(x) - rank(y));
};

/* Load Guard: FMCSA lookup through the site's serverless function */
LH.fmcsaURL = mc => 'https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=MC_MX&query_string=' + encodeURIComponent(mc);
LH.lookup = async function (mc) {
  let res;
  try { res = await fetch('/.netlify/functions/fmcsa?mc=' + encodeURIComponent(mc), { cache: 'no-store', headers: await LH.auth.headers() }); }
  catch (e) { return { ok: false, reason: 'offline' }; }
  let body = null; try { body = await res.json(); } catch (e) { }
  if (res.status === 404 && !body) return { ok: false, reason: 'not_configured' };
  if (res.status === 401) return { ok: false, reason: 'signin' };
  if (res.status === 402) return { ok: false, reason: 'upgrade' };
  if (!res.ok || !body) return { ok: false, reason: (body && body.error) || 'error' };
  if (!body.found) return { ok: true, found: false };
  const c = body.carrier || {}, bond = c.bondInsuranceOnFile;
  return {
    ok: true, found: true, mc,
    snap: {
      name: c.legalName || '', dba: c.dbaName || '', dot: c.dotNumber ? String(c.dotNumber) : '',
      allowed: c.allowedToOperate === 'Y', statusCode: c.statusCode || '',
      broker: c.brokerAuthorityStatus || '', common: c.commonAuthorityStatus || '', contract: c.contractAuthorityStatus || '',
      bondOnFile: !!(bond && String(bond) !== '0' && String(bond).toUpperCase() !== 'N'), bondRequired: String(c.bondInsuranceRequired || '').toUpperCase() === 'Y',
      addr: [c.phyStreet, c.phyCity, c.phyState, c.phyZipcode].filter(Boolean).join(', '), phone: c.telephone || ''
    }
  };
};
const words = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !['llc', 'inc', 'the', 'corp', 'logistics', 'freight', 'transportation', 'company', 'group', 'and'].includes(w));
/* turn a lookup + history into flags */
LH.guardFlags = function (snap, prev, enteredName) {
  const f = [];
  if (!snap.allowed) f.push({ cls: 'bad', t: 'FMCSA does not show this company as allowed to operate' });
  if (snap.broker && snap.broker !== 'A') f.push({ cls: 'bad', t: snap.broker === 'N' ? 'No active broker authority' : 'Broker authority is not active (status ' + snap.broker + ')' });
  if (!snap.broker) f.push({ cls: 'warn', t: 'No broker authority listed. If this is a carrier posting loads, ask why.' });
  if (snap.broker === 'A' && !snap.bondOnFile) f.push({ cls: 'bad', t: 'No broker bond on file with FMCSA' });
  if (enteredName) {
    const a = words(enteredName), b = words(snap.name + ' ' + snap.dba);
    if (a.length && b.length && !a.some(w => b.includes(w))) f.push({ cls: 'bad', t: 'The name on your paperwork does not match FMCSA ("' + snap.name + '"). Possible identity fraud.' });
  }
  if (prev) {
    const ch = []; ['name', 'addr', 'phone'].forEach(k => { if ((prev[k] || '') !== (snap[k] || '')) ch.push(k === 'addr' ? 'address' : k); });
    if (prev.broker !== snap.broker) ch.push('authority status');
    if (ch.length) f.push({ cls: 'warn', t: 'Changed since you last checked: ' + ch.join(', ') });
  }
  if (!f.length) f.push({ cls: 'ok', t: 'Authority is active and the basics look consistent' });
  return f;
};

/* detention claim text */
LH.claimText = function (l) {
  const d = LH.detention(l), s = LH.S.settings, lines = [];
  lines.push('Detention claim: load ' + (l.ref || '') + (l.brokerName ? ' (' + l.brokerName + ')' : ''));
  lines.push('Carrier: ' + (s.bizName || '') + (s.mc ? ' · MC ' + s.mc : ''));
  lines.push('Terms: ' + (num(l.freeHours) || 0) + ' hr free, then ' + money(d.rate) + '/hr');
  d.events.filter(e => !e.active).forEach(e => {
    lines.push('', (e.stop === 'pick' ? 'Pickup' : 'Delivery') + (l[e.stop] && l[e.stop].name ? ' · ' + l[e.stop].name : ''));
    lines.push('  Arrived: ' + new Date(e.arrive).toLocaleString('en-US') + (e.arriveGps ? ' (GPS ' + e.arriveGps.lat.toFixed(5) + ', ' + e.arriveGps.lng.toFixed(5) + ')' : ''));
    lines.push('  Departed: ' + new Date(e.depart).toLocaleString('en-US') + (e.departGps ? ' (GPS ' + e.departGps.lat.toFixed(5) + ', ' + e.departGps.lng.toFixed(5) + ')' : ''));
    lines.push('  Time at facility: ' + fmtHM(e.ms) + ' · billable: ' + fmtHM(e.billMs) + ' · ' + money(e.owed));
  });
  lines.push('', 'Total detention due: ' + money(d.owed));
  return lines.join('\n');
};

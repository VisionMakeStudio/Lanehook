'use strict';
/* LaneHook driver portal: demo data for testing and walk-throughs. Hidden unless you open /app/?demo=1 once. Everything it adds is tagged and can be cleared. */
(function () {
  try { const p = new URLSearchParams(location.search).get('demo'); if (p === '1') localStorage.setItem('lh-demo', '1'); if (p === '0') localStorage.removeItem('lh-demo'); } catch (e) { }
  const D = LH.demo = {};
  D.on = () => { try { return localStorage.getItem('lh-demo') === '1'; } catch (e) { return false; } };
  D.has = () => !!(LH.S && ['loads', 'expenses', 'docs', 'maint', 'trips', 'contacts', 'inspections', 'calcs'].some(k => (LH.S[k] || []).some(x => x.demo)));
  const day = n => addDays(isoDay(), n), ts = (n, h) => { const d = new Date(day(n) + 'T' + String(h || 9).padStart(2, '0') + ':00:00'); return d.getTime(); };
  D.add = function () {
    if (D.has()) { toast('Demo data is already loaded'); return; }
    const S = LH.S, st = S.settings; S.demoSet = S.demoSet || [];
    [['name', 'Demo Driver'], ['bizName', 'Demo Trucking LLC'], ['mc', '123456'], ['dot', '1234567'], ['phone', '555-0100'], ['email', 'demo@example.com'], ['mpg', 9], ['fuelPrice', 4.1], ['defDet', 60]].forEach(([k, v]) => { if (!st[k]) { st[k] = v; S.demoSet.push(k); } });
    const base = (o) => Object.assign({ id: uid(), demo: true, created: Date.now() - (o.age || 0) * 864e5, stage: 'booked', photos: [], detention: [], extras: [], terms: 30, freeHours: 2, detRate: 60, tolls: 0, otherCost: 0 }, o);
    const P = (name, city, n, h) => ({ name, city, addr: '', time: ts(n, h) });
    const L = [];
    L.push(base({ ref: 'D-1001', brokerName: 'Blue Ridge Logistics', brokerMc: '900001', brokerEmail: 'ap@blueridge.example', rate: 1150, loaded: 520, dead: 40, age: 0, pick: P('Newark Warehouse', 'Newark, NJ', 1, 8), deliv: P('Columbus DC', 'Columbus, OH', 2, 14) }));
    L.push(base({ ref: 'D-1002', brokerName: 'Harbor Freight Brokers', brokerMc: '900002', brokerEmail: 'billing@harbor.example', rate: 640, loaded: 190, dead: 25, stage: 'picked', pickedAt: Date.now() - 4 * 36e5, age: 1, pick: P('Edison Foods', 'Edison, NJ', 0, 7), deliv: P('Baltimore Market', 'Baltimore, MD', 0, 16) }));
    const arr = ts(-3, 8) + 0, dep = arr + 5.5 * 36e5;
    L.push(base({ ref: 'D-0998', brokerName: 'Blue Ridge Logistics', brokerMc: '900001', brokerEmail: 'ap@blueridge.example', rate: 820, loaded: 310, dead: 30, stage: 'delivered', deliveredAt: dep, age: 4, tolls: 18, pick: P('Albany Supply', 'Albany, NY', -4, 8), deliv: P('Hartford Retail', 'Hartford, CT', -3, 9), detention: [{ stop: 'deliv', arrive: arr, depart: dep, arriveGps: { lat: 41.7658, lng: -72.6734, acc: 12 }, departGps: { lat: 41.7658, lng: -72.6734, acc: 9 } }], claim: { status: 'sent', sentAt: Date.now() - 8 * 864e5 } }));
    L.push(base({ ref: 'D-0990', brokerName: 'Summit Freight', brokerMc: '900003', brokerEmail: 'ar@summit.example', rate: 980, loaded: 410, dead: 35, stage: 'delivered', age: 50, invoice: { no: 'LH-9001', date: day(-45), due: day(-15), terms: 30, withDetention: false, sent: ts(-45) }, pick: P('Scranton Dist', 'Scranton, PA', -48, 8), deliv: P('Richmond DC', 'Richmond, VA', -47, 15) }));
    [[-5, 'D-0985', 'Blue Ridge Logistics', '900001', 760, 280], [-18, 'D-0971', 'Harbor Freight Brokers', '900002', 1320, 560], [-47, 'D-0950', 'Summit Freight', '900003', 910, 360], [-80, 'D-0922', 'Blue Ridge Logistics', '900001', 1080, 470]].forEach(([n, ref, bn, mc, rate, mi], i) => {
      const inv = day(n - 12);
      L.push(base({ ref, brokerName: bn, brokerMc: mc, rate, loaded: mi, dead: 30, stage: 'delivered', age: Math.abs(n) + 12, invoice: { no: 'LH-' + (9010 + i), date: inv, due: addDays(inv, 30), terms: 30, withDetention: false, sent: ts(n - 12) }, paidDate: day(n), paidAmount: rate, pick: P('Pickup ' + (i + 1), 'Allentown, PA', n - 13, 8), deliv: P('Delivery ' + (i + 1), 'Boston, MA', n - 12, 14) }));
    });
    S.loads.push(...L);
    const ex = (n, cat, amount, o) => S.expenses.push(Object.assign({ id: uid(), demo: true, date: day(n), cat, amount }, o || {}));
    [[-2, 412.3, 98.2, 'PA', 'Pilot', 128400], [-9, 388.8, 94.1, 'NY', 'Love\'s', 127540], [-17, 405.1, 99.0, 'NJ', 'TA', 126660], [-26, 372.4, 91.5, 'OH', 'Pilot', 125800], [-38, 399.9, 97.4, 'PA', 'Sheetz', 124900], [-52, 380.0, 93.6, 'VA', 'Love\'s', 124050], [-70, 365.2, 89.9, 'NJ', 'TA', 123180]].forEach(([n, a, g, s, v, o]) => ex(n, 'Fuel', a, { gallons: g, state: s, vendor: v, odo: o }));
    ex(-4, 'Tolls', 46.5, { vendor: 'E-ZPass', state: 'NJ' }); ex(-20, 'Tolls', 61.25, { vendor: 'E-ZPass', state: 'PA' }); ex(-33, 'Tolls', 38, { vendor: 'E-ZPass', state: 'NY' });
    ex(-6, 'Repairs', 284, { vendor: 'Tire shop' }); ex(-40, 'Repairs', 515.4, { vendor: 'Brake service' });
    ex(-3, 'Insurance', 640, { vendor: 'Progressive' }); ex(-33, 'Insurance', 640, { vendor: 'Progressive' }); ex(-63, 'Insurance', 640, { vendor: 'Progressive' });
    ex(-8, 'Parking', 24, { vendor: 'Truck parking' }); ex(-12, 'Lumper', 85, { vendor: 'Receiver lumper' }); ex(-15, 'Food', 31.4, { vendor: 'Diner' }); ex(-45, 'Permits', 120, { vendor: 'State permit' });
    [['NJ', 640, -10], ['PA', 910, -14], ['NY', 430, -22], ['OH', 520, -24]].forEach(([s, m, n]) => S.trips.push({ id: uid(), demo: true, date: day(n), state: s, miles: m, note: 'Demo trip' }));
    S.docs.push({ id: uid(), demo: true, type: 'Insurance', title: 'Truck policy (demo)', number: 'POL-DEMO', expires: day(20), files: [] }, { id: uid(), demo: true, type: 'Registration', title: 'Registration (demo)', number: 'REG-DEMO', expires: day(200), files: [] });
    S.maint.push({ id: uid(), demo: true, name: 'Oil change', everyMiles: 15000, everyDays: 0, lastMiles: Math.max(0, num(S.odometer || 128400) - 14800), lastDate: day(-120) });
    S.contacts = (S.contacts || []).concat([{ id: uid(), demo: true, label: 'Roadside assistance', name: 'Demo Roadside', phone: '555-0111' }, { id: uid(), demo: true, label: 'Dispatcher', name: 'Demo Dispatch', phone: '555-0122' }]);
    S.inspections = (S.inspections || []).concat([{ id: uid(), demo: true, type: 'pre', ts: ts(-1, 6), odo: 128400, notes: 'Right marker light out. Replaced.', items: Object.fromEntries(LH.INSPECT.flatMap((g, gi) => g[1].map((it, ii) => [gi + '.' + ii, gi === 1 && ii === 3 ? 'issue' : 'ok']))), photos: [] }]);
    S.calcs = (S.calcs || []).concat([{ id: uid(), demo: true, tool: 'detention-pay-calculator', name: 'Detention pay', inputs: { hours: 5.5, free: 2, rate: 60, cap: 0, rpm: 2.2, vcm: 1.45, mph: 50 }, headline: 'Detention owed: $210', ts: Date.now() - 864e5 }]);
    [['900001', 'Blue Ridge Logistics', 'good'], ['900002', 'Harbor Freight Brokers', ''], ['900003', 'Summit Freight', 'slow']].forEach(([mc, name, flag]) => { if (!S.brokers[mc]) S.brokers[mc] = { mc, name, flag, demo: true, notes: flag === 'slow' ? 'Pays late. Always follow up.' : '' }; });
    if (!num(S.odometer)) { S.odometer = 128400; S.demoOdo = true; }
    LH.save(); toast('Demo data added'); LH.render();
  };
  D.clear = function () {
    const S = LH.S;
    ['loads', 'expenses', 'docs', 'maint', 'trips', 'contacts', 'inspections', 'calcs'].forEach(k => { S[k] = (S[k] || []).filter(x => !x.demo); });
    Object.keys(S.brokers || {}).forEach(k => { if (S.brokers[k].demo) delete S.brokers[k]; });
    (S.demoSet || []).forEach(k => { S.settings[k] = ''; }); S.demoSet = []; if (S.demoOdo) { S.odometer = 0; S.demoOdo = false; }
    LH.save(); toast('Demo data cleared'); LH.render();
  };
  D.card = function () {
    if (!D.on() && !D.has()) return '';
    return `<div class="card"><h3>Demo data</h3><p class="muted" style="margin:0 0 12px;font-size:14px">Fill the app with sample loads, expenses, fuel and documents to try everything without typing. Sample items are tagged Demo and can be cleared in one tap. Your real entries are never touched.</p><div class="grid2"><button class="btn pri" data-act="demoAdd">Load demo data</button><button class="btn" data-act="demoClear">Clear demo data</button></div></div>`;
  };
  LH.acts.demoAdd = () => D.add(); LH.acts.demoClear = () => ask('Clear demo data?', 'Only the sample items tagged Demo are removed.', 'Clear', () => D.clear(), false);
})();

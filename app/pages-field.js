'use strict';
/* LaneHook driver portal: Tools, Scan to PDF, Road tools, Breakdown kit, Inspection checklist, Share LaneHook */
LH.arr = k => (LH.S[k] = Array.isArray(LH.S[k]) ? LH.S[k] : []);

/* ---------------- TOOLS (calculators saved to the account) ---------------- */
LH.takeCarry = function (id) {
  try { const c = JSON.parse(localStorage.getItem('lh-tool-carry') || 'null'); if (c && c.id === id && Date.now() - c.ts < 7 * 864e5) { localStorage.removeItem('lh-tool-carry'); return c.inputs; } } catch (e) { }
  return null;
};
LH.pages.tools = r => {
  if (!window.LHTools) return { title: 'Tools', back: 'more', html: LH.empty('Tools did not load', 'Refresh the page and try again.') };
  if (r.id) return toolPage(r.id);
  const saved = LH.arr('calcs').slice().sort((a, b) => b.ts - a.ts), last = {}; saved.forEach(c => { if (!last[c.tool]) last[c.tool] = c; });
  return {
    title: 'Tools', back: 'more', html: `<div class="list">${LHTools.list.map(t => `<a class="item" href="#/tools/${t.id}">${ic('calc')}<div class="t"><b>${esc(t.name)}</b><small>${last[t.id] ? 'Last saved: ' + esc(last[t.id].headline) : esc(t.short)}</small></div><span class="chev">${ic('chev', 18)}</span></a>`).join('')}</div>
    <p class="hint">Results you save are kept with your account and sync to your other devices. The same calculators are free on lanehook.com/tools.</p>`
  };
};
function histHTML(id) {
  const hs = LH.arr('calcs').filter(c => c.tool === id).sort((a, b) => b.ts - a.ts).slice(0, 12);
  return hs.length ? `<div class="sec"><h2>Saved results</h2><span class="muted">${hs.length}</span></div><div class="list">${hs.map(c => `<div class="item"><div class="t"><b>${esc(c.headline)}</b><small>${fmtDT(c.ts)}${c.note ? ' · ' + esc(c.note) : ''}</small></div><button class="btn sm" data-act="calcLoad" data-id="${c.id}">Use</button><button class="icon-btn" style="width:36px;height:36px" data-act="calcDel" data-id="${c.id}" aria-label="Delete">${ic('x', 16)}</button></div>`).join('')}</div>` : '';
}
function toolPage(id) {
  const t = LHTools.get(id); if (!t) return { title: 'Tools', back: 'tools', html: LH.empty('Tool not found', '', '<a class="btn" href="#/tools">All tools</a>') };
  return {
    title: t.name, back: 'tools', html: `<p class="muted" style="margin:0 0 12px">${esc(t.intro)}</p><div id="toolBanner"></div><div id="toolMount"></div><div id="toolHist">${histHTML(id)}</div>`,
    after: () => {
      const carry = LH.takeCarry(id), last = LH.arr('calcs').filter(c => c.tool === id).sort((a, b) => b.ts - a.ts)[0];
      if (carry) $('#toolBanner').innerHTML = '<div class="alert ok"><i></i><div><b>Your numbers from lanehook.com are filled in</b><small>Tap Save to keep this result in your account.</small></div></div>';
      LH.toolMount(id, carry || (last && last.inputs) || null);
    }
  };
}
LH.toolMount = function (id, prefill) {
  const m = $('#toolMount'); if (!m) return;
  LHTools.mount(m, id, {
    prefill: prefill || {}, saveLabel: 'Save this result', onSave: (inputs, result, t) => {
      LH.arr('calcs').push({ id: uid(), tool: id, name: t.name, inputs, headline: result.rows[0].label + ': ' + result.rows[0].value, ts: Date.now() }); LH.save();
      if (window.lhTrack) try { window.lhTrack('tool_saved', { tool: id }); } catch (e) { }
      toast('Saved to your account'); $('#toolHist').innerHTML = histHTML(id);
    }
  });
};
LH.acts.calcLoad = el => { const c = LH.arr('calcs').find(x => x.id === el.dataset.id); if (c) { LH.toolMount(c.tool, c.inputs); window.scrollTo(0, 0); } };
LH.acts.calcDel = el => { LH.S.calcs = LH.arr('calcs').filter(x => x.id !== el.dataset.id); LH.save(); const r = LH.route(); $('#toolHist').innerHTML = histHTML(r.id); };

/* ---------------- SCAN TO PDF ---------------- */
LH.pdf = {
  /* pages: [{ bytes: Uint8Array (JPEG), w, h }] -> Blob. A tiny writer: one JPEG per Letter page, portrait or landscape to fit. */
  fromJpegs(pages) {
    const enc = new TextEncoder(), parts = [], offs = []; let len = 0;
    const push = d => { const u = typeof d === 'string' ? enc.encode(d) : d; parts.push(u); len += u.length; };
    const obj = (n, head, stream) => { offs[n] = len; push(n + ' 0 obj\n' + head + (stream ? '\nstream\n' : '\n')); if (stream) { push(stream); push('\nendstream\n'); } push('endobj\n'); };
    push('%PDF-1.4\n');
    const kids = pages.map((p, i) => (3 + i * 3) + ' 0 R').join(' ');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>'); obj(2, '<< /Type /Pages /Kids [' + kids + '] /Count ' + pages.length + ' >>');
    pages.forEach((p, i) => {
      const land = p.w > p.h, W = land ? 792 : 612, H = land ? 612 : 792, aw = W - 54, ah = H - 54, k = Math.min(aw / p.w, ah / p.h), dw = p.w * k, dh = p.h * k, x = (W - dw) / 2, y = (H - dh) / 2;
      const pn = 3 + i * 3, cn = pn + 1, im = pn + 2, content = 'q ' + dw.toFixed(2) + ' 0 0 ' + dh.toFixed(2) + ' ' + x.toFixed(2) + ' ' + y.toFixed(2) + ' cm /Im0 Do Q';
      obj(pn, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /XObject << /Im0 ' + im + ' 0 R >> >> /Contents ' + cn + ' 0 R >>');
      obj(cn, '<< /Length ' + content.length + ' >>', enc.encode(content));
      obj(im, '<< /Type /XObject /Subtype /Image /Width ' + p.w + ' /Height ' + p.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + p.bytes.length + ' >>', p.bytes);
    });
    const n = 3 + pages.length * 3, xref = len; let x = 'xref\n0 ' + n + '\n0000000000 65535 f \n';
    for (let i = 1; i < n; i++) x += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
    push(x + 'trailer\n<< /Size ' + n + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
    return new Blob(parts, { type: 'application/pdf' });
  }
};
LH.scan = { pages: [], name: '' };
LH.pages.scan = r => {
  const L = LH.scan, loads = [...LH.S.loads].sort((a, b) => (b.created || 0) - (a.created || 0)).slice(0, 25), pre = r.id && LH.load(r.id);
  const kinds = ['BOL', 'POD', 'Rate con', 'Receipt', 'Other'];
  return {
    title: 'Scan to PDF', back: pre ? 'load/' + pre.id : 'more', html: `<div class="card"><h3>Photograph each page</h3><div class="muted" style="font-size:14px;margin-bottom:12px">Lay the paper flat in good light and fill the frame. Add one page at a time, then send one PDF.</div>
    <div class="row wrap"><label class="btn pri" for="scCam">${ic('cam', 18)}${L.pages.length ? 'Add next page' : 'Take photo'}</label><label class="btn" for="scFile">Choose photos</label></div>
    <input id="scCam" type="file" accept="image/*" capture="environment" data-change="scanAdd"><input id="scFile" type="file" accept="image/*" multiple data-change="scanAdd"></div>
    ${L.pages.length ? `<div class="thumbs" id="scThumbs" style="margin-bottom:14px">${L.pages.map((p, i) => `<div class="thumb"><img alt="Page ${i + 1}" src="${p.url}"><small>Page ${i + 1}</small><div style="position:absolute;top:2px;right:2px;display:flex;gap:2px">${i > 0 ? `<button class="icon-btn" style="width:30px;height:30px;background:rgba(0,0,0,.6);color:#fff" data-act="scanMove" data-v="${i}" aria-label="Move earlier">‹</button>` : ''}<button class="icon-btn" style="width:30px;height:30px;background:rgba(0,0,0,.6);color:#fff" data-act="scanDel" data-v="${i}" aria-label="Remove page">${ic('x', 14)}</button></div></div>`).join('')}</div>
    <div class="card"><label class="f"><span>File name</span><input id="scName" value="${esc(L.name || (pre ? (pre.ref || 'load') + '-' : 'scan-') + isoDay())}" autocomplete="off"></label>
      <button class="btn pri block" data-act="scanShare">${ic('send', 18)}Send to broker (${L.pages.length} page${L.pages.length === 1 ? '' : 's'})</button>
      <div class="grid2" style="margin-top:10px"><button class="btn" data-act="scanDownload">${ic('down', 16)}Save PDF</button><button class="btn" data-act="scanClear">Start over</button></div></div>
    <div class="card"><h3>Keep a copy in LaneHook</h3><label class="f"><span>Attach to load</span><select id="scLoad"><option value="">Choose a load</option>${loads.map(l => `<option value="${l.id}" ${pre && pre.id === l.id ? 'selected' : ''}>${esc(LH.loadLabel(l) + ' · ' + LH.routeLabel(l))}</option>`).join('')}</select></label><label class="f"><span>What is it</span><select id="scKind">${kinds.map(k => `<option>${k}</option>`).join('')}</select></label>
      <div class="grid2"><button class="btn" data-act="scanToLoad">Attach to load</button><button class="btn" data-act="scanToDocs">Save in Documents</button></div></div>` : ''}`
  };
};
LH.acts.scanAdd = async el => {
  const files = [...(el.files || [])]; if (!files.length) return;
  for (const f of files) {
    const { blob } = await LH.prepFile(f, 2000); let bmp; try { bmp = await createImageBitmap(blob); } catch (e) { toast('Could not read that photo'); continue; }
    LH.scan.pages.push({ blob, w: bmp.width, h: bmp.height, url: URL.createObjectURL(blob) });
  }
  LH.render();
};
LH.acts.scanDel = el => { const p = LH.scan.pages.splice(+el.dataset.v, 1)[0]; if (p) URL.revokeObjectURL(p.url); LH.render(); };
LH.acts.scanMove = el => { const i = +el.dataset.v, a = LH.scan.pages; [a[i - 1], a[i]] = [a[i], a[i - 1]]; LH.render(); };
LH.acts.scanClear = () => ask('Start over?', 'The pages you scanned are removed.', 'Remove', () => { LH.scan.pages.forEach(p => URL.revokeObjectURL(p.url)); LH.scan = { pages: [], name: '' }; LH.render(); }, true);
LH.scanBlob = async function () {
  const pages = []; for (const p of LH.scan.pages) pages.push({ bytes: new Uint8Array(await p.blob.arrayBuffer()), w: p.w, h: p.h });
  return LH.pdf.fromJpegs(pages);
};
const scName = () => ((($('#scName') || {}).value || 'scan').replace(/[^\w\- ]/g, '').trim() || 'scan');
LH.acts.scanDownload = async () => { const b = await LH.scanBlob(), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = scName() + '.pdf'; a.click(); toast('PDF saved'); };
LH.acts.scanShare = async () => {
  const b = await LH.scanBlob(), f = new File([b], scName() + '.pdf', { type: 'application/pdf' });
  if (navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], title: scName() }); } catch (e) { } }
  else { toast('Sharing is not available here, so the PDF was saved. Attach it to your email.'); LH.acts.scanDownload(); }
};
LH.acts.scanToLoad = async () => {
  const id = $('#scLoad').value, l = id && LH.load(id); if (!l) { toast('Choose a load first'); return; }
  const b = await LH.scanBlob(), pid = uid(), kind = $('#scKind').value; await LH.putBlob(pid, b);
  (l.photos = l.photos || []).push({ id: pid, kind, ts: Date.now(), type: 'application/pdf', name: scName() + '.pdf', note: LH.scan.pages.length + ' pages' }); LH.save();
  LH.scan.pages.forEach(p => URL.revokeObjectURL(p.url)); LH.scan = { pages: [], name: '' }; toast('Attached to the load'); LH.go('load/' + l.id);
};
LH.acts.scanToDocs = async () => {
  const b = await LH.scanBlob(), pid = uid(), kind = $('#scKind').value, name = scName(); await LH.putBlob(pid, b);
  LH.arr('docs').push({ id: uid(), type: 'Other', title: name, number: '', expires: '', files: [{ id: pid, type: 'application/pdf', name: name + '.pdf' }] }); LH.save();
  LH.scan.pages.forEach(p => URL.revokeObjectURL(p.url)); LH.scan = { pages: [], name: '' }; toast('Saved in Documents'); LH.go('vault');
};

/* ---------------- ROAD TOOLS ---------------- */
LH.pos = null;
const isApple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
LH.mapApp = () => LH.S.settings.mapApp || (isApple ? 'apple' : 'google');
LH.mapURL = function (q, pos) {
  const app = LH.mapApp();
  if (app === 'apple') return 'https://maps.apple.com/?q=' + encodeURIComponent(q) + (pos ? '&sll=' + pos.lat.toFixed(5) + ',' + pos.lng.toFixed(5) : '');
  return 'https://www.google.com/maps/search/' + encodeURIComponent(q + (pos ? '' : ' near me')) + (pos ? '/@' + pos.lat.toFixed(5) + ',' + pos.lng.toFixed(5) + ',12z' : '');
};
LH.locLink = pos => pos ? 'https://maps.google.com/?q=' + pos.lat.toFixed(6) + ',' + pos.lng.toFixed(6) : '';
const ROAD = [['Truck stops', 'truck stop', 'truck'], ['Truck parking', 'truck parking', 'truck'], ['CAT scales', 'CAT scale', 'calc'], ['Diesel fuel', 'diesel fuel', 'money'], ['Truck wash', 'truck wash', 'sun'], ['Truck repair', 'truck repair shop', 'wrench'], ['Tire shop', 'commercial truck tires', 'wrench'], ['Rest areas', 'rest area', 'pin'], ['Weigh stations', 'weigh station', 'pin']];
LH.pages.road = () => ({
  title: 'Road tools', back: 'more', html: `<div class="chips" style="margin-bottom:4px">${[['google', 'Google Maps'], ['apple', 'Apple Maps']].map(m => `<button class="chip ${LH.mapApp() === m[0] ? 'on' : ''}" data-act="mapApp" data-v="${m[0]}">${m[1]}</button>`).join('')}</div>
    <div class="muted" id="roadState" style="margin:0 0 12px;font-size:14px">Finding your location…</div>
    <div class="list">${ROAD.map(r => `<a class="item road-link" data-q="${esc(r[1])}" href="${LH.mapURL(r[1], LH.pos)}" target="_blank" rel="noopener">${ic(r[2])}<div class="t"><b>${r[0]}</b><small>Open near you</small></div><span class="chev">${ic('chev', 18)}</span></a>`).join('')}</div>
    <p class="hint">LaneHook opens your maps app with the search already filled in. Results come from the maps app, so check hours and truck access before you go.</p>`,
  after: () => LH.roadPos(p => { const st = $('#roadState'); if (st) st.textContent = p ? 'Using your current location.' : 'Location is off, so searches use "near me" in your maps app.'; $$('.road-link').forEach(a => { a.href = LH.mapURL(a.dataset.q, p); }); })
});
LH.roadPos = async function (cb) { if (LH.pos && Date.now() - LH.pos.t < 120000) { cb(LH.pos); return; } const g = await LH.gps(); LH.pos = g ? Object.assign(g, { t: Date.now() }) : null; cb(LH.pos); };
LH.acts.mapApp = el => { LH.S.settings.mapApp = el.dataset.v; LH.save(); LH.render(); };

/* ---------------- BREAKDOWN KIT ---------------- */
const CONTACT_LABELS = ['Roadside assistance', 'Insurance claims', 'Towing', 'Mechanic', 'Dispatcher', 'Family'];
LH.smsHref = (phone, pos) => 'sms:' + (phone || '') + '?&body=' + encodeURIComponent(pos ? 'I need help. My location: ' + LH.locLink(pos) : 'I need help. I could not get my GPS location yet.');
LH.pages.breakdown = () => {
  const cs = LH.arr('contacts'), docs = LH.arr('docs').filter(d => d.type === 'Insurance' || d.type === 'Registration');
  return {
    title: 'Breakdown kit', back: 'more', html: `<div class="card"><h3>Send your location</h3><div class="muted" style="font-size:14px;margin-bottom:12px" id="bkState">Finding your location…</div><div class="grid2"><a class="btn pri" id="bkSms" href="${LH.smsHref('', LH.pos)}">Text my location</a><button class="btn" data-act="shareLoc">${ic('send', 16)}Share location</button></div></div>
    <div class="card"><div class="row"><h3 class="sp" style="margin:0">Your contacts</h3><button class="btn sm" data-act="addContact">${ic('plus', 16)}Add</button></div>
      ${cs.length ? cs.map(c => `<div class="row" style="padding:10px 0;border-top:1px solid var(--border)"><div class="t sp"><b>${esc(c.label)}</b><div class="muted" style="font-size:14px">${esc(c.name || '')} ${esc(c.phone)}</div></div><a class="btn sm pri" href="tel:${esc(c.phone)}">Call</a><a class="btn sm bk-sms" data-phone="${esc(c.phone)}" href="${LH.smsHref(c.phone, LH.pos)}">Text</a><button class="icon-btn" style="width:36px;height:36px" data-act="editContact" data-id="${c.id}" aria-label="Edit">${ic('edit', 16)}</button></div>`).join('') : '<div class="muted" style="margin-top:8px">Save the numbers you would need on the side of the road: roadside assistance, insurance, a tow company, your dispatcher.</div>'}</div>
    <div class="card"><h3>Insurance and registration</h3>${docs.length ? docs.map(d => { const s = LH.docState(d); return `<div class="row" style="padding:8px 0"><div class="t sp"><b>${esc(d.title)}</b><div class="muted" style="font-size:14px">${esc(s.label)}</div></div><button class="btn sm" data-act="openDoc" data-id="${d.id}">View</button><button class="btn sm" data-act="shareDoc" data-id="${d.id}">Send</button></div>`; }).join('') : '<div class="muted">Add your insurance card and registration in Documents and they will show up here.</div><a class="btn sm" style="margin-top:10px" href="#/vault">Open Documents</a>'}</div>
    <div class="card"><h3>If you break down</h3><ol class="muted" style="margin:0;padding-left:20px;font-size:14px;line-height:1.7"><li>Get as far off the road as you safely can and turn on your hazard lights.</li><li>Stay in the truck or well away from traffic. Do not stand in a live lane.</li><li>Set out reflective triangles if you carry them and it is safe to do so.</li><li>Call roadside assistance, then your dispatcher or broker.</li><li>Send your location with the button above, and take photos of anything that matters.</li></ol></div>`,
    after: () => LH.roadPos(p => { const st = $('#bkState'); if (!st) return; st.textContent = p ? 'Location ready. Accuracy about ' + (p.acc || '?') + ' m.' : 'Location is off. Allow location for this site, then reload.'; const a = $('#bkSms'); if (a) a.href = LH.smsHref('', p); $$('.bk-sms').forEach(x => { x.href = LH.smsHref(x.dataset.phone, p); }); })
  };
};
LH.acts.shareLoc = async () => {
  const p = LH.pos || await LH.gps(); if (!p) { toast('Could not get your location'); return; }
  const text = 'My location: ' + LH.locLink(p);
  if (navigator.share) { try { await navigator.share({ title: 'My location', text }); } catch (e) { } } else { try { await navigator.clipboard.writeText(text); toast('Location link copied'); } catch (e) { toast(text, 6000); } }
};
function contactSheet(c) {
  const isNew = !c; c = c || {};
  const s = openSheet(isNew ? 'Add contact' : 'Edit contact', `<form id="ctForm"><label class="f"><span>Who is it</span><input name="label" list="ctList" value="${esc(c.label || '')}" required><datalist id="ctList">${CONTACT_LABELS.map(x => `<option>${x}</option>`).join('')}</datalist></label><div class="grid2"><label class="f"><span>Name (optional)</span><input name="name" value="${esc(c.name || '')}"></label><label class="f"><span>Phone</span><input name="phone" type="tel" inputmode="tel" value="${esc(c.phone || '')}" required></label></div>
    <div class="${isNew ? '' : 'grid2'}">${isNew ? '' : '<button type="button" class="btn bad" id="ctDel">Delete</button>'}<button class="btn pri ${isNew ? 'block' : ''}">Save</button></div></form>`, { noFocus: true });
  $('#ctForm', s).onsubmit = e => { e.preventDefault(); const o = LH.form(e.target), rec = isNew ? { id: uid() } : c; Object.assign(rec, { label: o.label, name: o.name, phone: o.phone }); if (isNew) LH.arr('contacts').push(rec); LH.save(); closeSheet(); LH.render(); };
  const d = $('#ctDel', s); if (d) d.onclick = () => { LH.S.contacts = LH.arr('contacts').filter(x => x.id !== c.id); LH.save(); closeSheet(); LH.render(); };
}
LH.acts.addContact = () => contactSheet(); LH.acts.editContact = el => contactSheet(LH.arr('contacts').find(x => x.id === el.dataset.id));

/* ---------------- INSPECTION CHECKLIST ---------------- */
LH.INSPECT = [
  ['Cab', ['Brakes and parking brake', 'Steering', 'Horn', 'Windshield and wipers', 'Mirrors', 'Seat belt', 'Gauges and warning lights']],
  ['Outside the truck', ['Tires, wheels and lug nuts', 'Headlights and tail lights', 'Turn signals and hazards', 'Reflectors and markers', 'Fluid leaks under the truck', 'Engine oil and coolant', 'Suspension and frame', 'Exhaust']],
  ['Cargo and safety', ['Cargo door and latches', 'Load secured', 'Fuel level', 'Fire extinguisher', 'Reflective triangles', 'Registration and insurance in the cab']]
];
LH.ins = null;
LH.pages.inspect = r => {
  if (r.id === 'new') return inspectForm(r.sub === 'post' ? 'post' : 'pre');
  const hs = LH.arr('inspections').slice().sort((a, b) => b.ts - a.ts);
  return {
    title: 'Inspections', back: 'more', html: `<div class="card"><div class="muted" style="font-size:14px;margin-bottom:12px">A quick walk-around you keep for your own records, with photos of anything that looks wrong. It is a checklist, not a legal DVIR, and LaneHook is not an ELD.</div><div class="grid2"><a class="btn pri" href="#/inspect/new/pre">Pre-trip</a><a class="btn" href="#/inspect/new/post">Post-trip</a></div></div>
    ${hs.length ? `<div class="sec"><h2>Past inspections</h2><span class="muted">${hs.length}</span></div><div class="list">${hs.map(i => { const bad = Object.values(i.items || {}).filter(v => v === 'issue').length; return `<button class="item" data-act="openInspect" data-id="${i.id}"><div class="t"><b>${i.type === 'post' ? 'Post-trip' : 'Pre-trip'}</b><small>${fmtDT(i.ts)}${i.odo ? ' · ' + Math.round(i.odo).toLocaleString() + ' mi' : ''}</small></div><span class="badge ${bad ? 'bad' : 'ok'}">${bad ? bad + ' issue' + (bad === 1 ? '' : 's') : 'All OK'}</span></button>`; }).join('')}</div>` : ''}`
  };
};
function inspectForm(type) {
  if (!LH.ins || LH.ins.type !== type) LH.ins = { type, items: {}, photos: [], notes: '', odo: LH.S.odometer || '' };
  const D = LH.ins;
  return {
    title: type === 'post' ? 'Post-trip checklist' : 'Pre-trip checklist', back: 'inspect', html: `<form id="insForm">${LH.INSPECT.map((g, gi) => `<div class="card"><h3>${g[0]}</h3>${g[1].map((it, ii) => { const k = gi + '.' + ii, v = D.items[k]; return `<div class="row ins-row" style="padding:8px 0;border-top:1px solid var(--border)"><span class="sp">${esc(it)}</span><button type="button" class="chip ${v === 'ok' ? 'on' : ''}" data-act="insSet" data-id="${k}" data-v="ok">OK</button><button type="button" class="chip ${v === 'issue' ? 'on' : ''}" style="${v === 'issue' ? 'background:var(--bad);border-color:var(--bad);color:#fff' : ''}" data-act="insSet" data-id="${k}" data-v="issue">Issue</button></div>`; }).join('')}</div>`).join('')}
    <div class="card"><div class="grid2"><label class="f"><span>Odometer</span><input name="odo" inputmode="numeric" value="${esc(D.odo)}"></label><div></div></div><label class="f"><span>Notes about any issue</span><textarea name="notes">${esc(D.notes)}</textarea></label>
      <div class="row" style="margin-bottom:6px"><label class="btn sm" for="insPh">${ic('cam', 16)}Add photo</label><input id="insPh" type="file" accept="image/*" capture="environment" data-change="insPhoto"><span class="muted" id="insPhN">${D.photos.length ? D.photos.length + ' photo' + (D.photos.length === 1 ? '' : 's') : ''}</span></div></div>
    <div class="row wrap" style="margin-bottom:10px"><button type="button" class="btn sm" data-act="insAllOk">Mark everything OK</button></div>
    <button class="btn pri block" type="submit">Save inspection</button><p class="hint" style="margin-top:10px">This checklist is your own record. It does not replace a driver vehicle inspection report required by law.</p></form>`
  };
}
LH.acts.insSet = el => { const D = LH.ins, k = el.dataset.id, v = el.dataset.v; D.items[k] = D.items[k] === v ? '' : v; const row = el.closest('.ins-row'); $$('[data-act=insSet]', row).forEach(b => { const on = D.items[k] === b.dataset.v; b.classList.toggle('on', on); b.style.cssText = on && b.dataset.v === 'issue' ? 'background:var(--bad);border-color:var(--bad);color:#fff' : ''; }); };
LH.acts.insAllOk = () => { LH.INSPECT.forEach((g, gi) => g[1].forEach((it, ii) => { LH.ins.items[gi + '.' + ii] = 'ok'; })); LH.render(); };
LH.acts.insPhoto = async el => { const f = el.files[0]; if (!f) return; const r = await LH.prepFile(f, 1400); LH.ins.photos.push({ blob: r.blob, type: r.type }); $('#insPhN').textContent = LH.ins.photos.length + ' photo' + (LH.ins.photos.length === 1 ? '' : 's'); };
document.addEventListener('submit', async e => {
  if (e.target.id !== 'insForm') return; e.preventDefault(); const D = LH.ins, o = LH.form(e.target);
  const total = LH.INSPECT.reduce((s, g) => s + g[1].length, 0), done = Object.values(D.items).filter(Boolean).length;
  if (done < total) { toast(done ? 'Mark each item OK or Issue (' + (total - done) + ' left)' : 'Mark each item OK or Issue'); return; }
  const rec = { id: uid(), type: D.type, ts: Date.now(), odo: num(o.odo), notes: o.notes, items: Object.assign({}, D.items), photos: [] };
  for (const p of D.photos) { const id = uid(); await LH.putBlob(id, p.blob); rec.photos.push({ id, type: p.type }); }
  LH.arr('inspections').push(rec); if (rec.odo > num(LH.S.odometer)) LH.S.odometer = rec.odo; LH.save(); LH.ins = null;
  const bad = Object.values(rec.items).filter(v => v === 'issue').length; toast(bad ? 'Saved with ' + bad + ' issue' + (bad === 1 ? '' : 's') : 'Saved. All OK'); LH.go('inspect');
});
LH.inspectText = i => { const lines = [(i.type === 'post' ? 'Post-trip' : 'Pre-trip') + ' inspection · ' + fmtDT(i.ts) + (i.odo ? ' · ' + Math.round(i.odo).toLocaleString() + ' mi' : '')]; LH.INSPECT.forEach((g, gi) => g[1].forEach((it, ii) => { if (i.items[gi + '.' + ii] === 'issue') lines.push('ISSUE: ' + it); })); if (lines.length === 1) lines.push('No issues found.'); if (i.notes) lines.push('Notes: ' + i.notes); return lines.join('\n'); };
LH.acts.openInspect = el => {
  const i = LH.arr('inspections').find(x => x.id === el.dataset.id), bad = [];
  LH.INSPECT.forEach((g, gi) => g[1].forEach((it, ii) => { if (i.items[gi + '.' + ii] === 'issue') bad.push(it); }));
  openSheet((i.type === 'post' ? 'Post-trip' : 'Pre-trip') + ' · ' + fmtDay(isoDay(new Date(i.ts))), `<div class="row wrap" style="margin-bottom:10px"><span class="badge ${bad.length ? 'bad' : 'ok'}">${bad.length ? bad.length + ' issue' + (bad.length === 1 ? '' : 's') : 'All OK'}</span><span class="muted">${fmtDT(i.ts)}${i.odo ? ' · ' + Math.round(i.odo).toLocaleString() + ' mi' : ''}</span></div>
    ${bad.length ? `<ul style="margin:0 0 10px;padding-left:20px">${bad.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}${i.notes ? `<div style="white-space:pre-wrap;margin-bottom:10px">${esc(i.notes)}</div>` : ''}
    ${(i.photos || []).length ? `<div class="thumbs" style="margin-bottom:12px">${i.photos.map(p => `<a class="thumb" target="_blank" rel="noopener" data-blob-href="${p.id}"><img alt="" data-blob="${p.id}"></a>`).join('')}</div>` : ''}
    <div class="grid2"><button class="btn" data-act="insShare" data-id="${i.id}">${ic('send', 16)}Share</button><button class="btn bad" data-act="insDel" data-id="${i.id}">Delete</button></div>`, { noFocus: true });
};
LH.acts.insShare = async el => { const t = LH.inspectText(LH.arr('inspections').find(x => x.id === el.dataset.id)); if (navigator.share) { try { await navigator.share({ title: 'Inspection', text: t }); } catch (e) { } } else { try { await navigator.clipboard.writeText(t); toast('Copied'); } catch (e) { } } };
LH.acts.insDel = el => ask('Delete inspection?', 'The record and its photos are removed.', 'Delete', async () => { const i = LH.arr('inspections').find(x => x.id === el.dataset.id); for (const p of i.photos || []) await LH.delBlob(p.id); LH.S.inspections = LH.arr('inspections').filter(x => x.id !== i.id); LH.save(); LH.render(); });

/* ---------------- SHARE LANEHOOK ---------------- */
LH.acts.invite = async () => {
  const data = { title: 'LaneHook', text: 'I use LaneHook to track loads, detention, invoices and expenses. It is free to start:', url: 'https://lanehook.com/?ref=driver-invite' };
  if (window.lhTrack) try { window.lhTrack('invite_share'); } catch (e) { }
  if (navigator.share) { try { await navigator.share(data); } catch (e) { } return; }
  try { await navigator.clipboard.writeText(data.text + ' ' + data.url); toast('Invite link copied'); } catch (e) { openSheet('Share LaneHook', `<p class="muted">Send this link to another driver:</p><input readonly value="${esc(data.url)}" onfocus="this.select()">`); }
};

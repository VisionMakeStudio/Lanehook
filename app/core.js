'use strict';
/* LaneHook driver portal: core (storage, helpers, UI kit, router) */
const LH = window.LH = { pages: {}, acts: {}, S: null };

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : 0; };
const money = n => (n < 0 ? '-' : '') + '$' + Math.abs(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money0 = n => (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n || 0)).toLocaleString('en-US');
const isoDay = (d = new Date()) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4); return z.toISOString().slice(0, 10); };
const fmtDay = s => { if (!s) return '–'; const d = new Date(s.length === 10 ? s + 'T12:00:00' : s); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }); };
const fmtDT = ts => { if (!ts) return '–'; return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); };
const fmtHM = ms => { const m = Math.max(0, Math.floor(ms / 6e4)); return Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm'; };
const clock = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return String(Math.floor(s / 3600)).padStart(2, '0') + ':' + String(Math.floor(s % 3600 / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const daysFrom = s => Math.round((new Date(s + 'T12:00:00') - new Date(isoDay() + 'T12:00:00')) / 864e5);
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return isoDay(d); };
const cleanMC = v => String(v || '').replace(/\D/g, '').replace(/^0+/, '');

/* ---------- storage: one JSON state in IndexedDB + photo blobs ---------- */
const DEFAULT_STATE = () => ({ v: 1, settings: { terms: 30, mpg: 8, nextInv: 1, theme: 'dark', fuelPrice: 0, costPerMile: 0 }, loads: [], brokers: {}, docs: [], expenses: [], maint: [], trips: [], odometer: 0 });
let idb = null, saveTimer = null;
LH.storageOK = false;

function openDB() {
  return new Promise((res, rej) => {
    if (!window.indexedDB) return rej(new Error('no idb'));
    const r = indexedDB.open('lanehook', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('kv'); r.result.createObjectStore('blobs'); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
function idbDo(store, mode, fn) {
  return new Promise((res, rej) => {
    const t = idb.transaction(store, mode), req = fn(t.objectStore(store));
    t.oncomplete = () => res(req && req.result);
    t.onerror = () => rej(t.error);
  });
}
LH.boot = async function () {
  try { idb = await openDB(); LH.storageOK = true; } catch (e) { idb = null; }
  let st = null;
  if (idb) { try { const raw = await idbDo('kv', 'readonly', s => s.get('state')); if (raw) st = JSON.parse(raw); } catch (e) { } }
  LH.S = Object.assign(DEFAULT_STATE(), st || {});
  LH.S.settings = Object.assign(DEFAULT_STATE().settings, (st && st.settings) || {});
  if (idb && navigator.storage && navigator.storage.persist) { try { navigator.storage.persist(); } catch (e) { } }
};
LH.persist = function () {
  if (!idb) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { idbDo('kv', 'readwrite', s => s.put(JSON.stringify(LH.S), 'state')).catch(() => toast('Could not save. Storage may be full.')); }, 150);
};
LH.save = function () { LH.S.updatedAt = Date.now(); LH.persist(); if (LH.sync) LH.sync.schedule(); };
/* wipe this device's copy (used when a different person signs in, and on sign-out) */
LH.resetLocal = async function () {
  clearTimeout(saveTimer);
  for (const k in urlCache) delete urlCache[k];
  if (idb) { idb.close(); await new Promise(r => { const q = indexedDB.deleteDatabase('lanehook'); q.onsuccess = q.onerror = q.onblocked = r; }); try { idb = await openDB(); } catch (e) { idb = null; } }
  LH.S = DEFAULT_STATE();
};
const urlCache = {};
LH.putBlob = async (id, blob) => { if (!idb) { urlCache[id] = URL.createObjectURL(blob); return; } await idbDo('blobs', 'readwrite', s => s.put(blob, id)); };
LH.getBlob = id => idb ? idbDo('blobs', 'readonly', s => s.get(id)) : Promise.resolve(null);
LH.delBlob = id => { delete urlCache[id]; if (LH.sync) LH.sync.removeBlob(id); return idb ? idbDo('blobs', 'readwrite', s => s.delete(id)).catch(() => { }) : Promise.resolve(); };
LH.blobURL = async id => { if (urlCache[id]) return urlCache[id]; let b = await LH.getBlob(id); if (!b && LH.sync) b = await LH.sync.fetchBlob(id); if (!b) return ''; return (urlCache[id] = URL.createObjectURL(b)); };
/* fill <img data-blob=id> and <a data-blob-href=id> after render */
LH.hydrateBlobs = root => {
  $$('[data-blob]', root).forEach(async el => { const u = await LH.blobURL(el.dataset.blob); if (u) el.src = u; });
  $$('[data-blob-href]', root).forEach(async el => { const u = await LH.blobURL(el.dataset.blobHref); if (u) { el.href = u; } });
};

/* compress a photo to a jpeg blob (PDFs and other files pass through) */
LH.prepFile = async function (file, max = 1800) {
  if (!file.type.startsWith('image/')) return { blob: file, type: file.type || 'application/octet-stream' };
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .82));
    return { blob: blob || file, type: 'image/jpeg' };
  } catch (e) { return { blob: file, type: file.type }; }
};
LH.fileToBase64 = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(f); });

/* ---------- icons ---------- */
const P = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  truck: '<path d="M3 6h11v9H3z"/><path d="M14 9h4l3 3v3h-7z"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  money: '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5c0-1 1-1.8 2.5-1.8s2.5.8 2.5 1.8-1 1.6-2.5 1.9-2.5.9-2.5 1.9 1 1.8 2.5 1.8 2.5-.8 2.5-1.8"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  dots: '<circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chev: '<path d="M9 5l7 7-7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  doc: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/>',
  cam: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  clock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>',
  calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M12 12h2M16 12h0M8 16h2M12 16h2M16 16h0"/>',
  wrench: '<path d="M14.5 6.5a4 4 0 0 0 5 5L11 20a2.1 2.1 0 0 1-3-3z"/><path d="M14.5 6.5l3-3 3 3-3 3"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-4 3-6 6.5-6s6 2 6.5 6"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3c2 .7 3.2 2.600 3.500 5.700"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.900 4.900l2.100 2.100M17 17l2.100 2.100M4.900 19.100L7 17M17 7l2.100-2.100"/>',
  pin: '<path d="M12 21s-7-6.200-7-11a7 7 0 0 1 14 0c0 4.800-7 11-7 11z"/><circle cx="12" cy="10" r="2.500"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  send: '<path d="M21 3L3 11l7 3 3 7z"/><path d="M10 14l11-11"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.500 1.500M17.500 17.500L19 19M5 19l1.500-1.500M17.500 6.500L19 5"/>',
  down: '<path d="M12 4v12M6 12l6 6 6-6M5 21h14"/>'
};
const ic = (n, s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;

/* ---------- UI kit ---------- */
function toast(msg, ms = 2600) {
  $$('.toast').forEach(t => t.remove());
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}
let sheetEl = null;
function closeSheet() { if (sheetEl) { sheetEl.remove(); sheetEl = null; } }
function openSheet(title, body, opts = {}) {
  closeSheet();
  const s = document.createElement('div'); s.className = 'scrim';
  s.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="hd"><h2>${esc(title)}</h2><button class="icon-btn" data-act="closeSheet" aria-label="Close">${ic('x')}</button></div>${body}</div>`;
  s.addEventListener('mousedown', e => { if (e.target === s) closeSheet(); });
  document.body.appendChild(s); sheetEl = s;
  LH.hydrateBlobs(s);
  const f = $('input:not([type=file]):not([type=hidden]),select,textarea', s); if (f && !opts.noFocus && matchMedia('(pointer:fine)').matches) f.focus();
  return s;
}
function closeMenu() { $$('.menu').forEach(m => m.remove()); document.removeEventListener('mousedown', menuOutside, true); }
function menuOutside(e) { if (!e.target.closest('.menu')) closeMenu(); }
function openMenu(anchor, items) {
  closeMenu();
  const m = document.createElement('div'); m.className = 'menu'; m.setAttribute('role', 'menu');
  m.innerHTML = items.filter(Boolean).map(i => `<button role="menuitem" class="${i.bad ? 'bad' : ''}" data-act="${i.act}" data-id="${esc(i.id || '')}" data-v="${esc(i.v || '')}">${i.icon ? ic(i.icon, 18) : ''}${esc(i.label)}</button>`).join('');
  document.body.appendChild(m);
  const r = anchor.getBoundingClientRect(), w = m.offsetWidth, h = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + 'px';
  m.style.top = (r.bottom + 6 + h > innerHeight ? Math.max(8, r.top - h - 6) : r.bottom + 6) + 'px';
  setTimeout(() => document.addEventListener('mousedown', menuOutside, true), 0);
}
function ask(title, msg, okLabel, onOk, bad = true) {
  const s = openSheet(title, `<p class="muted" style="margin:0 0 16px">${msg}</p><div class="grid2"><button class="btn" data-act="closeSheet">Cancel</button><button class="btn ${bad ? 'pri' : 'pri'}" id="askOk">${esc(okLabel)}</button></div>`, { noFocus: true });
  $('#askOk', s).onclick = () => { closeSheet(); onOk(); };
}
LH.acts.closeSheet = closeSheet;
LH.toast = toast; LH.openSheet = openSheet; LH.closeSheet = closeSheet; LH.openMenu = openMenu; LH.closeMenu = closeMenu; LH.ask = ask; LH.ic = ic;

/* global click delegation: any [data-act] calls LH.acts[name](el, event) */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const fn = LH.acts[el.dataset.act]; if (!fn) return;
  if (!el.closest('.menu')) closeMenu(); else setTimeout(closeMenu, 0);
  fn(el, e);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeSheet(); closeMenu(); } });

/* ---------- router + shell ---------- */
const NAV = [
  { k: 'home', label: 'Home', icon: 'home', tab: 1 },
  { k: 'loads', label: 'Loads', icon: 'truck', tab: 1 },
  { k: 'guard', label: 'Load Guard', short: 'Check', icon: 'shield', tab: 1 },
  { k: 'money', label: 'Money', icon: 'money', tab: 1 },
  { k: 'more', label: 'More', icon: 'more', tab: 1, noside: 1 },
  { sep: 1 },
  { k: 'vault', label: 'Documents', icon: 'doc', side: 1 },
  { k: 'brokers', label: 'Brokers', icon: 'users', side: 1 },
  { k: 'calc', label: 'Profit calculator', icon: 'calc', side: 1 },
  { k: 'maint', label: 'Truck care', icon: 'wrench', side: 1 },
  { k: 'settings', label: 'Settings', icon: 'gear', side: 1 }
];
const wordmark = () => document.documentElement.dataset.theme === 'light' ? 'icons/wordmark-nav-dark.svg' : 'icons/wordmark-nav.svg';
LH.route = () => { const h = location.hash.replace(/^#\/?/, '').split('/'); return { name: h[0] || 'home', id: h[1] ? decodeURIComponent(h[1]) : '', sub: h[2] || '' }; };
LH.go = p => { if (location.hash === '#/' + p) LH.render(); else location.hash = '#/' + p; };
let tickTimer = null;
LH.render = function () {
  if (LH.auth && !LH.auth.local && !LH.auth.user) { if (!document.querySelector('.auth')) LH.auth.showLogin(); return; }
  closeMenu();
  const r = LH.route(), pg = LH.pages[r.name] || LH.pages.home;
  const out = pg(r) || { title: 'LaneHook', html: '' };
  const group = { loads: 'loads', load: 'loads', guard: 'guard', money: 'money', vault: 'vault', brokers: 'brokers', calc: 'calc', maint: 'maint', settings: 'settings', home: 'home', more: 'more' }[r.name] || 'home';
  const sideLinks = NAV.map(n => n.sep ? '<hr>' : (n.noside ? '' : `<a href="#/${n.k}" class="${group === n.k ? 'on' : ''}">${ic(n.icon)}${esc(n.label)}</a>`)).join('');
  const tabLinks = NAV.filter(n => n.tab).map(n => {
    const on = group === n.k || (n.k === 'more' && ['vault', 'brokers', 'calc', 'maint', 'settings'].includes(group));
    return `<a href="#/${n.k}" class="${on ? 'on' : ''}" ${on ? 'aria-current="page"' : ''}>${ic(n.icon, 24)}${esc(n.short || n.label)}</a>`;
  }).join('');
  $('#app').innerHTML = `
    <aside class="side"><img class="logo" src="${wordmark()}" alt="LaneHook">${sideLinks}${LH.auth && LH.auth.user ? `<div class="side-me"><small>${esc(LH.auth.user.email || '')}</small><button class="btn sm" data-act="signOut">Sign out</button></div>` : ''}</aside>
    <div class="main">
      <header class="top">${out.back ? `<a class="back" href="#/${out.back}" aria-label="Back">${ic('back')}</a>` : ''}${out.logo ? `<img class="logo" src="${wordmark()}" alt="LaneHook">` : ''}
        <div class="ttl ${out.logo ? 'hp' : ''}">${esc(out.title)}</div>${out.top || ''}</header>
      <main class="content" id="content">${out.html}</main>
    </div>
    <nav class="tabs" aria-label="Main">${tabLinks}</nav>`;
  LH.hydrateBlobs($('#content'));
  if (out.after) out.after();
  window.scrollTo(0, 0);
  clearInterval(tickTimer);
  if ($('[data-tick]')) tickTimer = setInterval(() => { $$('[data-tick]').forEach(el => { el.textContent = clock(Date.now() - +el.dataset.tick); }); }, 1000);
};
window.addEventListener('hashchange', () => { closeSheet(); LH.render(); });
LH.empty = (title, text, btn) => `<div class="empty"><b>${esc(title)}</b>${esc(text)}${btn || ''}</div>`;
LH.menuBtn = (items) => `<button class="icon-btn" aria-label="Actions" aria-haspopup="menu" data-act="menu" data-menu='${esc(JSON.stringify(items))}'>${ic('dots')}</button>`;
LH.acts.menu = el => openMenu(el, JSON.parse(el.dataset.menu));
LH.acts.toggleTheme = () => {
  const t = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = t; LH.S.settings.theme = t; try { localStorage.setItem('lh-theme', t); } catch (e) { } LH.save(); LH.render();
};
/* read a form into a plain object */
LH.form = el => { const o = {}; new FormData(el).forEach((v, k) => { o[k] = typeof v === 'string' ? v.trim() : v; }); return o; };
Object.assign(window, { $, $$, esc, uid, num, money, money0, isoDay, fmtDay, fmtDT, fmtHM, clock, daysFrom, addDays, cleanMC, ic, toast, openSheet, closeSheet, openMenu, closeMenu, ask });

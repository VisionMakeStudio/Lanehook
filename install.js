/* LaneHook "Add to your home screen" helper. One file shared by the Driver, Dispatcher and Admin portals.
   Load it in <head> with: <script src="/install.js" data-portal="driver" data-name="LaneHook" data-icon="/app/icons/icon-192.png"></script>
   - LHInstall.auto(readyFn)  shows the steps once the portal is on screen (not when installed, snoozed, or dismissed for good)
   - LHInstall.show(true)     opens the steps on demand (any element with a data-a2hs attribute does this too)
   - LHInstall.canShow()      true when installing makes sense on this device */
(function () {
  'use strict';
  var me = document.currentScript, cfg = { portal: (me && me.getAttribute('data-portal')) || 'driver', name: (me && me.getAttribute('data-name')) || 'LaneHook', icon: (me && me.getAttribute('data-icon')) || '/app/icons/icon-192.png' };
  var KEY = 'lh-a2hs-' + cfg.portal, deferred = null, open = false;
  var ua = navigator.userAgent || '';
  var iOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var android = /Android/i.test(ua);
  var mobile = iOS || android;
  var chromeIOS = /CriOS|FxiOS|EdgiOS/.test(ua);
  var inApp = /FBAN|FBAV|Instagram|Line\/|Snapchat|Twitter|LinkedInApp|MicroMessenger|GSA\/|; wv\)|GmailApp/i.test(ua);
  function standalone() { try { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true; } catch (e) { return false; } }
  function get() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } }
  function set(o) { try { localStorage.setItem(KEY, JSON.stringify(Object.assign(get(), o))); } catch (e) { } }

  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; });
  window.addEventListener('appinstalled', function () { deferred = null; set({ done: true }); close(); });

  function canShow() { return !standalone() && (mobile || !!deferred); }

  var ICONS = {
    share: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/></svg>',
    dots: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>',
    down: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v12"/><path d="M7 11l5 5 5-5"/><path d="M5 20h14"/></svg>'
  };
  function step(n, icon, html) { return '<li><span class="n">' + n + '</span><span class="t">' + html + '</span><span class="i">' + ICONS[icon] + '</span></li>'; }
  var CSS = '#lhA2{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:flex-end;justify-content:center;background:rgba(5,9,22,.62);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;animation:lhA2f .2s ease-out}'
    + '@keyframes lhA2f{from{opacity:0}to{opacity:1}}@keyframes lhA2u{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}'
    + '#lhA2 .sh{width:100%;max-width:460px;background:#111B3A;color:#F8FAFC;border-radius:22px 22px 0 0;padding:22px 20px calc(20px + env(safe-area-inset-bottom));box-shadow:0 -10px 40px rgba(0,0,0,.4);animation:lhA2u .25s cubic-bezier(.2,.8,.2,1);max-height:92vh;overflow:auto}'
    + '@media(min-width:600px){#lhA2{align-items:center}#lhA2 .sh{border-radius:22px}}'
    + '#lhA2 .hd{display:flex;align-items:center;gap:14px;margin-bottom:14px}#lhA2 .hd img{width:58px;height:58px;border-radius:14px;flex:none;box-shadow:0 2px 10px rgba(0,0,0,.35)}'
    + '#lhA2 h2{margin:0;font-size:20px;line-height:1.2;font-weight:800}#lhA2 p{margin:4px 0 0;font-size:14px;line-height:1.45;color:#AAB6CB}'
    + '#lhA2 ol{list-style:none;margin:16px 0 14px;padding:0;display:grid;gap:10px}#lhA2 li{display:flex;align-items:center;gap:12px;background:#1A2547;border-radius:14px;padding:13px 14px}'
    + '#lhA2 .n{flex:none;width:26px;height:26px;border-radius:50%;background:#F59E0B;color:#0B132B;font-weight:800;font-size:14px;display:grid;place-items:center}#lhA2 .t{flex:1;font-size:15px;line-height:1.4}#lhA2 .t b{color:#fff}'
    + '#lhA2 .i{flex:none;width:40px;height:40px;border-radius:10px;background:#0B132B;color:#60A5FA;display:grid;place-items:center}'
    + '#lhA2 .warn{background:#3A2A0A;border:1px solid #6B4A0E;color:#FCD34D;border-radius:12px;padding:11px 13px;font-size:14px;line-height:1.45;margin:0 0 12px}'
    + '#lhA2 .note{font-size:13px;color:#94A3B8;line-height:1.45;margin:0 0 14px}'
    + '#lhA2 .btn{display:block;width:100%;border:0;border-radius:12px;padding:15px 16px;font-weight:700;font-size:16px;line-height:1;font-family:inherit;cursor:pointer;background:#F59E0B;color:#0B132B;margin:0 0 10px}#lhA2 .btn:active{transform:scale(.98)}'
    + '#lhA2 .row{display:flex;gap:8px}#lhA2 .lk{flex:1;background:transparent;border:1px solid #2E3D6B;color:#CBD5E1;border-radius:12px;padding:12px 8px;font-weight:600;font-size:14px;line-height:1.1;font-family:inherit;cursor:pointer}';

  function copyLink() {
    var done = function () { var b = document.getElementById('lhA2c'); if (b) b.textContent = 'Link copied'; };
    try { navigator.clipboard.writeText(location.origin + location.pathname).then(done, done); } catch (e) { done(); }
  }
  function body() {
    var h = '';
    if (inApp) h += '<div class="warn"><b>Open this page in ' + (iOS ? 'Safari' : 'Chrome') + ' first.</b> You are inside another app\'s browser, and a home screen icon can only be added from ' + (iOS ? 'Safari' : 'Chrome') + '. Copy the link, open ' + (iOS ? 'Safari' : 'Chrome') + ', paste it, then come back to this screen.</div><button class="btn" id="lhA2c" type="button">Copy link</button>';
    if (iOS) {
      h += '<ol>' + step(1, 'share', chromeIOS ? 'Tap the <b>Share</b> button next to the address bar.' : 'Tap the <b>Share</b> button at the bottom of Safari.')
        + step(2, 'plus', 'Scroll down and tap <b>Add to Home Screen</b>.')
        + step(3, 'check', 'Tap <b>Add</b>. The ' + cfg.name + ' icon appears on your home screen.') + '</ol>';
      if (!inApp) h += '<p class="note">Opened this from an email link? If you do not see the Share button, tap the compass or "Open in Safari" first.</p>';
    } else if (android) {
      if (deferred) h += '<button class="btn" id="lhA2i" type="button">Install ' + cfg.name + '</button><p class="note">Or add it yourself:</p>';
      h += '<ol>' + step(1, 'dots', 'Tap the <b>menu</b> in the top right corner of Chrome.')
        + step(2, 'down', 'Tap <b>Install app</b> (or <b>Add to Home screen</b>).')
        + step(3, 'check', 'Tap <b>Install</b>. The ' + cfg.name + ' icon appears on your home screen.') + '</ol>';
    } else {
      if (deferred) h += '<button class="btn" id="lhA2i" type="button">Install ' + cfg.name + '</button>';
      else h += '<p class="note">In Chrome or Edge, click the install icon at the right end of the address bar, or open the browser menu and choose <b>Install</b>.</p>';
    }
    return h;
  }
  function close() { var e = document.getElementById('lhA2'); if (e) e.remove(); open = false; }
  function show(force) {
    if (open || standalone() || (!force && !canShow())) return false;
    open = true;
    var st = document.createElement('style'); st.textContent = CSS;
    var w = document.createElement('div'); w.id = 'lhA2'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true'); w.setAttribute('aria-label', 'Add to home screen');
    w.appendChild(st);
    var sh = document.createElement('div'); sh.className = 'sh';
    sh.innerHTML = '<div class="hd"><img src="' + cfg.icon + '" alt=""><div><h2>Add ' + cfg.name + ' to your home screen</h2><p>Open it like an app in one tap, with no browser bars.</p></div></div>' + body()
      + '<div class="row"><button class="lk" id="lhA2n" type="button">Not now</button><button class="lk" id="lhA2x" type="button">Don\'t show again</button></div>';
    w.appendChild(sh); document.body.appendChild(w);
    w.addEventListener('click', function (e) { if (e.target === w) { set({ snooze: Date.now() }); close(); } });
    var n = document.getElementById('lhA2n'), x = document.getElementById('lhA2x'), c = document.getElementById('lhA2c'), i = document.getElementById('lhA2i');
    if (n) n.onclick = function () { set({ snooze: Date.now() }); close(); };
    if (x) x.onclick = function () { set({ never: true }); close(); };
    if (c) c.onclick = copyLink;
    if (i) i.onclick = function () {
      var d = deferred; if (!d) return; deferred = null;
      try { d.prompt(); d.userChoice.then(function (r) { if (r && r.outcome === 'accepted') set({ done: true }); close(); }); } catch (e) { close(); }
    };
    set({ shown: Date.now() });
    return true;
  }
  /* readyFn returns true once the portal itself is on screen (not a sign-in, plan or loading screen) */
  var autoRan = false;
  function auto(readyFn) {
    if (autoRan) return; autoRan = true;
    var s = get();
    if (standalone() || !mobile || s.never || s.done) return;
    if (s.snooze && Date.now() - s.snooze < 7 * 86400000) return;
    var tries = 0, t = setInterval(function () {
      tries++;
      var ok = false; try { ok = !readyFn || readyFn(); } catch (e) { }
      if (ok) { clearInterval(t); setTimeout(function () { show(false); }, 1500); }
      else if (tries > 30) clearInterval(t);
    }, 1000);
  }
  document.addEventListener('click', function (e) { var a = e.target && e.target.closest && e.target.closest('[data-a2hs]'); if (a) { e.preventDefault(); show(true); } });
  window.LHInstall = { auto: auto, show: show, canShow: canShow };
})();

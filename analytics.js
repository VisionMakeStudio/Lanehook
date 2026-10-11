/* LaneHook visitor stats (Google Analytics 4) for the public website and legal pages.
   The Measurement ID is set in the admin under Plans & pricing, so nothing here needs editing.
   It stays off when no ID is saved, on localhost, and when the visitor sends Do Not Track or Global Privacy Control. */
(function () {
  'use strict';
  var H = location.hostname;
  if (H === 'localhost' || H === '127.0.0.1' || /^\d+\.\d+\.\d+\.\d+$/.test(H)) return;
  if (navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
  var KEY = 'lh-ga', started = false;
  function start(id) {
    if (started || !/^G-[A-Z0-9]{6,14}$/.test(id || '')) return;
    started = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', id);
    var s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
    document.head.appendChild(s);
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest && e.target.closest('a[href]'); if (!a) return;
      var h = a.getAttribute('href') || '';
      if (/^\/(app|dispatch)\//.test(h)) window.gtag('event', 'cta_click', { destination: h.split('?')[0], label: (a.textContent || '').trim().slice(0, 40), plan: (h.match(/[?&]plan=(\w+)/) || [])[1] || '' });
    }, true);
  }
  var cached = ''; try { cached = localStorage.getItem(KEY) || ''; } catch (e) { }
  if (cached) start(cached);
  fetch('https://hsjmtkqzdkcpyfaygxpb.supabase.co/rest/v1/site_settings?id=eq.1&select=data', { headers: { apikey: 'sb_publishable_a0uKjOLnATsVJ4G-Iti7Cg_jbVgHcxZ' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) {
      var id = (j && j[0] && j[0].data && j[0].data.gaId) || '';
      try { if (id) localStorage.setItem(KEY, id); else localStorage.removeItem(KEY); } catch (e) { }
      if (id) start(id);
    }).catch(function () { });
})();

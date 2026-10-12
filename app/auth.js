'use strict';
/* LaneHook driver portal: sign-in by email link (or 6-digit code) through Supabase Auth */
LH.wantPlanData = () => { let p = null; try { p = localStorage.getItem('lh-want-plan'); } catch (e) { } return p ? { data: { want_plan: p } } : {}; };
LH.auth = {
  sb: null, user: null, local: false, started: false,

  async init() {
    const c = window.LH_CONFIG;
    if (!c || !window.supabase) { this.local = true; return; }
    this.sb = window.supabase.createClient(c.supabaseUrl, c.supabaseKey, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    const { data } = await this.sb.auth.getSession();
    this.user = data.session ? data.session.user : null;
    // A sign-in link opened in a different browser than the one that asked for it cannot finish (the secure handshake lives in the first browser).
    if (!this.user && /[?&]code=|error_code=|error=access_denied|otp_expired/.test(location.search + location.hash)) {
      this.linkMsg = 'That link was opened in a different browser than the one you signed in from, so it could not finish. Enter your email and we will send a 6-digit code to type in here.';
      try { history.replaceState(null, '', location.pathname); } catch (e) { }
    }
    this.sb.auth.onAuthStateChange((ev, sess) => {
      const u = sess ? sess.user : null, was = this.user && this.user.id;
      this.user = u;
      if (u && u.id !== was) this.enter();
      else if (!u && was) { LH.sync.stop(); this.showLogin(); }
    });
  },

  /* header for calls to our own serverless functions */
  async headers() {
    if (!this.sb) return {};
    const { data } = await this.sb.auth.getSession();
    return data.session ? { authorization: 'Bearer ' + data.session.access_token } : {};
  },

  /* a person is signed in: make sure local data belongs to them, then sync */
  async enter(first) {
    const uid = this.user.id; let owner = null;
    try { owner = localStorage.getItem('lh-owner'); } catch (e) { }
    if (owner && owner !== uid) await LH.resetLocal();
    try { localStorage.setItem('lh-owner', uid); } catch (e) { }
    if (location.search || location.hash.indexOf('access_token') > -1) history.replaceState(null, '', location.pathname + (/^#\/[a-z]/.test(location.hash) && location.hash.indexOf('access_token') < 0 ? location.hash : '#/home'));
    if (!first) LH.render();
    LH.sync.start(this.sb, uid);
    (async () => { if (LH.disp) await LH.disp.start(); if (LH.plans) LH.plans.start(); })();
    this.tellOwner();
    if (window.LHInstall) LHInstall.auto(() => !LH.plans || LH.plans.state() === 'open');
  },

  // Lets the owner know about a brand-new signup. Safe to call every time: the server only sends once per person.
  async tellOwner() {
    try {
      const k = 'lh-told-' + this.user.id; if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1');
      const { data } = await this.sb.auth.getSession(); if (!data.session) return;
      fetch('/.netlify/functions/notify', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + data.session.access_token }, body: JSON.stringify({ portal: 'driver' }) }).then(r => r.json()).then(j => { if (j && j.new && window.lhTrack) lhTrack('sign_up', { method: 'email', portal: 'driver' }); }).catch(() => { });
    } catch (e) { }
  },

  async signOut() {
    toast('Saving before you sign out…', 4000);
    const ok = await LH.sync.flush();
    const go = async () => {
      LH.sync.stop(); try { localStorage.removeItem('lh-owner'); } catch (e) { }
      await this.sb.auth.signOut(); await LH.resetLocal(); this.user = null; location.hash = '#/home'; this.showLogin();
    };
    if (ok) return go();
    ask('Sign out without saving?', 'Some changes could not be saved to your account yet. If you sign out now, they will be lost from this device.', 'Sign out anyway', go);
  },

  /* ---------- sign-in screens ---------- */
  showLogin(email, stage) {
    clearInterval(window._lhTick);
    const prefill = email || (new URLSearchParams(location.search).get('email') || '');
    const logo = document.documentElement.dataset.theme === 'light' ? 'icons/wordmark-nav-dark.svg' : 'icons/wordmark-nav.svg';
    const app = $('#app');
    app.innerHTML = `<div class="auth"><div class="auth-card">
      <img class="auth-logo" src="${logo}" alt="LaneHook">
      <div id="authBody"></div>
      <p class="auth-fine">By continuing you agree to the <a href="/terms/" target="_blank" rel="noopener">Terms of Service</a> and <a href="/privacy/" target="_blank" rel="noopener">Privacy Policy</a>. <a href="../">Back to lanehook.com</a></p><div style="margin-top:14px"><span data-lhl-mount data-select></span></div></div></div>`;
    const note = this.linkMsg || ''; this.linkMsg = '';
    stage === 'code' ? this.codeStep(prefill) : this.emailStep(prefill, note);
  },
  emailStep(email, msg) {
    $('#authBody').innerHTML = `<h1>Sign in</h1><p class="muted">Enter your email. We will send you a 6-digit code to sign in. No password needed.</p>
      <form id="authForm"><label class="f"><span>Email</span><input name="email" type="email" inputmode="email" autocomplete="email" value="${esc(email || '')}" placeholder="you@email.com" required></label>
      <div id="authMsg" class="auth-msg" role="status">${msg ? esc(msg) : ''}</div>
      <button class="btn pri block" id="authGo">Email me a code</button></form>`;
    const f = $('#authForm');
    f.onsubmit = async e => {
      e.preventDefault(); const em = f.elements.email.value.trim().toLowerCase(); if (!/^\S+@\S+\.\S+$/.test(em)) { $('#authMsg').textContent = 'Enter a valid email address.'; return; }
      const b = $('#authGo'); b.disabled = true; b.innerHTML = '<span class="spin"></span> Sending…';
      const { error } = await this.sb.auth.signInWithOtp({ email: em, options: Object.assign({ emailRedirectTo: location.origin + '/app/', shouldCreateUser: true }, LH.wantPlanData()) });
      if (error) { b.disabled = false; b.textContent = 'Email me a code'; $('#authMsg').textContent = /rate|limit|seconds/i.test(error.message) ? 'Too many emails right now. Wait a minute and try again.' : 'We could not send the email. Check the address and try again.'; return; }
      this.codeStep(em);
    };
  },
  codeStep(email) {
    $('#authBody').innerHTML = `<h1>Enter your code</h1><p class="muted">We emailed a 6-digit code to <b style="color:var(--text)">${esc(email)}</b>. Type it here to sign in.</p>
      <form id="codeForm" style="margin:14px 0"><input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="123456" aria-label="6-digit code from the email" style="letter-spacing:.3em;font-size:26px;text-align:center;margin-bottom:10px" required autofocus><div id="authMsg" class="auth-msg" role="status"></div><button class="btn pri block">Sign in</button></form>
      <p class="muted" style="font-size:14px;margin:0 0 14px">The email also has a sign-in button. It only works in the same browser you are using now, so the code is the safer way.</p>
      <div class="row wrap"><button class="btn sm" id="resend" disabled>Send again</button><button class="btn sm" id="otherEmail">Use another email</button></div>`;
    $('#codeForm').onsubmit = async e => {
      e.preventDefault(); const tok = e.target.elements.code.value.replace(/\D/g, ''); if (tok.length < 6) { $('#authMsg').textContent = 'Enter the full code from the email.'; return; }
      const b = $('#codeForm .btn'); b.disabled = true;
      const { error } = await this.sb.auth.verifyOtp({ email, token: tok, type: 'email' });
      if (error) { b.disabled = false; $('#authMsg').textContent = 'That code did not work. It may have expired. Send a new one.'; }
    };
    $('#otherEmail').onclick = () => this.emailStep('');
    const rs = $('#resend'); let n = 30; rs.textContent = 'Send again (' + n + ')';
    const t = setInterval(() => { n--; if (!document.body.contains(rs)) return clearInterval(t); if (n <= 0) { clearInterval(t); rs.disabled = false; rs.textContent = 'Send again'; } else rs.textContent = 'Send again (' + n + ')'; }, 1000);
    rs.onclick = async () => { rs.disabled = true; const { error } = await this.sb.auth.signInWithOtp({ email, options: Object.assign({ emailRedirectTo: location.origin + '/app/', shouldCreateUser: true }, LH.wantPlanData()) }); $('#authMsg').textContent = error ? 'Could not send yet. Wait a minute and try again.' : 'Sent again. Check your inbox and spam folder.'; this.codeStep(email); $('#authMsg').textContent = error ? 'Could not send yet. Wait a minute and try again.' : 'Sent again. Check your inbox and spam folder.'; };
  }
};

/* account card for Settings */
LH.accountCard = function () {
  if (LH.auth.local || !LH.auth.user) return '';
  const i = LH.sync.info(), txt = { ok: 'Saved to your account' + (i.last ? ' ' + new Date(i.last).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''), syncing: 'Saving…', offline: 'Offline. Changes will save when you are back online.', error: 'Could not save. ' + (i.err || ''), off: 'Not syncing' }[i.status];
  return `<div class="card"><h3>Your account</h3><div class="row"><div class="t sp"><b style="word-break:break-all">${esc(LH.auth.user.email || '')}</b><div class="muted" id="syncState" style="font-size:14px">${esc(txt)}</div></div></div>
    <div class="row wrap" style="margin-top:12px"><button class="btn sm" data-act="syncNow">Save now</button><button class="btn sm" data-act="signOut">Sign out</button></div></div>`;
};
LH.onSync = () => { const el = document.getElementById('syncState'); if (!el) return; const i = LH.sync.info(); el.textContent = { ok: 'Saved to your account', syncing: 'Saving…', offline: 'Offline. Changes will save when you are back online.', error: 'Could not save. ' + (i.err || ''), off: 'Not syncing' }[i.status]; };
LH.acts.syncNow = async () => { toast('Saving…'); const ok = await LH.sync.flush(); toast(ok ? 'Saved to your account' : 'Could not save right now'); };
LH.acts.signOut = () => LH.auth.signOut();

'use strict';
/* LaneHook driver portal: sign-in by email link (or 6-digit code) through Supabase Auth */
LH.auth = {
  sb: null, user: null, local: false, started: false,

  async init() {
    const c = window.LH_CONFIG;
    if (!c || !window.supabase) { this.local = true; return; }
    this.sb = window.supabase.createClient(c.supabaseUrl, c.supabaseKey, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    const { data } = await this.sb.auth.getSession();
    this.user = data.session ? data.session.user : null;
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
    if (location.search || location.hash.indexOf('access_token') > -1) history.replaceState(null, '', location.pathname + '#/home');
    if (!first) LH.render();
    LH.sync.start(this.sb, uid);
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
      <p class="auth-fine">By continuing you agree to use LaneHook for lawful trucking business. <a href="../" >Back to lanehook.com</a></p></div></div>`;
    stage === 'code' ? this.codeStep(prefill) : this.emailStep(prefill);
  },
  emailStep(email, msg) {
    $('#authBody').innerHTML = `<h1>Sign in</h1><p class="muted">Enter your email. We will send you a link that signs you in. No password needed.</p>
      <form id="authForm"><label class="f"><span>Email</span><input name="email" type="email" inputmode="email" autocomplete="email" value="${esc(email || '')}" placeholder="you@email.com" required></label>
      <div id="authMsg" class="auth-msg" role="status">${msg ? esc(msg) : ''}</div>
      <button class="btn pri block" id="authGo">Email me a sign-in link</button></form>`;
    const f = $('#authForm');
    f.onsubmit = async e => {
      e.preventDefault(); const em = f.elements.email.value.trim().toLowerCase(); if (!/^\S+@\S+\.\S+$/.test(em)) { $('#authMsg').textContent = 'Enter a valid email address.'; return; }
      const b = $('#authGo'); b.disabled = true; b.innerHTML = '<span class="spin"></span> Sending…';
      const { error } = await this.sb.auth.signInWithOtp({ email: em, options: { emailRedirectTo: location.origin + '/app/', shouldCreateUser: true } });
      if (error) { b.disabled = false; b.textContent = 'Email me a sign-in link'; $('#authMsg').textContent = /rate|limit|seconds/i.test(error.message) ? 'Too many emails right now. Wait a minute and try again.' : 'We could not send the email. Check the address and try again.'; return; }
      this.codeStep(em);
    };
  },
  codeStep(email) {
    $('#authBody').innerHTML = `<h1>Check your email</h1><p class="muted">We sent a sign-in link to <b style="color:var(--text)">${esc(email)}</b>. Open it on this device and you are in.</p>
      <div class="card" style="margin:14px 0"><b>Link opened somewhere else?</b><p class="muted" style="margin:6px 0 12px;font-size:14px">If the email opens in a different app or browser, type the code from the email here instead.</p>
      <form id="codeForm" class="row"><input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="123456" aria-label="Code from email" style="letter-spacing:.2em;font-size:20px;text-align:center" required><button class="btn pri">Sign in</button></form><div id="authMsg" class="auth-msg" role="status"></div></div>
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
    rs.onclick = async () => { rs.disabled = true; const { error } = await this.sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + '/app/', shouldCreateUser: true } }); $('#authMsg').textContent = error ? 'Could not send yet. Wait a minute and try again.' : 'Sent again. Check your inbox and spam folder.'; this.codeStep(email); $('#authMsg').textContent = error ? 'Could not send yet. Wait a minute and try again.' : 'Sent again. Check your inbox and spam folder.'; };
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

'use strict';
/* LaneHook driver portal: cloud sync (state JSON + photos) through Supabase. Last-write wins with a union merge when two devices changed. */
LH.sync = (function () {
  let sb = null, uid = null, timer = null, busy = false, dirty = false, meta = { up: {} };
  const api = { status: 'off', err: '', last: 0 };
  const mk = () => 'lh-sync-' + uid;
  const loadMeta = () => { try { meta = JSON.parse(localStorage.getItem(mk()) || '{}'); } catch (e) { meta = {}; } meta.up = meta.up || {}; };
  const saveMeta = () => { try { localStorage.setItem(mk(), JSON.stringify(meta)); } catch (e) { } };
  const setStatus = (s, e) => { api.status = s; api.err = e || ''; if (s === 'ok') api.last = Date.now(); if (LH.onSync) LH.onSync(); };
  const hasData = s => !!(s && ((s.loads || []).length || (s.docs || []).length || (s.expenses || []).length || (s.maint || []).length || (s.trips || []).length || (s.settings && s.settings.bizName)));
  const refs = s => { const ids = new Set(); (s.loads || []).forEach(l => (l.photos || []).forEach(p => ids.add(p.id))); (s.docs || []).forEach(d => (d.files || []).forEach(f => ids.add(f.id))); (s.expenses || []).forEach(x => x.receiptId && ids.add(x.receiptId)); return [...ids]; };
  const busyForm = () => { const r = LH.route(); return (r.name === 'load' && (r.id === 'new' || r.sub === 'edit')) || !!document.querySelector('.scrim'); };

  function mergeStates(local, remote) {
    const out = JSON.parse(JSON.stringify(remote));
    ['loads', 'docs', 'expenses', 'maint', 'trips'].forEach(k => {
      const seen = new Set((out[k] || []).map(x => x.id)); out[k] = out[k] || [];
      (local[k] || []).forEach(x => { if (!seen.has(x.id)) out[k].push(x); });
    });
    out.brokers = Object.assign({}, local.brokers || {}, remote.brokers || {});
    const ls = local.settings || {}, rs = remote.settings || {}, st = Object.assign({}, ls);
    Object.keys(rs).forEach(k => { if (rs[k] !== '' && rs[k] !== 0 && rs[k] != null) st[k] = rs[k]; });
    st.nextInv = Math.max(num(ls.nextInv), num(rs.nextInv), 1);
    out.settings = st; out.odometer = Math.max(num(local.odometer), num(remote.odometer));
    return out;
  }
  function adopt(state) {
    const d = DEFAULT_STATE(); LH.S = Object.assign(d, state); LH.S.settings = Object.assign(DEFAULT_STATE().settings, state.settings || {});
    LH.persist();
  }
  async function uploadBlobs() {
    for (const id of refs(LH.S)) {
      if (meta.up[id]) continue;
      const b = await LH.getBlob(id); if (!b) continue;
      const { error } = await sb.storage.from('files').upload(uid + '/' + id, b, { upsert: true, contentType: b.type || 'application/octet-stream' });
      if (error) throw error; meta.up[id] = 1; saveMeta();
    }
  }
  async function push() {
    if (!sb || !uid) return false;
    if (busy) { dirty = true; return false; }
    busy = true; setStatus('syncing');
    try {
      await uploadBlobs();
      const now = new Date().toISOString(), snap = JSON.parse(JSON.stringify(LH.S));
      const { error } = await sb.from('user_state').upsert({ user_id: uid, state: snap, updated_at: now });
      if (error) throw error;
      meta.remoteAt = Date.parse(now); meta.pushedLocal = snap.updatedAt || 0; saveMeta(); setStatus('ok'); return true;
    } catch (e) { setStatus(navigator.onLine ? 'error' : 'offline', (e && e.message) || String(e)); return false; }
    finally { busy = false; if (dirty) { dirty = false; schedule(); } }
  }
  function schedule() { if (!sb || !uid) return; clearTimeout(timer); timer = setTimeout(push, 2500); }

  async function reconcile() {
    setStatus('syncing');
    const { data, error } = await sb.from('user_state').select('state,updated_at').eq('user_id', uid).maybeSingle();
    if (error) throw error;
    const localHas = hasData(LH.S);
    if (!data) { await push(); return false; }
    const remoteAt = Date.parse(data.updated_at), rs = data.state || {};
    let changed = false;
    if (meta.remoteAt === undefined) {
      if (!localHas) { adopt(rs); changed = true; }
      else if (!hasData(rs)) { /* account is empty: keep this device's data */ }
      else { adopt(mergeStates(LH.S, rs)); changed = true; }
      meta.remoteAt = remoteAt; saveMeta(); await push(); return changed;
    }
    const localChanged = (LH.S.updatedAt || 0) > (meta.pushedLocal || 0);
    if (remoteAt > meta.remoteAt) {
      adopt(localChanged ? mergeStates(LH.S, rs) : rs); changed = true;
      meta.remoteAt = remoteAt; saveMeta(); if (localChanged) await push();
    } else if (localChanged) await push(); else setStatus('ok');
    return changed;
  }
  async function check() {
    if (!sb || !uid || busy || !navigator.onLine) return;
    try {
      const { data } = await sb.from('user_state').select('updated_at').eq('user_id', uid).maybeSingle();
      if (data && Date.parse(data.updated_at) > (meta.remoteAt || 0)) { const ch = await reconcile(); if (ch && !busyForm()) LH.render(); }
    } catch (e) { }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  window.addEventListener('online', () => { if (sb) { schedule(); check(); } });

  api.start = async function (client, userId) {
    sb = client; uid = userId; loadMeta();
    try { const ch = await reconcile(); if (ch && !busyForm()) LH.render(); }
    catch (e) { setStatus(navigator.onLine ? 'error' : 'offline', (e && e.message) || String(e)); }
  };
  api.stop = function () { clearTimeout(timer); sb = null; uid = null; meta = { up: {} }; setStatus('off'); };
  api.schedule = schedule;
  api.flush = async function () { clearTimeout(timer); if (!sb) return true; let n = 0; while (busy && n++ < 40) await new Promise(r => setTimeout(r, 250)); return push(); };
  api.pending = () => !!sb && ((LH.S.updatedAt || 0) > (meta.pushedLocal || 0));
  api.fetchBlob = async function (id) {
    if (!sb || !uid) return null;
    const { data, error } = await sb.storage.from('files').download(uid + '/' + id);
    if (error || !data) return null;
    await LH.putBlob(id, data); meta.up[id] = 1; saveMeta(); return data;
  };
  api.removeBlob = function (id) { if (!sb || !uid) return; delete meta.up[id]; saveMeta(); sb.storage.from('files').remove([uid + '/' + id]).catch(() => { }); };
  api.info = () => ({ status: api.status, err: api.err, last: api.last });
  return api;
})();

// Server-side Supabase helpers (service key). Never import this from browser code.
const SB = 'https://hsjmtkqzdkcpyfaygxpb.supabase.co';
const DEFAULTS = {
  earlyAccess: true, trialDays: 7,
  plans: {
    solo: { name: 'Solo', price: 19, tagline: 'For the owner-operator', available: true, popular: true, features: ['Unlimited loads', 'Rate con scanner', 'Load Guard broker checks', 'Invoices and expenses', 'Document vault'] },
    crew: { name: 'Crew', price: 49, tagline: 'Dispatcher plus drivers', available: false, popular: false, features: ['Everything in Solo', 'Dispatcher dashboard', 'Up to 5 drivers', 'Company Link'] },
    fleet: { name: 'Fleet', price: 99, tagline: 'For growing fleets', available: false, popular: false, features: ['Everything in Crew', 'Up to 15 trucks', 'Driver settlements', 'Priority support'] }
  }
};
function headers() {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const h = { apikey: k, 'content-type': 'application/json' };
  if (k && !k.startsWith('sb_secret_')) h.authorization = 'Bearer ' + k;
  return h;
}
const rest = (path, opt = {}) => fetch(SB + '/rest/v1/' + path, { ...opt, headers: { ...headers(), ...(opt.headers || {}) } });
async function getSettings() {
  try {
    const r = await rest('site_settings?id=eq.1&select=data');
    const j = await r.json();
    return (j && j[0] && j[0].data) || DEFAULTS;
  } catch (e) { return DEFAULTS; }
}
async function accountRow(uid) {
  const r = await rest('account_admin?user_id=eq.' + encodeURIComponent(uid) + '&select=*');
  const j = await r.json(); return (Array.isArray(j) && j[0]) || null;
}
async function upsertAccount(uid, fields) {
  const r = await rest('account_admin?on_conflict=user_id', { method: 'POST', headers: { prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ user_id: uid, updated_at: new Date().toISOString(), ...fields }) });
  if (!r.ok) throw new Error('db_' + r.status);
}
module.exports = { SB, DEFAULTS, headers, rest, getSettings, accountRow, upsertAccount };

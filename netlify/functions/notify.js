// Emails the owner once when a brand-new person signs in for the first time.
// Called by the portals right after sign-in with the person's own token. Needs SUPABASE_SERVICE_ROLE_KEY and RESEND_API_KEY.
const { signedInUser } = require('./lib/auth');
const { SB, headers } = require('./lib/sb');
const { alertAdmin } = require('./lib/mail');
const json = (s, b) => ({ statusCode: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(b) });
const PORTALS = { driver: 'Driver Portal', dispatcher: 'Dispatcher Portal' };

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method' });
  const user = await signedInUser(event);
  if (!user) return json(401, { error: 'sign_in' });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return json(200, { sent: false });
  let b = {}; try { b = JSON.parse(event.body || '{}'); } catch (e) { }
  const meta = user.app_metadata || {};
  const age = Date.now() - new Date(user.created_at || 0).getTime();
  if (meta.signup_notified || !(age >= 0 && age < 3 * 86400000)) return json(200, { sent: false, new: false });
  try {
    // Mark first so a second tab or portal cannot send the same alert twice.
    const mark = await fetch(SB + '/auth/v1/admin/users/' + user.id, { method: 'PUT', headers: headers(), body: JSON.stringify({ app_metadata: { signup_notified: true } }) });
    if (!mark.ok) return json(200, { sent: false });
    const portal = PORTALS[b.portal] || 'LaneHook';
    const ok = await alertAdmin('New LaneHook signup: ' + user.email, [['Email', user.email], ['Portal', portal], ['Time (ET)', new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })]], 'New signup');
    return json(200, { sent: ok, new: true });
  } catch (e) { console.error('notify failed', e.message); return json(200, { sent: false }); }
};

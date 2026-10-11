// Confirms a request comes from a signed-in LaneHook user by asking Supabase to verify the token.
// The URL and publishable key are public values, the same ones the app uses in the browser.
const SB_URL = 'https://hsjmtkqzdkcpyfaygxpb.supabase.co';
const SB_KEY = 'sb_publishable_a0uKjOLnATsVJ4G-Iti7Cg_jbVgHcxZ';

exports.signedInUser = async function (event) {
  const h = (event.headers && (event.headers.authorization || event.headers.Authorization)) || '';
  const token = h.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  try {
    const res = await fetch(SB_URL + '/auth/v1/user', { headers: { apikey: SB_KEY, authorization: 'Bearer ' + token } });
    if (!res.ok) return null;
    const u = await res.json();
    return u && u.id ? u : null;
  } catch (e) { return null; }
};

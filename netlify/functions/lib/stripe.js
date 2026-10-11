// Minimal Stripe REST client (no SDK needed). Needs STRIPE_SECRET_KEY.
function enc(v, key, out) {
  if (v === undefined || v === null) return;
  if (Array.isArray(v)) v.forEach((x, i) => enc(x, key + '[' + i + ']', out));
  else if (typeof v === 'object') Object.keys(v).forEach(k => enc(v[k], key ? key + '[' + k + ']' : k, out));
  else out.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(v)));
}
const form = p => { const o = []; enc(p || {}, '', o); return o.join('&'); };
async function call(method, path, params) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) { const e = new Error('not_configured'); e.status = 503; throw e; }
  const q = method === 'GET' && params ? '?' + form(params) : '';
  const r = await fetch('https://api.stripe.com/v1/' + path + q, {
    method, headers: { authorization: 'Bearer ' + key, 'content-type': 'application/x-www-form-urlencoded' },
    body: method === 'GET' || method === 'DELETE' ? undefined : form(params)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error((j.error && j.error.message) || 'stripe_error'); e.status = r.status; throw e; }
  return j;
}
module.exports = { call, form };

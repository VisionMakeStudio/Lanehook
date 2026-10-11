// Looks up a carrier or broker by MC (docket) number in FMCSA's public QCMobile service.
// Needs a free FMCSA web key in the FMCSA_WEBKEY environment variable (Netlify site settings).
const { signedInUser } = require('./lib/auth');
const json = (status, body) => ({ statusCode: status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(body) });

exports.handler = async (event) => {
  if (!(await signedInUser(event))) return json(401, { error: 'sign_in' });
  const mc = String((event.queryStringParameters || {}).mc || '').replace(/\D/g, '').replace(/^0+/, '');
  if (!mc || mc.length > 9) return json(400, { error: 'bad_mc' });
  const key = process.env.FMCSA_WEBKEY;
  if (!key) return json(503, { error: 'not_configured' });
  try {
    const url = 'https://mobile.fmcsa.dot.gov/qc/services/carriers/docket-number/' + mc + '?webKey=' + encodeURIComponent(key);
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (res.status === 404) return json(200, { found: false });
    if (!res.ok) return json(502, { error: 'upstream_' + res.status });
    const data = await res.json();
    let c = data && data.content;
    if (Array.isArray(c)) c = c[0];
    c = c && (c.carrier || c);
    if (!c || (!c.legalName && !c.dotNumber)) return json(200, { found: false });
    return json(200, { found: true, carrier: c });
  } catch (e) {
    return json(502, { error: 'upstream_failed' });
  }
};

// Looks up a carrier or broker by MC (docket) number in FMCSA's public QCMobile service.
// Needs a free FMCSA web key in the FMCSA_WEBKEY environment variable (Netlify site settings).
const { signedInUser } = require('./lib/auth');
const { hasPaid } = require('./lib/entitle');
const json = (status, body) => ({ statusCode: status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(body) });

/* Extra fraud signals from FMCSA's free open-data portal (no key needed): how old the authority is,
   when the DOT number was registered, revocation history, insurance/bond filings, fleet size and contact details. */
const SODA = 'https://data.transportation.gov/resource/';
const iso = d => /^\d{8}$/.test(String(d || '')) ? d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8) : '';
async function soda(id, where, order, limit) {
  const u = new URL(SODA + id + '.json');
  u.searchParams.set('$where', where); if (order) u.searchParams.set('$order', order); u.searchParams.set('$limit', String(limit || 100));
  const h = { accept: 'application/json' }; if (process.env.SODA_APP_TOKEN) h['X-App-Token'] = process.env.SODA_APP_TOKEN;
  const r = await fetch(u, { headers: h, signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error('soda_' + r.status);
  return r.json();
}
async function extras(mc, dot) {
  const dk = ["'MC" + mc + "'", "'MC" + mc.padStart(6, '0') + "'"].join(',');
  const dn = String(dot || '').replace(/\D/g, '').replace(/^0+/, '');
  const [auth, ins, cen] = await Promise.allSettled([
    soda('yu5v-wbh6', 'docket_number in (' + dk + ')', 'status_change_date ASC', 200),
    soda('c5y8-a4uz', 'docket_number in (' + dk + ')', 'effective_date DESC', 20),
    dn ? soda('az4n-8mr2', "dot_number='" + dn + "'", null, 1) : Promise.resolve([])
  ]);
  const out = {};
  if (auth.status === 'fulfilled' && auth.value.length) {
    const rows = auth.value.map(r => ({ type: r.op_auth_type || '', status: r.op_auth_status || '', reason: r.reason || '', date: iso(r.status_change_date) })).filter(r => r.date);
    const live = rows.filter(r => r.status === 'Active');
    const first = (live[0] || rows[0] || {}).date || '';
    const last = rows[rows.length - 1] || {};
    const bad = rows.filter(r => r.status === 'Inactive');
    out.authority = { since: first, everActive: live.length > 0, lastStatus: last.status || '', lastReason: last.reason || '', lastDate: last.date || '', inactiveEvents: bad.length, lastInactive: bad.length ? bad[bad.length - 1] : null };
  }
  if (ins.status === 'fulfilled') {
    out.insurance = ins.value.map(r => ({ form: r.ins_form_code || '', insurer: r.insurance_company_name || '', max: Number(r.max_cov_amount) || 0, effective: iso(r.effective_date) }));
  }
  if (cen.status === 'fulfilled' && cen.value[0]) {
    const c = cen.value[0];
    out.census = { dotAdded: iso(c.add_date), mcs150: iso(c.mcs150_date), powerUnits: Number(c.power_units) || 0, drivers: Number(c.total_drivers) || 0, email: String(c.email_address || '').toLowerCase(), officer: c.company_officer_1 || '', org: c.business_org_desc || '',
      mailAddr: [c.carrier_mailing_street, c.carrier_mailing_city, c.carrier_mailing_state, c.carrier_mailing_zip].filter(Boolean).join(', '), status: c.status_code || '' };
  }
  return out;
}

exports.handler = async (event) => {
  const me = await signedInUser(event);
  if (!me) return json(401, { error: 'sign_in' });
  if (!(await hasPaid(me.id))) return json(402, { error: 'upgrade' });
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
    let extra = null; try { extra = await extras(mc, c.dotNumber); } catch (e) { extra = null; }
    return json(200, { found: true, carrier: c, extra });
  } catch (e) {
    return json(502, { error: 'upstream_failed' });
  }
};

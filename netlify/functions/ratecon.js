// Reads a rate confirmation (photo or PDF) and returns the fields LaneHook needs.
// Needs ANTHROPIC_API_KEY in the Netlify environment. Optional: RATECON_MODEL.
const json = (status, body) => ({ statusCode: status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }, body: JSON.stringify(body) });

const PROMPT = `You are reading a freight rate confirmation for a trucking company. Extract the fields below. Use null for anything not clearly printed. Do not guess. Return only one JSON object with these keys:
broker_name, broker_mc (digits only), broker_email (billing or dispatch email), broker_phone, load_number,
pickup_name, pickup_city (City, ST), pickup_address, pickup_time (local, format YYYY-MM-DDTHH:MM),
delivery_name, delivery_city (City, ST), delivery_address, delivery_time (local, format YYYY-MM-DDTHH:MM),
rate (total line haul in dollars, number), miles (number), free_hours (free time before detention, number), detention_rate (dollars per hour, number),
payment_terms_days (number), notes (short: lumper, TONU, layover, appointment rules, anything unusual).`;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'method' });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return json(503, { error: 'not_configured' });
  // Only accept calls from this site.
  const origin = event.headers.origin || event.headers.Origin || '';
  const host = event.headers.host || event.headers.Host || '';
  if (origin && !origin.endsWith('//' + host)) return json(403, { error: 'origin' });
  let body; try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'bad_body' }); }
  const media = body.media, data = body.data;
  const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
  if (!data || !ok.includes(media) || data.length > 7.5e6) return json(400, { error: 'bad_file' });
  const part = media === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: media, data } }
    : { type: 'image', source: { type: 'base64', media_type: media, data } };
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: process.env.RATECON_MODEL || 'claude-haiku-5-5', max_tokens: 1200, messages: [{ role: 'user', content: [part, { type: 'text', text: PROMPT }] }] })
    });
    if (!res.ok) return json(502, { error: 'upstream_' + res.status });
    const out = await res.json();
    const text = (out.content || []).map(b => b.text || '').join('');
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return json(502, { error: 'unreadable' });
    return json(200, { ok: true, data: JSON.parse(m[0]) });
  } catch (e) {
    return json(502, { error: 'failed' });
  }
};

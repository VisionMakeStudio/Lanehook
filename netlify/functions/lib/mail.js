// Sends a short alert email to the LaneHook owner through Resend.
// Needs RESEND_API_KEY in Netlify. ADMIN_ALERT_EMAIL is optional (defaults to the studio address).
// Never throws: an alert that fails must not break sign-in or billing.
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

exports.esc = esc;
exports.alertAdmin = async function (subject, rows, headline) {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.warn('alert skipped: RESEND_API_KEY missing'); return false; }
  const to = (process.env.ADMIN_ALERT_EMAIL || 'info@visionmakestudio.com').split(',').map(s => s.trim()).filter(Boolean);
  const from = process.env.ALERT_FROM || 'LaneHook <alerts@lanehook.com>';
  const list = (rows || []).filter(r => r && r[1] != null && r[1] !== '');
  const html = '<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px;color:#0B132B">'
    + '<div style="background:#0B132B;color:#fff;padding:14px 18px;border-radius:12px 12px 0 0;font-weight:800;font-size:16px">LaneHook</div>'
    + '<div style="border:1px solid #E2E8F0;border-top:4px solid #F59E0B;border-radius:0 0 12px 12px;padding:18px">'
    + '<h2 style="margin:0 0 12px;font-size:19px">' + esc(headline || subject) + '</h2>'
    + '<table style="width:100%;border-collapse:collapse;font-size:15px">' + list.map(r => '<tr><td style="padding:7px 0;color:#64748B;width:38%;vertical-align:top">' + esc(r[0]) + '</td><td style="padding:7px 0;font-weight:600">' + esc(r[1]) + '</td></tr>').join('') + '</table>'
    + '<p style="margin:16px 0 0;font-size:13px"><a href="https://lanehook.com/admin/" style="color:#2563EB">Open the admin</a></p></div></div>';
  const text = (headline || subject) + '\n\n' + list.map(r => r[0] + ': ' + r[1]).join('\n') + '\n\nhttps://lanehook.com/admin/';
  try {
    const res = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' }, body: JSON.stringify({ from, to, subject, html, text }) });
    if (!res.ok) { console.error('alert failed', res.status, (await res.text()).slice(0, 160)); return false; }
    return true;
  } catch (e) { console.error('alert error', e.message); return false; }
};

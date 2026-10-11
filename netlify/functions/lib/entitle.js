// Decides whether a signed-in person may use paid features (rate-con scanner, live broker lookups).
const { getSettings, accountRow, rest } = require('./sb');
async function covered(uid) {
  try { const r = await rest('rpc/is_covered', { method: 'POST', body: JSON.stringify({ uid }) }); return (await r.json()) === true; } catch (e) { return false; }
}
exports.hasPaid = async function (uid) {
  try {
    const s = await getSettings();
    if (s.earlyAccess) return true;
    const row = await accountRow(uid);
    if (row && row.plan === 'comped') return true;
    if (row && ['solo', 'crew', 'fleet'].includes(row.plan) && ['active', 'trialing', 'past_due'].includes(row.sub_status)) return true;
    return await covered(uid); // a driver on a paid company is covered by the company's plan
  } catch (e) { return true; } // if the database is unreachable, do not lock people out
};

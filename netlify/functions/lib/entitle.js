// Decides whether a signed-in person may use paid features (rate-con scanner, live broker lookups).
const { getSettings, accountRow } = require('./sb');
exports.hasPaid = async function (uid) {
  try {
    const s = await getSettings();
    if (s.earlyAccess) return true;
    const row = await accountRow(uid);
    if (!row) return false;
    if (row.plan === 'comped') return true;
    if (!['solo', 'crew', 'fleet'].includes(row.plan)) return false;
    return ['active', 'trialing', 'past_due'].includes(row.sub_status);
  } catch (e) { return true; } // if the database is unreachable, do not lock people out
};

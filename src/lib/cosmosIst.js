/**
 * Cosmos IST — single source for Node.js date/time.
 * Contract: docs/architecture/ist-time.md
 */

const COSMOS_IST_TZ = 'Asia/Kolkata';

const SQL_NOW = 'DATEADD(MINUTE, 330, SYSUTCDATETIME())';

/** SQL fragment for current IST wall clock (embed in query text). */
function sqlNow() {
  return SQL_NOW;
}

/**
 * IST wall clock as YYYY-MM-DDTHH:mm:ss (for DATETIME2 parameters / logs).
 * @param {Date} [d] defaults to now
 */
function wallClockIso(d) {
  const dt = d instanceof Date ? d : new Date();
  return dt.toLocaleString('sv-SE', { timeZone: COSMOS_IST_TZ }).replace(' ', 'T');
}

/** Today's calendar date in IST as YYYY-MM-DD. */
function todayYmd() {
  return new Date().toLocaleDateString('en-CA', { timeZone: COSMOS_IST_TZ });
}

/**
 * Any Date or parseable value → YYYY-MM-DD in IST (for filters / date inputs).
 * @param {Date|string|number} value
 */
function formatDateYmd(value) {
  if (value == null || value === '') return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-CA', { timeZone: COSMOS_IST_TZ });
}

/** IST hour 0–23 for server-side greetings / buckets. */
function istHour(d) {
  const dt = d instanceof Date ? d : new Date();
  return Number(
    dt.toLocaleString('en-GB', { timeZone: COSMOS_IST_TZ, hour: 'numeric', hour12: false })
  );
}

module.exports = {
  COSMOS_IST_TZ,
  SQL_NOW,
  sqlNow,
  wallClockIso,
  todayYmd,
  formatDateYmd,
  istHour,
};

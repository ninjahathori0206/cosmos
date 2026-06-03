/**
 * Promotes PENDING loyalty_ledger rows to LIVE when available_at has passed.
 * Runs only when loyalty_engine_v2 app_setting is enabled.
 */
const { getPool } = require('../config/db')
const { isLoyaltyEngineV2Enabled } = require('../lib/loyaltyEngineFlag')
const cxService = require('./cxService')

const INTERVAL_MS = Number(process.env.LOYALTY_CRON_INTERVAL_MS || 15 * 60 * 1000)
let _timer = null

async function runLoyaltyCronTick () {
  try {
    const pool = await getPool()
    if (!(await isLoyaltyEngineV2Enabled(pool))) return
    const out = await cxService.processPendingLoyalty(pool)
    if (out && Number(out.rows_promoted) > 0) {
      // eslint-disable-next-line no-console
      console.log('[loyalty-cron] promoted', out.rows_promoted, 'pending rows')
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[loyalty-cron]', err.message || err)
  }
}

function startLoyaltyCron () {
  if (_timer) return
  _timer = setInterval(runLoyaltyCronTick, INTERVAL_MS)
  if (typeof _timer.unref === 'function') _timer.unref()
  void runLoyaltyCronTick()
}

module.exports = { startLoyaltyCron, runLoyaltyCronTick }

/**
 * Renumber legacy POS invoices (EW-INV-EW-ORD-*) to sequential format:
 *   {prefix}{FY}-{storeCompact}-{seq5}  e.g. EW-INV-2627-SRT01-00001
 *
 * Usage: node scripts/migrate_legacy_pos_invoice_numbers.js [--dry-run]
 */
process.env.TZ = 'Asia/Kolkata'
require('dotenv').config()

const { getPool } = require('../src/config/db')
const { readSetting } = require('../src/services/procurementService')

const INVOICE_SEQ_KEY = 'pos_invoice_seq'

function getIndianFyLabelForInvoice(date = new Date()) {
  const istDateStr = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const parts = istDateStr.split('-').map(Number)
  const y = parts[0]
  const m = parts[1]
  if (!Number.isFinite(y) || !Number.isFinite(m)) return '0000'
  const fyStart = m >= 4 ? y : y - 1
  const fyEnd = (fyStart + 1) % 100
  return String(fyStart % 100).padStart(2, '0') + String(fyEnd).padStart(2, '0')
}

function compactStoreCodeForInvoice(storeCode) {
  const s = String(storeCode || 'STORE').trim()
  const trimmed = s.replace(/^EW-/i, '').replace(/-/g, '')
  return trimmed || 'STORE'
}

async function allocateNextSeq(pool) {
  const k = INVOICE_SEQ_KEY
  await pool.request().input('k', k).query(`
    IF NOT EXISTS (SELECT 1 FROM dbo.app_settings WITH (UPDLOCK, ROWLOCK) WHERE setting_key = @k)
    BEGIN
      INSERT INTO dbo.app_settings (setting_key, setting_value, setting_group, description)
      VALUES (@k, N'0', N'pos', N'Monotonic invoice sequence (integer string).');
    END
  `)
  const lock = await pool.request().input('k', k).query(
    'SELECT setting_value FROM dbo.app_settings WITH (UPDLOCK, ROWLOCK) WHERE setting_key = @k'
  )
  let seq = parseInt((lock.recordset[0] || {}).setting_value, 10)
  if (!Number.isFinite(seq)) seq = 0
  const nextSeq = seq + 1
  await pool.request().input('k', k).input('v', String(nextSeq)).query(`
    UPDATE dbo.app_settings
    SET setting_value = @v, updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
    WHERE setting_key = @k
  `)
  return nextSeq
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const pool = await getPool()
  const prefixRaw = await readSetting(pool, 'pos_invoice_prefix')
  const prefix = String(prefixRaw || 'EW-INV-')
  const fy = getIndianFyLabelForInvoice()

  const legacy = await pool.request().input('pfx', prefix + 'EW-ORD-%').query(`
    SELECT pi.invoice_id, pi.invoice_no, pi.order_id, pi.created_at,
           o.order_no, o.store_id, st.store_code
    FROM dbo.pos_invoices pi
    INNER JOIN dbo.pos_orders o ON o.order_id = pi.order_id
    LEFT JOIN dbo.stores st ON st.store_id = o.store_id
    WHERE pi.invoice_no LIKE @pfx
       OR pi.invoice_no = @pfx
    ORDER BY pi.created_at ASC, pi.invoice_id ASC
  `)

  const rows = legacy.recordset || []
  if (!rows.length) {
    console.log('No legacy invoice numbers to migrate.')
    process.exit(0)
  }

  console.log(`Found ${rows.length} legacy invoice(s)${dryRun ? ' (dry run)' : ''}:`)
  for (const row of rows) {
    const storeCompact = compactStoreCodeForInvoice(row.store_code)
    const nextSeq = dryRun
      ? '(next seq)'
      : await allocateNextSeq(pool)
    const newNo = dryRun
      ? `${prefix}${fy}-${storeCompact}-?????`
      : `${prefix}${fy}-${storeCompact}-${String(nextSeq).padStart(5, '0')}`

    console.log(`  ${row.invoice_no} → ${newNo}  (order ${row.order_no}, store ${row.store_code || row.store_id})`)

    if (!dryRun) {
      await pool.request()
        .input('iid', row.invoice_id)
        .input('newNo', newNo)
        .query(`
          UPDATE dbo.pos_invoices SET invoice_no = @newNo WHERE invoice_id = @iid
        `)
    }
  }

  if (!dryRun) {
    const after = await pool.request().query(`
      SELECT invoice_id, order_id, invoice_no FROM dbo.pos_invoices ORDER BY invoice_id
    `)
    console.log('\nAfter migration:')
    console.table(after.recordset)
  }

  console.log(dryRun ? '\nDry run only — no changes written.' : '\nDone.')
  process.exit(0)
}

main().catch((e) => {
  console.error('ERROR:', e.message)
  process.exit(1)
})

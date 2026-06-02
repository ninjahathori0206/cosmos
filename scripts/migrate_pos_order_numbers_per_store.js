/**
 * Renumber legacy POS order numbers (EW-ORD-123) to per-store format:
 *   EW-ORD-{storeCompact}-{seq5}  e.g. EW-ORD-SRT03-00001
 *
 * Updates pos_orders, oe_orders (if present), and offer_usage.order_no.
 * Syncs app_settings keys pos_order_seq:{STORE}.
 *
 * Usage: node scripts/migrate_pos_order_numbers_per_store.js [--dry-run]
 */
process.env.TZ = 'Asia/Kolkata'
require('dotenv').config()

const sql = require('mssql')
const { getPool } = require('../src/config/db')

const ORDER_NO_PREFIX = 'EW-ORD-'
const ORDER_SEQ_KEY_PREFIX = 'pos_order_seq:'

function compactStoreCodeForInvoice(storeCode) {
  const s = String(storeCode || 'STORE').trim()
  const trimmed = s.replace(/^EW-/i, '').replace(/-/g, '')
  return trimmed || 'STORE'
}

function orderSeqSettingKey(storeCompact) {
  const sc = String(storeCompact || 'STORE').trim().toUpperCase()
  const key = ORDER_SEQ_KEY_PREFIX + sc
  if (key.length <= 100) return key
  return ORDER_SEQ_KEY_PREFIX + sc.slice(0, 100 - ORDER_SEQ_KEY_PREFIX.length)
}

function buildPosOrderNo(storeCompact, seq) {
  const sc = String(storeCompact || 'STORE').trim().toUpperCase()
  return `${ORDER_NO_PREFIX}${sc}-${String(seq).padStart(5, '0')}`
}

/** Legacy global format: EW-ORD-{digits only} */
function isLegacyOrderNo(orderNo) {
  return /^EW-ORD-\d+$/i.test(String(orderNo || '').trim())
}

async function tableExists(pool, name) {
  const rs = await pool.request().input('n', sql.NVarChar(128), name).query(`
    SELECT CASE WHEN OBJECT_ID(@n, N'U') IS NOT NULL THEN 1 ELSE 0 END AS ok
  `)
  return !!(rs.recordset[0] && rs.recordset[0].ok)
}

async function loadLegacyOrders(pool, tableName) {
  const rs = await pool.request().query(`
    SELECT o.order_id, o.order_no, o.store_id, st.store_code
    FROM ${tableName} o
    LEFT JOIN dbo.stores st ON st.store_id = o.store_id
    ORDER BY o.store_id, o.order_id ASC
  `)
  return (rs.recordset || []).filter((r) => isLegacyOrderNo(r.order_no))
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const pool = await getPool()
  const hasPos = await tableExists(pool, 'dbo.pos_orders')
  const hasOe = await tableExists(pool, 'dbo.oe_orders')
  const hasOfferUsage = await tableExists(pool, 'dbo.offer_usage')

  if (!hasPos && !hasOe) {
    console.log('No pos_orders or oe_orders table — nothing to migrate.')
    process.exit(0)
  }

  const sourceTable = hasPos ? 'dbo.pos_orders' : 'dbo.oe_orders'
  const legacyRows = await loadLegacyOrders(pool, sourceTable)
  if (!legacyRows.length) {
    console.log('No legacy EW-ORD-{n} order numbers found.')
    process.exit(0)
  }

  const byStore = new Map()
  for (const row of legacyRows) {
    const sid = Number(row.store_id)
    if (!byStore.has(sid)) byStore.set(sid, [])
    byStore.get(sid).push(row)
  }

  const mapping = []
  for (const [, rows] of byStore) {
    let seq = 0
    for (const row of rows) {
      seq += 1
      const storeCompact = compactStoreCodeForInvoice(row.store_code).toUpperCase()
      mapping.push({
        order_id: row.order_id,
        old_no: row.order_no,
        new_no: buildPosOrderNo(storeCompact, seq),
        store_id: row.store_id,
        store_compact: storeCompact,
        seq
      })
    }
  }

  console.log(`Migrating ${mapping.length} order(s)${dryRun ? ' (dry run)' : ''}:`)
  for (const m of mapping) {
    console.log(`  ${m.old_no} → ${m.new_no}  (order_id ${m.order_id}, store ${m.store_id})`)
  }

  if (dryRun) {
    process.exit(0)
  }

  const transaction = new sql.Transaction(pool)
  await transaction.begin()
  try {
    const phase1 = async (tableName) => {
      for (const m of mapping) {
        const r = new sql.Request(transaction)
        r.input('oid', sql.Int, m.order_id)
        r.input('tmp', sql.NVarChar(50), `EW-ORD-MIG-${m.order_id}`)
        await r.query(`UPDATE ${tableName} SET order_no = @tmp WHERE order_id = @oid`)
      }
    }

    if (hasPos) await phase1('dbo.pos_orders')
    if (hasOe) await phase1('dbo.oe_orders')

    const phase2 = async (tableName) => {
      for (const m of mapping) {
        const r = new sql.Request(transaction)
        r.input('oid', sql.Int, m.order_id)
        r.input('newNo', sql.NVarChar(50), m.new_no)
        await r.query(`UPDATE ${tableName} SET order_no = @newNo WHERE order_id = @oid`)
      }
    }

    if (hasPos) await phase2('dbo.pos_orders')
    if (hasOe) await phase2('dbo.oe_orders')

    if (hasOfferUsage) {
      for (const m of mapping) {
        const r = new sql.Request(transaction)
        r.input('oid', sql.Int, m.order_id)
        r.input('newNo', sql.NVarChar(80), m.new_no)
        await r.query(`
          UPDATE dbo.offer_usage SET order_no = @newNo WHERE order_id = @oid
        `)
      }
    }

    const maxByStore = new Map()
    for (const m of mapping) {
      const prev = maxByStore.get(m.store_compact) || 0
      if (m.seq > prev) maxByStore.set(m.store_compact, m.seq)
    }

    for (const [storeCompact, maxSeq] of maxByStore) {
      const k = orderSeqSettingKey(storeCompact)
      const rEns = new sql.Request(transaction)
      rEns.input('k', sql.VarChar(100), k)
      rEns.input('v', sql.VarChar(500), String(maxSeq))
      await rEns.query(`
        IF NOT EXISTS (SELECT 1 FROM dbo.app_settings WHERE setting_key = @k)
          INSERT INTO dbo.app_settings (setting_key, setting_value, setting_group, description)
          VALUES (@k, @v, N'pos', N'Per-store POS order sequence (integer string).');
        ELSE
          UPDATE dbo.app_settings
          SET setting_value = @v, updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
          WHERE setting_key = @k
      `)
    }

    await transaction.commit()
    console.log('Migration complete. Per-store pos_order_seq:* settings synced.')
  } catch (err) {
    await transaction.rollback()
    throw err
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

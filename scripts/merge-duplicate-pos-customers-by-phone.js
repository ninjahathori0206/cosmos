/**
 * One-time merge of duplicate active pos_customers rows sharing the same normalized phone.
 * Survivor = most orders (pos_orders + oe_orders); tie → lowest customer_id.
 *
 * Usage:
 *   node scripts/merge-duplicate-pos-customers-by-phone.js --dry-run
 *   node scripts/merge-duplicate-pos-customers-by-phone.js --execute
 *
 * Before --execute: DB backup required. Run migration 80 (aliases table) first.
 */
require('dotenv').config()
const sql = require('mssql')
const { normalizeIndiaMobileDigits, isValidIndiaMobileDigits } = require('../src/lib/indiaMobile')

const config = {
  server: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: { encrypt: false, trustServerCertificate: true }
}

const CHILD_TABLES = [
  { table: 'pos_orders', col: 'customer_id' },
  { table: 'oe_orders', col: 'customer_id' },
  { table: 'eye_tests', col: 'customer_id' },
  { table: 'pos_checkout_inventory_drafts', col: 'customer_id' },
  { table: 'offer_usage', col: 'customer_id' },
  { table: 'pos_points_ledger', col: 'customer_id' }
]

function parseArgs() {
  const execute = process.argv.includes('--execute')
  const dryRun = process.argv.includes('--dry-run') || !execute
  if (!dryRun && !execute) {
    console.error('Pass --dry-run (default) or --execute')
    process.exit(1)
  }
  return { dryRun: dryRun && !execute, execute }
}

async function tableExists(pool, name) {
  const r = await pool.request().input('t', sql.NVarChar(128), name).query(`
    SELECT 1 AS ok FROM sys.tables WHERE name = @t AND schema_id = SCHEMA_ID('dbo')
  `)
  return !!r.recordset[0]
}

async function normalizePhones(pool, dryRun, log) {
  const r = await pool.request().query(`
    SELECT customer_id, phone, full_name FROM dbo.pos_customers WHERE is_active = 1
  `)
  let updated = 0
  let invalid = 0
  for (const row of r.recordset || []) {
    const norm = normalizeIndiaMobileDigits(row.phone)
    if (!isValidIndiaMobileDigits(norm)) {
      invalid++
      log.push({ type: 'invalid_phone', customer_id: row.customer_id, phone: row.phone })
      continue
    }
    if (norm !== String(row.phone || '').trim()) {
      updated++
      if (!dryRun) {
        await pool
          .request()
          .input('id', sql.Int, row.customer_id)
          .input('p', sql.NVarChar(20), norm)
          .query(`UPDATE dbo.pos_customers SET phone = @p, updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME()) WHERE customer_id = @id`)
      }
    }
  }
  return { updated, invalid }
}

async function orderCount(pool, customerId) {
  const r = await pool.request().input('cid', sql.Int, customerId).query(`
    SELECT
      (SELECT COUNT(*) FROM dbo.pos_orders WHERE customer_id = @cid) +
      (SELECT COUNT(*) FROM dbo.oe_orders WHERE customer_id = @cid) AS cnt
  `)
  return Number(r.recordset[0]?.cnt || 0)
}

async function findDuplicateGroups(pool) {
  const r = await pool.request().query(`
    SELECT phone, COUNT(*) AS cnt
    FROM   dbo.pos_customers
    WHERE  is_active = 1 AND phone IS NOT NULL AND LTRIM(RTRIM(phone)) <> ''
    GROUP BY phone
    HAVING COUNT(*) > 1
    ORDER BY phone
  `)
  return r.recordset || []
}

async function customersForPhone(pool, phone) {
  const r = await pool.request().input('phone', sql.NVarChar(20), phone).query(`
    SELECT customer_id, full_name, phone, email
    FROM   dbo.pos_customers
    WHERE  is_active = 1 AND phone = @phone
    ORDER BY customer_id
  `)
  return r.recordset || []
}

async function pickSurvivor(pool, rows) {
  let best = rows[0]
  let bestCnt = await orderCount(pool, best.customer_id)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const cnt = await orderCount(pool, row.customer_id)
    if (cnt > bestCnt || (cnt === bestCnt && row.customer_id < best.customer_id)) {
      best = row
      bestCnt = cnt
    }
  }
  return { survivor: best, orderCount: bestCnt }
}

async function ensureAlias(pool, survivorId, aliasName, dryRun) {
  const name = String(aliasName || '').trim()
  if (!name) return
  const hasTable = await tableExists(pool, 'pos_customer_aliases')
  if (!hasTable) return
  if (dryRun) return
  await pool
    .request()
    .input('cid', sql.Int, survivorId)
    .input('alias', sql.NVarChar(200), name)
    .query(`
      IF NOT EXISTS (
        SELECT 1 FROM dbo.pos_customer_aliases WHERE customer_id = @cid AND alias_name = @alias
      )
      AND NOT EXISTS (
        SELECT 1 FROM dbo.pos_customers WHERE customer_id = @cid AND LTRIM(RTRIM(full_name)) = @alias
      )
      INSERT INTO dbo.pos_customer_aliases (customer_id, alias_name)
      VALUES (@cid, @alias)
    `)
}

async function mergeMemberships(pool, survivorId, loserId, dryRun, log) {
  const has = await tableExists(pool, 'customer_memberships')
  if (!has) return
  const survMem = await pool.request().input('cid', sql.Int, survivorId).query(`
    SELECT TOP 1 membership_id, is_active FROM dbo.customer_memberships
    WHERE customer_id = @cid AND is_active = 1
    ORDER BY expires_at DESC
  `)
  const loseMem = await pool.request().input('cid', sql.Int, loserId).query(`
    SELECT membership_id, is_active FROM dbo.customer_memberships WHERE customer_id = @cid
  `)
  const survActive = survMem.recordset[0]
  for (const m of loseMem.recordset || []) {
    if (m.is_active && survActive) {
      log.push({
        type: 'membership_deactivate_loser',
        loser_id: loserId,
        membership_id: m.membership_id
      })
      if (!dryRun) {
        await pool
          .request()
          .input('mid', sql.Int, m.membership_id)
          .query(`UPDATE dbo.customer_memberships SET is_active = 0 WHERE membership_id = @mid`)
      }
    } else if (!survActive && m.is_active) {
      if (!dryRun) {
        await pool
          .request()
          .input('mid', sql.Int, m.membership_id)
          .input('sid', sql.Int, survivorId)
          .query(`UPDATE dbo.customer_memberships SET customer_id = @sid WHERE membership_id = @mid`)
      }
    } else if (!dryRun) {
      await pool
        .request()
        .input('mid', sql.Int, m.membership_id)
        .input('sid', sql.Int, survivorId)
        .query(`UPDATE dbo.customer_memberships SET customer_id = @sid WHERE membership_id = @mid`)
    }
  }
}

async function mergeCustomerAuth(pool, survivorId, loserId, dryRun, log) {
  const has = await tableExists(pool, 'customer_auth')
  if (!has) return
  const surv = await pool.request().input('cid', sql.Int, survivorId).query(`
    SELECT 1 AS ok FROM dbo.customer_auth WHERE customer_id = @cid
  `)
  const lose = await pool.request().input('cid', sql.Int, loserId).query(`
    SELECT customer_auth_id FROM dbo.customer_auth WHERE customer_id = @cid
  `)
  if (!lose.recordset[0]) return
  if (surv.recordset[0]) {
    log.push({ type: 'customer_auth_conflict', loser_id: loserId, survivor_id: survivorId })
    return
  }
  if (!dryRun) {
    await pool
      .request()
      .input('sid', sql.Int, survivorId)
      .input('lid', sql.Int, loserId)
      .query(`UPDATE dbo.customer_auth SET customer_id = @sid WHERE customer_id = @lid`)
  }
}

async function mergeDependents(pool, survivorId, loserId, dryRun) {
  const has = await tableExists(pool, 'customer_membership_dependents')
  if (!has) return
  const rows = await pool.request().input('lid', sql.Int, loserId).query(`
    SELECT dependent_id, membership_id, customer_id FROM dbo.customer_membership_dependents
    WHERE customer_id = @lid
  `)
  for (const d of rows.recordset || []) {
    const dup = await pool
      .request()
      .input('mid', sql.Int, d.membership_id)
      .input('sid', sql.Int, survivorId)
      .query(`
        SELECT 1 AS ok FROM dbo.customer_membership_dependents
        WHERE membership_id = @mid AND customer_id = @sid
      `)
    if (dup.recordset[0]) {
      if (!dryRun) {
        await pool
          .request()
          .input('did', sql.Int, d.dependent_id)
          .query(`DELETE FROM dbo.customer_membership_dependents WHERE dependent_id = @did`)
      }
    } else if (!dryRun) {
      await pool
        .request()
        .input('did', sql.Int, d.dependent_id)
        .input('sid', sql.Int, survivorId)
        .query(`UPDATE dbo.customer_membership_dependents SET customer_id = @sid WHERE dependent_id = @did`)
    }
  }
}

async function mergeGroup(pool, phone, dryRun, audit) {
  const rows = await customersForPhone(pool, phone)
  if (rows.length < 2) return
  const { survivor, orderCount: survOrders } = await pickSurvivor(pool, rows)
  const losers = rows.filter((r) => r.customer_id !== survivor.customer_id)
  const entry = {
    phone,
    survivor_id: survivor.customer_id,
    survivor_name: survivor.full_name,
    survivor_orders: survOrders,
    merged_ids: losers.map((l) => l.customer_id),
    loser_names: losers.map((l) => l.full_name),
    log: []
  }
  audit.push(entry)

  if (dryRun) return

  const tx = new sql.Transaction(pool)
  await tx.begin()
  const req = () => new sql.Request(tx)
  try {
    for (const loser of losers) {
      for (const { table, col } of CHILD_TABLES) {
        if (!(await tableExists(pool, table))) continue
        await req()
          .input('sid', sql.Int, survivor.customer_id)
          .input('lid', sql.Int, loser.customer_id)
          .query(`UPDATE dbo.${table} SET ${col} = @sid WHERE ${col} = @lid`)
      }
      await mergeMemberships(pool, survivor.customer_id, loser.customer_id, false, entry.log)
      await mergeCustomerAuth(pool, survivor.customer_id, loser.customer_id, false, entry.log)
      await mergeDependents(pool, survivor.customer_id, loser.customer_id, false)

      const primary = String(survivor.full_name || '').trim()
      const loserName = String(loser.full_name || '').trim()
      if (loserName && loserName.toLowerCase() !== primary.toLowerCase()) {
        await ensureAlias(pool, survivor.customer_id, loserName, false)
      }

      await req()
        .input('lid', sql.Int, loser.customer_id)
        .query(`
          UPDATE dbo.pos_customers
          SET is_active = 0, updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
          WHERE customer_id = @lid
        `)
    }
    await tx.commit()
  } catch (err) {
    await tx.rollback()
    throw err
  }
}

async function ensureUniquePhoneIndex(pool, dryRun) {
  const dup = await findDuplicateGroups(pool)
  if (dup.length) {
    console.error('[merge] Cannot create unique index —', dup.length, 'duplicate phone group(s) remain.')
    return false
  }
  const exists = await pool.request().query(`
    SELECT 1 AS ok FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.pos_customers') AND name = N'UQ_pos_customers_phone_active'
  `)
  if (exists.recordset[0]) {
    console.log('[merge] UQ_pos_customers_phone_active already exists.')
    return true
  }
  if (dryRun) {
    console.log('[merge] Would create UQ_pos_customers_phone_active (filtered unique on active phone).')
    return true
  }
  await pool.request().query(`
    CREATE UNIQUE INDEX UQ_pos_customers_phone_active
      ON dbo.pos_customers(phone)
      WHERE is_active = 1
  `)
  console.log('[merge] Created UQ_pos_customers_phone_active.')
  return true
}

async function main() {
  const { dryRun, execute } = parseArgs()
  if (!config.database || !config.user) {
    console.error('Missing DB_NAME or DB_USER in .env')
    process.exit(1)
  }
  console.log('[merge] Mode:', dryRun ? 'DRY-RUN' : 'EXECUTE')
  const pool = await sql.connect(config)
  const audit = []
  const log = []
  try {
    const norm = await normalizePhones(pool, dryRun, log)
    console.log('[merge] Phone normalize:', norm.updated, 'updated,', norm.invalid, 'invalid (logged)')

    const groups = await findDuplicateGroups(pool)
    console.log('[merge] Duplicate phone groups:', groups.length)
    for (const g of groups) {
      await mergeGroup(pool, g.phone, dryRun, audit)
    }

    if (audit.length) {
      console.log('\n--- Audit ---')
      audit.forEach((a) => {
        console.log(
          `phone=${a.phone} survivor=${a.survivor_id} (${a.survivor_name}) orders=${a.survivor_orders} merged=[${a.merged_ids.join(',')}]`
        )
      })
    }

    if (execute) {
      await ensureUniquePhoneIndex(pool, false)
    } else {
      await ensureUniquePhoneIndex(pool, true)
    }

    console.log('\n[merge] Verification checklist:')
    console.log('  1. Register Rama 9876543210 → customer_id A')
    console.log('  2. Register Ram same mobile → confirm alias → still A')
    console.log('  3. SELECT phone FROM pos_customers WHERE is_active=1 GROUP BY phone HAVING COUNT(*)>1 → 0 rows')
    console.log('  4. Search "Ram" shows alias-first with (registered as …)')
    console.log('  5. Go dependent add uses existing customer_id for known phone')
    if (dryRun) {
      console.log('\n[merge] Dry-run complete. Re-run with --execute after backup.')
    } else {
      console.log('\n[merge] Execute complete.')
    }
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error('[merge] FAILED:', err.message)
  process.exit(1)
})

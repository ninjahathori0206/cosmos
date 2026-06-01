/**
 * IST UTC → wall-clock backfill (+330 min on listed DATETIME columns).
 *
 * Requires: COSMOS_IST_BACKFILL_CONFIRM=I_UNDERSTAND
 * Optional force re-run: COSMOS_IST_BACKFILL_FORCE=1 (if marker already set)
 *
 * Usage:
 *   npm run maintenance:ist-utc-backfill
 * PowerShell:
 *   $env:COSMOS_IST_BACKFILL_CONFIRM='I_UNDERSTAND'; npm run maintenance:ist-utc-backfill
 */
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const sql = require('mssql')
const { wallClockIso, sqlNow } = require('../src/lib/cosmosIst')

const MARKER_KEY = 'ist_utc_backfill_v1_completed_at'

/** Substitute cutoff placeholder and append WHERE on UPDATE blocks (skip rows on/after cutoff). */
function injectBackfillCutoff(source, beforeIso) {
  const safe = beforeIso.replace(/'/g, "''")
  let s = source.replace(/__BACKFILL_BEFORE__/g, safe)
  const blockRe = /(UPDATE dbo\.\w+ SET[\s\S]*?)(\r?\n\r?\n  IF OBJECT_ID|\r?\n\r?\n  -- ----|\r?\n\r?\n  END;)/g
  s = s.replace(blockRe, (full, body, next) => {
    if (/\bWHERE\b/i.test(body)) return full
    const trimmed = body.replace(/;\s*$/, '')
    if (/\bcreated_at\s*=\s*DATEADD/i.test(body)) {
      return trimmed + '\n    WHERE created_at < @BackfillBefore;' + next
    }
    if (/\blast_updated\s*=\s*DATEADD/i.test(body)) {
      return trimmed + '\n    WHERE last_updated < @BackfillBefore;' + next
    }
    if (/\bupdated_at\s*=\s*DATEADD/i.test(body) && !/\bcreated_at\s*=\s*DATEADD/i.test(body)) {
      return trimmed + '\n    WHERE updated_at < @BackfillBefore;' + next
    }
    if (/\bused_at\s*=\s*DATEADD/i.test(body)) {
      return trimmed + '\n    WHERE used_at < @BackfillBefore;' + next
    }
    if (/\badded_at\s*=\s*DATEADD/i.test(body)) {
      return trimmed + '\n    WHERE added_at < @BackfillBefore;' + next
    }
    if (/\bchanged_at\s*=\s*DATEADD/i.test(body)) {
      return trimmed + '\n    WHERE changed_at < @BackfillBefore;' + next
    }
    return trimmed + ';' + next
  })
  return s
}

const config = {
  server: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: { encrypt: false, trustServerCertificate: true },
  requestTimeout: Math.max(300000, Number(process.env.DB_REQUEST_TIMEOUT_MS || 300000))
}

async function probeUtcLikelihood(pool) {
  const probes = [
    { label: 'audit_logs', sql: `SELECT TOP 1 created_at AS ts FROM dbo.audit_logs ORDER BY created_at DESC` },
    { label: 'pos_orders', sql: `SELECT TOP 1 created_at AS ts FROM dbo.pos_orders ORDER BY created_at DESC` },
    { label: 'transfer_requests', sql: `SELECT TOP 1 created_at AS ts FROM dbo.transfer_requests ORDER BY created_at DESC` }
  ]
  const istNowR = await pool.request().query(`SELECT ${sqlNow()} AS ist_now`)
  const istNow = istNowR.recordset[0].ist_now
  const out = []
  for (const p of probes) {
    try {
      const r = await pool.request().query(p.sql)
      const ts = r.recordset[0]?.ts
      if (!ts) continue
      const diff = await pool.request()
        .input('ts', sql.DateTime2, ts)
        .query(`SELECT DATEDIFF(MINUTE, @ts, ${sqlNow()}) AS min_behind_ist`)
      out.push({
        table: p.label,
        latest: ts,
        minBehindIst: diff.recordset[0].min_behind_ist
      })
    } catch (_) {
      /* table may not exist */
    }
  }
  return { istNow, samples: out }
}

async function readMarker(pool) {
  try {
    const r = await pool.request()
      .input('k', sql.VarChar(100), MARKER_KEY)
      .query('SELECT setting_value FROM dbo.app_settings WHERE setting_key = @k')
    return r.recordset[0]?.setting_value || null
  } catch (_) {
    return null
  }
}

async function writeMarker(pool) {
  const val = wallClockIso()
  await pool.request()
    .input('k', sql.VarChar(100), MARKER_KEY)
    .input('v', sql.VarChar(500), val)
    .query(`
      IF EXISTS (SELECT 1 FROM dbo.app_settings WHERE setting_key = @k)
        UPDATE dbo.app_settings SET setting_value = @v, updated_at = ${sqlNow()} WHERE setting_key = @k;
      ELSE
        INSERT INTO dbo.app_settings (setting_key, setting_value, setting_group, description, updated_at)
        VALUES (@k, @v, 'maintenance', 'IST UTC backfill completed (do not re-run without audit)', ${sqlNow()});
    `)
}

async function run() {
  if (process.env.COSMOS_IST_BACKFILL_CONFIRM !== 'I_UNDERSTAND') {
    console.error(
      'Refusing to run: set COSMOS_IST_BACKFILL_CONFIRM=I_UNDERSTAND after DB backup and UTC-stored confirmation.'
    )
    console.error('See docs/architecture/ist-time.md and sql/migrations/ist_backfill_utc_stored_rows.sql')
    process.exit(1)
  }
  if (!config.database || !config.user) {
    console.error('Missing DB_NAME or DB_USER in .env')
    process.exit(1)
  }

  const migrationPath = path.join(__dirname, '..', 'sql', 'migrations', 'ist_backfill_utc_stored_rows.sql')
  let source = fs.readFileSync(migrationPath, 'utf8')
  if (!/DECLARE @ConfirmUtcStored BIT = 0;/.test(source)) {
    console.error('[ist_backfill] Expected @ConfirmUtcStored = 0 guard in migration file.')
    process.exit(1)
  }
  const beforeIso = (process.env.COSMOS_IST_BACKFILL_BEFORE || '2026-06-01T00:00:00').trim()
  source = source.replace(
    /DECLARE @ConfirmUtcStored BIT = 0;\s*--[^\n]*/m,
    'DECLARE @ConfirmUtcStored BIT = 1; -- set by scripts/run_ist_utc_backfill.js'
  )
  source = injectBackfillCutoff(source, beforeIso)
  if (process.env.COSMOS_IST_BACKFILL_DEBUG === '1') {
    fs.writeFileSync(path.join(__dirname, '_ist_backfill_generated.sql'), source, 'utf8')
  }
  console.log('[ist_backfill] Shifting rows with created_at/updated_at/last_updated before:', beforeIso)
  console.log('[ist_backfill] Full DB flip: set COSMOS_IST_BACKFILL_BEFORE=2099-12-31T23:59:59')
  const batches = source.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean)

  const pool = await sql.connect(config)
  try {
    const marker = await readMarker(pool)
    if (marker && process.env.COSMOS_IST_BACKFILL_FORCE !== '1') {
      console.error(`[ist_backfill] Already completed at ${marker}. Set COSMOS_IST_BACKFILL_FORCE=1 to run again.`)
      process.exit(1)
    }

    const probe = await probeUtcLikelihood(pool)
    console.log('[ist_backfill] IST now (SQL):', probe.istNow)
    for (const s of probe.samples) {
      console.log(
        `[ist_backfill] probe ${s.table}: latest=${s.latest} min_behind_ist=${s.minBehindIst}` +
          (s.minBehindIst >= 300 && s.minBehindIst <= 360 ? ' (likely UTC-stored)' : '')
      )
    }

    for (let i = 0; i < batches.length; i += 1) {
      await pool.request().query(batches[i])
      console.log(`[ist_backfill] batch ${i + 1}/${batches.length} ok`)
    }

    await writeMarker(pool)
    console.log('[ist_backfill] completed successfully. Marker:', MARKER_KEY)
    console.log('[ist_backfill] Re-login users; hard-refresh browsers. Verify sample rows in UI.')
  } finally {
    await pool.close()
  }
}

run().catch((err) => {
  console.error('[ist_backfill] FAILED:', err.message)
  process.exit(1)
})

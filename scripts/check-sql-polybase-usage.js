#!/usr/bin/env node
/**
 * Read-only PolyBase / external object check for Cosmos SQL Server.
 * Usage: npm run check:sql-polybase
 */
process.env.TZ = 'Asia/Kolkata'
require('dotenv').config()

const sql = require('mssql')

const config = {
  server: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: { encrypt: false, trustServerCertificate: true },
  requestTimeout: 30000
}

async function safeQuery(pool, label, text) {
  try {
    const r = await pool.request().query(text)
    return { label, ok: true, rows: r.recordset || [] }
  } catch (err) {
    return { label, ok: false, error: err.message || String(err) }
  }
}

async function main() {
  if (!config.database || !config.user) {
    console.error('Missing DB_NAME or DB_USER in .env')
    process.exit(1)
  }

  const pool = await sql.connect(config)
  console.log('[polybase-check] Connected to', config.server, 'database', config.database)

  const checks = [
    ['external_tables (current DB)', `
      SELECT DB_NAME() AS db_name, name, location, type_desc
      FROM sys.external_tables
    `],
    ['external_data_sources (current DB)', `
      SELECT DB_NAME() AS db_name, name, type_desc, location
      FROM sys.external_data_sources
    `],
    ['external_file_formats (current DB)', `
      SELECT DB_NAME() AS db_name, name, format_type
      FROM sys.external_file_formats
    `],
    ['SQL Server edition', `
      SELECT
        SERVERPROPERTY('Edition') AS edition,
        SERVERPROPERTY('ProductVersion') AS product_version,
        SERVERPROPERTY('ProductLevel') AS product_level,
        SERVERPROPERTY('MachineName') AS machine_name
    `],
    ['PolyBase installed (feature)', `
      SELECT feature_name, feature_id
      FROM sys.dm_db_paa_features
      WHERE feature_name LIKE '%PolyBase%'
    `],
    ['PolyBase config', `
      SELECT name, value, value_in_use, description
      FROM sys.configurations
      WHERE name LIKE '%polybase%'
    `]
  ]

  const results = []
  for (const [label, text] of checks) {
    results.push(await safeQuery(pool, label, text))
  }

  await pool.close()

  let anyExternal = false
  for (const r of results) {
    console.log('\n---', r.label, '---')
    if (!r.ok) {
      console.log('(skipped or unavailable)', r.error)
      continue
    }
    if (!r.rows.length) {
      console.log('(none)')
      continue
    }
    console.log(JSON.stringify(r.rows, null, 2))
    if (r.label.includes('external') && r.rows.length) anyExternal = true
  }

  console.log('\n[polybase-check] Summary')
  console.log('  Cosmos app: no PolyBase usage (TDS + stored procedures only).')
  console.log('  External objects on this DB:', anyExternal ? 'YES' : 'NO')
  console.log('  Host:', config.server, '— stop PolyBase services on that machine if NO external objects.')

  process.exit(anyExternal ? 2 : 0)
}

main().catch((err) => {
  console.error('[polybase-check]', err.message || err)
  process.exit(1)
})

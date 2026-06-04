/**
 * Migration 97 — eye_tests.patient_dob
 * Usage: node scripts/run-migration-97-eye-tests-patient-dob.js
 */
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const sql = require('mssql')

const config = {
  server: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: { encrypt: false, trustServerCertificate: true }
}

async function main () {
  if (!config.database || !config.user) {
    console.error('Missing DB_NAME or DB_USER in .env')
    process.exit(1)
  }
  const migFile = path.join(__dirname, '..', 'sql', 'migrations', '97_eye_tests_patient_dob.sql')
  const batches = fs.readFileSync(migFile, 'utf8').split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean)
  const pool = await sql.connect(config)
  try {
    for (const batch of batches) await pool.request().query(batch)
    const check = await pool.request().query(`
      SELECT COL_LENGTH('dbo.eye_tests', 'patient_dob') AS patient_dob_col
    `)
    console.log('[migration-97] OK', check.recordset[0])
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error('[migration-97]', err.message || err)
  process.exit(1)
})

/**
 * Grant Foundry Catalogue permissions to hq_manager (Phase B granular set).
 * Usage: node scripts/grant_hq_manager_catalogue_permissions.js
 */
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const { getPool } = require('../src/config/db')
const { ALL_CATALOGUE_PERMISSION_KEYS } = require('../src/config/foundryCatalogueAuth')

async function main() {
  const file = path.join(__dirname, '..', 'sql', 'maintenance', 'grant_hq_manager_catalogue_permissions.sql')
  const script = fs.readFileSync(file, 'utf8')
  const cleaned = script.replace(/^\s*GO\s*$/gim, '')
  const pool = await getPool()
  await pool.request().batch(cleaned)

  const inList = ALL_CATALOGUE_PERMISSION_KEYS.map((k) => `N'${k.replace(/'/g, "''")}'`).join(', ')
  const r = await pool.request().input('rk', require('mssql').NVarChar(50), 'hq_manager').query(`
    SELECT permission FROM dbo.role_permissions
    WHERE role_key = @rk AND permission IN (${inList})
    ORDER BY permission
  `)

  console.log('Expected keys:', ALL_CATALOGUE_PERMISSION_KEYS.join(', '))
  console.log('hq_manager has:')
  const have = (r.recordset || []).map((x) => x.permission)
  console.log(have.join(', ') || '(none)')
  const missing = ALL_CATALOGUE_PERMISSION_KEYS.filter((k) => !have.includes(k))
  if (missing.length) {
    console.error('Missing:', missing.join(', '))
    process.exit(1)
  }
  console.log('OK. Re-login as hq_manager users so JWT includes catalogue permissions.')
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message || e)
    process.exit(1)
  })

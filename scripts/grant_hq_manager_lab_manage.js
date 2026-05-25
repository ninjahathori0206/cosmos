/**
 * Grant foundry.lab.manage to hq_manager (RBAC lab transitions).
 * Usage: node scripts/grant_hq_manager_lab_manage.js
 */
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const { getPool } = require('../src/config/db')

async function main() {
  const file = path.join(__dirname, '..', 'sql', 'maintenance', 'grant_hq_manager_lab_manage.sql')
  const script = fs.readFileSync(file, 'utf8')
  const cleaned = script.replace(/^\s*GO\s*$/gim, '')
  const pool = await getPool()
  await pool.request().batch(cleaned)
  const r = await pool.request().input('rk', require('mssql').NVarChar(50), 'hq_manager').query(`
    SELECT permission FROM dbo.role_permissions WHERE role_key = @rk AND permission LIKE N'foundry.lab.%'
  `)
  console.log('hq_manager foundry.lab.* permissions:')
  console.log((r.recordset || []).map((x) => x.permission).join(', ') || '(none)')
  console.log('Re-login as hq_manager users so JWT includes new permissions.')
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message || e)
    process.exit(1)
  })

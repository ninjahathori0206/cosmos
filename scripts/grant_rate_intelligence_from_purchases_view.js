/**
 * Grant foundry.rate_intelligence.view to roles that have foundry.purchases.view.
 * Usage: node scripts/grant_rate_intelligence_from_purchases_view.js
 */
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const { getPool } = require('../src/config/db')

async function main() {
  const file = path.join(__dirname, '..', 'sql', 'maintenance', 'grant_rate_intelligence_from_purchases_view.sql')
  const script = fs.readFileSync(file, 'utf8')
  const cleaned = script.replace(/^\s*GO\s*$/gim, '')
  const pool = await getPool()
  await pool.request().batch(cleaned)
  const r = await pool.request().query(`
    SELECT role_key FROM dbo.role_permissions
    WHERE permission = N'foundry.rate_intelligence.view'
    ORDER BY role_key
  `)
  console.log('Roles with foundry.rate_intelligence.view:')
  console.log((r.recordset || []).map((x) => x.role_key).join(', ') || '(none)')
  console.log('Re-login after assigning in Command Unit.')
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message || e)
    process.exit(1)
  })

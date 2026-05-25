/**
 * Phase B — grant granular catalogue keys to roles that have legacy foundry.catalogue.*.
 * Usage: node scripts/migrate_catalogue_granular_permissions.js
 */
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const { getPool } = require('../src/config/db')
const { ALL_CATALOGUE_PERMISSION_KEYS } = require('../src/config/foundryCatalogueAuth')

async function main() {
  const file = path.join(__dirname, '..', 'sql', 'maintenance', 'migrate_catalogue_granular_permissions.sql')
  const script = fs.readFileSync(file, 'utf8')
  const cleaned = script.replace(/^\s*GO\s*$/gim, '')
  const pool = await getPool()
  await pool.request().batch(cleaned)

  const r = await pool.request().input('rk', require('mssql').NVarChar(50), 'hq_manager').query(`
    SELECT permission FROM dbo.role_permissions
    WHERE role_key = @rk
      AND permission IN (
        N'foundry.catalogue.view', N'foundry.catalogue.edit',
        N'foundry.lens.packages.view', N'foundry.lens.packages.edit',
        N'foundry.lens.addons.view', N'foundry.lens.addons.edit',
        N'foundry.lens.matrix.view', N'foundry.lens.matrix.edit',
        N'foundry.lens.wizard.view', N'foundry.lens.wizard.edit',
        N'foundry.master_catalogue.view', N'foundry.master_catalogue.edit',
        N'foundry.stock.view', N'foundry.stock.create'
      )
    ORDER BY permission
  `)

  const have = (r.recordset || []).map((x) => x.permission)
  console.log('hq_manager catalogue permissions:')
  console.log(have.join(', ') || '(none)')
  const missing = ALL_CATALOGUE_PERMISSION_KEYS.filter((k) => !have.includes(k))
  if (missing.length) {
    console.warn('hq_manager still missing (assign in CU or run grant script):', missing.join(', '))
  } else {
    console.log('hq_manager has full granular catalogue set.')
  }
  console.log('Re-login so JWT includes updated permissions.')
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e.message || e)
    process.exit(1)
  })

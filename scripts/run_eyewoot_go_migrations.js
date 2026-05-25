process.env.TZ = 'Asia/Kolkata';
require('dotenv').config();

const fs   = require('fs');
const path = require('path');
const { getPool } = require('../src/config/db');

const MIGRATIONS = [
  '29_customer_auth.sql',
  '30_pos_customers_alter.sql',
  '31_membership_plans.sql',
  '32_customer_memberships.sql',
  '33_eye_tests.sql',
  '34_loyalty_tiers.sql',
  '35_customer_offers.sql',
  'customer_offers_bogo_discount_types.sql',
  '37_widen_customer_offers_discount_type.sql',
  '62_seed_membership_plans_default.sql'
];

async function runMigrations() {
  console.log('\n🚀 Running Eyewoot Go migrations...\n');
  const pool = await getPool();

  for (const file of MIGRATIONS) {
    const filePath = path.join(__dirname, '..', 'sql', 'migrations', file);
    let sql = fs.readFileSync(filePath, 'utf8');

    // Split on GO statements (SSMS batch separator)
    const batches = sql.split(/^\s*GO\s*$/im).map(b => b.trim()).filter(Boolean);

    process.stdout.write(`  Running ${file}...`);
    try {
      for (const batch of batches) {
        if (batch) await pool.request().query(batch);
      }
      console.log(' ✓');
    } catch (err) {
      console.log(' ✗');
      console.error(`    ERROR: ${err.message}\n`);
      process.exit(1);
    }
  }

  console.log('\n✅ All migrations completed successfully!\n');
  process.exit(0);
}

runMigrations().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});

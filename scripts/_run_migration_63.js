process.env.TZ = 'Asia/Kolkata'
require('dotenv').config()
const { getPool } = require('../src/config/db')

async function main () {
  const pool = await getPool()

  const before = await pool.request().query(`
    SELECT DB_NAME() AS db_name,
           COL_LENGTH('dbo.membership_plans', 'tier_id') AS tier_id_len
  `)
  console.log('Before:', before.recordset[0])

  if (before.recordset[0].tier_id_len == null) {
    console.log('Step 1: ADD tier_id column...')
    await pool.request().query(`
      ALTER TABLE dbo.membership_plans ADD tier_id INT NULL;
    `)
  }

  console.log('Step 2: FK (if missing)...')
  try {
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.foreign_keys
        WHERE name = N'FK_membership_plans_tier'
          AND parent_object_id = OBJECT_ID(N'dbo.membership_plans')
      )
      AND OBJECT_ID('dbo.membership_tiers', 'U') IS NOT NULL
      BEGIN
        ALTER TABLE dbo.membership_plans
          ADD CONSTRAINT FK_membership_plans_tier
          FOREIGN KEY (tier_id) REFERENCES dbo.membership_tiers(membership_id);
      END;
    `)
    console.log('  FK ok or already exists')
  } catch (err) {
    console.warn('  FK skipped:', err.message)
  }

  console.log('Step 3: Backfill tier_id...')
  const backfill = await pool.request().query(`
    IF OBJECT_ID('dbo.membership_tiers', 'U') IS NOT NULL
    BEGIN
      UPDATE p
      SET p.tier_id = t.membership_id
      FROM dbo.membership_plans p
      INNER JOIN dbo.membership_tiers t ON t.is_active = 1
        AND (
          UPPER(LTRIM(RTRIM(ISNULL(t.loyalty_tier, N'')))) = UPPER(p.plan_key)
          OR UPPER(REPLACE(REPLACE(REPLACE(t.tier_name, N' ', N'_'), N'-', N'_'), N'.', N'_')) = UPPER(p.plan_key)
        )
      WHERE p.tier_id IS NULL;
      SELECT @@ROWCOUNT AS rows_updated;
    END
  `)
  console.log('  Rows updated:', backfill.recordset[0])

  const after = await pool.request().query(`
    SELECT COL_LENGTH('dbo.membership_plans', 'tier_id') AS tier_id_len,
           (SELECT COUNT(*) FROM dbo.membership_plans WHERE tier_id IS NOT NULL) AS linked_plans,
           (SELECT COUNT(*) FROM dbo.membership_plans) AS total_plans
  `)
  console.log('After:', after.recordset[0])
  console.log('Migration 63 completed.')
  process.exit(0)
}

main().catch((err) => {
  console.error('ERROR:', err.message)
  process.exit(1)
})

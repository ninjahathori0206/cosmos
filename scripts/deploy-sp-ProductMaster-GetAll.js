/* Deploy only dbo.sp_ProductMaster_GetAll from sql/sp/product_master.sql */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getPool } = require('../src/config/db');

(async () => {
  const raw = fs.readFileSync(path.join(__dirname, '..', 'sql', 'sp', 'product_master.sql'), 'utf8');
  const start = raw.indexOf("IF OBJECT_ID('dbo.sp_ProductMaster_GetAll'");
  const end = raw.indexOf("IF OBJECT_ID('dbo.sp_ProductMaster_CheckRepeat'");
  if (start < 0 || end < 0) throw new Error('Could not locate sp_ProductMaster_GetAll block');
  const chunk = raw.slice(start, end).trim();
  const batches = chunk.split(/^\s*GO\s*$/gim).map((b) => b.trim()).filter(Boolean);
  const pool = await getPool();
  for (const b of batches) {
    await pool.request().batch(b);
  }
  console.log('Deployed sp_ProductMaster_GetAll (' + batches.length + ' batches).');
  process.exit(0);
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

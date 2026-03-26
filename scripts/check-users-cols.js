require('dotenv').config();
const { getPool } = require('../src/config/db');

getPool().then(async (pool) => {
  const r = await pool.request().query(`
    SELECT COLUMN_NAME, IS_NULLABLE, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'users'
    ORDER BY ORDINAL_POSITION
  `);
  console.log(JSON.stringify(r.recordset, null, 2));
  process.exit(0);
}).catch((e) => { console.error(e.message); process.exit(1); });

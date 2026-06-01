require('dotenv').config();
const { executeStoredProcedure } = require('../src/config/db');
const sql = require('mssql');

(async () => {
  const result = await executeStoredProcedure('sp_PurchaseHeader_GetById', {
    header_id: { type: sql.Int, value: 5 }
  });
  const colours = result.recordsets[2] || [];
  console.log(JSON.stringify(colours, null, 2));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });

/* eslint-disable no-console */
require('dotenv').config();
const { getPool } = require('../src/config/db');

(async () => {
  const pool = await getPool();
  const r = await pool.request().query(`
    SELECT m.definition
    FROM sys.sql_modules m
    JOIN sys.objects o ON m.object_id = o.object_id
    WHERE o.name = N'sp_SKUv2_Generate' AND SCHEMA_NAME(o.schema_id) = N'dbo'
  `);
  const def = r.recordset[0]?.definition || '';
  console.log('sp_SKUv2_Generate exists:', Boolean(def.length));
  console.log('Contains @model_part:', def.includes('@model_part'));
  console.log('Contains four-segment sku line:', def.includes("@model_part + '-' + @clr_part"));
  process.exit(0);
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

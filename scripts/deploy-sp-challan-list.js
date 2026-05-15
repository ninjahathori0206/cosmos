'use strict';
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const sql = require('mssql');

const config = {
  server: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: { encrypt: false, trustServerCertificate: true }
};

async function main() {
  const file = path.join(__dirname, '..', 'sql', 'sp', 'finance_challan_invoice.sql');
  const source = fs.readFileSync(file, 'utf8');
  const batches = source.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean);
  const target = batches.filter((b) => b.includes('sp_Challan_ListForValuation'));
  if (!target.length) {
    console.error('sp_Challan_ListForValuation not found');
    process.exit(1);
  }
  const pool = await sql.connect(config);
  for (const batch of target) {
    await pool.request().query(batch);
  }
  await pool.close();
  console.log('Deployed sp_Challan_ListForValuation');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

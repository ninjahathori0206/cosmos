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
  const rel = 'sql/sp/finance_challan_invoice.sql';
  const file = path.join(__dirname, '..', rel);
  const source = fs.readFileSync(file, 'utf8');
  const batches = source.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean);
  const listBatches = batches.filter((b) => b.includes('sp_SupplierInvoice_List'));
  if (!listBatches.length) {
    console.error('No sp_SupplierInvoice_List batches found');
    process.exit(1);
  }
  const pool = await sql.connect(config);
  for (const batch of listBatches) {
    await pool.request().query(batch);
  }
  await pool.close();
  console.log('Deployed sp_SupplierInvoice_List (' + listBatches.length + ' batch(es))');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

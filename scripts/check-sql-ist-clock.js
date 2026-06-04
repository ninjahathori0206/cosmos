require('dotenv').config();
process.env.TZ = 'Asia/Kolkata';

const { getCosmosTimeSnapshot } = require('../src/services/cosmosTimeHealthService');

async function main() {
  const snap = await getCosmosTimeSnapshot();
  console.log('=== Node (Asia/Kolkata) ===');
  console.log('UTC now (ISO):     ', snap.node_utc_iso);
  console.log('IST wallClockIso:  ', snap.node_ist_wire);

  console.log('\n=== SQL Server ===');
  console.log('IST wire (126):    ', snap.sql_ist_wire);
  console.log('UTC wire:          ', snap.sql_utc_wire);

  console.log('\n=== Skew analysis ===');
  console.log('Node ↔ SQL (minutes):', snap.skew_node_sql_minutes);
  console.log('Threshold (minutes):', snap.threshold_minutes);
  console.log('Healthy (server):   ', snap.healthy_server ? 'YES' : 'NO');
  if (snap.issues_server && snap.issues_server.length) {
    snap.issues_server.forEach(function (item) { console.log('  -', item); });
  }

  const { getPool } = require('../src/config/db');
  await getPool().close();
}

main().catch(function (e) {
  console.error(e.message || e);
  process.exit(1);
});

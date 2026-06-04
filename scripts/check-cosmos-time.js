#!/usr/bin/env node
/**
 * CLI — Cosmos time health (Node + SQL IST clocks and skew).
 * Usage: npm run check:cosmos-time
 */
process.env.TZ = 'Asia/Kolkata';
require('dotenv').config();

const { getCosmosTimeSnapshot } = require('../src/services/cosmosTimeHealthService');

async function main() {
  const snap = await getCosmosTimeSnapshot();
  console.log('[cosmos-time] Node IST:  ', snap.node_ist_wire);
  console.log('[cosmos-time] SQL IST:  ', snap.sql_ist_wire);
  console.log('[cosmos-time] Skew Node↔SQL (min):', snap.skew_node_sql_minutes);
  console.log('[cosmos-time] Threshold (min):', snap.threshold_minutes);
  console.log('[cosmos-time] Healthy (server):', snap.healthy_server ? 'YES' : 'NO');
  if (snap.issues_server && snap.issues_server.length) {
    snap.issues_server.forEach(function (item) { console.log('  -', item); });
  }
  process.exit(snap.healthy_server ? 0 : 2);
}

main().catch(function (err) {
  console.error('[cosmos-time]', err.message || err);
  process.exit(1);
});

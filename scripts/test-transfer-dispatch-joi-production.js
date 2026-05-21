/**
 * Verify production API accepts extra_lines[].unit_ids (not Joi "not allowed").
 */
require('dotenv').config();
const https = require('https');

const apiKey = process.env.API_KEY;
const base = 'https://cosmos.eyewoot.com';
if (!apiKey) {
  console.error('Missing API_KEY in .env');
  process.exit(1);
}

const url = new URL(base + '/api/transfer-requests/1/status');
const body = JSON.stringify({
  status: 'DISPATCHED',
  extra_lines: [{ sku_id: 1, qty: 1, unit_ids: [12345] }]
});

const req = https.request(
  {
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'X-API-Key': apiKey,
      Authorization: 'Bearer invalid-token-for-joi-only'
    }
  },
  (res) => {
    let data = '';
    res.on('data', (c) => { data += c; });
    res.on('end', () => {
      let msg = data;
      try {
        msg = JSON.parse(data).message || data;
      } catch (_) { /* raw */ }
      if (String(msg).includes('unit_ids') && String(msg).includes('not allowed')) {
        console.error('FAIL: Production still rejects extra_lines[].unit_ids:', msg);
        process.exit(1);
      }
      console.log('OK: Production API (HTTP', res.statusCode + '):', msg);
    });
  }
);
req.on('error', (e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
req.write(body);
req.end();

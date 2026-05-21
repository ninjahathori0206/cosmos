/**
 * POST-like validation smoke test against running API (Joi runs before DB).
 * Usage: node scripts/test-transfer-dispatch-joi-http.js
 */
require('dotenv').config();
const http = require('http');

const port = Number(process.env.PORT || 4000);
const apiKey = process.env.API_KEY;
if (!apiKey) {
  console.error('Missing API_KEY in .env');
  process.exit(1);
}

const body = JSON.stringify({
  status: 'DISPATCHED',
  extra_lines: [{ sku_id: 1, qty: 1, unit_ids: [12345] }]
});

const req = http.request(
  {
    hostname: '127.0.0.1',
    port,
    path: '/api/transfer-requests/1/status',
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
        console.error('FAIL: API still rejects extra_lines[].unit_ids:', msg);
        process.exit(1);
      }
      console.log('OK: API did not return Joi "unit_ids is not allowed" (HTTP', res.statusCode + '):', msg);
    });
  }
);
req.on('error', (e) => {
  console.error('FAIL: could not reach API on port', port, e.message);
  process.exit(1);
});
req.write(body);
req.end();

const fs = require('fs');
const p = 'e:/Curser/cosmos/src/public/js/foundry-prototype.js';
let s = fs.readFileSync(p, 'utf8');
const marker = '  // Build list of {code (pid for QR), label (sku_code for text), copies} — full batch, no modal selection';
const i = s.indexOf(marker);
if (i < 0) { console.error('marker not found'); process.exit(1); }
const insert = fs.readFileSync('e:/Curser/cosmos/scripts/_patch_bc_restore_core.txt', 'utf8');
s = s.slice(0, i) + insert + s.slice(i);
fs.writeFileSync(p, s);
console.log('restored barcode core');

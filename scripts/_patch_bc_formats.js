const fs = require('fs');
const p = 'e:/Curser/cosmos/src/public/js/foundry-prototype.js';
let s = fs.readFileSync(p, 'utf8');

const oldStart = '  /** Full modal layout (margins, gaps, label grid, QR/TSPL fields, USB mm offset) */';
const oldEnd = '  // Build list of {code (pid for QR), label (sku_code for text), copies} — full batch, no modal selection';

const i0 = s.indexOf(oldStart);
const i1 = s.indexOf(oldEnd);
if (i0 < 0 || i1 < 0 || i1 <= i0) {
  console.error('markers not found', i0, i1);
  process.exit(1);
}

const insert = fs.readFileSync('e:/Curser/cosmos/scripts/_patch_bc_formats_insert.txt', 'utf8');
s = s.slice(0, i0) + insert + s.slice(i1);
fs.writeFileSync(p, s);
console.log('inserted format helpers');

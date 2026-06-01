const fs = require('fs');
const p = 'e:/Curser/cosmos/Foundry_Prototype.html';
let s = fs.readFileSync(p, 'utf8');
const start = s.indexOf('<motion class="section-lbl mb2">Saved configuration');
const altStart = s.indexOf('<motion class="section-lbl mb2">Saved configuration');
const realStart = s.indexOf('Saved configuration (this browser)');
if (realStart < 0) {
  console.log('already removed');
  process.exit(0);
}
const blockStart = s.lastIndexOf('<motion class="mt3"', realStart);
const blockStart2 = s.lastIndexOf('<div class="mt3"', realStart);
const i0 = Math.max(blockStart, blockStart2);
const i1 = s.indexOf('USB printer calibration', i0);
const i2 = s.lastIndexOf('<motion class="mt3"', i1);
const i2b = s.lastIndexOf('<div class="mt3"', i1);
const iBeforeUsb = Math.max(i2, i2b);
if (i0 < 0 || iBeforeUsb <= i0) {
  console.error('could not find block', i0, iBeforeUsb);
  process.exit(1);
}
s = s.slice(0, i0) + s.slice(iBeforeUsb);
fs.writeFileSync(p, s);
console.log('removed saved config block');

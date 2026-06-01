const fs = require('fs');
const p = 'e:/Curser/cosmos/Foundry_Prototype.html';
let s = fs.readFileSync(p, 'utf8');

const marker = '  <!-- ═══ LAB ORDERS ═══ -->';
const first = s.indexOf(marker);
const second = s.indexOf(marker, first + marker.length);
if (second === -1) {
  console.log('Only one lab orders block — OK');
} else {
  const scriptStart = s.indexOf('\n<script>', second);
  if (scriptStart === -1) throw new Error('script tag not found after duplicate');
  s = s.slice(0, second) + '\n' + s.slice(scriptStart);
  console.log('Removed duplicate lab orders block at', second);
}

s = s.replace(/<\/motion>/g, '</motion>').replace(/<motion /g, '<div ');

fs.writeFileSync(p, s);
const count = (s.match(/id="page-lab-orders"/g) || []).length;
console.log('page-lab-orders count:', count);

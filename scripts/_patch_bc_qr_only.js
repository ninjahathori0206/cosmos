const fs = require('fs');
const p = 'e:/Curser/cosmos/src/public/js/foundry-prototype.js';
let s = fs.readFileSync(p, 'utf8');

s = s.replace(
  /        if \(type === 'QR'\) \{\r?\n          inner \+= `<div class="bc-label-cell"/,
  '        inner += `<motion class="bc-label-cell"'
);
s = s.replace(
  /          <\/motion>`;\r?\n        \} else \{[\s\S]*?          <\/div>`;\r?\n        \}\r?\n      \}/,
  '          </div>`;\n      }'
);
s = s.replace(
  /        inner \+= `<motion class="bc-label-cell"/g,
  '        inner += `<div class="bc-label-cell"'
);

s = s.replace(
  /    if \(type === 'QR'\) \{\r?\n      _bcFillQrPlaceholders\(previewEl\);\r?\n    \}\r?\n\r?\n    \/\/ Render Code128 barcodes after DOM is updated\r?\n    if \(type === 'CODE128'[\s\S]*?      \}\);\r?\n    \}\r?\n\r?\n/,
  '    _bcFillQrPlaceholders(previewEl);\n\n'
);

s = s.replace(
  /const type\s*=\s*document\.getElementById\('bc-type'\)\?\.value \|\| 'QR';/g,
  "const type = 'QR';"
);

s = s.replace(
  /        if \(type === 'QR'\) \{\r?\n          inner \+= `<div class="bc-label-cell"/,
  '        inner += `<div class="bc-label-cell"'
);

fs.writeFileSync(p, s);
console.log('patched', s.includes('bc-type'), s.includes('CODE128'));

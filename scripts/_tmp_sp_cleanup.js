const fs = require('fs');
const path = 'e:/Curser/cosmos/src/public/js/storepilot-prototype.js';
let s = fs.readFileSync(path, 'utf8');
s = s.replace(
  /\nwindow\.setIncFilter = function \(status\) \{[\s\S]*?\n\};\n\nwindow\.loadIncomingTransfers = async function \(\) \{[\s\S]*?\n\};\n/,
  '\n'
);
s = s.replace(
  /\n\/\/ Incoming Transfers badge on startup[\s\S]*?window\.expandSpMlDoc = async function \(docId\) \{[\s\S]*?\n\};\n/,
  '\n'
);
s = s.replace(/loadIncomingTransfers\(\)/g, 'spRefreshAfterIncomingAction()');
fs.writeFileSync(path, s);
console.log('done');

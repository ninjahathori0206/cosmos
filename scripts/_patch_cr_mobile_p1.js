'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function write(rel, content) { fs.writeFileSync(path.join(root, rel), content, 'utf8'); console.log('wrote', rel); }

(function patchPolishJs() {
  const rel = 'src/public/js/cosmos-ui-polish.js';
  let s = read(rel);
  if (s.includes('cosmosSheetBackdropClick')) { console.log('skip polish js'); return; }
  const needle = '    }, 2000)\n  }\n})()';
  const insert = `    }, 2000)
  }

  window.cosmosSheetBackdropClick = function (e, closeFn, opts) {
    if (!e || e.target !== e.currentTarget) return
    opts = opts || {}
    try {
      if (window.matchMedia('(max-width: 768px)').matches) return
    } catch (_) {}
    var guard = opts.dismissGuardUntil
    if (typeof guard === 'number' && Date.now() < guard) return
    if (typeof closeFn === 'function') closeFn()
  }
})()`;
  const idx = s.lastIndexOf(needle); if (idx < 0) throw new Error('polish end missing');
  write(rel, s.slice(0, idx) + insert + (s.endsWith('\n') ? '\n' : ''));
})();

console.log('patch1 ok');


'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function write(rel, content) { fs.writeFileSync(path.join(root, rel), content, 'utf8'); console.log('wrote', rel); }

let s = read('src/public/js/foundry-prototype.js');
if (!s.includes('ftrCreateTransferBackdropClick')) {
  s = s.replace(
    '  window.openFtrCreateTransferModal = async function () {',
    '  let _ftrCtDismissGuardUntil = 0;\n\n  window.ftrCreateTransferBackdropClick = function (e) {\n    window.cosmosSheetBackdropClick(e, window.closeFtrCreateTransferModal, {\n      dismissGuardUntil: _ftrCtDismissGuardUntil\n    });\n  };\n\n  window.openFtrCreateTransferModal = async function () {'
  );
}
const focusOld = '    await ftrCtLoadStores();\n    setTimeout(function () { if (search) search.focus(); }, 120);';
const focusNew = [
  '    await ftrCtLoadStores();',
  '    if (search && !search._ftrBackdropGuard) {',
  '      search._ftrBackdropGuard = true;',
  '      search.addEventListener(\'blur\', function () {',
  '        _ftrCtDismissGuardUntil = Date.now() + 400;',
  '      });',
  '    }',
  '    if (!window.matchMedia(\'(max-width: 768px)\').matches) {',
  '      setTimeout(function () { if (search) search.focus(); }, 120);',
  '    }'
].join('\n');
if (s.includes(focusOld)) s = s.replace(focusOld, focusNew);
write('src/public/js/foundry-prototype.js', s);

let sp = read('StorePilot_Prototype.html');
sp = sp.replace('onclick="if(event.target===this) closeSpCreateRequestModal()"', 'onclick="spCreateRequestBackdropClick(event)"');
if (!sp.includes('sp-create-request-store-line')) {
  sp = sp.replace(
    '<div class="sp-create-request-head-row">\n          <div class="modal-title" id="sp-create-request-title">Create goods request</div>',
    '<div class="sp-create-request-head-row">\n          <div class="sp-create-request-head-copy">\n            <div class="modal-title" id="sp-create-request-title">Create goods request</div>\n            <p class="sp-create-request-store-line" id="sp-create-request-store-line" hidden></p>\n          </div>'
  );
}
sp = sp.replace('<div class="ch"><div class="ct">Destination &amp; notes</div></div>', '<div class="ch"><div class="ct" id="sp-create-request-meta-title">Destination &amp; notes</div></div>');
sp = sp.replace('<div class="sp-create-request-field">\n                    <label class="sp-create-request-label" for="tc-dest-store">', '<div class="sp-create-request-field sp-create-request-dest-field">\n                    <label class="sp-create-request-label" for="tc-dest-store">');
sp = sp.replace(/cosmos-ui-polish\.css\?v=[^"]+/g, 'cosmos-ui-polish.css?v=20260528-cr-mobile');
sp = sp.replace(/cosmos-ui-polish\.js\?v=[^"]+/g, 'cosmos-ui-polish.js?v=20260528-cr-mobile');
sp = sp.replace(/storepilot-prototype\.js\?v=[^"]+/g, 'storepilot-prototype.js?v=20260528-cr-mobile');
write('StorePilot_Prototype.html', sp);

let ftr = read('Foundry_Prototype.html');
ftr = ftr.replace('onclick="if(event.target===this) closeFtrCreateTransferModal()"', 'onclick="ftrCreateTransferBackdropClick(event)"');
ftr = ftr.replace(/cosmos-ui-polish\.js\?v=[^"]+/g, 'cosmos-ui-polish.js?v=20260528-cr-mobile');
write('Foundry_Prototype.html', ftr);

let doc = read('docs/ui/cosmos-record-list-module.md');
const add = '- **Mobile (≤768px):** backdrop tap does not close sheet; only SKU results scroll; **Request cart + Notes** pinned below search; fixed destination as header subtitle (field hidden); cart strip always visible (**Cart & notes ↓**).';
if (!doc.includes('Cart & notes')) {
  doc = doc.replace(
    '- **Mobile:** 96dvh bottom sheet, grabber, sticky HQ search, cart strip (`#sp-create-request-cart-strip`), 48px CTAs, safe-area footer; body scroll locked while open.',
    '- **Mobile:** 96dvh bottom sheet, grabber, safe-area footer; body scroll locked while open.\n' + add
  );
  write('docs/ui/cosmos-record-list-module.md', doc);
}

console.log('html+foundry+docs done');
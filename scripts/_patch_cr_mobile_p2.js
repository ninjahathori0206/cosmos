'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function write(rel, content) { fs.writeFileSync(path.join(root, rel), content, 'utf8'); console.log('wrote', rel); }

let s = read('src/public/js/storepilot-prototype.js');

if (!s.includes('_spCreateRequestDismissGuardUntil')) {
  s = s.replace(
    'function spIsCreateRequestMobile() {',
    'let _spCreateRequestDismissGuardUntil = 0;\n\nfunction spIsCreateRequestMobile() {'
  );
}

const oldStrip = [
  'window.spSyncCreateRequestCartStrip = function () {',
  '  const strip = document.getElementById(\'sp-create-request-cart-strip\');',
  '  const label = document.getElementById(\'sp-create-request-cart-strip-label\');',
  '  if (!strip) return;',
  '  const n = _transferCart.length;',
  '  if (!n) {',
  '    strip.hidden = true;',
  '    return;',
  '  }',
  '  strip.hidden = false;',
  '  if (label) {',
  '    label.textContent = n + \' item\' + (n !== 1 ? \'s\' : \'\') + \' in cart\';',
  '  }',
  '};'
].join('\n');

if (!s.includes('spCreateRequestBackdropClick') && s.includes(oldStrip)) {
  const newStrip = [
    'window.spSyncCreateRequestCartStrip = function () {',
    '  const strip = document.getElementById(\'sp-create-request-cart-strip\');',
    '  const label = document.getElementById(\'sp-create-request-cart-strip-label\');',
    '  const cta = strip && strip.querySelector(\'.sp-create-request-cart-strip__cta\');',
    '  if (!strip) return;',
    '  const overlay = document.getElementById(\'overlay-sp-create-request\');',
    '  const sheetOpen = overlay && overlay.classList.contains(\'open\');',
    '  const mobile = spIsCreateRequestMobile();',
    '  const n = _transferCart.length;',
    '  if (!mobile || !sheetOpen) {',
    '    if (!n) { strip.hidden = true; return; }',
    '    strip.hidden = false;',
    '    if (label) label.textContent = n + \' item\' + (n !== 1 ? \'s\' : \'\') + \' in cart\';',
    '    if (cta) cta.hidden = false;',
    '    return;',
    '  }',
    '  strip.hidden = false;',
    '  if (label) {',
    '    label.textContent = n ? (n + \' item\' + (n !== 1 ? \'s\' : \'\') + \' · Review ↓\') : \'Cart & notes ↓\';',
    '  }',
    '  if (cta) cta.hidden = true;',
    '};',
    '',
    'window.spCreateRequestBackdropClick = function (e) {',
    '  window.cosmosSheetBackdropClick(e, window.closeSpCreateRequestModal, {',
    '    dismissGuardUntil: _spCreateRequestDismissGuardUntil',
    '  });',
    '};',
    '',
    'function spBindCreateRequestSearchGuard() {',
    '  const search = document.getElementById(\'tc-search\');',
    '  if (!search || search._spBackdropGuard) return;',
    '  search._spBackdropGuard = true;',
    '  search.addEventListener(\'blur\', function () {',
    '    _spCreateRequestDismissGuardUntil = Date.now() + 400;',
    '  });',
    '}',
    '',
    'function spSyncCreateRequestStoreLine() {',
    '  const line = document.getElementById(\'sp-create-request-store-line\');',
    '  if (!line) return;',
    '  if (!spIsCreateRequestMobile()) { line.hidden = true; line.textContent = \'\'; return; }',
    '  const name = _storeName || (_storeId ? \'Store #\' + _storeId : \'\');',
    '  if (!name) { line.hidden = true; return; }',
    '  line.hidden = false;',
    '  line.textContent = \'Requesting for: \' + name;',
    '}',
    '',
    'function spSyncCreateRequestMetaTitle() {',
    '  const title = document.getElementById(\'sp-create-request-meta-title\');',
    '  if (!title) return;',
    '  title.textContent = spIsCreateRequestMobile() ? \'Notes (optional)\' : \'Destination & notes\';',
    '}'
  ].join('\n');
  s = s.replace(oldStrip, newStrip);
}

s = s.replace(
  '  initTransferCreate();\n  spSyncCreateRequestCartStrip();',
  '  initTransferCreate();\n  spBindCreateRequestSearchGuard();\n  spSyncCreateRequestStoreLine();\n  spSyncCreateRequestMetaTitle();\n  spSyncCreateRequestCartStrip();'
);

s = s.replace(
  'window.closeSpCreateRequestModal = function () {\n  const overlay = document.getElementById(\'overlay-sp-create-request\');\n  if (overlay) {',
  'window.closeSpCreateRequestModal = function () {\n  const overlay = document.getElementById(\'overlay-sp-create-request\');\n  const strip = document.getElementById(\'sp-create-request-cart-strip\');\n  if (strip) strip.hidden = true;\n  if (overlay) {'
);

const finOld = '    if (seq === _tcSearchSeq && spin) spin.style.display = \'none\';\n  }\n}\n\nwindow.addToCartFromBtn';
const finNew = '    if (seq === _tcSearchSeq && spin) spin.style.display = \'none\';\n    if (typeof window.spSyncCreateRequestCartStrip === \'function\') window.spSyncCreateRequestCartStrip();\n  }\n}\n\nwindow.addToCartFromBtn';
if (s.includes(finOld) && !s.includes('spSyncCreateRequestCartStrip();\n  }\n}\n\nwindow.addToCartFromBtn')) {
  s = s.replace(finOld, finNew);
}

write('src/public/js/storepilot-prototype.js', s);
console.log('storepilot done');
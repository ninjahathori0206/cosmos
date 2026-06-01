'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const nl = '\r\n';
let s = fs.readFileSync(path.join(root, 'src/public/js/storepilot-prototype.js'), 'utf8');

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
].join(nl);

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
].join(nl);

if (s.includes(oldStrip) && !s.includes('spCreateRequestBackdropClick')) {
  s = s.replace(oldStrip, newStrip);
  console.log('strip replaced');
} else if (s.includes('spCreateRequestBackdropClick')) {
  console.log('strip already new');
} else {
  console.log('strip replace FAILED');
}

const openOld = '  initTransferCreate();' + nl + '  spSyncCreateRequestCartStrip();';
const openNew = '  initTransferCreate();' + nl + '  spBindCreateRequestSearchGuard();' + nl + '  spSyncCreateRequestStoreLine();' + nl + '  spSyncCreateRequestMetaTitle();' + nl + '  spSyncCreateRequestCartStrip();';
if (s.includes(openOld) && !s.includes('spBindCreateRequestSearchGuard')) s = s.replace(openOld, openNew);

const closeOld = 'window.closeSpCreateRequestModal = function () {' + nl + '  const overlay = document.getElementById(\'overlay-sp-create-request\');' + nl + '  if (overlay) {';
const closeNew = 'window.closeSpCreateRequestModal = function () {' + nl + '  const overlay = document.getElementById(\'overlay-sp-create-request\');' + nl + '  const strip = document.getElementById(\'sp-create-request-cart-strip\');' + nl + '  if (strip) strip.hidden = true;' + nl + '  if (overlay) {';
if (s.includes(closeOld) && !s.includes('if (strip) strip.hidden = true')) s = s.replace(closeOld, closeNew);

const finOld = '    if (seq === _tcSearchSeq && spin) spin.style.display = \'none\';' + nl + '  }' + nl + '}' + nl + nl + 'window.addToCartFromBtn';
const finNew = '    if (seq === _tcSearchSeq && spin) spin.style.display = \'none\';' + nl + '    if (typeof window.spSyncCreateRequestCartStrip === \'function\') window.spSyncCreateRequestCartStrip();' + nl + '  }' + nl + '}' + nl + nl + 'window.addToCartFromBtn';
if (s.includes(finOld)) s = s.replace(finOld, finNew);

fs.writeFileSync(path.join(root, 'src/public/js/storepilot-prototype.js'), s);
console.log('ok', s.includes('spCreateRequestBackdropClick'));
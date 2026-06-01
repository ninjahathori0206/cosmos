'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const rel = 'src/public/css/cosmos-ui-polish.css';
let s = fs.readFileSync(path.join(root, rel), 'utf8');

if (!s.includes('sp-create-request-head-copy')) {
  const headCss = '\n.modal.modal--create-request .sp-create-request-head-copy {\n  flex: 1;\n  min-width: 0;\n}\n\n.sp-create-request-store-line {\n  display: none;\n  margin: 4px 0 0;\n  font-size: 13px;\n  font-weight: 500;\n  color: var(--text2, #64748b);\n  line-height: 1.35;\n}\n\n';
  s = s.replace('.modal.modal--create-request .sp-create-request-close {', headCss + '.modal.modal--create-request .sp-create-request-close {');
}

const marker = '  .overlay.open .modal.modal--create-request .sp-create-request-clear-btn {';
const idx = s.indexOf(marker);
if (idx < 0) throw new Error('marker missing');
const closeIdx = s.indexOf('\n}', idx);
if (closeIdx < 0) throw new Error('close brace missing');

const insert = [
  '  .overlay.open .modal.modal--create-request .sp-create-request-clear-btn {',
  '    background: transparent;',
  '    border-color: transparent;',
  '    color: var(--text2, #64748b);',
  '    min-height: 40px;',
  '  }',
  '',
  '  .modal.modal--create-request .sp-create-request-store-line {',
  '    display: block;',
  '  }',
  '',
  '  #overlay-sp-create-request .sp-create-request-dest-field {',
  '    display: none;',
  '  }',
  '',
  '  .modal.modal--create-request .sp-create-request-body {',
  '    overflow: hidden;',
  '    display: flex;',
  '    flex-direction: column;',
  '    padding: 0;',
  '  }',
  '',
  '  #overlay-sp-create-request #transfer-create-form,',
  '  #overlay-ftr-create-transfer .sp-create-request-body > .two-col {',
  '    flex: 1 1 auto;',
  '    min-height: 0;',
  '    display: flex;',
  '    flex-direction: column;',
  '  }',
  '',
  '  .modal.modal--create-request .sp-create-request-layout.two-col {',
  '    display: flex;',
  '    flex-direction: column;',
  '    flex: 1 1 auto;',
  '    min-height: 0;',
  '    gap: 0;',
  '  }',
  '',
  '  .modal.modal--create-request .sp-create-request-search-wrap {',
  '    position: static;',
  '    flex: 1 1 auto;',
  '    min-height: 0;',
  '    display: flex;',
  '    flex-direction: column;',
  '    padding: 12px 16px 0;',
  '  }',
  '',
  '  .modal.modal--create-request .sp-create-request-search-card {',
  '    flex: 1 1 auto;',
  '    min-height: 0;',
  '    display: flex;',
  '    flex-direction: column;',
  '    margin: 0;',
  '  }',
  '',
  '  .modal.modal--create-request .sp-create-request-search-card .ch {',
  '    flex-shrink: 0;',
  '  }',
  '',
  '  .modal.modal--create-request .sp-create-request-results {',
  '    flex: 1 1 auto;',
  '    min-height: 0;',
  '    overflow-y: auto;',
  '    overscroll-behavior: contain;',
  '    -webkit-overflow-scrolling: touch;',
  '  }',
  '',
  '  .modal.modal--create-request .sp-create-request-cart-col {',
  '    flex-shrink: 0;',
  '    max-height: min(42dvh, calc(var(--cosmos-vvh, 100dvh) * 0.4));',
  '    overflow-y: auto;',
  '    overscroll-behavior: contain;',
  '    -webkit-overflow-scrolling: touch;',
  '    border-top: 1px solid var(--border, #e2e8f0);',
  '    box-shadow: 0 -8px 20px rgba(15, 30, 53, 0.06);',
  '    background: var(--card, #fff);',
  '  }',
  '}'
].join('\n');

if (!s.includes('#overlay-sp-create-request .sp-create-request-dest-field')) {
  s = s.slice(0, idx) + insert + s.slice(closeIdx + 2);
}

fs.writeFileSync(path.join(root, rel), s, 'utf8');
console.log('css patched', s.includes('sp-create-request-dest-field'));
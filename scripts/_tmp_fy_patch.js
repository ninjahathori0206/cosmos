const fs = require('fs');
const path = 'e:/Curser/cosmos/src/public/js/foundry-prototype.js';
let s = fs.readFileSync(path, 'utf8');

s = s.replace(
  "function getFoundryPageFromPath(pathname) {\n    const normalized = String(pathname || '').replace(/\\/+$/, '') || '/foundry';",
  "function getFoundryPageFromPath(pathname) {\n    const normalized = String(pathname || '').replace(/\\/+$/, '') || '/foundry';\n    if (normalized === '/foundry/movement-list') return 'transfer-requests';"
);

s = s.replace(
  "    if (id === 'movement-list' && typeof window.loadMovementList === 'function') window.loadMovementList();\n",
  ''
);

s = s.replace(
  `    window.stOpenDispatchDoc = function stOpenDispatchDoc(docId) {
      const navEl = document.querySelector('.sidebar-nav .nav-item[onclick*="movement-list"]');
      if (typeof nav === 'function') nav('movement-list', navEl || null);
      setTimeout(function () {
        if (typeof expandMlDoc === 'function') expandMlDoc(docId);
      }, 80);
    };`,
  `    window.stOpenDispatchDoc = function stOpenDispatchDoc(docId) {
      if (typeof expandMlDoc === 'function') expandMlDoc(docId);
    };`
);

s = s.replace(
  `  window.ftrAfterDispatchNav = function () {
    const navEl = document.querySelector('.sidebar-nav .nav-item[onclick*="movement-list"]');
    if (typeof nav === 'function') nav('movement-list', navEl || null);
    if (typeof window.loadMovementList === 'function') window.loadMovementList();
    closeTrDetail();
  };`,
  `  window.ftrAfterDispatchNav = function () {
    const navEl = getFoundryNavEl('transfer-requests');
    if (typeof nav === 'function') nav('transfer-requests', navEl || null);
    if (typeof window.loadTransferRequests === 'function') window.loadTransferRequests();
    closeTrDetail();
  };`
);

s = s.replace(
  /\n  let _mlFilter = ''[\s\S]*?window\.loadMovementList = async function \(\) \{[\s\S]*?\n  \};\n\n  window\.expandMlDoc/,
  '\n  window.expandMlDoc'
);

fs.writeFileSync(path, s);
console.log('foundry patched');

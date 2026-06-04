/**
 * Restore UTF-8 emojis/symbols in Foundry_Prototype.html from git HEAD,
 * while preserving local-only changes (e.g. Unit Search page).
 */
const cp = require('child_process');
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'Foundry_Prototype.html');
const git = cp.execSync('git show HEAD:Foundry_Prototype.html').toString('utf8');
let cur = fs.readFileSync(file, 'utf8');

// Pair removed (good) vs added (bad) lines from git diff — emoji/symbol fixes only.
const replacements = [
  ['Foundry ? Cosmos ERP', 'Foundry — Cosmos ERP'],
  ['<span class="ic">?</span> Dashboard', '<span class="ic">⊞</span> Dashboard'],
  ['<span class="ic">??</span> Purchases', '<span class="ic">📋</span> Purchases'],
  ['<span class="ic">+</span> New Purchase', '<span class="ic">＋</span> New Purchase'],
  ['<span class="ic">??</span> Bill Verification', '<span class="ic">🧾</span> Bill Verification'],
  ['<span class="ic">???</span> Branding', '<span class="ic">🏷️</span> Branding'],
  ['<span class="ic">??</span> Digitisation', '<span class="ic">📸</span> Digitisation'],
  ['<span class="ic">???</span> SKU Catalogue', '<span class="ic">🗂️</span> SKU Catalogue'],
  ['<span class="ic">??</span> Stock View', '<span class="ic">📦</span> Stock View'],
  ['<span class="ic">??</span> Unit Search', '<span class="ic">🔍</span> Unit Search'],
  ['<span class="ic">???</span> Lens packages', '<span class="ic">👁️</span> Lens packages'],
  ['<span class="ic">?</span> Lens add-ons', '<span class="ic">➕</span> Lens add-ons'],
  ['<span class="ic">?</span> Lens link matrix', '<span class="ic">▦</span> Lens link matrix'],
  ['<span class="ic">?</span> Lens wizard rules', '<span class="ic">⚙</span> Lens wizard rules'],
  ['<span class="ic">??</span> Master Catalogue', '<span class="ic">📖</span> Master Catalogue'],
  ['<span class="ic">??</span> Goods Request', '<span class="ic">📬</span> Goods Request'],
  ['<span class="ic">??</span> Goods Transfer', '<span class="ic">🚚</span> Goods Transfer'],
  ['<span class="ic">??</span> Rate Intelligence', '<span class="ic">💰</span> Rate Intelligence'],
  ['<span class="ic">??</span> Lab Orders', '<span class="ic">🔬</span> Lab Orders'],
  ['<!-- ??? UNIT SEARCH ??? -->', '<!-- ═══ UNIT SEARCH ═══ -->'],
  ['<span class="si">??</span>\r\n            <input id="ut-search-q"', '<span class="si">🔍</span>\r\n            <input id="ut-search-q"'],
  ['<span class="si">??</span>\n            <input id="ut-search-q"', '<span class="si">🔍</span>\n            <input id="ut-search-q"'],
  ['<div class="empty-ic">??</div>\r\n      <div style="font-size:15px;font-weight:600;color:var(--text1);margin-bottom:6px">Trace a unit by code', '<div class="empty-ic">🔍</div>\r\n      <div style="font-size:15px;font-weight:600;color:var(--text1);margin-bottom:6px">Trace a unit by code'],
  ['<div class="empty-ic">??</div>\n      <div style="font-size:15px;font-weight:600;color:var(--text1);margin-bottom:6px">Trace a unit by code', '<div class="empty-ic">🔍</div>\n      <div style="font-size:15px;font-weight:600;color:var(--text1);margin-bottom:6px">Trace a unit by code'],
];

// Bulk replacements from git diff for inline emojis / rupee / arrows
const bulkFromGit = [
  ['?? Purchase Reg.', '📝 Purchase Reg.'],
  ['?? Bill Verify', '🧾 Bill Verify'],
  ['??? Branding', '🏷️ Branding'],
  ['?? Digitisation', '📸 Digitisation'],
  ['?? Warehouse', '📦 Warehouse'],
  ['?? Search existing', '🔍 Search existing'],
  ['?? Print Summary', '🖨 Print Summary'],
  ['? Complete', '✓ Complete'],
  ['??50', '₹50'],
  ['?? Print Dispatch Order', '🖨 Print Dispatch Order'],
  ['?? Create Transfer Order', '🚚 Create Transfer Order'],
  ['?? Open scan bucket', '📦 Open scan bucket'],
  ['?? Dispatch to Store', '🚚 Dispatch to Store'],
  ['??? Print last slip', '🖨 Print last slip'],
  ['1 ??? Blue (default)', '1 — Blue (default)'],
  ['2 ??? Teal', '2 — Teal'],
  ['3 ??? Amber', '3 — Amber'],
  ['4 ??? Purple', '4 — Purple'],
  ['5 ??? Orange', '5 — Orange'],
  ['placeholder="e.g. ??"', 'placeholder="e.g. 👓"'],
  ['?160', '₹160'],
  ['?240', '₹240'],
  ['?185', '₹185'],
  ['?${diff.toFixed(0)}', '₹${diff.toFixed(0)}'],
  ['Foundry ? unit-search', 'Foundry › unit-search'],
  ['Search product ? EW Collection', 'Search product — EW Collection'],
  ['ABC Optics ? 14 Mar', 'ABC Optics · 14 Mar'],
  ['Optics World ? 02 Jan', 'Optics World · 02 Jan'],
  ['ABC Optics ? 08 Jan', 'ABC Optics · 08 Jan'],
  ['<span>??</span>', '<span>ℹ️</span>'],
  ['<span>?</span>', '<span>✓</span>'],
  ['<span>??</span><div><strong>DISCREPANCY</strong> ? Difference:', '<span>⚠️</span><div><strong>DISCREPANCY</strong> — Difference:'],
  ['<strong>MATCHED</strong> ? Difference:', '<strong>MATCHED</strong> — Difference:'],
  ['auto-approved ? Beyond', 'auto-approved · Beyond'],
];

let count = 0;
for (const [bad, good] of [...replacements, ...bulkFromGit]) {
  if (cur.includes(bad)) {
    cur = cur.split(bad).join(good);
    count++;
  }
}

// Restore section comment banners from git where we only have --- 
const gitLines = git.split(/\r?\n/);
const sectionMap = {};
gitLines.forEach((line) => {
  const m = line.match(/<!-- (.+) --- -->/);
  if (m && m[1].includes('═')) sectionMap[m[1].replace(/═/g, '').trim()] = m[1];
});
cur = cur.replace(/<!-- --- ([A-Z /]+) --- -->/g, (full, name) => {
  const key = name.trim();
  if (sectionMap[key]) return `<!-- ${sectionMap[key]} -->`;
  return full;
});

// Restore BOM + LF like git (optional — skip BOM to avoid editor fights)
fs.writeFileSync(file, cur, 'utf8');

const remaining = (cur.match(/class="ic">\?+/g) || []).length;
console.log('Applied', count, 'emoji replacement groups');
console.log('Remaining corrupted nav ic lines:', remaining);
if (remaining > 0) {
  console.warn('Some icons may still need manual fix — check Foundry_Prototype.html');
  process.exitCode = 1;
}

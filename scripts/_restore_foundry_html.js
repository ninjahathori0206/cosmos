/**
 * Restore Foundry_Prototype.html UTF-8 from git HEAD + merge local Unit Search page.
 */
const cp = require('child_process');
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'Foundry_Prototype.html');
const cur = fs.readFileSync(file, 'utf8');
const git = cp.execSync('git show HEAD:Foundry_Prototype.html').toString('utf8');

// Preserve local Unit Search nav + page if present in working copy.
const navUnit = cur.match(/^\s*<div class="nav-item"[^>]*unit-search[^>]*>[\s\S]*?<\/div>/m);
const pageUnit = cur.match(/<!-- [^>]*UNIT SEARCH[^>]* -->[\s\S]*?<div class="page" id="page-unit-search">[\s\S]*?<\/div>\s*\r?\n\s*<!--/m);

let out = git;

if (navUnit) {
  const stockNav = '<div class="nav-item" data-foundry-permission="foundry.stock.view" data-foundry-page="stock-view" onclick="nav(\'stock-view\',this)"><span class="ic">📦</span> Stock View</div>';
  if (!out.includes('unit-search')) {
    out = out.replace(
      stockNav,
      stockNav + '\n    ' + navUnit[0].trim().replace(/\?+/g, (m) => (m.length >= 2 ? '🔍' : '🔍'))
    );
  }
}

if (pageUnit) {
  let block = pageUnit[0].replace(/\r?\n\s*<!--\s*$/, '');
  block = block
    .replace(/<!-- \?+ UNIT SEARCH \?+ -->/, '<!-- ═══ UNIT SEARCH ═══ -->')
    .replace(/<span class="si">\?+<\/span>/g, '<span class="si">🔍</span>')
    .replace(/<div class="empty-ic">\?+<\/div>\s*\r?\n\s*<div style="font-size:15px;font-weight:600[^"]*"[^>]*>Trace a unit by code/, '<div class="empty-ic">🔍</div>\n      <div style="font-size:15px;font-weight:600;color:var(--text1);margin-bottom:6px">Trace a unit by code');

  const anchor = '<!-- ═══ STOCK TRANSFER ═══ -->';
  if (!out.includes('page-unit-search') && out.includes(anchor)) {
    out = out.replace(anchor, block + '\n\n  ' + anchor);
  }
}

// Keep local polish script cache-bust if user bumped it.
const wire = cur.match(/cosmos-ui-polish\.js\?v=([^"]+)/);
if (wire) {
  out = out.replace(/cosmos-ui-polish\.js\?v=[^"]+/, wire[0]);
}

fs.writeFileSync(file, out, 'utf8');

const badNav = (out.match(/class="ic">\?+/g) || []).length;
console.log('Restored from git. Corrupted nav icons remaining:', badNav);
if (badNav) process.exitCode = 1;

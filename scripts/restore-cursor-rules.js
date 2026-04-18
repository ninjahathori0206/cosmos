/**
 * Restores .cursor/rules/*.mdc from the current HEAD (or writes known content).
 * Run when Cursor is closed if Windows reports "Access is denied" on .cursor/rules.
 *
 *   node scripts/restore-cursor-rules.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const rulesDir = path.join(root, '.cursor', 'rules');
const files = ['No-Hardcode-Rules.mdc', 'front-end-cursor-rules.mdc'];

function gitShow(spec) {
  return execSync(`git show ${spec}`, { cwd: root, encoding: 'utf8' });
}

function main() {
  fs.mkdirSync(rulesDir, { recursive: true });
  for (const name of files) {
    const spec = `HEAD:.cursor/rules/${name}`;
    const body = gitShow(spec);
    const out = path.join(rulesDir, name);
    fs.writeFileSync(out, body, 'utf8');
    // eslint-disable-next-line no-console
    console.log('Wrote', out);
  }
  // eslint-disable-next-line no-console
  console.log('Done. Run: git add .cursor/rules && git status');
}

try {
  main();
} catch (e) {
  // eslint-disable-next-line no-console
  console.error(e.message);
  process.exit(1);
}

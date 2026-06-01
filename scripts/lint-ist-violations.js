#!/usr/bin/env node
/**
 * Flags common IST timezone violations in Cosmos.
 * Contract: docs/architecture/ist-time.md
 * Run: npm run lint:ist
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SCAN_DIRS = ['src', 'scripts'];
const SCAN_ROOT_FILES = [
  'app.js',
  'Foundry_Prototype.html',
  'StorePilot_Prototype.html',
  'Finance_Prototype.html',
  'CommandUnit_Prototype.html',
  'POS_Prototype.html',
  'Cx_Prototype.html',
  'Army_Prototype.html',
];
const EXT = new Set(['.js', '.html', '.sql']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'logs', 'mcps']);
const SKIP_FILES = new Set([
  path.normalize('scripts/lint-ist-violations.js'),
  path.normalize('src/lib/cosmosIst.js'),
  path.normalize('src/public/js/cosmos-ui-polish.js'),
]);

const RULES = [
  {
    id: 'iso-date-slice',
    re: /toISOString\(\)\s*\.\s*(split\s*\(\s*['"]T['"]\s*\)|slice\s*\(\s*0\s*,\s*10\s*\))/,
    msg: 'Use cosmosIstToday() / cosmosDateToInputIso() / cosmosIstDateYmd() — not toISOString for business dates',
  },
  {
    id: 'get-hours',
    re: /new\s+Date\(\)\s*\.getHours\s*\(/,
    msg: 'Use cosmosIstHour() (browser) or istHour() from cosmosIst.js (Node)',
  },
  {
    id: 'locale-en-gb-no-tz',
    re: /\.toLocale(?:String|DateString|TimeString)\s*\(\s*['"]en-GB['"]\s*\)/,
    msg: 'toLocale*("en-GB") must include timeZone: "Asia/Kolkata"',
  },
  {
    id: 'getdate-sp',
    re: /\bGETDATE\s*\(\s*\)/i,
    msg: 'Use DATEADD(MINUTE, 330, SYSUTCDATETIME()) or sqlNow() — not GETDATE()',
    files: /\.sql$/i,
  },
];

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = path.relative(ROOT, full).split(path.sep).join('/');
    if (SKIP_FILES.has(path.normalize(rel))) continue;
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(name)) continue;
      walk(full, out);
      continue;
    }
    if (!EXT.has(path.extname(name))) continue;
    out.push(full);
  }
}

function collectFiles() {
  const files = [];
  for (const d of SCAN_DIRS) walk(path.join(ROOT, d), files);
  for (const f of SCAN_ROOT_FILES) {
    const full = path.join(ROOT, f);
    if (fs.existsSync(full)) files.push(full);
  }
  walk(path.join(ROOT, 'sql', 'sp'), files);
  return [...new Set(files)];
}

function checkFile(filePath) {
  const rel = path.relative(ROOT, filePath);
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/);
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/lint:ist-ignore/.test(line)) continue;
    if (/^\s*--/.test(line)) continue;
    for (const rule of RULES) {
      if (rule.files && !rule.files.test(rel)) continue;
      if (rule.re.test(line)) {
        hits.push({ line: i + 1, rule: rule.id, msg: rule.msg, snippet: line.trim().slice(0, 120) });
      }
    }
  }
  return hits;
}

function main() {
  const files = collectFiles();
  let total = 0;
  for (const f of files) {
    const hits = checkFile(f);
    if (!hits.length) continue;
    const rel = path.relative(ROOT, f);
    for (const h of hits) {
      console.log(`${rel}:${h.line} [${h.rule}] ${h.msg}`);
      console.log(`  ${h.snippet}`);
      total++;
    }
  }
  if (total) {
    console.error(`\nlint:ist failed — ${total} violation(s). See docs/architecture/ist-time.md`);
    process.exit(1);
  }
  console.log('lint:ist OK — no common IST violations found.');
}

main();

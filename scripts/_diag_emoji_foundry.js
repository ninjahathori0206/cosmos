const cp = require('child_process');
const fs = require('fs');

const cur = fs.readFileSync('Foundry_Prototype.html', 'utf8');
const buf = fs.readFileSync('Foundry_Prototype.html');
console.log('disk bytes start:', buf.slice(0, 8).toString('hex'));

const navLines = cur.split(/\r?\n/).filter((l) => l.includes('nav-item') && l.includes('class="ic"'));
navLines.forEach((l) => {
  const m = l.match(/class="ic">([^<]+)/);
  if (m) console.log('nav ic:', JSON.stringify(m[1]), 'codepoints:', [...m[1]].map((c) => c.codePointAt(0).toString(16)).join(' '));
});

const unitIdx = cur.indexOf('page-unit-search');
console.log('\nunit-search block snippet:', JSON.stringify(cur.slice(unitIdx, unitIdx + 600)));

const git = cp.execSync('git show HEAD:Foundry_Prototype.html').toString('utf8');
const gitNav = git.split('\n').filter((l) => l.includes('unit-search') && l.includes('class="ic"'));
console.log('\ngit unit-search nav:', gitNav[0] ? gitNav[0].slice(0, 200) : 'none');

// Compare emoji vs question-mark lines between disk and git
const diskQ = (cur.match(/class="ic">\?+/g) || []).length;
const gitQ = (git.match(/class="ic">\?+/g) || []).length;
console.log('\ndisk ic>? lines:', diskQ, 'git ic>? lines:', gitQ);

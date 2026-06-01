const fs = require('fs')
const p = 'E:/Curser/cosmos/src/public/js/foundry-prototype.js'
let s = fs.readFileSync(p, 'utf8')
const badOpen = '<' + 'mo' + 'tion'
const goodOpen = '<' + 'di' + 'v'
const badClose = '</' + 'mo' + 'tion>'
const goodClose = '</' + 'di' + 'v>'
s = s.split(badOpen).join(goodOpen).split(badClose).join(goodClose)
fs.writeFileSync(p, s, 'utf8')
console.log('done')

const fs = require('fs')
const path = require('path')

const src = path.join(__dirname, '..', 'pencil-new.pen')
const dest = path.join(__dirname, '..', 'src', 'public', 'design', 'pencil-local', 'pencil-new.pen')

fs.mkdirSync(path.dirname(dest), { recursive: true })
fs.copyFileSync(src, dest)
console.log('Copied pencil-new.pen -> src/public/design/pencil-local/')

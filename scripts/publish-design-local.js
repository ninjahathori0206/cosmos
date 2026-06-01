const fs = require('fs')
const path = require('path')

const src = path.join(__dirname, '..', 'UIX', 'pencil-new.pen')
const dest = path.join(__dirname, '..', 'src', 'public', 'design', 'pencil-local', 'pencil-new.pen')

if (!fs.existsSync(src)) {
  console.error('Source not found:', src)
  process.exit(1)
}
fs.mkdirSync(path.dirname(dest), { recursive: true })
fs.copyFileSync(src, dest)
console.log('Copied UIX/pencil-new.pen -> src/public/design/pencil-local/')

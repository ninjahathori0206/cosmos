const fs = require('fs')
const path = require('path')

const file = path.join(__dirname, '../src/public/js/foundry-prototype.js')
let s = fs.readFileSync(file, 'utf8')

const start = s.indexOf('      if (tbody) {\n        tbody.innerHTML = rows.map((r) => {')
const end = s.indexOf('    } catch (e) {', start)
if (start < 0 || end < 0) {
  console.error('Could not find block', start, end)
  process.exit(1)
}

const replacement = `      if (qcByStoreTab) {
        var grouped = fyRenderLabOrdersGroupedHtml(rows, true);
        if (tbody) tbody.innerHTML = grouped.tableHtml;
        if (mobile) mobile.innerHTML = grouped.mobileHtml;
      } else {
        if (tbody) {
          tbody.innerHTML = rows.map(function (r) {
            return fyRenderLabOrderTableRow(r, false);
          }).join('');
        }
        if (mobile) mobile.innerHTML = rows.map(function (r) { return fyBuildLabOrderMobileCard(r); }).join('');
      }
`

s = s.slice(0, start) + replacement + s.slice(end)
fs.writeFileSync(file, s)
console.log('Patched loadLabOrders render block')

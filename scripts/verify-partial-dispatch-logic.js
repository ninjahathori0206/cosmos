/**
 * Unit-style check for partial dispatch header status logic (mirrors transferRequests.js).
 */
function transferLineCap(line) {
  if (line.approved_qty != null && Number(line.approved_qty) > 0) return Number(line.approved_qty);
  return Math.max(0, Number(line.requested_qty) || 0);
}

function computeDispatchHeaderStatus(lines) {
  if (!lines || !lines.length) return 'APPROVED';
  let anyDispatched = false;
  let allComplete = true;
  for (const l of lines) {
    const cap = transferLineCap(l);
    const disp = Math.max(0, Number(l.dispatched_qty) || 0);
    if (disp > 0) anyDispatched = true;
    if (disp < cap) allComplete = false;
  }
  if (allComplete && anyDispatched) return 'DISPATCHED';
  if (anyDispatched) return 'PARTIALLY_DISPATCHED';
  return 'APPROVED';
}

const cases = [
  { lines: [{ requested_qty: 56, approved_qty: 56, dispatched_qty: 0 }], want: 'APPROVED' },
  { lines: [{ requested_qty: 56, approved_qty: 56, dispatched_qty: 1 }], want: 'PARTIALLY_DISPATCHED' },
  { lines: [{ requested_qty: 56, approved_qty: 56, dispatched_qty: 56 }], want: 'DISPATCHED' }
];

let failed = 0;
cases.forEach((c, i) => {
  const got = computeDispatchHeaderStatus(c.lines);
  if (got !== c.want) {
    console.error('FAIL case', i, 'want', c.want, 'got', got);
    failed++;
  }
});
if (failed) process.exit(1);
console.log('OK: partial dispatch status logic');

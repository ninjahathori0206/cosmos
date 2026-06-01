const fs = require('fs')
const p = 'E:/Curser/cosmos/src/public/js/foundry-prototype.js'
let s = fs.readFileSync(p, 'utf8')

const marker = '  window.loadLabOrders = async function() {'
const idx = s.indexOf(marker)
if (idx < 0) throw new Error('loadLabOrders not found')

const endMarker = '  window.markFyLabIntake = async function(orderId, subOrderId, field) {'
const endIdx = s.indexOf(endMarker, idx)
if (endIdx < 0) throw new Error('markFyLabIntake not found')

const insertBefore = `  function fyBuildLabOrderMobileCard(r) {
    const statusShown = fyJobsFromOrderRow(r).map(function (j) {
      return fyLabelLabStatus(j.lab_workflow_status)
    }).filter(Boolean).join(' · ')
    const statusFinal = statusShown || fyLabelLabStatus(r.lab_workflow_status)
    const created = typeof fmtDateTime === 'function' ? fmtDateTime(r.created_at) : (r.created_at || '')
    const orderNo = fyEscapeHtml(r.order_no || '')
    return (
      '<article class="fy-lab-card">' +
      '<header class="fy-lab-card__head">' +
      '<motion class="fy-lab-card__order mono">' + orderNo + '</div>' +
      '<span class="b b-blue" style="font-size:11px">' + fyEscapeHtml(statusFinal) + '</span>' +
      '</header>' +
      '<div class="fy-lab-card__customer">' + fyEscapeHtml(r.customer_name || 'Walk-in') + '</div>' +
      (r.customer_phone ? '<motion class="fy-lab-card__phone">' + fyEscapeHtml(r.customer_phone) + '</div>' : '') +
      '<div class="fy-lab-card__store">' + fyEscapeHtml(r.store_name || '') + '</div>' +
      '<div class="fy-lab-card__meta">' +
      '<span>' + fyEscapeHtml(created) + '</span>' +
      '<button type="button" class="fy-lab-card__timeline" onclick="window.cosmosTimelineOpen(' + r.order_id + ',\\'' + fyEscapeAttr(r.order_no || '') + '\\')">Timeline</button>' +
      '</div>' +
      '<div class="fy-lab-card__actions fy-lab-card__actions-row">' + buildFyLabStatusAction(r) + '</motion>' +
      '</article>'
    )
  }

  function fyRenderLabOrdersEmpty(q, filterTitle, hint, hasSearch) {
    const atLabBtn =
      '<button type="button" class="btn sm primary" onclick="document.getElementById(\\'fy-lab-tab-at-lab\\')&&setFyLabFilter(\\'LAB_FITTING\\',document.getElementById(\\'fy-lab-tab-at-lab\\'))">Show At Lab</button>'
    const dispatchBtn =
      '<button type="button" class="btn sm" onclick="document.getElementById(\\'fy-lab-tab-dispatched\\')&&setFyLabFilter(\\'DISPATCHED_TO_STORE\\',document.getElementById(\\'fy-lab-tab-dispatched\\'))">Show Dispatched</button>'
    const extraQueues =
      String(_fyLabStatusFilter || '').toUpperCase() === 'QC_PASS'
        ? '<div style="margin-top:12px;display:flex;flex-wrap:wrap;justify-content:center;gap:10px">' + atLabBtn + dispatchBtn + '</motion>'
        : ''
    const searchLine = hasSearch
      ? '<div style="margin-top:8px;font-size:12px;color:var(--gold)">Active search filters the list (' + fyEscapeHtml(q) + ').</div>'
      : ''
    const primaryEmptyBtn =
      '<button type="button" class="btn sm primary" onclick="fyLabClearSearchAndShowAll()">' +
      (hasSearch ? 'Clear search &amp; show all' : 'Show all orders') +
      '</button>'
    const emptyInner =
      '<div class="empty" style="padding:32px 24px;text-align:center;max-width:520px;margin:0 auto">' +
      '<div class="empty-ic" style="font-weight:700;font-size:26px;line-height:1;color:var(--acc2)" aria-hidden="true">◇</div>' +
      '<div style="font-size:15px;font-weight:600;color:var(--text1);margin:12px 0 8px">' + fyEscapeHtml(hasSearch ? 'No matches for this query' : 'No lab orders in this view') + '</div>' +
      '<div style="font-size:13px;color:var(--text2);line-height:1.5">' + fyEscapeHtml(hint) + '</div>' +
      '<div style="font-size:12px;color:var(--text3);margin-top:8px">' + fyEscapeHtml('Tab: ' + filterTitle + (hasSearch ? ' · search on' : '')) + '</motion>' +
      searchLine +
      '<div style="margin-top:18px;display:flex;flex-wrap:wrap;justify-content:center;gap:10px">' +
      primaryEmptyBtn +
      '<button type="button" class="btn sm" onclick="window.loadLabOrders && window.loadLabOrders()">Refresh</button>' +
      '</div>' +
      extraQueues +
      '</div>'

    const tbody = document.getElementById('lab-orders-tbody')
    const mobile = document.getElementById('fy-lab-orders-mobile')
    if (tbody) tbody.innerHTML = '<tr><td colspan="6">' + emptyInner + '</td></tr>'
    if (mobile) mobile.innerHTML = '<div class="fy-lab-empty">' + emptyInner + '</div>'
  }

`

const newLoad = `  window.loadLabOrders = async function() {
    const tbody = document.getElementById('lab-orders-tbody');
    const mobile = document.getElementById('fy-lab-orders-mobile');
    if (!tbody && !mobile) return;
    if (typeof window.cosmosSkeletonTable === 'function' && tbody) window.cosmosSkeletonTable('lab-orders-tbody', 6);
    if (typeof window.cosmosSkeletonRows === 'function' && mobile) window.cosmosSkeletonRows('fy-lab-orders-mobile', 4);

    const searchEl = document.getElementById('lab-orders-search');
    const q = (searchEl && searchEl.value ? searchEl.value.trim() : '');
    try {
      const qs = new URLSearchParams();
      qs.set('kind', 'LAB');
      qs.set('scope', 'all');
      qs.set('limit', '120');
      if (q) qs.set('search', q);
      if (_fyLabStatusFilter) qs.set('lab_status', _fyLabStatusFilter);
      const rows = await apiGet(\`/api/orders?\${qs.toString()}\`);
      if (!rows || !rows.length) {
        fyRenderLabOrdersEmpty(q, fyLabFilterTitle(_fyLabStatusFilter), fyLabEmptyHintForFilter(_fyLabStatusFilter), Boolean(q));
        return;
      }
      if (tbody) {
        tbody.innerHTML = rows.map((r) => {
          const statusShown = fyJobsFromOrderRow(r).map(function (j) {
            return fyLabelLabStatus(j.lab_workflow_status)
          }).filter(Boolean).join(' · ')
          const statusFinal = statusShown || fyLabelLabStatus(r.lab_workflow_status)
          return \`
        <tr>
          <td class="mono xs">
            <div>\${r.order_no || ''}</motion>
            <button type="button" onclick="window.cosmosTimelineOpen(\${r.order_id},'\${r.order_no || ''}')" style="background:none;border:none;color:var(--acc2);font-size:11px;cursor:pointer;padding:0;margin-top:2px;text-decoration:underline">📋 Timeline</button>
          </td>
          <td>\${r.customer_name || 'Walk-in'}\${r.customer_phone ? \`<div style="font-size:11px;color:var(--text3)">\${r.customer_phone}</motion>\` : ''}</td>
          <td>\${r.store_name || ''}</td>
          <td><span class="b b-blue" style="font-size:11px">\${statusFinal}</span></td>
          <td style="font-size:12px;color:var(--text3)">\${typeof fmtDateTime === 'function' ? fmtDateTime(r.created_at) : (r.created_at || '')}</td>
          <td>\${buildFyLabStatusAction(r)}</td>
        </tr>
      \`
        }).join('');
      }
      if (mobile) mobile.innerHTML = rows.map((r) => fyBuildLabOrderMobileCard(r)).join('');
    } catch (e) {
      const msg = e && e.message ? e.message : 'Could not load orders.';
      if (typeof window.cosmosToastError === 'function') window.cosmosToastError(msg);
      if (tbody) tbody.innerHTML = \`<tr><td colspan="6" style="color:var(--red);padding:16px">Could not load orders.</td></tr>\`;
      if (mobile) mobile.innerHTML = '<div class="fy-lab-empty" style="color:var(--red)">Could not load orders.</div>';
    }
  };

`

// Fix accidental motion tags in generated strings
function fixTags(str) {
  const bO = '<' + 'mo' + 'tion'
  const gO = '<' + 'di' + 'v'
  const bC = '</' + 'mo' + 'tion>'
  const gC = '</' + 'di' + 'v>'
  return str.split(bO).join(gO).split(bC).join(gC)
}

const block = fixTags(insertBefore + newLoad)
s = s.slice(0, idx) + block + s.slice(endIdx)
fs.writeFileSync(p, s, 'utf8')
console.log('patched lab orders')

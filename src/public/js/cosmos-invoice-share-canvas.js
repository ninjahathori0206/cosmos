/**
 * Shared invoice receipt canvas for StorePilot + Finance share-as-image.
 * Expects GET /api/pos/invoices/:id or GET /api/orders/invoices/:id payload.
 */
(function () {
  'use strict'

  const THEMES = {
    storepilot: { grad0: '#1D6FD4', grad1: '#2B8CFF', accent: '#1D6FD4', text: '#0F172A' },
    finance: { grad0: '#0E7E60', grad1: '#14A377', accent: '#0E7E60', text: '#0B1F35' }
  }

  function fmtRs(v) {
    const n = Number(v) || 0
    return '\u20B9 ' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  }

  function fmtDateTimeIst(v) {
    if (typeof window.cosmosFmtDateTimeShort === 'function') return window.cosmosFmtDateTimeShort(v)
    if (!v) return ''
    return String(v)
  }

  function orderKindLabel(kind) {
    const k = String(kind || '').toUpperCase()
    if (k === 'MIXED') return 'Mixed'
    if (k === 'LAB') return 'Lab'
    if (k === 'INSTANT') return 'Instant'
    return k || '\u2014'
  }

  function collectLineItems(detail) {
    const out = []
    const subs = Array.isArray(detail.sub_orders) ? detail.sub_orders : []
    for (const sub of subs) {
      const items = Array.isArray(sub.items) ? sub.items : []
      for (const it of items) {
        out.push({
          label: String(it.product_label || it.sku_code || 'Item').trim(),
          qty: Number(it.qty) || 1,
          unitPrice: Number(it.unit_price) || 0,
          lineTotal: Number(it.line_total) || 0
        })
      }
    }
    return out
  }

  function paymentMethodsLabel(payments) {
    const methods = []
    const seen = new Set()
    for (const p of payments || []) {
      const m = String(p.method || '').trim()
      if (!m || seen.has(m)) continue
      seen.add(m)
      methods.push(m)
    }
    return methods.length ? methods.join(', ') : '\u2014'
  }

  function truncateText(ctx, text, maxW) {
    const s = String(text || '')
    if (ctx.measureText(s).width <= maxW) return s
    let t = s
    while (t.length > 1 && ctx.measureText(t + '\u2026').width > maxW) {
      t = t.slice(0, -1)
    }
    return t + '\u2026'
  }

  function estimateHeight(lineCount, hasAddress, hasStorePhone) {
    let h = 88 // header
    h += 108 // customer + order block
    if (hasAddress) h += 18
    if (hasStorePhone) h += 18
    h += 28 + lineCount * 22 // items
    h += 130 // totals
    h += 36 // payment
    h += 72 // footer
    return Math.max(h, 520)
  }

  /**
   * @param {object} detail API invoice detail payload
   * @param {'storepilot'|'finance'} themeKey
   * @returns {HTMLCanvasElement}
   */
  function buildInvoiceReceiptCanvas(detail, themeKey) {
    const theme = THEMES[themeKey] || THEMES.storepilot
    const order = detail.order || {}
    const customer = detail.customer || {}
    const store = detail.store || {}
    const summary = detail.payment_summary || {}
    const invNo = String(detail.invoice_no || order.invoice_no || '\u2014')
    const lineItems = collectLineItems(detail)
    const storeAddr = String(store.address || '').trim()
    const storePhone = String(store.phone || '').trim()
    const W = 420
    const H = estimateHeight(lineItems.length, !!storeAddr, !!storePhone)
    const DPR = Math.min(window.devicePixelRatio || 1, 2)
    const canvas = document.createElement('canvas')
    canvas.width = W * DPR
    canvas.height = H * DPR
    const ctx = canvas.getContext('2d')
    ctx.scale(DPR, DPR)

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, W, H)

    const grad = ctx.createLinearGradient(0, 0, W, 0)
    grad.addColorStop(0, theme.grad0)
    grad.addColorStop(1, theme.grad1)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, 88)

    const storeName = String(store.name || 'Store').toUpperCase()
    const dtStr = fmtDateTimeIst(order.created_at)

    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'left'
    ctx.font = 'bold 17px Inter, system-ui, sans-serif'
    ctx.fillText(truncateText(ctx, storeName, W - 170), 24, 34)
    ctx.font = '12px Inter, system-ui, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.78)'
    ctx.fillText('Sales Invoice', 24, 56)
    if (dtStr) {
      ctx.font = '11px Inter, system-ui, sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.65)'
      ctx.fillText(dtStr, 24, 74)
    }

    ctx.fillStyle = 'rgba(255,255,255,0.18)'
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath()
      ctx.roundRect(W - 156, 14, 136, 58, 8)
      ctx.fill()
    } else {
      ctx.fillRect(W - 156, 14, 136, 58)
    }
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 10px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(truncateText(ctx, invNo, 120), W - 88, 36)
    ctx.font = '10px Inter, system-ui, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.72)'
    const invDateOnly = order.created_at
      ? new Date(order.created_at).toLocaleDateString('en-GB', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
      : ''
    if (invDateOnly) ctx.fillText(invDateOnly, W - 88, 58)

    let y = 108
    function hLine(yy) {
      ctx.strokeStyle = '#E2EBF5'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(24, yy)
      ctx.lineTo(W - 24, yy)
      ctx.stroke()
    }

    ctx.textAlign = 'left'
    ctx.fillStyle = '#8B9CAE'
    ctx.font = '10px Inter, system-ui, sans-serif'
    ctx.fillText('CUSTOMER', 24, y)
    ctx.fillText('ORDER', W - 24 - 80, y)
    y += 18
    ctx.fillStyle = theme.text
    ctx.font = 'bold 15px Inter, system-ui, sans-serif'
    const custName = String(customer.full_name || '\u2014')
    ctx.fillText(truncateText(ctx, custName, 200), 24, y)
    ctx.textAlign = 'right'
    ctx.font = 'bold 13px Inter, system-ui, sans-serif'
    ctx.fillText(orderKindLabel(order.order_kind), W - 24, y)
    y += 20
    ctx.textAlign = 'left'
    ctx.fillStyle = '#5C6B7A'
    ctx.font = '12px Inter, system-ui, sans-serif'
    const custPhone = String(customer.phone || '').trim()
    if (custPhone) {
      ctx.fillText(custPhone, 24, y)
      y += 18
    }
    ctx.textAlign = 'right'
    ctx.fillStyle = '#5C6B7A'
    ctx.font = '12px Inter, system-ui, sans-serif'
    ctx.fillText(String(order.order_no || '\u2014'), W - 24, y - (custPhone ? 18 : 0))
    ctx.textAlign = 'left'
    if (!custPhone) y += 18

    if (storeAddr) {
      ctx.fillStyle = '#94A3B8'
      ctx.font = '11px Inter, system-ui, sans-serif'
      ctx.fillText(truncateText(ctx, storeAddr, W - 48), 24, y)
      y += 18
    }
    if (storePhone) {
      ctx.fillStyle = '#94A3B8'
      ctx.font = '11px Inter, system-ui, sans-serif'
      ctx.fillText('Store: ' + storePhone, 24, y)
      y += 18
    }

    y += 8
    hLine(y)
    y += 20

    ctx.fillStyle = '#8B9CAE'
    ctx.font = '10px Inter, system-ui, sans-serif'
    ctx.fillText('ITEMS', 24, y)
    y += 18

    if (!lineItems.length) {
      ctx.fillStyle = '#5C6B7A'
      ctx.font = '12px Inter, system-ui, sans-serif'
      ctx.fillText('No line items recorded', 24, y)
      y += 22
    } else {
      for (const it of lineItems) {
        ctx.fillStyle = theme.text
        ctx.font = '12px Inter, system-ui, sans-serif'
        ctx.fillText(truncateText(ctx, it.label, 220), 24, y)
        ctx.textAlign = 'right'
        ctx.fillStyle = '#5C6B7A'
        ctx.font = '11px Inter, system-ui, sans-serif'
        const qtyStr = it.qty + ' \u00D7 ' + fmtRs(it.unitPrice)
        ctx.fillText(qtyStr, W - 24, y)
        y += 14
        ctx.fillStyle = theme.text
        ctx.font = 'bold 12px Inter, system-ui, sans-serif'
        ctx.fillText(fmtRs(it.lineTotal), W - 24, y)
        ctx.textAlign = 'left'
        y += 12
      }
    }

    y += 6
    hLine(y)
    y += 18

    const subtotal = Number(summary.subtotal_amount != null ? summary.subtotal_amount : order.subtotal_amount) || 0
    const gst = Number(summary.gst_amount != null ? summary.gst_amount : order.gst_amount) || 0
    const total = Number(summary.total_amount != null ? summary.total_amount : order.total_amount) || 0
    const paid = Number(summary.paid_total) || 0
    const balance = Number(summary.amount_remaining) || 0

    function totalRow(label, value, bold) {
      ctx.textAlign = 'left'
      ctx.fillStyle = '#8B9CAE'
      ctx.font = '11px Inter, system-ui, sans-serif'
      ctx.fillText(label, 24, y)
      ctx.textAlign = 'right'
      ctx.fillStyle = theme.text
      ctx.font = (bold ? 'bold ' : '') + (bold ? '15px' : '12px') + ' Inter, system-ui, sans-serif'
      ctx.fillText(fmtRs(value), W - 24, y)
      y += bold ? 22 : 18
    }

    totalRow('Subtotal (taxable)', subtotal, false)
    totalRow('GST', gst, false)
    totalRow('TOTAL', total, true)
    totalRow('Paid', paid, false)
    totalRow('Balance', balance, false)

    y += 4
    hLine(y)
    y += 18

    ctx.textAlign = 'left'
    ctx.fillStyle = '#8B9CAE'
    ctx.font = '10px Inter, system-ui, sans-serif'
    ctx.fillText('PAYMENT', 24, y)
    y += 16
    ctx.fillStyle = theme.text
    ctx.font = '13px Inter, system-ui, sans-serif'
    ctx.fillText('Method: ' + paymentMethodsLabel(detail.payments), 24, y)
    y += 24

    hLine(y)
    y += 22
    ctx.textAlign = 'center'
    ctx.fillStyle = theme.accent
    ctx.font = 'bold 15px Inter, system-ui, sans-serif'
    ctx.fillText('Thank you for your visit!', W / 2, y)
    y += 20
    ctx.fillStyle = '#8B9CAE'
    ctx.font = '12px Inter, system-ui, sans-serif'
    ctx.fillText('We look forward to seeing you again.', W / 2, y)
    y += 28
    ctx.fillStyle = '#B0BCCC'
    ctx.font = '11px Inter, system-ui, sans-serif'
    ctx.fillText('Powered by Cosmos ERP', W / 2, y)

    return canvas
  }

  async function shareInvoiceCanvas(canvas, invNo, shareText) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(async function (blob) {
        if (!blob) {
          reject(new Error('Could not create invoice image.'))
          return
        }
        try {
          const safeInv = String(invNo || 'invoice').replace(/[^\w.-]+/g, '_')
          const file = new File([blob], 'Invoice-' + safeInv + '.png', { type: 'image/png' })
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: 'Invoice ' + invNo,
              text: shareText || ''
            })
          } else {
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'Invoice-' + safeInv + '.png'
            document.body.appendChild(a)
            a.click()
            setTimeout(function () {
              URL.revokeObjectURL(url)
              a.remove()
            }, 2000)
            if (typeof cosmosToastInfo === 'function') {
              cosmosToastInfo('Image downloaded \u2014 share it from your files.')
            }
          }
          resolve()
        } catch (err) {
          if (err.name === 'AbortError') resolve()
          else reject(err)
        }
      }, 'image/png')
    })
  }

  window.cosmosBuildInvoiceReceiptCanvas = buildInvoiceReceiptCanvas
  window.cosmosShareInvoiceCanvas = shareInvoiceCanvas
})()

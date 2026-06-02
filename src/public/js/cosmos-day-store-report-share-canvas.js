/**
 * Day Store Report — share-as-image canvas (StorePilot).
 * Expects payload from GET /api/storepilot/reports/day-store (mapped in UI).
 */
(function () {
  'use strict'

  const THEME = { grad0: '#1D6FD4', grad1: '#2B8CFF', accent: '#1D6FD4', text: '#0F172A', muted: '#5C6B7A', panel: '#F4F7FB' }

  function fmtRs(v) {
    const n = Number(v) || 0
    return '\u20B9 ' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  function fmtDateLabel(ymd) {
    if (!ymd) return ''
    if (typeof window.cosmosFmtDate === 'function') return window.cosmosFmtDate(ymd)
    const p = String(ymd).slice(0, 10).split('-')
    if (p.length === 3) return p[2] + '/' + p[1] + '/' + p[0]
    return String(ymd)
  }

  function drawSection(ctx, y, title, metrics, x, w) {
    const pad = 14
    const rowH = 52
    const rows = Math.ceil(metrics.length / 2)
    const h = pad * 2 + 22 + rows * rowH
    ctx.fillStyle = THEME.panel
    roundRect(ctx, x, y, w, h, 10)
    ctx.fill()
    ctx.fillStyle = THEME.muted
    ctx.font = 'bold 11px DM Sans, Inter, system-ui, sans-serif'
    ctx.fillText(title, x + pad, y + pad + 11)
    let my = y + pad + 28
    for (let i = 0; i < metrics.length; i++) {
      const col = i % 2
      const row = Math.floor(i / 2)
      const mx = x + pad + col * ((w - pad * 2) / 2)
      const myRow = my + row * rowH
      ctx.fillStyle = THEME.muted
      ctx.font = '11px DM Sans, Inter, system-ui, sans-serif'
      ctx.fillText(metrics[i].label, mx, myRow)
      ctx.fillStyle = THEME.text
      ctx.font = '600 17px JetBrains Mono, ui-monospace, monospace'
      ctx.fillText(metrics[i].value, mx, myRow + 20)
    }
    return h + 10
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + rad, y)
    ctx.lineTo(x + w - rad, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + rad)
    ctx.lineTo(x + w, y + h - rad)
    ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h)
    ctx.lineTo(x + rad, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - rad)
    ctx.lineTo(x, y + rad)
    ctx.quadraticCurveTo(x, y, x + rad, y)
    ctx.closePath()
  }

  function buildDayStoreReportCanvas(data) {
    const d = data || {}
    const inv = d.invoiced || {}
    const bk = d.booking || {}
    const col = d.collection || {}
    const storeName = String(d.store_name || 'Store').trim()
    const dateLabel = fmtDateLabel(d.report_date)
    const W = 400
    const H = 720
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    const grad = ctx.createLinearGradient(0, 0, 0, 88)
    grad.addColorStop(0, THEME.grad0)
    grad.addColorStop(1, THEME.grad1)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, 88)
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 20px Syne, Inter, system-ui, sans-serif'
    ctx.fillText('Day Store Report', 24, 40)
    ctx.font = '12px DM Sans, Inter, system-ui, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.fillText(storeName, 24, 62)
    ctx.fillText(dateLabel, 24, 78)

    let y = 100
    const mx = 20
    const innerW = W - mx * 2
    ctx.fillStyle = THEME.muted
    ctx.font = '12px DM Sans, Inter, system-ui, sans-serif'
    ctx.fillText('IST daily snapshot', mx, y)
    y += 22

    y += drawSection(ctx, y, 'INVOICED (TODAY)', [
      { label: 'Revenue (invoiced)', value: fmtRs(inv.revenue) },
      { label: 'Number of bills', value: String(Number(inv.bill_count) || 0) },
      { label: 'Avg invoice', value: fmtRs(inv.avg_invoice_amount) }
    ], mx, innerW)

    y += drawSection(ctx, y, 'BOOKING (TODAY)', [
      { label: "Today's booking", value: fmtRs(bk.revenue) },
      { label: 'Orders booked', value: String(Number(bk.order_count) || 0) },
      { label: 'Avg booking', value: fmtRs(bk.avg_booking_amount) }
    ], mx, innerW)

    y += drawSection(ctx, y, 'COLLECTION (TODAY)', [
      { label: "Today's collection", value: fmtRs(col.total) },
      { label: 'Bank (UPI + card)', value: fmtRs(col.bank) },
      { label: 'Cash', value: fmtRs(col.cash) }
    ], mx, innerW)

    y += drawSection(ctx, y, 'MEMBERSHIP', [
      { label: 'Total membership sold', value: String(Number(d.memberships_sold) || 0) }
    ], mx, innerW)

    ctx.fillStyle = '#B0BCCC'
    ctx.font = '11px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Powered by Cosmos ERP · StorePilot', W / 2, H - 20)
    ctx.textAlign = 'left'
    return canvas
  }

  async function shareDayStoreReportCanvas(canvas, reportDate, storeName) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(async function (blob) {
        if (!blob) {
          reject(new Error('Could not create report image.'))
          return
        }
        try {
          const safeDate = String(reportDate || 'report').replace(/[^\w.-]+/g, '_')
          const file = new File([blob], 'Day-Store-Report-' + safeDate + '.png', { type: 'image/png' })
          const shareText = (storeName || '') + (reportDate ? ' · ' + fmtDateLabel(reportDate) : '')
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: 'Day Store Report ' + safeDate,
              text: shareText
            })
          } else {
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'Day-Store-Report-' + safeDate + '.png'
            document.body.appendChild(a)
            a.click()
            setTimeout(function () {
              URL.revokeObjectURL(url)
              a.remove()
            }, 2000)
            if (typeof cosmosToastInfo === 'function') {
              cosmosToastInfo('Image downloaded — share it from your files.')
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

  window.cosmosBuildDayStoreReportCanvas = buildDayStoreReportCanvas
  window.cosmosShareDayStoreReportCanvas = shareDayStoreReportCanvas
})()

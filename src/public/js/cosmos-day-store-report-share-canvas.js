/**
 * Day Store Report — share-as-image canvas (StorePilot).
 * Expects payload from GET /api/storepilot/reports/day-store (mapped in UI).
 * Output: 1280×720 PNG (16:9).
 */
(function () {
  'use strict'

  const THEME = { grad0: '#1D6FD4', grad1: '#2B8CFF', accent: '#1D6FD4', text: '#0F172A', muted: '#5C6B7A', panel: '#F4F7FB', bg: '#FFFFFF' }
  const CANVAS_W = 1280
  const CANVAS_H = 720

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

  function drawSectionBox(ctx, x, y, w, h, title, metrics) {
    const pad = 14
    const rowH = 38
    ctx.fillStyle = THEME.panel
    roundRect(ctx, x, y, w, h, 12)
    ctx.fill()
    ctx.fillStyle = THEME.muted
    ctx.font = 'bold 11px DM Sans, Inter, system-ui, sans-serif'
    ctx.fillText(title, x + pad, y + pad + 10)
    let my = y + pad + 26
    for (let i = 0; i < metrics.length; i++) {
      const col = i % 2
      const row = Math.floor(i / 2)
      const mx = x + pad + col * ((w - pad * 2) / 2)
      const myRow = my + row * rowH
      ctx.fillStyle = THEME.muted
      ctx.font = '10px DM Sans, Inter, system-ui, sans-serif'
      ctx.fillText(metrics[i].label, mx, myRow)
      ctx.fillStyle = THEME.text
      ctx.font = '600 15px JetBrains Mono, ui-monospace, monospace'
      ctx.fillText(metrics[i].value, mx, myRow + 18)
    }
  }

  function buildDayStoreReportCanvas(data) {
    const d = data || {}
    const inv = d.invoiced || {}
    const bk = d.booking || {}
    const col = d.collection || {}
    const colNew = col.new_order || {}
    const colHand = col.handover || {}
    const mcol = d.membership_collection || {}
    const storeName = String(d.store_name || 'Store').trim()
    const dateLabel = fmtDateLabel(d.report_date)

    const canvas = document.createElement('canvas')
    canvas.width = CANVAS_W
    canvas.height = CANVAS_H
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = THEME.bg
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

    const hdrH = 72
    const grad = ctx.createLinearGradient(0, 0, CANVAS_W, 0)
    grad.addColorStop(0, THEME.grad0)
    grad.addColorStop(1, THEME.grad1)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, CANVAS_W, hdrH)

    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 26px Syne, Inter, system-ui, sans-serif'
    ctx.fillText('Day Store Report', 32, 34)
    ctx.font = '14px DM Sans, Inter, system-ui, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.fillText(storeName + ' · ' + dateLabel, 32, 56)
    ctx.textAlign = 'right'
    ctx.font = '12px DM Sans, Inter, system-ui, sans-serif'
    ctx.fillText('IST daily snapshot', CANVAS_W - 32, 56)
    ctx.textAlign = 'left'

    const pad = 28
    const gap = 16
    const gridTop = hdrH + 20
    const ftrH = 32
    const gridH = CANVAS_H - gridTop - ftrH - 12
    const gridW = CANVAS_W - pad * 2
    const cols = 3
    const rows = 2
    const cellW = (gridW - gap * (cols - 1)) / cols
    const cellH = (gridH - gap * (rows - 1)) / rows

    const sections = [
      { title: 'INVOICED (TODAY)', metrics: [
        { label: 'Revenue (invoiced)', value: fmtRs(inv.revenue) },
        { label: 'Number of bills', value: String(Number(inv.bill_count) || 0) },
        { label: 'Avg invoice', value: fmtRs(inv.avg_invoice_amount) }
      ], col: 0, row: 0 },
      { title: 'PRODUCT BOOKING (TODAY)', metrics: [
        { label: "Today's product booking", value: fmtRs(bk.revenue) },
        { label: 'Product orders booked', value: String(Number(bk.order_count) || 0) },
        { label: 'Avg product booking', value: fmtRs(bk.avg_booking_amount) }
      ], col: 1, row: 0 },
      { title: 'COLLECTION — PRODUCTS', metrics: [
        { label: 'Product collection', value: fmtRs(col.total) },
        { label: 'Bank (UPI + card)', value: fmtRs(col.bank) },
        { label: 'Cash', value: fmtRs(col.cash) }
      ], col: 2, row: 0 },
      { title: 'NEW ORDER COLLECTION', metrics: [
        { label: 'From new orders', value: fmtRs(colNew.total) },
        { label: 'Bank', value: fmtRs(colNew.bank) },
        { label: 'Cash', value: fmtRs(colNew.cash) }
      ], col: 0, row: 1 },
      { title: 'HANDOVER COLLECTION', metrics: [
        { label: 'From handover', value: fmtRs(colHand.total) },
        { label: 'Bank', value: fmtRs(colHand.bank) },
        { label: 'Cash', value: fmtRs(colHand.cash) }
      ], col: 1, row: 1 },
      { title: 'MEMBERSHIP COLLECTION', metrics: [
        { label: 'Membership collected', value: fmtRs(mcol.total) },
        { label: 'Bank (UPI + card)', value: fmtRs(mcol.bank) },
        { label: 'Cash', value: fmtRs(mcol.cash) },
        { label: 'Memberships sold', value: String(Number(d.memberships_sold) || 0) }
      ], col: 2, row: 1 }
    ]

    sections.forEach(function (sec) {
      const x = pad + sec.col * (cellW + gap)
      const y = gridTop + sec.row * (cellH + gap)
      drawSectionBox(ctx, x, y, cellW, cellH, sec.title, sec.metrics)
    })

    ctx.fillStyle = '#B0BCCC'
    ctx.font = '11px Inter, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Powered by Cosmos ERP · StorePilot', CANVAS_W / 2, CANVAS_H - 14)
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

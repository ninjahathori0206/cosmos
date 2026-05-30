/**
 * Shared zone text alignment helpers (Command Unit configurator + Foundry print).
 * TSPL: left/top uses TEXT; other alignments use BLOCK with TSC align codes 1=left, 2=right, 3=center.
 */
(function () {
  'use strict';

  var TSPL_ALIGN_H = { left: 1, right: 2, center: 3 };

  function normAlignH(z) {
    var v = (z && z.text_align_h) || 'left';
    return v === 'center' || v === 'right' ? v : 'left';
  }

  function normAlignV(z) {
    var v = (z && z.text_align_v) || 'top';
    return v === 'middle' || v === 'bottom' ? v : 'top';
  }

  function zoneAlignCss(z) {
    var h = normAlignH(z);
    var v = normAlignV(z);
    var justify = h === 'center' ? 'center' : (h === 'right' ? 'flex-end' : 'flex-start');
    var align = v === 'middle' ? 'center' : (v === 'bottom' ? 'flex-end' : 'flex-start');
    return (
      'display:flex;width:100%;height:100%;box-sizing:border-box;overflow:hidden;padding:0.3mm;' +
      'justify-content:' + justify + ';align-items:' + align + ';'
    );
  }

  /** Screen preview text style — same pt/mm as Foundry print modal (WYSIWYG). */
  function zonePreviewTextStyle(z) {
    var pt = z && z.font_size_pt != null && z.font_size_pt !== '' ? Number(z.font_size_pt) : 8;
    if (!Number.isFinite(pt)) pt = 8;
    var fw = (z && z.font_weight) ? String(z.font_weight) : '700';
    var style =
      'font-size:' + pt + 'pt;font-weight:' + fw + ';line-height:1.15;color:var(--text1);' +
      'white-space:pre-wrap;word-break:break-word;max-width:100%;';
    if (z && z.writing_mode === 'vertical') {
      style += 'writing-mode:vertical-rl;text-orientation:mixed;';
    }
    return style;
  }

  function countLines(text) {
    var parts = String(text || '').split('\n');
    return parts.length ? parts.length : 1;
  }

  function estimateTextHeightDots(lineCount, fontPt, dotsPerMm) {
    var pt = fontPt || 8;
    var dpm = dotsPerMm || 8;
    var lineH = Math.max(8, Math.round(pt * dpm * 0.38));
    return lineCount * lineH;
  }

  /**
   * @param {object} z zone
   * @param {number} xd dots
   * @param {number} yd dots
   * @param {number} dotsPerMm
   * @param {string|number} fontId
   * @param {number} xMul
   * @param {number} yMul
   * @param {string} textQuoted already escaped for TSPL quotes
   * @returns {string} TSPL line (no CRLF)
   */
  function zoneTextTsplLine(z, xd, yd, dotsPerMm, fontId, xMul, yMul, textQuoted) {
    var rot = z.writing_mode === 'vertical' ? 270 : 0;
    var h = normAlignH(z);
    var v = normAlignV(z);
    if (h === 'left' && v === 'top') {
      return 'TEXT ' + xd + ',' + yd + ',"' + fontId + '",' + rot + ',' + xMul + ',' + yMul + ',"' + textQuoted + '"';
    }
    var wDots = Math.max(8, Math.round((z.width_mm || 1) * dotsPerMm));
    var hDots = Math.max(8, Math.round((z.height_mm || 1) * dotsPerMm));
    var lines = countLines(textQuoted);
    var textHDots = estimateTextHeightDots(lines, z.font_size_pt, dotsPerMm);
    var yUse = yd;
    if (v === 'middle') yUse = yd + Math.max(0, Math.floor((hDots - textHDots) / 2));
    else if (v === 'bottom') yUse = yd + Math.max(0, hDots - textHDots);
    var align = TSPL_ALIGN_H[h] || 1;
    return (
      'BLOCK ' + xd + ',' + yUse + ',' + wDots + ',' + hDots + ',"' + fontId + '",' + rot + ',' +
      xMul + ',' + yMul + ',0,' + align + ',"' + textQuoted + '"'
    );
  }

  /** Default sample item for Command Unit label designer preview (matches Foundry print tokens). */
  var SAMPLE_ITEM_DEFAULT = {
    code: '1234567',
    unitText: '1234567',
    sku_code: 'SKU-MAR-001',
    label: 'SKU-MAR-001',
    brand: 'MAR',
    model: 'Aviator Classic',
    power: '+1.50',
    mrp: '4000',
    bottomLine: 'MAR-4000'
  };

  function applyZoneTokens(tpl, item) {
    var s = String(tpl || '');
    var it = item || SAMPLE_ITEM_DEFAULT;
    var parts = String(it.bottomLine || '').split('-');
    var brand = it.brand != null ? String(it.brand) : (parts[0] || '');
    var mrp = it.mrp != null ? String(it.mrp) : (parts[1] || '');
    var power = it.power != null ? String(it.power).trim() : '';
    return s
      .replace(/\{unit_id\}/g, String(it.code || it.unitText || ''))
      .replace(/\{sku_code\}/g, String(it.sku_code || it.label || ''))
      .replace(/\{brand\}/g, brand)
      .replace(/\{model\}/g, String(it.model || ''))
      .replace(/\{power\}/g, power)
      .replace(/\{mrp\}/g, mrp);
  }

  /** Fallback if meta API unavailable — keep aligned with labelPrintFormatSchema.js */
  var ZONE_CONTENT_TOKENS = [
    { key: 'unit_id', label: 'Unit ID', description: '7-digit unit barcode' },
    { key: 'sku_code', label: 'SKU code', description: 'Product SKU' },
    { key: 'brand', label: 'Brand', description: 'Brand code' },
    { key: 'model', label: 'Model', description: 'Model name' },
    { key: 'power', label: 'Power', description: 'Reading diopter (Readers)' },
    { key: 'mrp', label: 'MRP', description: 'Sale price' }
  ];

  var ZONE_CONTENT_PRESETS = [
    { key: 'unit_only', label: 'Unit ID only', content: '{unit_id}' },
    { key: 'sku_only', label: 'SKU only', content: '{sku_code}' },
    { key: 'brand_mrp', label: 'Brand-MRP', content: '{brand}-{mrp}' },
    { key: 'brand_model_mrp', label: '3-line strip', content: '{brand}\n{model}\nMRP {mrp}' },
    { key: 'readers_power', label: 'Readers — power', content: '{power}' },
    { key: 'readers_brand_power_mrp', label: 'Readers 3-line', content: '{brand}\n{power}\nMRP {mrp}' }
  ];

  window.cosmosLabelZoneAlign = {
    normAlignH: normAlignH,
    normAlignV: normAlignV,
    zoneAlignCss: zoneAlignCss,
    zonePreviewTextStyle: zonePreviewTextStyle,
    zoneTextTsplLine: zoneTextTsplLine,
    SAMPLE_ITEM_DEFAULT: SAMPLE_ITEM_DEFAULT,
    applyZoneTokens: applyZoneTokens,
    ZONE_CONTENT_TOKENS: ZONE_CONTENT_TOKENS,
    ZONE_CONTENT_PRESETS: ZONE_CONTENT_PRESETS
  };
})();

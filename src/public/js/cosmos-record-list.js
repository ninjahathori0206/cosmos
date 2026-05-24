/**
 * Cosmos Record List + Detail — shared list rows, filter tabs, detail body blocks.
 * Requires cosmos-ui-polish.js (cosmosOpenExtendedDetail, skeletons).
 */
(function cosmosRecordListBootstrap() {
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  window.cosmosFilterTabs = {
    sync: function syncFilterTabs(containerEl, activeKey, opts) {
      if (!containerEl) return;
      var attr = (opts && opts.attr) || 'data-filter-key';
      var key = activeKey == null ? '' : String(activeKey);
      containerEl.querySelectorAll('[data-filter-key]').forEach(function (b) {
        var st = b.getAttribute(attr) || '';
        var active = st === key;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }
  };

  window.cosmosRecordRow = {
    html: function recordRowHtml(opts) {
      opts = opts || {};
      var click = opts.onClick ? ' onclick="' + String(opts.onClick).replace(/"/g, '&quot;') + '"' : '';
      var keydown = opts.onClick
        ? ' onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();' + opts.onClick + '}"'
        : '';
      var progress = opts.progressHtml
        ? '<div class="cosmos-record-row__progress">' + opts.progressHtml + '</div>'
        : '';
      return (
        '<div class="cosmos-record-row tr-link" role="button" tabindex="0"' + click + keydown +
        (opts.ariaLabel ? ' aria-label="' + esc(opts.ariaLabel) + '"' : '') + '>' +
        '<div class="cosmos-record-row__main">' +
        '<div class="cosmos-record-row__primary">' + (opts.primary || '') + '</div>' +
        '<div class="cosmos-record-row__secondary">' + (opts.secondary || '') + '</div>' +
        progress +
        '</div>' +
        (opts.badgeHtml ? '<div class="cosmos-record-row__badge">' + opts.badgeHtml + '</div>' : '') +
        '</div>'
      );
    }
  };

  window.cosmosRecordList = {
    renderEmpty: function (listEl, emptyHtml) {
      if (listEl) listEl.innerHTML = emptyHtml || '';
    },
    skeleton: function (listEl, count) {
      if (!listEl) return;
      if (typeof window.cosmosSkeletonRows === 'function') {
        window.cosmosSkeletonRows(listEl.id || 'cosmos-record-skel', count || 6);
        if (!listEl.id) {
          listEl.innerHTML = document.getElementById('cosmos-record-skel')
            ? document.getElementById('cosmos-record-skel').innerHTML
            : '';
        }
      }
      if (listEl.id && typeof window.cosmosSkeletonRows === 'function') {
        window.cosmosSkeletonRows(listEl.id, count || 6);
      }
    }
  };

  window.cosmosDetailPanel = {
    prepareOpen: function (panelId, backdropId) {
      if (typeof window.closeSidebar === 'function') {
        var overlayEl = document.getElementById('sp-sidebar-overlay') ||
          document.getElementById('fy-sidebar-overlay');
        var sidebarEl = document.querySelector('.sidebar');
        var isSidebarOpen = !!(sidebarEl && sidebarEl.classList.contains('open'));
        var isOverlayOpen = !!(overlayEl && overlayEl.classList.contains('open'));
        var isBodyLocked = document.body.style.overflow === 'hidden';
        if (isSidebarOpen || isOverlayOpen || isBodyLocked) window.closeSidebar();
      }
      if (typeof window.cosmosOpenExtendedDetail === 'function') {
        window.cosmosOpenExtendedDetail(panelId, backdropId);
      }
      if (typeof window.cosmosUpdateToastTopOffset === 'function') {
        window.cosmosUpdateToastTopOffset();
      }
    },
    close: function (panelId, backdropId) {
      if (typeof window.cosmosCloseExtendedDetail === 'function') {
        window.cosmosCloseExtendedDetail(panelId, backdropId);
      }
    },
    skeletonBody: function (bodyEl, count) {
      if (!bodyEl) return;
      bodyEl.innerHTML = '<div id="cosmos-detail-skel"></div>';
      if (typeof window.cosmosSkeletonRows === 'function') {
        var sk = document.getElementById('cosmos-detail-skel');
        if (sk) {
          sk.id = 'cosmos-detail-skel-' + Date.now();
          var id = sk.id;
          bodyEl.innerHTML = '<div id="' + id + '"></div>';
          window.cosmosSkeletonRows(id, count || 4);
        }
      }
    }
  };

  window.cosmosDetailQtySummary = {
    /** Line table shows per-SKU qty columns — banner only for outstanding remainders. */
    html: function (summary, opts) {
      if (!summary || summary.skuCount < 1 && !summary.totalCap) return '';
      opts = opts || {};
      var parts = [];
      if (opts.showRemainingToShip !== false && summary.remainingToShip > 0) {
        parts.push('<strong>' + summary.remainingToShip + '</strong> remaining to ship');
      }
      if (opts.showRemainingToStock !== false && summary.remainingToStock > 0) {
        parts.push('<span class="cosmos-record-row__progress-rem"><strong>' + summary.remainingToStock + '</strong> remaining to stock</span>');
      }
      if (!parts.length) return '';
      return '<div class="cosmos-detail-qty-bar hint">' + parts.join(' · ') + '</div>';
    }
  };

  window.cosmosDetailChips = {
    html: function (chips) {
      if (!chips || !chips.length) return '';
      return '<div class="cosmos-extended-detail__chips">' + chips.map(function (c) {
        return '<div class="cosmos-extended-detail__chip"><label>' + esc(c.label) + '</label><span>' + (c.valueHtml || esc(c.value)) + '</span></div>';
      }).join('') + '</div>';
    }
  };

  window.cosmosDetailLinesTable = {
    wrap: function (tableInnerHtml) {
      return '<div class="cosmos-detail-table-wrap"><table>' + tableInnerHtml + '</table></div>';
    }
  };

  window.cosmosDetailShipments = {
    html: function (items, opts) {
      if (!items || !items.length) {
        return '<span style="color:var(--text3)">No transfer documents yet.</span>';
      }
      opts = opts || {};
      return '<ul style="margin:0;padding-left:18px">' + items.map(function (d) {
        var click = opts.onDocClick
          ? ' style="cursor:pointer;margin-bottom:8px;min-height:44px" onclick="' + opts.onDocClick + '(' + d.doc_id + ')"'
          : ' style="margin-bottom:6px"';
        return '<li' + click + '>Doc <span class="mono">#' + esc(d.doc_id) + '</span> · ' +
          esc(d.dateLabel || '') + ' · ' + esc(d.status || '') +
          ' · ' + (d.line_count || 0) + ' line(s)</li>';
      }).join('') + '</ul>';
    }
  };

  window.cosmosRecordEsc = esc;
})();

/**
 * HQ admin — GatePass visit purpose catalog (Command Unit + CX Settings).
 * Expects opts: { get, post, put, del, escHtml, canEdit, tbodyId, badgeVariantsId? }
 */
(function () {
  'use strict';

  var _purposes = [];
  var _badgeVariants = [];
  var _editKey = null;
  var _opts = null;

  function o() {
    return _opts || {};
  }

  function esc(s) {
    if (o().escHtml) return o().escHtml(s);
    if (!s) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function purposeBadgeHtml(variant, label) {
    var v = String(variant || 'gray').toLowerCase();
    var cls = 'badge badge-' + (v === 'amber' ? 'gold' : v === 'gray' ? 'gray' : v);
    return '<span class="' + cls + '">' + esc(label || variant) + '</span>';
  }

  function fillBadgeSelect(selId, selected) {
    var sel = document.getElementById(selId);
    if (!sel) return;
    sel.innerHTML = '';
    (_badgeVariants || []).forEach(function (b) {
      var opt = document.createElement('option');
      opt.value = b.key;
      opt.textContent = b.label || b.key;
      if (selected && b.key === selected) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  function renderTable() {
    var tbody = document.getElementById(o().tbodyId);
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!_purposes.length) {
      tbody.innerHTML =
        '<tr><td colspan="7" class="td-muted" style="text-align:center;padding:20px">'
        + 'No visit purposes yet. Add your first option for GatePass check-in.'
        + '</td></tr>';
      return;
    }
    _purposes.forEach(function (row) {
      var tr = document.createElement('tr');
      tr.dataset.purposeKey = row.key;
      var statusBadge =
        row.is_active !== false
          ? '<span class="badge badge-green">Active</span>'
          : '<span class="badge badge-gray">Inactive</span>';
      var actions = '';
      if (o().canEdit) {
        actions =
          '<button type="button" class="topbar-btn gp-purpose-edit-btn" style="padding:5px 10px;font-size:12px">Edit</button>';
      } else {
        actions = '<span class="td-muted text-xs">View only</span>';
      }
      tr.innerHTML =
        '<td class="font-mono fw-600">' + esc(row.key) + '</td>'
        + '<td class="fw-600">' + esc(row.label) + '</td>'
        + '<td>' + purposeBadgeHtml(row.badgeVariant, row.badgeVariant) + '</td>'
        + '<td>' + esc(String(row.sort_order != null ? row.sort_order : '')) + '</td>'
        + '<td>' + esc(String(row.visitor_count != null ? row.visitor_count : 0)) + '</td>'
        + '<td>' + statusBadge + '</td>'
        + '<td>' + actions + '</td>';
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll('.gp-purpose-edit-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        var key = e.target.closest('tr').dataset.purposeKey;
        window.cosmosGatepassPurposeAdmin.openEdit(key);
      });
    });
    var addBtn = document.getElementById(o().addBtnId);
    if (addBtn) addBtn.hidden = !o().canEdit;
  }

  async function loadCatalog() {
    var tbody = document.getElementById(o().tbodyId);
    if (!tbody) return;
    if (typeof window.cosmosSkeletonTable === 'function') {
      window.cosmosSkeletonTable(o().tbodyId, 6);
    }
    try {
      var data = await o().get('/api/settings/gatepass-purpose-catalog');
      _purposes = (data && data.purposes) || [];
      _badgeVariants = (data && data.badge_variants) || [];
      renderTable();
    } catch (err) {
      tbody.innerHTML =
        '<tr><td colspan="7" class="td-muted">Error: ' + esc(err.message) + '</td></tr>';
      if (typeof window.cosmosToastError === 'function') {
        window.cosmosToastError(err.message || 'Could not load visit purposes');
      }
    }
  }

  window.cosmosGatepassPurposeAdmin = {
    init: function (opts) {
      _opts = opts || {};
      var addBtn = document.getElementById(_opts.addBtnId);
      if (addBtn && !_opts._bound) {
        _opts._bound = true;
        addBtn.addEventListener('click', function () {
          window.cosmosGatepassPurposeAdmin.openNew();
        });
        var newSave = document.getElementById(_opts.newSaveBtnId);
        if (newSave) {
          newSave.addEventListener('click', function () {
            window.cosmosGatepassPurposeAdmin.saveNew(newSave);
          });
        }
        var editSave = document.getElementById(_opts.editSaveBtnId);
        if (editSave) {
          editSave.addEventListener('click', function () {
            window.cosmosGatepassPurposeAdmin.saveEdit(editSave);
          });
        }
        var editDeact = document.getElementById(_opts.editDeactivateBtnId);
        if (editDeact) {
          editDeact.addEventListener('click', function () {
            window.cosmosGatepassPurposeAdmin.deactivate(editDeact);
          });
        }
      }
    },

    setCanEdit: function (flag) {
      if (_opts) _opts.canEdit = !!flag;
    },

    reload: function () {
      return loadCatalog();
    },

    openNew: function () {
      if (!o().canEdit) return;
      var errEl = document.getElementById(o().newErrorId);
      if (errEl) errEl.textContent = '';
      var keyIn = document.getElementById(o().newKeyId);
      var labelIn = document.getElementById(o().newLabelId);
      if (keyIn) keyIn.value = '';
      if (labelIn) labelIn.value = '';
      var sortIn = document.getElementById(o().newSortId);
      if (sortIn) sortIn.value = '100';
      fillBadgeSelect(o().newBadgeId, 'blue');
      if (window.openModal) window.openModal(o().newModalId);
    },

    openEdit: function (purposeKey) {
      if (!o().canEdit) return;
      var row = _purposes.find(function (r) { return r.key === purposeKey; });
      if (!row) return;
      _editKey = row.key;
      var errEl = document.getElementById(o().editErrorId);
      if (errEl) errEl.textContent = '';
      var title = document.getElementById(o().editTitleId);
      if (title) title.textContent = 'Edit — ' + row.label;
      var keyIn = document.getElementById(o().editKeyId);
      if (keyIn) keyIn.value = row.key;
      var labelIn = document.getElementById(o().editLabelId);
      if (labelIn) labelIn.value = row.label || '';
      var sortIn = document.getElementById(o().editSortId);
      if (sortIn) sortIn.value = row.sort_order != null ? String(row.sort_order) : '100';
      var activeSel = document.getElementById(o().editActiveId);
      if (activeSel) activeSel.value = row.is_active !== false ? '1' : '0';
      fillBadgeSelect(o().editBadgeId, row.badgeVariant || 'gray');
      var deactBtn = document.getElementById(o().editDeactivateBtnId);
      if (deactBtn) {
        deactBtn.disabled = (row.visitor_count || 0) > 0;
        deactBtn.title =
          deactBtn.disabled
            ? 'Cannot deactivate while visits reference this purpose'
            : '';
      }
      if (window.openModal) window.openModal(o().editModalId);
    },

    saveNew: async function (btn) {
      if (!o().canEdit) return;
      var errEl = document.getElementById(o().newErrorId);
      var keyIn = document.getElementById(o().newKeyId);
      var labelIn = document.getElementById(o().newLabelId);
      var key = keyIn ? String(keyIn.value || '').trim().toLowerCase() : '';
      var label = labelIn ? String(labelIn.value || '').trim() : '';
      if (!key) {
        if (typeof window.cosmosFieldError === 'function' && keyIn) {
          window.cosmosFieldError(keyIn, 'Required');
        }
        return;
      }
      if (!label) {
        if (typeof window.cosmosFieldError === 'function' && labelIn) {
          window.cosmosFieldError(labelIn, 'Required');
        }
        return;
      }
      var badgeEl = document.getElementById(o().newBadgeId);
      var sortEl = document.getElementById(o().newSortId);
      if (typeof window.cosmosBtnLoading === 'function' && btn) window.cosmosBtnLoading(btn);
      try {
        await o().post('/api/settings/gatepass-purpose-catalog', {
          purpose_key: key,
          label: label,
          badge_variant: badgeEl ? badgeEl.value : 'gray',
          sort_order: sortEl ? Number(sortEl.value) || 100 : 100,
          is_active: true
        });
        if (window.closeModal) window.closeModal(o().newModalId);
        if (typeof window.cosmosToastSuccess === 'function') {
          window.cosmosToastSuccess('Visit purpose created.');
        }
        await loadCatalog();
        if (typeof window.cosmosGatepassPurposeCacheClear === 'function') {
          window.cosmosGatepassPurposeCacheClear();
        }
      } catch (err) {
        if (errEl) errEl.textContent = err.message || 'Create failed';
        if (typeof window.cosmosToastError === 'function') {
          window.cosmosToastError(err.message || 'Create failed');
        }
        if (typeof window.cosmosBtnDone === 'function' && btn) window.cosmosBtnDone(btn);
        return;
      }
      if (typeof window.cosmosBtnSuccess === 'function' && btn) window.cosmosBtnSuccess(btn);
    },

    saveEdit: async function (btn) {
      if (!o().canEdit || !_editKey) return;
      var errEl = document.getElementById(o().editErrorId);
      var labelIn = document.getElementById(o().editLabelId);
      var label = labelIn ? String(labelIn.value || '').trim() : '';
      if (!label) {
        if (typeof window.cosmosFieldError === 'function' && labelIn) {
          window.cosmosFieldError(labelIn, 'Required');
        }
        return;
      }
      var badgeEl = document.getElementById(o().editBadgeId);
      var sortEl = document.getElementById(o().editSortId);
      var activeEl = document.getElementById(o().editActiveId);
      if (typeof window.cosmosBtnLoading === 'function' && btn) window.cosmosBtnLoading(btn);
      try {
        await o().put(
          '/api/settings/gatepass-purpose-catalog/' + encodeURIComponent(_editKey),
          {
            label: label,
            badge_variant: badgeEl ? badgeEl.value : undefined,
            sort_order: sortEl ? Number(sortEl.value) || 100 : undefined,
            is_active: activeEl ? activeEl.value === '1' : undefined
          }
        );
        if (window.closeModal) window.closeModal(o().editModalId);
        if (typeof window.cosmosToastSuccess === 'function') {
          window.cosmosToastSuccess('Visit purpose saved.');
        }
        await loadCatalog();
        if (typeof window.cosmosGatepassPurposeCacheClear === 'function') {
          window.cosmosGatepassPurposeCacheClear();
        }
      } catch (err) {
        if (errEl) errEl.textContent = err.message || 'Save failed';
        if (typeof window.cosmosToastError === 'function') {
          window.cosmosToastError(err.message || 'Save failed');
        }
        if (typeof window.cosmosBtnDone === 'function' && btn) window.cosmosBtnDone(btn);
        return;
      }
      if (typeof window.cosmosBtnSuccess === 'function' && btn) window.cosmosBtnSuccess(btn);
    },

    deactivate: async function (btn) {
      if (!o().canEdit || !_editKey) return;
      if (!window.confirm('Deactivate this visit purpose? It will be hidden from check-in dropdowns.')) return;
      var errEl = document.getElementById(o().editErrorId);
      if (typeof window.cosmosBtnLoading === 'function' && btn) window.cosmosBtnLoading(btn);
      try {
        await o().del('/api/settings/gatepass-purpose-catalog/' + encodeURIComponent(_editKey));
        if (window.closeModal) window.closeModal(o().editModalId);
        if (typeof window.cosmosToastSuccess === 'function') {
          window.cosmosToastSuccess('Visit purpose deactivated.');
        }
        _editKey = null;
        await loadCatalog();
        if (typeof window.cosmosGatepassPurposeCacheClear === 'function') {
          window.cosmosGatepassPurposeCacheClear();
        }
      } catch (err) {
        if (errEl) errEl.textContent = err.message || 'Deactivate failed';
        if (typeof window.cosmosToastError === 'function') {
          window.cosmosToastError(err.message || 'Deactivate failed');
        }
        if (typeof window.cosmosBtnDone === 'function' && btn) window.cosmosBtnDone(btn);
        return;
      }
      if (typeof window.cosmosBtnSuccess === 'function' && btn) window.cosmosBtnSuccess(btn);
    }
  };
})();

/** Clear client caches so POS/SP reload purpose meta after HQ edit. */
window.cosmosGatepassPurposeCacheClear = function cosmosGatepassPurposeCacheClear() {
  try {
    if (typeof window !== 'undefined') {
      window._spGpPurposeOptions = null;
      if (typeof window.posGatepassPurposeOptions !== 'undefined') {
        window.posGatepassPurposeOptions = null;
      }
    }
  } catch (_) {}
};

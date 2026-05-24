'use strict';

/**
 * Foundry Goods Request — main list view buckets (not per-DB-status tabs).
 * Keys used in GET /api/transfer-requests?view= and UI data-ftr-view.
 */
const TRANSFER_REQUEST_LIST_VIEWS = [
  {
    key: 'need_attention',
    label: 'Need Attention',
    description: 'Pending and approved requests awaiting HQ action',
    statuses: ['SUBMITTED', 'APPROVED']
  },
  {
    key: 'partial',
    label: 'Partial',
    description: 'Partially shipped from HQ',
    statuses: ['PARTIALLY_DISPATCHED']
  },
  {
    key: 'fulfilled',
    label: 'Fulfilled',
    description: 'Latest dispatched, stocked, or HQ-initiated transfers (last 10 by activity)',
    statuses: ['DISPATCHED', 'RECEIVED', 'PARTIALLY_RECEIVED', 'HQ_INITIATED'],
    top_n_default: 10
  }
];

const TRANSFER_REQUEST_LIST_VIEW_KEYS = TRANSFER_REQUEST_LIST_VIEWS.map((v) => v.key);

const DEFAULT_TRANSFER_REQUEST_LIST_VIEW = 'need_attention';

const DEFAULT_LIST_TOP_N = 100;

const HISTORY_DEFAULT_DAYS = 90;

/** History modal — stocked-at-store or rejected only (not in-flight workflow). */
const TRANSFER_REQUEST_HISTORY_COMPLETED_STATUSES = [
  'RECEIVED',
  'PARTIALLY_RECEIVED',
  'REJECTED'
];

function isAllowedTransferRequestListView(key) {
  return TRANSFER_REQUEST_LIST_VIEW_KEYS.includes(String(key || '').trim());
}

function getTransferRequestListViewTopNDefault(viewKey) {
  const key = String(viewKey || '').trim();
  const view = TRANSFER_REQUEST_LIST_VIEWS.find((v) => v.key === key);
  if (view && Number(view.top_n_default) > 0) return Number(view.top_n_default);
  return DEFAULT_LIST_TOP_N;
}

function getTransferRequestListViewsForApi() {
  return {
    views: TRANSFER_REQUEST_LIST_VIEWS,
    default_view: DEFAULT_TRANSFER_REQUEST_LIST_VIEW,
    default_list_top_n: DEFAULT_LIST_TOP_N,
    history_default_days: HISTORY_DEFAULT_DAYS,
    history_completed_statuses: TRANSFER_REQUEST_HISTORY_COMPLETED_STATUSES
  };
}

module.exports = {
  TRANSFER_REQUEST_LIST_VIEWS,
  TRANSFER_REQUEST_LIST_VIEW_KEYS,
  DEFAULT_TRANSFER_REQUEST_LIST_VIEW,
  DEFAULT_LIST_TOP_N,
  HISTORY_DEFAULT_DAYS,
  TRANSFER_REQUEST_HISTORY_COMPLETED_STATUSES,
  isAllowedTransferRequestListView,
  getTransferRequestListViewTopNDefault,
  getTransferRequestListViewsForApi
};

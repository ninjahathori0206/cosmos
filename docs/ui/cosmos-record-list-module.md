# Cosmos Record List + Detail module

Reusable **list + filter + extended detail sheet** for transfer requests and transfer documents across StorePilot and Foundry.

## References

- List rows: StorePilot Incoming Goods (`inc-tr-row` → `.cosmos-record-row`)
- Request detail: Foundry Goods Request overlay (`#ftr-detail-card`)
- Document detail: StorePilot Incoming Goods (`#sp-inc-detail`)
- Mobile shell: [cosmos-mobile-chrome.md](cosmos-mobile-chrome.md)
- Detail shell: [cosmos-extended-detail-panel.md](cosmos-extended-detail-panel.md)

## List layer

| Element | Class / API |
|---------|-------------|
| Page head | `.cosmos-page-head` — sticky on mobile |
| Filters | `.cosmos-page-filters` — horizontal scroll chips; `cosmosFilterTabs.sync(container, activeKey)` |
| List container | `.cosmos-record-list` inside `.card` |
| Row | `.cosmos-record-row.tr-link` — min 56px tap; `cosmosRecordRow.html({...})` |
| Progress subtitle | `.cosmos-record-row__progress` — e.g. remaining to receive |

## Detail layer (extended panel)

| Section | Notes |
|---------|--------|
| Toolbar | Title, meta (badge + date), actions, Close |
| Chips | `.cosmos-extended-detail__chips` |
| Qty summary | `cosmosDetailQtySummary.html` — requested / approved / shipped / stocked / remaining |
| Lines | `.cosmos-detail-table-wrap` — horizontal scroll on mobile |
| Shipments | `GET /api/transfer-requests/:id/shipments` for request detail |

Mobile: bottom sheet via `.cosmos-extended-detail__panel` + `--cosmos-vvh`; body scroll only inside `.cosmos-extended-detail__body`.

## Scripts

Load order: `cosmos-ui-polish.js` → `cosmos-record-list.js`

## Screens

| Screen | List ID | Detail panel |
|--------|---------|--------------|
| SP My Transfer Requests | `#tr-history-wrap` | `#sp-tr-detail` |
| SP shipment stocking (overlay) | — | `#sp-inc-detail` (opened from request shipments) |

### Request detail — Shipments block

- **API:** `GET /api/transfer-requests/:id/shipments` → list of stock transfer docs; row click → `expandIncTransfer(doc_id)`.
- **UI:** `spLoadRequestShipments` in `storepilot-prototype.js` uses `cosmosDetailShipments.html` from **`cosmos-record-list.js`** (required script on StorePilot shell).
- **Visibility:** Shipments section shows when request status is dispatched/received family **or** the shipments API returns at least one doc (handles status drift).
- **Fallback:** If `cosmosDetailShipments` is missing (stale PWA shell), a built-in `<ul>` list still renders doc rows.

### StorePilot PWA (installed app)

- **Service worker:** `/storepilot-sw.js` — `/api/*` is network-only; `/js/*` and `/css/*` are **network-first** (cache updated on success).
- **After deploy:** Users on an old home-screen install may need to clear site data for the origin or remove and re-add **Add to Home Screen**. Standalone mode may auto-refresh when a new service worker activates.
- **Scripts:** `cosmos-record-list.js` must load before `storepilot-prototype.js` (see `StorePilot_Prototype.html`).

### Create Request entry (My Requests)

- **Nav:** sidebar **My Requests** only (no separate Request Goods page).
- **Primary action:** `#sp-tr-create-btn` on page head → `#overlay-sp-create-request` (`.modal--create-request`).
- **Catalogue cart:** **Review & Place Request** → `goToRequestGoods()` opens the same modal.
- **SKU search:** `GET /api/transfer-requests/search-skus?q=` — unit code resolves to SKU only (no unit location / HQ availability gate); HQ qty shown as informational.
- **Deep link:** `/storepilot/transfers-create` → My Requests + modal (requires `storepilot.transfers.create`).
- **Legacy routes:** `/storepilot/incoming-transfers` and `/storepilot/movement-list` redirect to My Requests.
- **Mobile:** 96dvh bottom sheet, grabber, safe-area footer; body scroll locked while open.
- **Mobile (≤768px):** backdrop tap does not close sheet; only SKU results scroll; **Request cart + Notes** pinned below search; fixed destination as header subtitle (field hidden); cart strip always visible (**Cart & notes ↓**).
| Foundry Goods Request | `#ftr-cards-wrap` | `#ftr-detail-card` (requests) / `#ml-detail` (HQ docs) |
| Foundry Goods Request History | `#ftr-history-results` (modal `#overlay-ftr-history`) | `#ftr-detail-card` |

### Foundry Goods Request — workflow tabs

- **Tabs** (from `GET /api/meta/transfer-request-list-views`): Need Attention, Partial, Fulfilled (last **10** by dispatch/receive activity; includes `record_kind: HQ_DOC` rows).
- **HQ Create Transfer:** `#ftr-create-transfer-btn` → `#overlay-ftr-create-transfer` → `POST /api/stock-transfer-docs` (direct dispatch); row appears on Fulfilled tab.
- **List API:** `GET /api/transfer-requests?view=need_attention|partial|fulfilled` (`top_n=10` for fulfilled)
- **History:** `History` button → `#overlay-ftr-history` → `GET /api/transfer-requests/history` (store, dates, request ID, SKU, unit).

## Pencil frames (target)

`StorePilot — My Requests`, `Foundry — Goods Request detail`, `Foundry — Create HQ transfer` (375×812, sheet open).

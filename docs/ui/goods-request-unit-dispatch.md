# Goods Request — unit-code dispatch (Foundry)

**Route:** `/foundry/transfer-requests`  
**Pencil frame:** `FY — Goods Requests`  
**Module:** Store Connect › Goods Request

## Purpose

HQ reviews store transfer requests and, when **APPROVED**, ships warehouse stock in one or more **shipments** (Goods Transfer documents). Dispatch must match **Goods Transfer** unit-barcode rules: unit-tracked product types require `unit_ids`; bulk types use quantity only.

## User flows

### List

- Filter tabs: All, Pending, Approved, **Partial**, Dispatched, Received, Rejected.
- **Approved** tab includes `APPROVED` and `PARTIALLY_DISPATCHED` (open requests).
- Table: #, Store, Requested by, Date (IST), Items, Status, Actions.
- Pending: inline Approve / Reject (with confirm strip, no `alert`).
- Approved: **Preview & Dispatch** opens detail panel.
- Partial: **Dispatch remainder** opens same dispatch panel.
- Loading: skeleton table (no raw "Loading…").

### Approve (SUBMITTED)

- Expand row → line table with **Set approved qty** per SKU (qty only; stores request in SKU quantities).
- Optional review note; Approve / Reject.
- **Reject blocked** after any quantity has been dispatched.

### Dispatch shipment (APPROVED or PARTIALLY_DISPATCHED)

- Banner when partially shipped: *N of M pcs already shipped — scan up to R more in this shipment.*
- **Previous shipments** list: doc #, date (IST), status (from `GET /api/transfer-requests/:id/shipments`).
- Per request line:
  - Requested, approved, **(X sent)** if partial.
  - **This shipment** column: `scanned / remaining` (remaining = approved − already dispatched).
  - Unit codes list with remove per unit.
  - Lines with remaining 0 are omitted from cart.
- **Scan panel:** Open scan bucket ([`cosmos-bucket-scan.md`](cosmos-bucket-scan.md) — TRANSFER mode).
- **Confirm shipment** → creates transfer doc; cumulative `dispatched_qty` on request lines.
- Header status after shipment:
  - `PARTIALLY_DISPATCHED` if any line still short of approved qty.
  - `DISPATCHED` when all lines fully shipped.

### Store (StorePilot)

- `PARTIALLY_DISPATCHED`: label *Partially dispatched*; hint to use **Incoming Goods** per doc; no request-level Confirm Receipt.
- `DISPATCHED` (fully shipped): **Confirm Receipt** available (`PUT` status RECEIVED).

### Read-only states

- SUBMITTED, RECEIVED, REJECTED, fully DISPATCHED (no remainder): readonly line table.

## States

| State | UI |
|-------|-----|
| List loading | Skeleton table in `#ftr-list-wrap` |
| Detail loading | Skeleton rows in `#ftr-detail-body` |
| Shipment empty cart | Validation on confirm |
| Shipment partial scan | Scanned &lt; remaining for line |
| Shipment ready | At least one unit in cart |
| Request PARTIALLY_DISPATCHED | Dispatch remainder + shipments list |
| Error | `cosmosToastError` / inline `#ftr-detail-msg` |

## Copy

- Confirm button: `✓ Confirm shipment (create Goods Transfer)`
- Success (partial): *Shipment #doc created. Dispatch remainder when ready.*
- Success (full): *Shipment #doc — request fully dispatched.*

## API contract

### Shipment dispatch

`PUT /api/transfer-requests/:id/status`

```json
{
  "status": "DISPATCHED",
  "notes": "optional",
  "lines": [{ "line_id": 1, "dispatched_qty": 1, "unit_ids": [101] }],
  "extra_lines": [{ "sku_id": 9, "qty": 1, "unit_ids": [205] }]
}
```

- `dispatched_qty` on each line = **this shipment only** (not cumulative).
- After the transfer document is created, the API runs **`sp_TransferRequest_SyncDispatchedFromDocs`** so line `dispatched_qty` and header status match linked docs (source of truth).
- Response: `{ request_id, status, doc_id, fully_dispatched }` where `status` is `PARTIALLY_DISPATCHED` or `DISPATCHED`.
- If sync fails after doc creation: **422** with `doc_id` and message to use **Reconcile**.

### Reconcile (out-of-sync repair)

`POST /api/transfer-requests/:id/reconcile` — `foundry.transfers.edit`

Re-runs sync from all `stock_transfer_docs` with `source_request_id`. UI: **Sync from documents** on the mismatch banner when shipments exist but summary shows 0 shipped.

Ops script: `node scripts/repair-transfer-request-line-qty.js --request-id=N --sync-dispatched-only`

### Shipments list

`GET /api/transfer-requests/:id/shipments`

**Previous shipments** is always shown on the dispatch panel (not hidden when `dispatched_qty` is 0).

## Design source

- Pencil frame `FY — Goods Requests` — update for Partial tab and remainder banner when using Pencil MCP.

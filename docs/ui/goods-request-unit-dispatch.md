# Goods Request — unit-code dispatch (Foundry)

**Route:** `/foundry/transfer-requests`  
**Pencil frame:** `FY — Goods Requests`  
**Module:** Store Connect › Goods Request

## Purpose

HQ reviews store transfer requests and, when **APPROVED**, dispatches warehouse stock via a Goods Transfer document. Dispatch must match **Goods Transfer** unit-barcode rules: unit-tracked product types require `unit_ids`; bulk types use quantity only.

## User flows

### List

- Filter tabs: All, Pending, Approved, Dispatched, Received, Rejected.
- Table: #, Store, Requested by, Date (IST), Items, Status, Actions.
- Pending: inline Approve / Reject (with confirm strip, no `alert`).
- Approved: **Preview & Dispatch** opens detail panel.
- Loading: skeleton table (no raw "Loading…").

### Approve (SUBMITTED)

- Expand row → line table with **Set approved qty** per SKU (qty only; stores request in SKU quantities).
- Optional review note; Approve / Reject.

### Dispatch (APPROVED) — primary change

- Hint: *Scan each 7-digit unit barcode — camera or wedge. Multiple scans in sequence; no manual qty.*
- Per request line:
  - SKU (mono), description, brand, requested, approved.
  - **Scanned** column: `n / approved` (read-only).
  - **Unit codes** list (mono 7-digit) with remove per unit.
  - **Strict:** every dispatched piece must be a scanned unit; no +/- qty, no server auto-pick.
- **Scan panel:**
  - **Open scan bucket** popup ([`cosmos-bucket-scan.md`](cosmos-bucket-scan.md) — TRANSFER mode, BarcodeDetector/jsQR).
  - Manual unit entry inside bucket (wedge + Enter).
- **Extras:** created only when a scanned unit belongs to a SKU not on the request (same scan flow).
- Note on transfer document (optional).
- **Confirm dispatch** → creates transfer doc; success → link to Movement List.

### Read-only states

- Other statuses: line table without dispatch controls.

## States

| State | UI |
|-------|-----|
| List loading | Skeleton table in `#ftr-list-wrap` |
| Detail loading | Skeleton rows in `#ftr-detail-body` |
| Dispatch empty cart | All lines qty 0, no extras → validation message on confirm |
| Dispatch partial | Some units scanned / qty set |
| Dispatch ready | At least one line or extra with qty > 0 |
| Error | `cosmosToastError` / inline `#ftr-detail-msg` |

## Copy

- Search placeholder: `7-digit unit, SKU, or keyword…`
- Unit-tracked toast: `Scan the 7-digit unit barcode for each piece.`
- Extra unit-tracked from search: `Scan unit barcodes to add this SKU — quantity alone is not enough.`
- Confirm button: `✓ Confirm dispatch (create Goods Transfer)`

## Accessibility

- Scan/search inputs: Enter to submit; `event.stopPropagation()` on panel clicks.
- Buttons use `cosmosBtnLoading` on async confirm.

## API contract (dispatch)

`PUT /api/transfer-requests/:id/status`

```json
{
  "status": "DISPATCHED",
  "notes": "optional",
  "lines": [{ "line_id": 1, "dispatched_qty": 3, "unit_ids": [101, 102] }],
  "extra_lines": [{ "sku_id": 9, "qty": 1, "unit_ids": [205] }]
}
```

Server uses `strictUnitOnly: true` — `unit_ids.length` must equal `dispatched_qty`; no auto-pick.

## Parity reference

- **Goods Transfer** (`page-stock-transfer`): `stInit`, lookup `/api/stock-transfers/lookup`, cart `units[]`, submit `unit_ids`.

## Design source

- Pencil frame `FY — Goods Requests` — update when Pencil MCP is available; implementation follows this spec.

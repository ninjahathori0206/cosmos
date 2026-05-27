# StorePilot — partial transfer receive

Receive a **partial** shipment on one transfer document: save scanned units, stock what was verified, scan more later on the **same** doc until fully stocked.

## Routes

| Surface | Path / frame |
|---------|----------------|
| My Requests → shipment | `/storepilot/transfers-history` → `#sp-inc-detail` |
| Bucket RECEIVE | `#modal-bucket-scan` |

Pencil frames (when synced): `StorePilot / Transfer detail — partial receive`, `StorePilot / Bucket review — partial RECEIVE`.

## Flow

1. Store accepts transfer (**DISPATCHED → ACCEPTED**).
2. **Open bucket** — scan unit barcodes (7-digit).
3. **Review** — shows `N / total verified` and missing list.
4. **Save N scanned** — allowed when `N >= 1` (partial). Merges into detail verification state.
5. **Stock verified (N)** — credits store for verified units only; doc stays **ACCEPTED** if units remain **IN_TRANSIT**.
6. **Scan more units** — reopens bucket for remaining **IN_TRANSIT** units only.
7. When all units stocked → doc **STOCKED**; parent request syncs to **RECEIVED** or **PARTIALLY_RECEIVED**.

## Transfer detail toolbar (ACCEPTED + unit lines)

| Control | When |
|---------|------|
| Open bucket | `verified === 0` |
| Scan more units | `0 < verified < total` |
| Stock verified (N) | `verified >= 1` and not all verified |
| Verify & Stock | all units verified |
| Reset | clears **pending** scans only (not AT_STORE) |

Meta line example: `3 / 10 units verified`.

## Unit row badges

| Badge | Meaning |
|-------|---------|
| Stocked (green) | `unit_status === AT_STORE` |
| Verified (blue) | Scanned this session, not yet stocked |
| Pending (gray) | Not scanned |

## Bucket review (RECEIVE, partial)

| Control | Action |
|---------|--------|
| Scan more units | Return to camera (same session) |
| Save N scanned | Submit partial; label **Save all & close** when complete |

Warn copy: “Save scanned units, or continue scanning.”

## Partial stock confirm

Before API stock when `verified < total`:

> Stock **N** of **M** units now? Remaining units stay on this transfer for later scanning.

## Persistence

- Client: `sessionStorage` key `sp-inc-verify-{docId}` for pending verification until stocked or reset.
- Server: `qty_received` on lines; units `IN_TRANSIT` → `AT_STORE` per stock pass; doc **ACCEPTED** until fully received.

## API / SQL

- `PUT /api/stock-transfer-docs/:id/stock` — `{ lines: [{ line_id, qty_received }] }`
- `sp_StockTransferDoc_Stock` — **ACCEPTED** if any line short or any unit still **IN_TRANSIT**
- `sp_TransferRequest_SyncReceivedFromDocs` — sum `qty_received` from docs **ACCEPTED** or **STOCKED**

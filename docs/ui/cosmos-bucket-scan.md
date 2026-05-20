# Cosmos Bucket Scan — TRANSFER + RECEIVE

Shared popup modal: [`src/public/js/cosmos-bucket-scan.js`](../../src/public/js/cosmos-bucket-scan.js)

Loaded on **Foundry** and **StorePilot** prototypes with `#modal-bucket-scan`.

## Modes (two only)

| Mode | App | Screen | Behaviour |
|------|-----|--------|-----------|
| **TRANSFER** | Foundry | Goods Transfer, Goods Request dispatch | Open scan — any valid warehouse unit via `transferLookupSku` |
| **RECEIVE** | StorePilot | Incoming Goods (ACCEPTED) | Closed list from doc `lines[].units[]` — **reject** scans not on Foundry challan |

**STOCKTAKE** is not implemented.

## RECEIVE rules (strict)

- `expected[]` built from `GET /api/stock-transfer-docs/:id` unit rows.
- Score: `n / m units verified`.
- Unit not on document → error toast, no row, no override.
- Submit bucket when `verified === total`; then **Verify & Stock** uses existing `incStock`.

## TRANSFER rules

- Score: `N units · M SKUs`.
- Submit with ≥1 scanned unit; glue fills Foundry cart (`_ftrApplyBucketResult` / `openGoodsTransferDispatchBucket`).

## Mobile layout (phones / Safari)

- Modal uses class `modal--bucket-scan`: bottom sheet on viewports ≤768px, height from `100dvh` / `visualViewport` (`--cosmos-vvh`, `--cosmos-vv-bottom` in [`cosmos-ui-polish.js`](../../src/public/js/cosmos-ui-polish.js)).
- **Primary actions** (Stop, Review & submit, Back, Submit) live in `#bucket-modal-foot` — fixed above the browser bottom bar with `env(safe-area-inset-bottom)`.
- Scrollable body: camera, score, scanned list, manual entry only.
- Toasts (`cosmosToast*`) appear **below the modal header**, not at the screen bottom (shared polish behaviour).

## Camera

`BarcodeDetector` (QR) → fallback `jsQR.min.js` — same pattern as StorePilot incoming camera (not Html5Qrcode).

## Glue

| Function | File |
|----------|------|
| `openGoodsTransferDispatchBucket` | `foundry-prototype.js` |
| `openGoodsRequestDispatchBucket`, `_ftrApplyBucketResult` | `foundry-prototype.js` |
| `openIncomingTransferBucket`, `_spApplyBucketReceiveResult` | `storepilot-prototype.js` |

## Manual test

1. Foundry Goods Transfer: bucket → dispatch doc → units `IN_TRANSIT`.
2. Foundry Goods Request: bucket → confirm dispatch.
3. StorePilot: Accept → bucket verify all units → Verify & Stock → `STOCKED`.
4. RECEIVE: scan unit **not** on doc → rejected.

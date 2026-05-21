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
- **Scan screen (default):** camera, total count + progress bar, inline `#bucket-scan-status` for errors only, manual entry. Unit code list is **hidden** until **Show QR** is tapped (`#bucket-scanned-list-wrap`).
- **Show QR:** toggles list of scanned unit codes; button shows count when collapsed, e.g. `Show QR (3)`.
- Success adds use one success toast at a time (replaces previous). Duplicate/wrong-unit feedback uses amber flash + inline status (with unit code), not stacked warn toasts.
- **Review screen:** full verified/missing lists unchanged.

## Camera

`BarcodeDetector` (QR) → fallback `jsQR.min.js` — decode throttled ~10 fps. **Tap viewport** to set focus reticle; Android uses `pointsOfInterest` / `single-shot` when supported; iOS uses ROI crop around tap for jsQR. Hint: “Tap on the label to focus”.

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

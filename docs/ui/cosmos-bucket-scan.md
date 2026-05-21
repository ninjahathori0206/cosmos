# Cosmos Bucket Scan — TRANSFER + RECEIVE

Shared popup modal: [`src/public/js/cosmos-bucket-scan.js`](../../src/public/js/cosmos-bucket-scan.js)

Loaded on **Foundry** and **StorePilot** prototypes with `#modal-bucket-scan`.

Styles: [`cosmos-ui-polish.css`](../../src/public/css/cosmos-ui-polish.css) — `#modal-bucket-scan`.

## Entry points

All call `window.openBucket({ mode, expected, onSubmit, ... })`.

| Function | File | Screen |
|----------|------|--------|
| `openGoodsTransferDispatchBucket` | `foundry-prototype.js` | Goods Transfer cart |
| `openGoodsRequestDispatchBucket`, `_ftrApplyBucketResult` | `foundry-prototype.js` | Goods Request dispatch |
| `openIncomingTransferBucket`, `_spApplyBucketReceiveResult` | `storepilot-prototype.js` | Incoming Goods (ACCEPTED) |

## Modes (two only)

| Mode | App | Screen | Behaviour |
|------|-----|--------|-----------|
| **TRANSFER** | Foundry | Goods Transfer, Goods Request dispatch | Open scan — any valid warehouse unit via `transferLookupSku` |
| **RECEIVE** | StorePilot | Incoming Goods (ACCEPTED) | Closed list from doc `lines[].units[]` — **reject** scans not on Foundry challan |

**STOCKTAKE** is not implemented.

## Modal flow (three screens)

1. **Idle** — “Start scanning” button (`#bucket-screen-idle`)
2. **Scan** — live camera, score bar, manual entry, optional scanned list (`#bucket-screen-scan`)
3. **Review** — verified / missing lists, Submit bucket (`#bucket-screen-review`)

Transitions: `openBucket()` → Idle → `bucketStartScanning()` → Scan → `bucketGoReview()` → Review → `bucketSubmit()` closes modal. Stop / Back return to Idle or Scan.

## QR scan vs tap (two different “tap” concepts)

| User action | What it does |
|-------------|--------------|
| **Tap camera viewport** | Sets **focus region** for QR decode — does **not** trigger a one-shot scan |
| **Tap “Show QR (N)”** | Toggles a **text list** of already-scanned unit barcodes (not QR images) |

**Scanning is continuous** while the camera is running (~10 fps), not on tap.

Hint under camera: **“Tap on the label to focus”**.

### Continuous camera decode

When **Start scanning** runs `bucketStartCamera()`:

1. **HTTPS check** — camera blocked on non-secure origins; message in `#bucket-scan-status`
2. **Decoder priority:** native `BarcodeDetector` (QR only) if available; else `/js/jsQR.min.js` on canvas frames
3. **Camera** — rear preferred (`facingMode: environment`), 1280×720 ideal
4. **Loop** — `requestAnimationFrame` every **100ms** (`SCAN_TICK_MS`); each tick → `bucketDecodeFrame()` → `bucketHandleScan(value)` when a code is found

**On success:** green flash, unit added to bucket, score updated, one success toast at a time (replaces previous), **2s debounce** per unit code (`DEBOUNCE_MS`).

**On error / duplicate / wrong unit:** red or amber flash; inline `#bucket-scan-status` (duplicate feedback does not stack warn toasts).

### Tap on viewport = focus ROI (not scan trigger)

`pointerdown` on `#bucket-scan-viewport` → `bucketApplyTapFocus()`:

1. **Visual** — brief focus reticle at tap point (`#bucket-focus-reticle`, ~900ms)
2. **Android** — `pointsOfInterest` + `focusMode: single-shot` on video track when supported
3. **jsQR path (often iOS)** — decode uses **42% ROI crop** centered on tap (`ROI_SIZE = 0.42`) instead of full frame

**ROI fallback** in `bucketDecodeFrame()`:

- ROI set → decode cropped region first
- **12 consecutive misses** → clear ROI, fall back to full-frame decode
- Native `BarcodeDetector` ignores ROI (full-frame only)

Tap does **not** call `bucketHandleScan()` — it only narrows where the continuous loop looks and helps autofocus.

### “Show QR” button (scanned list, not camera)

`bucketToggleScannedList()` toggles `#bucket-scanned-list-wrap`:

- **Collapsed by default** on mobile
- Button: `Show QR` → `Show QR (3)` → `Hide QR`
- List shows **7-digit unit barcodes** as text rows, not rendered QR images
- Duplicate scan while list open → row pulse + scroll into view

For reviewing what was already scanned, not for scanning new codes.

## Manual entry

- `#bucket-manual-input` + Enter or **Add**
- Same `bucketHandleScan()` path as camera
- Works with wedge/USB scanners that type + Enter

## RECEIVE rules (strict)

- `expected[]` built from `GET /api/stock-transfer-docs/:id` unit rows.
- Score: `n / m units verified`.
- Unit not on document → error, no row, no override.
- Submit bucket when `verified === total`; then **Verify & Stock** uses existing `incStock`.

## TRANSFER rules

- Score: `N units · M SKUs`.
- Submit with ≥1 scanned unit; glue fills Foundry cart (`_ftrApplyBucketResult` / `openGoodsTransferDispatchBucket`).

## Mobile layout (phones / Safari)

- Modal uses class `modal--bucket-scan`: bottom sheet on viewports ≤768px, height from `100dvh` / `visualViewport` (`--cosmos-vvh`, `--cosmos-vv-bottom` in [`cosmos-ui-polish.js`](../../src/public/js/cosmos-ui-polish.js)).
- **Primary actions** (Stop, Review & submit, Back, Submit) live in `#bucket-modal-foot` — fixed above the browser bottom bar with `env(safe-area-inset-bottom)`.
- **Scan screen (default):** camera, total count + progress bar, inline `#bucket-scan-status` for errors only, manual entry. Unit code list hidden until **Show QR** is tapped.

## Script version

Load with cache-bust on prototype HTML, e.g. `cosmos-bucket-scan.js?v=20260521-bucket-syntax` (syntax fix in commit `74f3d3b` — missing parenthesis blocked `openBucket`).

## Common failure scenarios

| Symptom | Likely cause |
|---------|----------------|
| “Scan bucket is not loaded” | `cosmos-bucket-scan.js` failed to parse/load — hard-refresh browser |
| Tap does nothing visible | Camera not started (still on Idle screen) |
| Tap but QR still hard to read | iOS: ROI only helps jsQR; BarcodeDetector ignores ROI — hold steady or use manual entry |
| Duplicate scans ignored | 2s cooldown per unit code |
| RECEIVE rejects valid-looking code | Unit not on HQ dispatch document `expected[]` |

## Manual test

1. Foundry Goods Transfer: bucket → dispatch doc → units `IN_TRANSIT`.
2. Foundry Goods Request: bucket → confirm dispatch.
3. StorePilot: Accept → bucket verify all units → Verify & Stock → `STOCKED`.
4. RECEIVE: scan unit **not** on doc → rejected.
5. Tap viewport → reticle appears; jsQR decode prefers tap region.
6. Show QR → list of scanned unit codes; Hide QR → camera primary again.

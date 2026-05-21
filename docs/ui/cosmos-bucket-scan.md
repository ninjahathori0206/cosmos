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
| **TRANSFER** | Foundry | Goods Transfer, Goods Request dispatch | Scan warehouse unit via tap or manual entry |
| **RECEIVE** | StorePilot | Incoming Goods (ACCEPTED) | Closed list from doc `lines[].units[]` — reject scans not on Foundry challan |

## Modal flow (three screens)

1. **Idle** — “Start scanning”
2. **Scan** — live camera preview, static QR frame, tap to scan, manual entry, Show QR list
3. **Review** — submit bucket

## Camera viewport (tap to scan)

| Element | Behaviour |
|---------|-----------|
| Moving blue line | **Removed** (was misleading laser-scanner UX) |
| Static corner frame | `.bucket-scan-frame` — four brackets, no animation |
| Focus reticle | `#bucket-focus-reticle` — visible ~900ms **only on tap** |
| Hint | **“Aim QR in frame · tap to scan”** |

### Tap = one scan attempt

While the camera is on, the feed is **preview only** — nothing is decoded until the user **taps** the viewport.

`pointerdown` on `#bucket-scan-viewport` → `bucketTapToScan()`:

1. Focus reticle + ROI at tap (`bucketApplyTapFocus`)
2. Android autofocus (`pointsOfInterest` / `single-shot`) when supported
3. **One** `bucketDecodeFrame()` — ROI crop first (jsQR), then full frame if needed
4. If code found → `bucketHandleScan()`; else inline `No QR detected — tap again`

Tap debounce: **400ms** (`TAP_DEBOUNCE_MS`). Per-unit cooldown: **2s** (`DEBOUNCE_MS`).

Native `BarcodeDetector` (when available): single full-frame detect on each tap.

### “Show QR” button

Toggles text list of scanned unit barcodes (not QR images). Collapsed by default on mobile.

## Manual entry

- `#bucket-manual-input` + Enter or **Add**
- Same `bucketHandleScan()` as a successful camera tap
- Wedge/USB scanners supported

## Script version

`cosmos-bucket-scan.js?v=20260521-tap-scan`

## Manual test

1. Start scanning — no moving line; corner frame visible.
2. Point at QR **without tap** — bucket count unchanged.
3. **Tap** on QR — unit added or duplicate/status message once.
4. Manual entry still works.
5. Show QR lists scanned codes.

# Cosmos Bucket Scan — TRANSFER + RECEIVE

Shared popup modal: [`src/public/js/cosmos-bucket-scan.js`](../../src/public/js/cosmos-bucket-scan.js)

Loaded on **Foundry** and **StorePilot** prototypes with `#modal-bucket-scan`.

Styles: [`cosmos-ui-polish.css`](../../src/public/css/cosmos-ui-polish.css) — `#modal-bucket-scan`.

**Stacking:** CSS variables in `cosmos-ui-polish.css`: `--cosmos-z-detail-backdrop` (240), `--cosmos-z-detail-panel` (250), `--cosmos-z-bucket-overlay` (400, above shell `.overlay` 300). Extended detail and bucket layers are portaled to `document.body` (`cosmosOpenExtendedDetail`, `bucketModalOpen`) so StorePilot’s `overflow:hidden` `.main` does not trap them. Opening a shipment transfer detail closes the request sheet first. Do not close the transfer detail before bucket submit — receive state lives in that panel.

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

## Mobile back (blocked on phone / PWA)

On **mobile browsers and installed PWA** (`cosmos-ui-polish.js`), the **system/hardware Back** gesture is **blocked app-wide**. It does not change routes, close the bucket, or stop the camera.

| Back type | Mobile / PWA | Desktop |
|-----------|--------------|---------|
| Hardware / browser Back | No effect (history trap) | Normal route back |
| In-app buttons (✕, footer Back, detail close, nav) | Works | Works |

Use **modal close**, **Scan more units**, and **Save** — not the Android back key — while scanning.

## Script version

`cosmos-bucket-scan.js?v=20260528-partial-receive` · `cosmos-ui-polish.js?v=20260528-mobile-back-block`

## Manual test

1. Start scanning — no moving line; corner frame visible.
2. Point at QR **without tap** — bucket count unchanged.
3. **Tap** on QR — unit added or duplicate/status message once.
4. Manual entry still works.
5. Show QR lists scanned codes.
6. **Foundry request dispatch:** With Request details open, tap **Open bucket** — bucket appears on top (do not close detail). Scan → Submit → **Confirm shipment** without reopening the request.
7. **Mobile:** Open bucket → start camera → press hardware Back several times — still on scan screen; use ✕ or Save to leave.

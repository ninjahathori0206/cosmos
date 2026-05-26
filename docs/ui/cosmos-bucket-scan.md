# Cosmos Bucket Scan — TRANSFER + RECEIVE

Shared popup modal: [`src/public/js/cosmos-bucket-scan.js`](../../src/public/js/cosmos-bucket-scan.js)

Loaded on **Foundry**, **StorePilot**, and **POS** prototypes with `#modal-bucket-scan`.

Styles: [`cosmos-ui-polish.css`](../../src/public/css/cosmos-ui-polish.css) — `#modal-bucket-scan`.

**Stacking:** The bucket opens as a stacked overlay (`z-index: 260`) above extended detail panels (request / transfer details at 240–250). Do not close the request before scanning — dispatch cart state lives in the open detail panel.

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
2. **Scan** — live camera preview, static QR frame, tap to focus / scan, manual entry, optional torch, Show QR list
3. **Review** — submit bucket

## Camera (native-like, per device)

On stream start, `bucketProbeDeviceCamera()` reads `track.getCapabilities()` and builds a **device profile**: best rear resolution, continuous AF at preview, tap `single-shot` + `pointsOfInterest`, optional zoom/torch.

| Phase | Behaviour |
|-------|-----------|
| **Start** | `getUserMedia` (environment) → continuous/autofocus → warm-up ~600ms |
| **Tap (pointerup)** | POI at tap (clamped 0.05–0.95) → tap focus mode → macro zoom on **all mobile** when supported → settle 1–2s → **Scanning…** loop |
| **Decode** | `ImageCapture.grabFrame()` when available, else video frame; ROI jsQR + BarcodeDetector; **2×/3× ROI upscale**; full frame without downscale when width ≤ 1280px; mobile `BarcodeDetector` on live video each tick |
| **Torch** | `#bucket-torch-btn` when `caps.torch` / flash supported |
| **Background** | `bucketScheduleCameraResume` restarts stream when modal still scanning |

Hint: **“Aim at QR · tap to focus · release to scan”**

Tap debounce: **400ms**. Per-unit cooldown: **2s**.

### Small frame QRs (15×15 labels)

Eyewear labels use a ~10 mm QR ([`qr-15x15-label.md`](qr-15x15-label.md)). If camera decode fails, use **manual 7-digit entry** — same `bucketHandleScan()` path.

## Manual entry

- `#bucket-manual-input` + Enter or **Add**
- Same `bucketHandleScan()` as a successful camera tap
- Wedge/USB scanners supported

## Script version

`cosmos-bucket-scan.js?v=20260526-native-camera-profile`

## Manual test

1. Start scanning — corner frame visible; hint shows tap-to-focus copy.
2. Point at QR **without tap** — bucket count unchanged.
3. **Tap and release** on QR on **Android Chrome** and **iPhone Safari** — wait Focusing → Scanning; unit added or duplicate message (not persistent “No QR detected”).
4. Manual entry of same 7 digits works.
5. Torch button appears only when device supports it.
6. Background app → return — camera resumes without console errors.
7. **Foundry request dispatch:** bucket on top of request detail; scan → submit without closing detail.

# Print labels — operator guide

**Where:** Foundry → open a purchase → **Digitisation** or **Warehouse** stage → SKU table  
**Modal:** Print labels (`#modal-barcode-print`)

## Before you start

- SKUs must already be generated (you see barcode / unit numbers on the purchase).
- Choose which products need labels using the **checkboxes** on the table.

## Steps (simple)

1. **Select products** — tick the rows you want, or use **Print all labels** for every SKU on the purchase.
2. **Choose label type** — pick the sticker size that matches your roll (Large roll is the usual default).
3. **Check the preview** — on the right, confirm the QR and text look right. Each QR encodes **only** the 7-digit unit barcode (numeric, compact QR settings).
4. **Print**
   - Click **Connect label printer** once if you use the USB sticker printer.
   - Click **Print now**.

You do **not** need to change numbers in “Advanced printer settings” unless your IT team asks you to.

## Buttons on the purchase screen

| Button | Meaning |
|--------|---------|
| **Print labels (selected)** | Only checked rows |
| **Print all labels** | Every SKU on this purchase |

## Label types (presets)

| Choose this | When to use |
|-------------|-------------|
| **Large roll label** | Standard shelf / box stickers (about 40×28 mm) |
| **Small sticker** | One 15×15 sticker per row with brand + price (eyewear) |
| **15×15 continuous roll** | **6 stickers per row** on 109 mm roll — same layout as mockup: QR, vertical unit number, brand/price footer |
| **Frame wrap strip** | Long strip wrapped on spectacle frames |

## If the printer is not connected

- Cosmos can still print using your **browser print** window — follow the prompts.
- USB printer: plug in, click **Connect label printer**, allow the browser permission once.

## If something looks wrong

- Wrong sticker size → change **Choose label type** and check preview again.
- Missing QR → SKU has no **7-digit unit barcode**; run unit backfill or re-generate SKUs, then try again. Labels without a valid 7-digit code are skipped (QR never falls back to PID or SKU text).
- Blank dropdown → wait a moment; built-in sizes load even if the server is slow.

## For managers / IT only

- **Advanced printer settings** — margins, TSPL, calibration (hidden by default).
- **Save changes for everyone** — updates the org preset (needs permission).
- Technical layout spec: zones will move to `zones_json` in a future release; screen preview uses mm, converted to pixels at 96 dpi (`px = mm × 3.7795`).

## Permissions

- Print: same as viewing the purchase (digitisation / warehouse / branding, etc.).
- Change saved label types: **Label print formats — Edit** in Command Unit.

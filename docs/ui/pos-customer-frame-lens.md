# Store OS — Lenses on customer-owned frame

## Purpose

Sell **prescription lens packages** when the customer brings their **own eyeglass frame** (not a store SKU / no unit barcode). Lab receives a **photo of the physical frame** for identification.

## Entry

- **Cart:** `+ Lenses on customer frame` (below line items) — adds virtual SKU and opens lens wizard.
- Requires **`pos.customer_frame_sku_id`** in app settings (Foundry virtual product, type `CUSTOMER_FRAME`).
- Virtual SKU **`sale_price` should be ₹0** — the bill is lens package + add-ons only; the customer-owned frame is not sold as inventory.

## Flow

1. Link **Cx** on cart (required at checkout as today).
2. Tap **+ Lenses on customer frame**.
3. Lens wizard: power type → package → **Step 2 Add power**:
   - **Frame photo** (required): camera or gallery, max 8 MB, jpg/png/webp/heic.
   - Optional **Frame note** (brand/model).
   - Patient chooser + power mode (same as standard lab lines).
4. Confirm → line is **LAB** with `lens_bundle`; cart shows **Customer's frame**, photo thumb, lens package.
5. Checkout — no 7-digit unit scan for this line type.

## Pencil frames (target)

| Frame | Route |
|-------|-------|
| `Store OS Cart · /storeos/cart · Customer frame lab line` | `/storeos/cart` |
| Lens wizard Step 2 — customer frame photo block | `/storeos/lens-config` |

## API

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/pos/customer-frame-product` | Resolves virtual SKU from `pos.customer_frame_sku_id` |
| POST | `/api/pos/customer-frame-photo` | Multipart `frame_photo` → `/uploads/customer-frames/...` |

Order lines include `customer_frame_photo_url`, `customer_frame_note` when `product_type` is `CUSTOMER_FRAME`.

## Lab / StorePilot

Lab orders list and order detail (`GET /api/orders/:id`) expose frame photo URL on matching line items — thumbnail link for handover.

## Config (Command Unit)

**Product type `CUSTOMER_FRAME`:** LAB fulfillment, lens wizard **REQUIRED**, unit scan **off**, qty 1 only. Seeded in migration `89_customer_frame_lens.sql`.

## Empty / error states

| State | UX |
|-------|-----|
| SKU not configured | Toast: configure virtual SKU + app setting |
| Photo missing at confirm | `cosmosToastWarn` — photo required |
| Upload fail | `cosmosToastError` |

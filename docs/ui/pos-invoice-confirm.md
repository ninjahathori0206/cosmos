# POS Invoice — Confirm Screen & Invoice Template

**Feature:** Invoice generation on order completion  
**Pencil frames:** `Order Creation - Confirmation (Instant · Invoice) · /pos/confirm` and `Order Creation - Confirmation (Lab/Mixed · No Invoice Yet) · /pos/confirm`  
**Status:** Awaiting design approval

---

## Scope

This document covers two related surfaces:

1. **Confirm screen** — the page shown after payment succeeds; split into Instant and Lab/Mixed variants
2. **Invoice template** — the HTML document rendered in the preview iframe (used for View Invoice, Reprint, Email)

---

## Confirm Screen — INSTANT Order (invoice ready)

Shown when `order_kind = INSTANT` and full payment has been collected.

### Layout

```
✓  Order placed!
   Order #EW-ORD-1005
   [  Invoice  EW-INV-2526-S1-00001  ]   ← blue pill badge

┌──────────────────────────────────────┐
│  Amount paid                         │
│  ₹4,462                              │  ← green
│  Paid via UPI · Ref: HDFC2345        │
│  ────────────────────────────────    │
│  Tax Invoice: EW-INV-2526-S1-00001   │
└──────────────────────────────────────┘

Order Breakdown
┌─────────────────────────┐
│ ⚡ Instant Pickup        │
│ 1 frame · Hustlr Z      │
│ Pickup now from Store   │
└─────────────────────────┘

▼ Invoice Details  [optional]      ∧
┌──────────────────────────────────────┐
│ Bill name                            │
│ [  Ravi Kumar                     ]  │  ← auto-filled from customer profile
│                                      │
│ GSTIN (optional)                     │
│ [  27AAABBBCCCC1Z5               ]  │
│                                      │
│ Billing address (optional)           │
│ [  Building, Street, City, PIN    ]  │
│                                      │
│ Notes (optional)                     │
│ [  e.g. For office use            ]  │
└──────────────────────────────────────┘

[ 💬 WhatsApp ]  [ 🧾 View Invoice ]  [ 📧 Email ]  [ ＋ New Order ]
```

### Behaviour

- **Invoice badge**: shown only when `invoice_no` is returned by the payment API
- **Invoice Details panel**: collapsed by default; user taps header to expand
  - `bill_name` auto-filled from customer profile `full_name`; "Walk-in Customer" if no profile
  - All fields optional; filled values are read when "View Invoice" is tapped
- **View Invoice button**: opens `overlay-pos-invoice-preview` iframe with full invoice HTML
  - Reads current billing form values before rendering
  - Enabled only when `invoice_no` exists
- **Email button**: calls `POST /api/pos/orders/:id/email-invoice`
  - Enabled only when customer has a valid email on file
- **WhatsApp button**: enabled only when customer phone ≥ 10 digits
- **New Order**: resets POS session to catalogue

---

## Confirm Screen — LAB / MIXED Order (no invoice yet)

Shown when `order_kind = LAB` or `MIXED` (invoice is deferred to handover).

### Layout

```
✓  Order placed!
   Order #EW-ORD-1006

┌──────────────────────────────────────┐
│  Advance paid                        │
│  ₹1,900                              │  ← amber/gold
│  Paid via Cash · Balance ₹2,562 due  │
└──────────────────────────────────────┘

Order Breakdown
┌─────────────────────────┐
│ 🚚 Lab Order             │
│ 1 frame · Air + Lenses  │
│ Estimated: 25 May 2026  │
└─────────────────────────┘

ℹ Tax invoice will be issued when the order is fully
  delivered and handed over.

[ 💬 WhatsApp ]  [ ＋ New Order ]
```

### Behaviour

- No billing panel
- No "View Invoice" or "Email Invoice" buttons
- Blue info notice replaces invoice section
- WhatsApp sends the standard order confirmation message (no invoice number yet)

---

## Invoice Template Sections

### Header (left)

```
EYEWOOT RETAIL PVT. LTD.      ← pos_firm_name  (18px 800)
GSTIN: 27AAAAA0000A1Z5        ← pos_firm_gstin
123, MG Road, Mumbai 400001   ← pos_firm_address
━━━━━━━━━━━━━━━━━━━━━━━━━━
Store: Bandra Outlet           ← store_name from session
Shop 5, Linking Road, Bandra  ← pos_store_address
```

### Header (right)

```
TAX INVOICE  (or RETAIL INVOICE if composition_scheme = true)
No.  EW-INV-2526-S1-00001
Order ref.  EW-ORD-1005
Date  20 May 2026, 14:32 IST    ← pos_invoices.invoice_date
```

### Bill To

```
Bill To
  Ravi Kumar                  ← invoice_prefs.bill_name
  GSTIN: 27BBBB...            ← only if provided
  [billing_address]           ← only if provided
  Notes: ...                  ← only if provided
```

Fallback: "Walk-in Customer" if no bill_name

Customer phone NOT shown.

### Line Items

| Description | Qty | Amount (₹) |
|-------------|-----|------------|
| Frame XYZ (SKU-001) | 1 | 3,500.00 |
| Single Vision Lenses `Lab` | 1 | 1,250.00 |

Lab items tagged with blue "Lab" pill.  No HSN codes (deferred).

### Prescription (LAB orders only; skip if both OD+OS plano)

```
Prescription
         SPH     CYL    AXIS
OD (R)  -2.00  -0.50   180°
OS (L)  -1.75  -0.25   175°
PD: 64mm    Doctor: Dr. Sharma
```

Source: `pos_orders.rx_snapshot`

### Totals (smart GST)

```
Catalogue subtotal    ₹X,XXX
Discount            − ₹XXX
Taxable value         ₹X,XXX
CGST @ 2.5%           ₹XXX    ← if intra-state or no customer GSTIN
SGST @ 2.5%           ₹XXX
  — or —
IGST @ 5%             ₹XXX    ← if customer GSTIN first 2 chars ≠ pos_state_code
Grand Total           ₹X,XXX
```

Composition scheme: no GST lines; title is "RETAIL INVOICE".

### Payment History

```
Payments Received
  ADVANCE   ₹1,900  Cash — Counter         20 May 2026
  BALANCE   ₹2,562  Card · Ref: AXIS9876   25 May 2026
  Total Received: ₹4,462
```

### Delivered On (lab only)

```
Delivered on: 25 May 2026  ← pos_invoices.invoice_date
```

### Signatures

```
Customer sign. ___________     For [Store Name]
                                Authorised signatory ___________
```

### Footer

```
[pos_invoice_return_policy configurable text]
Computer-generated document · Review GST with your CA · Eyewoot / Cosmos ERP
```

### Cancelled Watermark

When `pos_invoices.status = 'CANCELLED'` — red diagonal "CANCELLED" text overlaid.

---

## Order History — Invoiced Tabs

Two tabs replace the single `INVOICED_7` tab:

| Tab label | `data-pos-order-status` | Backend filter |
|-----------|------------------------|----------------|
| Invoiced Today | `INVOICED_TODAY` | `JOIN pos_invoices WHERE CAST(invoice_date …) = IST_today` |
| Invoiced (Last 7) | `INVOICED_7` | `JOIN pos_invoices WHERE invoice_date >= IST_7_days_ago` |

Order detail modal for invoiced orders — extra buttons:
- **Reprint Invoice** — editable billing panel, saves to `pos_invoices.invoice_display_json`
- **Email Invoice** — `POST /api/pos/orders/:id/email-invoice`
- **WhatsApp Invoice** — deeplink with invoice number

---

## Command Unit — POS Invoice Settings

New panel under Settings:

- **Firm Identity**: firm name, GSTIN, registered address, store address, state code (2-digit)
- **Email / SMTP**: host, port, user, password (masked), from address; "Test Email" button
- **Return Policy**: `<textarea>` pre-filled with "7-day frame exchange · No cash refund · Prescription verification within 3 days"

Save: `PUT /api/settings/pos-invoice-firm`  
Access: any Command Unit user

# Store OS — Payment screen context header

## Purpose

Cashiers always see **who** they are billing, **which order** (if created), and **how much is still due** while on the payment screen — including after a failed first payment when the bill is saved as **Payment pending**.

## Pencil frame

`Store OS Payment · /storeos/payment` in `pencil-new.pen`

## Layout

Context card sits below **‹ Cart** back link, above delivery mode card.

| Field | Element ID | Pre-create (`pendingCheckout`) | Existing order / resume |
|-------|------------|-------------------------------|-------------------------|
| Order | `pay-order-no` | **New checkout** | `EW-ORD-n` |
| Customer | `pay-customer-name` | Selected Cx name or Walk-in | Order customer name |
| Balance due | `pay-balance-due` | Cart total (or full bill) | `payment_summary.amount_remaining` |

## States

### Default (new checkout)

- Yellow info banner: order created on Pay; failed pay → Payment pending in Orders.
- Balance due = cart total.

### Payment failed (order saved)

- Toast: payment could not be collected; order no saved as Payment pending.
- Context card shows real order no + balance.
- Pay retry uses `POST /api/pos/payment`.

### Resume from Orders

- Same as existing order path; `resumePosOrderPayment` loads detail and opens payment screen.

## Accessibility

- Context card: `aria-label="Checkout context"`.
- Values use strong weight; labels uppercase 11px.

## Copy

- Display status in order list: **Payment pending** (not Unpaid).
- Void path unchanged: zero-payment OPEN bills → Void bill.

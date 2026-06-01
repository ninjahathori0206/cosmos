# POS — draft-until-pay and payment-pending orders

Store OS does **not** persist an order when the cashier taps **Proceed** and then **Back** from payment (in-memory `pendingCheckout` only).

When the cashier taps **Pay** and payment **fails validation**, the order **is kept** as `OPEN` with zero (or partial) payments — surfaced in **Orders → Active** as **Payment pending**.

## Payment-fail retention (`checkout-and-pay`)

Flow in [`checkoutAndPay`](../src/services/orderService.js):

1. **Transaction A:** create order (`OPEN`), commit stock + unit barcodes.
2. **Transaction B:** validate and insert payment.
3. If step 2 fails → order remains; API returns **422** with `payment_failed: true` and `data.order_id` / `order_no`.

Store OS shows a warning toast and stays on the payment screen so staff can retry or find the bill under **Orders → Active**.

Post-success side effects (offer usage, coins, membership grant) run **only** after payment succeeds.

## Display labels

Rows such as **EW-ORD-1001** stay `status = OPEN` until paid or voided. The API exposes:

- `is_unpaid`, `amount_remaining`, `amount_paid`
- `display_status_label` → **Payment pending** (when `OPEN` and underpaid)
- `display_status_css_class` → `payment-pending`

Labels come from [`src/config/posOrderDisplayCatalog.js`](../src/config/posOrderDisplayCatalog.js).

## Order list tabs (queue)

Tabs are defined in [`src/config/posOrderQueueCatalog.js`](../src/config/posOrderQueueCatalog.js). Each tab sends `GET /api/pos/orders?queue=<KEY>` for the logged-in store.

| Tab | `queue` | Behaviour |
|-----|---------|-----------|
| **Active** | `ACTIVE` | Zero-payment / underpaid `OPEN` bills, `INSTANT` `OPEN`, lab rows not in other queues |
| **Transit** | `TRANSIT` | Send to lab + send to store statuses; requires payment collected |
| **LAB** | `LAB_AT_HQ` | HQ fitting / QC stages |
| **Ready for HandOver** | `HANDOVER` | `READY_FOR_DELIVERY` through pre-invoice handover |
| **Invoiced (Last 7)** | `INVOICED_7` | `INVOICED` within last 7 IST days |

**Global search:** `GET /api/pos/orders?q=...&search_scope=all` — matches order no, customer name, or phone across all stores.

## Endpoints

### `POST /api/pos/checkout-and-pay` (Store OS Pay)

Creates the order, then attempts the first payment.

**On success:** `200` with `order_id`, `order_no`, `payment_summary`, optional `invoice_no`.

**On payment failure (order saved):** `422` with:

```json
{
  "success": false,
  "payment_failed": true,
  "message": "Minimum advance is …",
  "data": {
    "order_id": 123,
    "order_no": "EW-ORD-…",
    "total_amount": 2300,
    "amount_remaining": 2300,
    "payment_summary": { … }
  }
}
```

### `POST /api/pos/orders` (legacy / tooling)

Creates an `OPEN` order without payment. Still used by integrations.

### `POST /api/pos/payment`

Records payment on an existing order (resume / retry after payment pending).

### `POST /api/pos/orders/:id/void-unpaid`

Voids a **zero-payment** `OPEN` bill: `CANCELLED`, restores stock and units.

## Payment screen context

See [`docs/ui/pos-payment-context-header.md`](ui/pos-payment-context-header.md) — order no, customer name, balance due on `/storeos/payment`.

## Related

- `pos_checkout_drafts` — per-staff **cart** resume JSON, not the store-wide unpaid list.
- CX customer detail refreshes live stats via `GET /api/cx/customers/:id/summary`.

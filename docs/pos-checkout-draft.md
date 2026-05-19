# POS — draft-until-pay and unpaid orders

Store OS checkout no longer persists `pos_orders` when the cashier taps **Proceed** and then **Back** from payment. Orders are created atomically with the first successful payment.

## Why a legacy bill still shows `OPEN` in the database

Rows such as **EW-ORD-1001** were inserted by the old flow (`POST /api/pos/orders` on Proceed). The persisted column `status` remains **`OPEN`** until the bill is paid or voided. Store OS does **not** change that column for underpaid bills; instead the API exposes:

- `is_unpaid`, `amount_remaining`, `amount_paid`
- `display_status_label` → **Unpaid** (when `OPEN` and underpaid)
- `display_status_css_class` → `unpaid`

Labels come from [`src/config/posOrderDisplayCatalog.js`](../src/config/posOrderDisplayCatalog.js).

## Order list tabs (queue)

Tabs are defined in [`src/config/posOrderQueueCatalog.js`](../src/config/posOrderQueueCatalog.js). Each tab sends `GET /api/pos/orders?queue=<KEY>` for the logged-in store.

| Tab | `queue` | Behaviour |
|-----|---------|-----------|
| **Active** | `ACTIVE` | Zero-advance unpaid `OPEN` bills, `INSTANT` `OPEN`, and lab rows not in other queues |
| **Transit** | `TRANSIT` | Send to lab + send to store statuses; requires payment collected |
| **LAB** | `LAB_AT_HQ` | HQ fitting / QC stages |
| **Ready for HandOver** | `HANDOVER` | `READY_FOR_DELIVERY` through pre-invoice handover |
| **Invoiced (Last 7)** | `INVOICED_7` | `INVOICED` within last 7 IST days |

**Global search:** `GET /api/pos/orders?q=...&search_scope=all` — matches order no, customer name, or phone across all stores (no tab filter). Tabs remain store-scoped when the search box is empty.

## Endpoints

### `POST /api/pos/checkout-and-pay` (preferred for Store OS)

Creates the order and records the first payment in one database transaction.

**Auth:** `pos.orders.create` and `pos.payment.collect` (same as proceeding to pay).

**Body:**

```json
{
  "order": { /* same shape as POST /api/pos/orders */ },
  "payment": {
    "stage": "FULL | ADVANCE | BALANCE",
    "method": "UPI | CARD | CASH | NONE",
    "amount": 0,
    "tendered": null,
    "external_ref": null
  }
}
```

`payment` must not include `order_id`; the server sets it after insert.

**Response:** `data` includes `order_id`, `order_no`, totals, `payment_summary`, and optional `invoice_no`.

### `POST /api/pos/orders` (legacy)

Still available for tooling and integrations that create an OPEN order before payment. Store OS UI uses **checkout-and-pay** for new checkouts. Going back from payment after **Proceed** does not leave an unpaid row when using the new flow.

### `POST /api/pos/payment`

Records a payment on an existing order. Used when resuming an unpaid order (subsequent payments). **Creator-only:** `created_by_user_id` must match JWT `user_id` / `employee_id` unless the actor is `super_admin`.

### `GET /api/pos/orders?draft=1` (alias `unpaid=1`)

Lists store-visible **OPEN** orders where total payments are less than `total_amount` (minus epsilon). Rows include `created_by_user_id`, `amount_paid`, `amount_remaining`, `is_unpaid`, and display status fields.

### `GET /api/pos/orders/:id`

Includes `can_mutate`, `is_mine`, `created_by_user_id`, and display status on `order`.

### `POST /api/pos/orders/:id/void-unpaid`

Voids a **zero-payment** `OPEN` orphan: sets `status` to **`CANCELLED`**, restores store stock and unit barcodes when inventory was committed at order create.

**Auth:** `pos.orders.void_unpaid` (falls back to `pos.orders.create` for migration).

**Rules:** creator-only (or `super_admin`); rejects if any payment exists or `paid_total > 0`.

### `POST /api/pos/orders/:id/status`

Lab workflow updates. Same **creator-only** rule as payment (with `super_admin` bypass).

## Ownership

- Orders store `created_by_user_id` on insert.
- Staff JWT from `POST /api/pos/staff-login` sets `user_id` / `employee_id` to the matched staff user id.
- Rows with **NULL** `created_by_user_id` cannot be mutated by non–super-admin users until data is repaired.

## Related

- `pos_checkout_drafts` remains a **per-staff cart resume** table, not the store-wide unpaid list.
- One-time repair for duplicate order numbers: `sql/maintenance/sync_pos_order_seq_from_orders.sql`.

## Clearing EW-ORD-1001

1. Hard-refresh Store OS (cache-busted `pos.js`).
2. Open **Orders → Unpaid / drafts** — bill shows **Unpaid**.
3. If you created the bill, tap **Void bill** (or use `POST /api/pos/orders/:id/void-unpaid`).
4. Re-assign `pos.orders.void_unpaid` in Command Unit if the button is missing after deploy.

Do not set `CANCELLED` manually in SQL unless stock/units were already restored.

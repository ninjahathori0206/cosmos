# POS — Mandatory customer at checkout

## Purpose

Every new POS order must be linked to a real `pos_customers` row. Walk-in is no longer a default/prelinked session state; staff may build a cart first, but cannot proceed to payment without selecting or creating a customer.

## User flow

1. Staff adds products to cart (customer optional until checkout).
2. Cart sidebar shows **Customer required at checkout** with **Select customer** when none linked.
3. **Proceed to Pay** without customer → warning toast + customer picker modal opens.
4. Staff searches or **registers new customer**, then continues to payment.
5. Order is created with non-null `customer_id`.

## UI states

### Cart customer panel (order builder sidebar)

| State | Copy | Actions |
|-------|------|---------|
| No customer | Headline: *Customer required at checkout*; subtext: *Select or register a customer before payment.* | Primary footer: **Select customer** (opens picker with search) |
| Customer linked | Name, phone, customer ID | Footer: **Change customer** (same picker — no separate Search button) |

### Customer picker modal

- Banner when empty: *Customer required before payment.*
- **Continue** enabled only when a customer is selected.
- No “Skip & continue” / walk-in bypass.
- Register block label: **New customer** (not “Walk-in”).

Full redesign spec: [pos-customer-picker-modal.md](pos-customer-picker-modal.md) — **search first**: register block appears only after **Create Cx** on a 10-digit mobile search with no Cx profile.

### Lens wizard — customer card

- Empty: *No customer selected* (not “Walk-in customer”).
- No “Remove customer · continue as walk-in” control.

## Pencil frames

- Store OS cart sidebar customer block (order builder).
- `overlay-pos-customer-picker` modal.

Route labels: `/storeos/order` (cart), customer picker overlay on same flow.

## API

- `POST /api/pos/orders`, `POST /api/pos/checkout-and-pay`: `customer_id` required (positive integer).
- 400 message: *Customer is required to create an order.*

## Out of scope

- `NOT NULL` DB constraint on `pos_orders.customer_id`.
- Requiring customer before first cart line.
- Changing historical list display fallback for legacy null-customer orders.

# POS cart — sell membership plan

## Purpose
Cashiers add an active membership plan from Command Unit to the Store OS cart, bill it on the same checkout, and activate the customer membership when payment succeeds.

## User flow
1. Select customer on `/pos/order` cart.
2. Tap **Add membership plan** (bill aside, near Apply Coupon).
3. Pick a plan from the modal (from `GET /api/pos/membership-plans`).
4. Bill summary shows membership line + updated total.
5. Optional: apply member-only offers (preview uses prospective plan eligibility).
6. **Proceed to checkout** → payment screen re-validates offers.
7. On pay: `checkout-and-pay` creates order, records payment, grants membership with `pos_order_id`.

## States
- **Default:** tap row visible when customer selected and permission `pos.membership.sell`.
- **Plan selected:** chip on customer card + membership bill row + remove in modal.
- **Membership-only cart:** no SKU lines required.
- **Mixed:** eyewear lines + membership on one bill.

## API
- `GET /api/pos/membership-plans`
- Order body: `membership_sale: { plan_key, price_paid }`
- `GET /api/pos/cart-offers?prospective_plan_key=PLUS`

## Pencil frames
- `/pos/order` — cart aside + membership bill row
- `/pos/payment` — confirm total with membership + offer re-check

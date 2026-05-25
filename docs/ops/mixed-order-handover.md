# MIXED order handover (frame + lenses)

Orders with `order_kind = MIXED` have two sub-orders:

| Line | Fulfillment | Typical label |
|------|-------------|---------------|
| Frame | `INSTANT` | e.g. EW-ORD-3A |
| Lenses | `LAB` | e.g. EW-ORD-3B |

## Required sequence

1. **Hand over frame (instant)** — `POST /api/orders/:id/instant-sub-handover` with `sub_order_id` for the INSTANT line. Sets `handover_status = HANDED_OVER` on that sub-order.
2. **Bill handover** — `POST /api/orders/:id/handover` when the lab line is `READY_FOR_DELIVERY` and payment is complete. Advances lab line through `DELIVERED` → `BALANCE_COLLECTED` → `INVOICED` and generates invoice.

## UI

- **StorePilot Lab Orders** — “Hand over frame · EW-ORD-3A” appears before the bill **Handover** button.
- **Store OS** — same on the orders list; Collect Balance / handover modal is blocked until the frame step is done.

## Permissions

- `storepilot.lab.manage` or `pos.lab.workflow` for both instant-sub-handover and bill handover.

## Diagnose

```bash
node scripts/diagnose_order_handover.js EW-ORD-3
```

If you see `BLOCKED: instant/frame line(s) not HANDED_OVER`, run frame handover first.

## EW-ORD-3 note

Confirmed in DB: MIXED bill, lab line `READY_FOR_DELIVERY`, instant line `EW-ORD-3A` not yet `HANDED_OVER` — bill handover alone cannot complete until frame handover runs.

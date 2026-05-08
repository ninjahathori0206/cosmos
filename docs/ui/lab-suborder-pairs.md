# Lab — per-pair sub-orders & sibling dispatch guard

## Intent

- One parent bill (`order_id`) may have multiple **LAB** sub-rows keyed by **`pair_index`** (`order_no` suffix A/B… from `pair_index`).
- **INSTANT** lanes on the same bill use **`handover_status`** (e.g. `HANDED_OVER`); they do **not** block lab workflow transitions on pair-mates.
- Before **`DISPATCHED_TO_STORE`**, another **LAB** sub-order with the **same** `pair_index` must already be **QC-ready** (`QC_PASS` or later in the coherence set). Blocking peers return HTTP 400 with a clear message.
- **Bypass**: users with **`*.lab.bypass_order_sibling`** (catalogue keys) may set **`bypass_order_sibling_guard: true`** and optional **`bypass_reason`** on `POST …/lab-status`; the timeline note is prefixed for audit (`[sibling_guard_bypass …]`).
- Foundry Lab UI: stacked blocks per **`lab_sub_orders`** row plus **Dispatch anyway (pair guard bypass)** when allowed.
- Instant lane handover for mixed carts: **`POST /api/orders/:id/instant-sub-handover`** with `sub_order_id` (same store as JWT).

## Pencil

- Primary frame: **`pencil-new.pen`** — Lab orders / pair labels / bypass affordance aligned with Cosmos blues and existing lab table density.

# Release SKU units after POS order deletion

## Problem

POS checkout marks each scanned unit as **SOLD** in `dbo.sku_units` and links it in `dbo.order_item_units`. The POS barcode resolver only allows sale when the unit is **AT_STORE** at the current store.

Deleting rows from `dbo.pos_orders` with raw SQL **does not** run release logic. Units stay **SOLD** (often with a stale `order_id`) and cannot be scanned again.

## Correct approaches

| Situation | What to use |
|-----------|-------------|
| OPEN bill, zero payments | POS **void** API → `voidUnpaidPosOrder` in `src/services/orderService.js` |
| Order already deleted manually, or orphaned SOLD units | `node scripts/release_sku_units.js --store-id <id> <barcode> ...` |
| Remove a test order end-to-end (dev) | `node scripts/purge_pos_order.js --order-no <EW-ORD-n>` |

## Release by barcode

```bash
node scripts/release_sku_units.js --store-id 13 0001060 0002040 0001032
```

- Sets `sku_units.status` to **AT_STORE**, `location_type` **STORE**, `location_id` to the store.
- Clears `order_id`, `order_item_id`, `sold_*`.
- Deletes matching `order_item_units` rows.
- Restores **+1** per unit on `stock_balances` at that store (unless `--no-restore-stock`).

Safe to re-run: units already **AT_STORE** at the store are reported as `skipped`.

## Purge order (dev)

```bash
node scripts/purge_pos_order.js --order-no EW-ORD-2
```

Order of operations inside one transaction:

1. `releaseSkuUnitsForOrder` (units + stock if `inventory_committed`)
2. Delete `pos_order_status_log` (FK is NO ACTION on order)
3. Delete optional `pos_checkout_drafts`
4. Delete `pos_orders` (cascades sub-orders, items, payments, invoices)

## Do not

- `DELETE FROM dbo.pos_orders` without releasing units first.
- Delete `order_item_units` with `WHERE order_id = …` — that table links via **`order_item_id`**, not `order_id`.

## Verification

```sql
SELECT unit_barcode, status, location_type, location_id, order_id, sold_store_id
FROM dbo.sku_units
WHERE unit_barcode IN ('0001060', '0002040', '0001032');
```

Expect `status = AT_STORE`, `location_id` = selling store, `order_id` NULL. Then scan each barcode on POS at that store.

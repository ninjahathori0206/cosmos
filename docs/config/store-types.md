# Store types — configure in Command Unit

## Where to configure (UI)

**Command Unit → Business Rules → Store Types** (`/command-unit/store-types`)

Requires **`command_unit.settings.view`** (list) and **`command_unit.settings.edit`** (create / edit / deactivate).

You can add formats (key, label, description, sort order), assign **roles** (e.g. Primary warehouse hub), and deactivate types that are not used by any store.

Store **format** dropdowns on Add/Edit Store load from the database automatically — no code change needed for new labels.

## Code catalogue (roles only)

Semantic **roles** (not store type keys) are defined once in:

- `src/config/storeTypeRolesCatalog.js` — e.g. `warehouse_hub`

New roles need a row in that file **and** migration `48` MERGE if SQL functions filter by role.

## Database

| Table | Purpose |
|-------|---------|
| `dbo.store_type_catalog` | `type_key`, `label`, `description`, `sort_order`, `is_active` |
| `dbo.store_type_catalog_roles` | `type_key` → `role_key` |

Migrations: `47` (catalog + FK), `48` (roles + warehouse SQL), `49` (`is_active`).

## API

| Method | Path | Use |
|--------|------|-----|
| GET | `/api/settings/store-type-catalog` | CU admin table |
| POST | `/api/settings/store-type-catalog` | Create type |
| PUT | `/api/settings/store-type-catalog/:typeKey` | Update |
| DELETE | `/api/settings/store-type-catalog/:typeKey` | Deactivate (422 if stores still use it) |
| GET | `/api/meta/store-types` | Active types for dropdowns |

## Primary warehouse and stock

- **Warehouse stock location** = the configured **primary inventory hub** store (e.g. Falshruti Nagar). `location_type = WAREHOUSE` in `stock_balances` is not a separate abstract site; it must use that hub’s `store_id` as `location_id`.
- Set the hub in **Command Unit → Settings → Inventory hub** (`PUT /api/settings/inventory-hub`). That writes `app_settings.foundry_primary_warehouse_location_id`. Display name comes from `dbo.fn_Foundry_WarehouseDisplayName()` (Foundry Stock View accounting row and StorePilot hub copy).
- **`stock_balances`** rows with `location_type = WAREHOUSE` must use that store’s `store_id` as `location_id` for transfers, `warehouse_qty` in `sp_SKU_StockDistribution`, and the SKU catalogue to agree.
- After changing the primary hub, stranded `WAREHOUSE` rows are merged automatically when you save **Inventory hub** in Command Unit. You can also run **`npm run maintenance:report-warehouse-misalignment`**, then **`COSMOS_ALIGN_WAREHOUSE_CONFIRM=I_UNDERSTAND npm run maintenance:align-warehouse-stock-to-primary`** manually. New purchase **Warehouse ready** runs the same alignment after stock is seeded.

## Rules

- **Do not** hardcode `HQ`, `Franchise`, etc. in HTML or JS — use API-driven lists.
- **Type key** is set at create and cannot be renamed (stores reference it).
- **Deactivate** only when `store_count` is 0.

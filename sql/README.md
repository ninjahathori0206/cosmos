# SQL folder guide

## Canonical table order

**Source of truth:** `sql/manifest.json` → `tables` array.

- Every `*.sql` file under `sql/tables/` must appear exactly once in that array.
- `node scripts/run-sql.js` uses the manifest when present and **errors** if files are missing or extra scripts exist in `tables/` without being listed.

This avoids fragile “directory sort” ordering (for example ensuring `04_branding_agents.sql` runs with other Foundry-era DDL instead of lexically after `12_order_engine.sql`).

## Run order (greenfield)

1. `create_database.sql`
2. `node scripts/run-sql.js` (tables from manifest)
3. `alter/01_*.sql` … `alter/30_*.sql` (numeric filename order)
4. `migrations/` — follow `docs/` runbooks or `package.json` `migrate:*` scripts
5. `sp/*.sql` — deploy all procedures your API expects
6. `seed/*.sql`

## Brownfield — staff login column rename

- **`migrations/45_users_rename_password_to_password_hash.sql`** — canonical column **`dbo.users.password_hash`** (replaces legacy **`password`**). Run **`npm run migrate:45-users-password-hash`** once per database, then **`npm run deploy:auth-users-sp`** (or redeploy **`sql/sp/auth.sql`** and **`sql/sp/users.sql`** manually).

Other environments (from repo root, `.env` pointing at that SQL Server):

```bash
npm run migrate:45-users-password-hash && npm run deploy:auth-users-sp
```

Works in **bash**, **cmd**, and **PowerShell 7+**. On **Windows PowerShell 5.1**, run each `npm run …` on its own line, or use  
`cmd /c "npm run migrate:45-users-password-hash && npm run deploy:auth-users-sp"`.

## Brownfield — primary warehouse (Foundry / transfers)

- **`migrations/46_foundry_primary_warehouse_functions.sql`** — **`dbo.fn_Foundry_PrimaryWarehouseLocationId()`** and **`dbo.fn_Foundry_WarehouseDisplayName()`**, plus optional bootstrap of **`app_settings.foundry_primary_warehouse_location_id`** from the first active HQ store. Run **`npm run migrate:46-foundry-primary-warehouse-functions`** once per database, then redeploy **`sql/sp/stock_transfers.sql`** and **`sql/sp/stock_transfer_docs.sql`** (or your usual SP deploy) so WAREHOUSE operations filter by **`location_id`**.

## Brownfield — duplicate store incharge roles (`store_in_charge` vs `store_incharge`)

- **Preflight:** run **`sql/maintenance/preflight_store_incharge_roles.sql`** (or open in SSMS) to see user and permission counts per key.
- **Recommended:** merge legacy **`store_in_charge` → `store_incharge`** with **`npm run maintenance:migrate-store-in-charge-role`** (runs **`sql/maintenance/migrate_store_in_charge_role_key.sql`**). Affected users must **re-login**.
- **Not recommended:** deleting canonical **`store_incharge`** while keeping **`store_in_charge`** breaks alignment with seeds/alters under **`sql/alter/`**; only do that with a deliberate DBA plan (reassign users, merge permissions, update seeds).

## `alter/` vs `migrations/`

- **`alter/`** — older numbered deltas that established the baseline; keep sequence when rebuilding from scratch.
- **`migrations/`** — preferred place for **new** DDL going forward so releases stay traceable.

## Application access pattern

Node calls **`executeStoredProcedure` only** — no ad hoc SQL from routes. When you add tables, add or extend procedures under `sql/sp/` in the same change train.

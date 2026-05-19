# SQL seed folder — auto-seed disabled

Cosmos **does not** insert bootstrap or reference data from this folder anymore. Live data is owned by **Command Unit**, **Foundry**, and **POS** configuration UIs (and one-off maintenance scripts you run deliberately).

## Do not use for deploy

- `scripts/run-sp-and-seed.js` no longer runs `sql/seed/*.sql`.
- Table scripts (`sql/tables/05_pos_config.sql`, etc.) are **DDL only** — no `INSERT` / `MERGE` reference rows.
- Migrations add schema only; they do not re-seed product types, lens catalogue, membership, or loyalty tiers.

## Greenfield / new database

1. Run `sql/create_database.sql`, then `node scripts/run-sql.js`, then `alter/` and `migrations/` per `sql/README.md`.
2. Deploy stored procedures (`sql/sp/`).
3. Create **roles**, **stores**, and **users** in Command Unit.
4. Configure **lookups**, **lab transitions**, **product types**, **lens catalogue**, **app settings**, and **store types** in the app — not from SQL seeds.

## One-time cleanup on an existing DB

If old deploy seeds still pollute data:

- Lens demo catalogue: `sql/maintenance/remove_lens_catalog_demo_seed.sql`
- Broader legacy demo rows: `sql/maintenance/remove_deploy_seed_data.sql` (review before running)

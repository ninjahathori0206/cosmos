# SQL Server host — Cosmos requirements

Cosmos ERP needs **only the SQL Server Database Engine** (TDS, port 1433, stored procedures). It does **not** use PolyBase, Analysis Services, Reporting Services, or external federated tables.

## Verified on CosmosERP (2026-05-27)

Run locally anytime:

```bash
npm run check:sql-polybase
```

| Check | Result |
|-------|--------|
| `sys.external_tables` | None |
| `sys.external_data_sources` | None |
| `sys.external_file_formats` | None |
| `polybase enabled` (sys.configurations) | **0** (off) |
| SQL edition | Express Edition (64-bit), SQL Server 2022 (16.x) |
| Host | Remote VPS (`vmi3295596` via `DB_HOST` in `.env`) |

**Conclusion:** Cosmos is not driving PolyBase. If **PolyBase Engine** / `mpdwsvcl` still consumes CPU, it is a **Windows service on the SQL Server machine** (or a separate local SQL install), not the Node app.

## What Cosmos uses

- [`src/config/db.js`](../../src/config/db.js) — `mssql` driver, connection pool (default max 20)
- Stored procedures under [`sql/sp/`](../../sql/sp/)
- Migrations under [`sql/migrations/`](../../sql/migrations/)
- No `EXTERNAL TABLE`, `OPENROWSET` (PolyBase), or Hadoop connectors in the repo

## If PolyBase Engine loads the server

PolyBase is optional infrastructure for querying **external** files (Azure, HDFS, ODBC). Safe to stop when no external objects exist (confirmed for CosmosERP).

### On the SQL Server Windows host (RDP / admin)

1. **SQL Server Configuration Manager** → **SQL Server Services**
2. Stop (if present):
   - SQL Server PolyBase Engine
   - SQL Server PolyBase Data Movement Service
3. Set **Startup type** → **Manual** or **Disabled**

Or run PowerShell **as Administrator** on that machine:

```powershell
.\scripts\disable-sql-polybase-services.ps1
```

### Optional: remove PolyBase feature

SQL Server Installation Center → Modify → uncheck PolyBase (edition-dependent; maintenance window required). Express Edition may not include full PolyBase; some `mpdw*` processes can still appear from other SQL components—use Task Manager / Services to match the exact service name.

## Verification SQL (SSMS)

```sql
USE CosmosERP;
SELECT name FROM sys.external_tables;
SELECT name FROM sys.external_data_sources;
SELECT name, value_in_use FROM sys.configurations WHERE name LIKE '%polybase%';
SELECT SERVERPROPERTY('Edition') AS edition, @@SERVERNAME AS instance;
```

## Local vs remote

- **Cosmos app** may run on your PC; **SQL Server** may run on a VPS (`DB_HOST` in `.env`).
- PolyBase services on **your PC** only matter if SQL Server is installed locally. Check Services on whichever machine shows high `mpdwsvcl` CPU.

## Related scripts

| Script | Purpose |
|--------|---------|
| [`scripts/check-sql-polybase-usage.js`](../../scripts/check-sql-polybase-usage.js) | Read-only DB check (npm `check:sql-polybase`) |
| [`scripts/disable-sql-polybase-services.ps1`](../../scripts/disable-sql-polybase-services.ps1) | Stop + set Manual startup (run on SQL host as admin) |

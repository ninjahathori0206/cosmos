# Command Unit — Cosmos Time Configuration

**Route:** Command Unit → System Settings → **Cosmos Time** tab  
**API:** `GET/PUT /api/settings/cosmos-time`, poll `GET /api/meta/cosmos-time`  
**Pencil frame:** `Command Unit · Cosmos Time · /command-unit/settings`

## Purpose

Show **device**, **Node server**, and **SQL Server** IST clocks side-by-side, highlight skew, and configure the drift alert threshold (default **5 minutes**). When any pair exceeds the threshold, all Cosmos shells show a dismissible **Clock time mismatch** modal.

## Layout

- **Clock cards:** This device (browser), Node server, SQL Server — live IST `DD/MM/YYYY, HH:mm:ss`
- **Skew table:** device↔server, device↔SQL, server↔SQL with green/amber badges
- **Threshold:** minutes (1–60), Save + Refresh now
- **Remediation:** sync Windows/NTP on SQL host and tablets; link to `docs/dev/sql-server-host.md`

## Global modal (all modules)

- Poll every 5 minutes after login
- Title: **Clock time mismatch**
- Lists issues + three clocks
- Dismiss (sessionStorage); re-shows on next poll if still unhealthy

## Permissions

- View: `command_unit.settings.view`
- Edit threshold: `command_unit.settings.edit`
- Drift modal: all logged-in module users (not permission-gated)

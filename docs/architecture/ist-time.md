# Cosmos — IST time and date (single source of truth)

India Standard Time (IST) = UTC + 05:30. No daylight saving.

This document is the **contract** for all layers. Implementation lives in:

| Layer | Module / reference |
|-------|-------------------|
| SQL | [`sql/sp/cosmos_ist_time.sql`](../../sql/sp/cosmos_ist_time.sql) — `DATEADD(MINUTE, 330, SYSUTCDATETIME())` |
| Node | [`src/lib/cosmosIst.js`](../../src/lib/cosmosIst.js) |
| Browser | [`src/public/js/cosmos-ui-polish.js`](../../src/public/js/cosmos-ui-polish.js) — `cosmosFmt*`, `cosmosIstToday`, etc. |

Cursor rule: [`.cursor/rules/ist-timezone-rules.mdc`](../../.cursor/rules/ist-timezone-rules.mdc).

---

## Storage

- Business timestamps are **`DATETIME2` IST wall clock** (naive — no offset column).
- **Writes** in SQL: `DATEADD(MINUTE, 330, SYSUTCDATETIME())` or `dbo.cosmos_ist_now()` when deployed.
- **Writes** in Node (POS orders/payments from `orderService.js`): pass `wallClockIso()` as `CAST(@created_at_ist AS DATETIME2(0))` — do **not** rely on SQL `DATEADD` alone if the SQL host clock drifts from true UTC.
- **Do not** use `GETDATE()` for new code (host OS timezone is not guaranteed IST).

## Wire / API

- API emits **naive IST wall-clock** strings: `YYYY-MM-DDTHH:mm:ss` (no `Z`, no offset).
- Node: use `sqlWireDatetime('col')` in SQL selects and `wireDatetimeFromSql()` when mapping rows.
- **Do not** pass raw mssql `Date` objects to `res.json()` for business timestamps — the driver adds `Z` and breaks display.
- Legacy responses ending in `Z` are still converted to IST in the browser until all endpoints are migrated.

## Display (UI)

| Use case | Function |
|----------|----------|
| Tables, detail panels | `cosmosFmtDate(v)` → `DD/MM/YYYY` |
| Tables with time | `cosmosFmtDateTime(v)` → `DD/MM/YYYY, HH:mm:ss` (24h) |
| Receipts / share image | `cosmosFmtDateTimeShort(v)` → `27 May 2026 · 2:30 pm` |
| `<input type="date">` default | `cosmosIstToday()` → `YYYY-MM-DD` |
| flatpickr hidden ISO field | `cosmosDateToInputIso(pickedDate)` |
| Greetings / time-of-day | `cosmosIstHour()` |

Never use `toISOString().split('T')[0]` or `.slice(0, 10)` for business dates.

## Node helpers

```js
const { sqlNow, wallClockIso, todayYmd, formatDateYmd, COSMOS_IST_TZ } = require('../lib/cosmosIst');
```

- `sqlNow()` — SQL fragment for `NOW` in queries.
- `wallClockIso()` — `YYYY-MM-DDTHH:mm:ss` IST for `DATETIME2` parameters.
- `sqlWireDatetime('col')` — SQL `CONVERT(VARCHAR(19), col, 126)` for API wire strings.
- `wireDatetimeFromSql(value)` — normalize row/API value to naive wire string (no `Z`).
- `todayYmd()` — today's calendar date in IST as `YYYY-MM-DD`.
- `formatDateYmd(d)` — any `Date` or parseable value → `YYYY-MM-DD` in IST.

## Lint

Run `npm run lint:ist` to flag common violations (UTC date slices, missing `timeZone`, `GETDATE()` in new SPs).

## One-time UTC → IST backfill (historical rows)

Only when legacy `DATETIME` values were stored as **UTC wall clock** (not already IST).

1. **Back up** the database.
2. Validate in SSMS (see script header in `sql/migrations/ist_backfill_utc_stored_rows.sql`).
3. Run:

```bash
# bash
COSMOS_IST_BACKFILL_CONFIRM=I_UNDERSTAND npm run maintenance:ist-utc-backfill
```

```powershell
$env:COSMOS_IST_BACKFILL_CONFIRM='I_UNDERSTAND'; npm run maintenance:ist-utc-backfill
```

Adds **+330 minutes** to every column listed in the migration. Idempotency marker: `app_settings.ist_utc_backfill_v1_completed_at` (do not re-run unless you know data was never shifted). Force re-run: `COSMOS_IST_BACKFILL_FORCE=1`.

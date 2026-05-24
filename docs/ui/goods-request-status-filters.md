# Foundry — Goods Request status buckets + History

## Purpose

HQ operators work from three workflow tabs on the main list; deep lookup (rejected, older fulfilled, SKU/unit search) lives in **History**.

## Route / frame

- **URL:** `/foundry/transfer-requests`
- **Pencil frame:** `Foundry — Goods Request` (`#page-transfer-requests`, 375×812 mobile)
- **History modal frame:** `Foundry — Goods Request History` (`#overlay-ftr-history`)

## Main list — view tabs

| Tab key | Label | Server `view` | Content |
|---------|-------|---------------|---------|
| `need_attention` | Need Attention | `need_attention` | `SUBMITTED`, `APPROVED` |
| `partial` | Partial | `partial` | `PARTIALLY_DISPATCHED` only |
| `fulfilled` | Fulfilled | `fulfilled` | Store requests in `DISPATCHED`, `RECEIVED`, `PARTIALLY_RECEIVED` **plus** HQ-initiated direct transfers (`record_kind: HQ_DOC`) — **last 10 by activity** (no date window) |

- **Default tab:** Need Attention
- **Store filter:** horizontal chips using **store code** (e.g. `SRT-01`); full name on `title`
- **Tools:** Refresh, **History** (opens modal)
- Rejected / older completed: not on main tabs

## Empty states

| View | Headline | Subtext |
|------|----------|---------|
| need_attention | No requests need attention | Try another store or check History |
| partial | No partially shipped requests | — |
| fulfilled | No fulfilled transfers | Shows the last 10 dispatched or stocked requests and HQ-initiated transfers; older ones are in History |

## History modal

- **Open:** History button in page head
- **Close:** X, Cancel, backdrop (mobile sheet)
- **Completed only:** `RECEIVED`, `PARTIALLY_RECEIVED`, `REJECTED` (not pending, approved, dispatch, or in-transit)
- **Fields:** Store (code chips + All), **From | To** on one row (**Flatpickr** compact calendar, **DD/MM/YYYY** IST, closes on select, default last 90 days when no optional lookup), **Request ID + SKU** on one row, **Unit ID** full width (all optional except dates when browsing)
- **Search:** primary CTA → `GET /api/transfer-requests/history`
- **Results:** compact `cosmos-record-list` rows (no SKU/qty/progress duplicate); row tap → request detail panel **on top**; History sheet stays open underneath
- **Mobile:** bottom sheet ~92dvh, sticky footer, 48px CTAs

### History result row (minimal)

| Line | Content |
|------|---------|
| Primary | `#request_id` · store code when “All stores” filter |
| Dates | `Requested {created_at}` · `Shipped {dispatched_at or —}` (DD/MM/YYYY IST) |
| Scores | `HQ {n}` · `Fulfillment {n}` (calendar days, IST date boundaries) |
| Badge | Status label (e.g. Stocked at Store, Rejected) |

**HQ score** (`hq_score_days`): `DATEDIFF` day from `created_at` → `dispatched_at`. Hidden (`—`) for `REJECTED` or when never dispatched.

**Fulfillment score** (`fulfillment_score_days`): calendar days `created_at` → completion (`received_at`, or latest `stocked_at` on linked transfer docs when stocked via sync). Shown for `RECEIVED` / `PARTIALLY_RECEIVED`; `—` for rejected or never stocked.

Example:

```
#23 · EW-SRT-02                    [Stocked at Store]
Requested 20/05/2026 · Shipped 22/05/2026
HQ 2 · Fulfillment 3
```

Computed in `sp_TransferRequest_SearchHistory`; surfaced as `hq_score_days` / `fulfillment_score_days` on the history API.

## States

- Loading: skeleton rows in list / history results
- Error: `cosmosToastError` + inline banner in modal
- Validation: `cosmosFieldError` only for invalid date range or non-numeric Request ID when that field is filled

## API

- List: `GET /api/transfer-requests?view=&store_id=&top_n=` (default `top_n`: 100; **fulfilled** view default **10**)
- Views catalog: `GET /api/meta/transfer-request-list-views`
- History: `GET /api/transfer-requests/history?...`

## Detail — stale header vs lines

Detail `GET /api/transfer-requests/:id` auto-runs transfer-doc sync when the header is dispatched/received-ish or lines have qty. That corrects impossible states (e.g. **Stocked at Store** badge with zero dispatched/zero stocked on lines). **`POST /api/transfer-requests/:id/reconcile`** does the same.

## Admin reject after HQ approval

Only **`super_admin`** may reject a request in **`APPROVED`** status (nothing shipped yet). HQ can still reject **`SUBMITTED`** only.

## Pencil

Update `pencil-new.pen` frames above (no note boxes). Sync copy to `src/public/design/pencil-local/pencil-new.pen` when done.

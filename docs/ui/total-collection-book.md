# Total Collection Book — Store Cash / Payment Machine / Store Bank

**Feature:** Per-store treasury ledgers and money-flow management  
**Status:** v1 + Phase 2 (ledger UX)  
**Modules:** StorePilot (`/storepilot/collections`), Finance (`/finance/collections`)

---

## Purpose

Store staff and HQ Finance need one place to see **where customer money sits** after POS/handover collection:

| Ledger | Source | Outflow |
|---|---|---|
| **Store Cash** | Cash payments | Cash deposited to bank |
| **Payment Machine** | UPI + Card via Mswipe/Paytm | Machine settlement to bank (after charges) |
| **Store Bank** | Credits from deposits + settlements | View-only balance in v1 |
| **Membership Cash** | Membership plan cash (`pos_membership_payments`) | Separate from product cash |
| **Membership Machine** | Membership UPI/Card | Separate from product machine |

Each store has **one bank account** and **one payment machine provider** (Mswipe or Paytm). Product and membership ledgers are **software-separated** (same physical drawer/terminal in v1).

---

## Phase 2 — Money flow ledger toolbar

Above the ledger table (per store detail view):

### Ledger tabs

| Tab | API `ledger_key` | Contents |
|---|---|---|
| All | *(omit)* | All entries |
| Store Cash | `store_cash` | Cash collections + cash deposits (out) |
| Payment Machine | `payment_machine` | UPI/Card collections + machine settlements (out) |
| Store Bank | `store_bank` | Bank credits from deposits/settlements |
| Membership Cash | `membership_store_cash` | Membership cash collections |
| Membership Machine | `membership_payment_machine` | Membership UPI/Card collections |

### Date range (IST)

- Presets: **All time** (default), **Today**, **Last 7 days**, **This month**, **Custom** (from/to inputs)
- Changing tab or dates re-fetches ledger with skeleton loader

### Export CSV

- Button: **Export CSV**
- Uses current tab + date filters, `limit=500`
- Columns: Date, Type, Ledger, Method, Direction, Amount, Charges, Net, Reference, Bank ref
- Filename: `collection-ledger-{storeId}-{YYYY-MM-DD}.csv`

### Load more

- If a page returns exactly 150 rows, show **Load more** (offset pagination)

### Void transfer

- On **Cash deposit** and **Machine settlement** rows only (permission: `*.collections.settle`)
- Confirm modal with optional reason → `PUT /api/collections/transfers/:id/void`
- Refreshes summary cards + ledger

---

## User flows

### Store staff (StorePilot)

1. Open **Collection Book** from sidebar.
2. See three ledger cards + ledger toolbar + timeline.
3. Filter by ledger tab and date range; export CSV.
4. **Record cash deposit** / **Record machine settlement** (unchanged from v1).
5. **Void** a mistaken deposit or settlement if permitted.

### HQ Finance

1. Open **Total Collection Book** — all stores rollup.
2. Click a store row → same ledger view as StorePilot.
3. **Store setup** — bank account + payment machine (Finance manage permissions).

---

## Main states

| State | Behaviour |
|---|---|
| Loading | Skeleton on stat cards and ledger table |
| Default | Balances + timeline populated |
| Empty ledger | Headline + subtext for current filters |
| No bank account | Cash deposit / settlement blocked with toast |
| Error | `cosmosToastError` |

---

## API

- `GET /api/collections/summary`
- `GET /api/collections/ledger?ledger_key=&from_date=&to_date=&offset=&limit=`
- `GET /api/collections/stores-summary` (Finance)
- `POST /api/collections/cash-deposit`
- `POST /api/collections/machine-settlement`
- `PUT /api/collections/transfers/:id/void`
- Bank account + machine config endpoints

---

## Pencil frames

- `Collection Book · /storepilot/collections`
- `Total Collection Book · /finance/collections`

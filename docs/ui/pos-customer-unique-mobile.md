# POS — unique mobile per customer + aliases

## Behaviour

- One **active** `pos_customers` row per normalized 10-digit Indian mobile (`UQ_pos_customers_phone_active` after merge).
- Registering the same mobile with a **different name** shows a confirmation modal; on confirm an **alias** is stored (same `customer_id`).
- **Search by full mobile or alias text:** result card shows **primary name on top**, then **alias rows** below (each tappable).
- **No aliases yet:** primary row + **“Add name for this mobile”** → Quick Cx registration (confirm-alias flow).
- **Bill / invoice:** always **primary** registered name — not the alias.
- **Lab / RX:** each lab line picks **who this pair is for** in lens setup (primary or alias); power is stored in `rx_snapshot` with `patient_name`.

## APIs

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/pos/customer/check-phone` | `{ exists, primary_name, aliases[], needs_alias_confirm }` |
| `POST` | `/api/pos/customer` | Create or link; `confirm_alias: true` to add alias |
| `GET` | `/api/pos/customer-search?q=` | Rows include `aliases[]`, `matched_alias_name`, `display_name` |

## POS UI

- Customer picker: `pos-cust-picker-card` (primary + alias sub-rows).
- Lens wizard: **Who is this pair for?** chips (primary, aliases, + Add name).
- Cart banner / receipt bill name: **primary** only.

## Database / ops

1. `npm run migrate:80-pos-customer-aliases`
2. `node scripts/merge-duplicate-pos-customers-by-phone.js --dry-run` then `--execute`
3. `npm run deploy:pos-sp`

## Verification

1. Search `8140551814` → **Talha junani**, alias row(s) below.
2. Tap alias → lens wizard pre-selects alias; invoice still shows primary.
3. Two lab lines → different `patient_name` in `rx_snapshot` (version 2 when multiple).
4. Quick reg adds alias without new `customer_id`.

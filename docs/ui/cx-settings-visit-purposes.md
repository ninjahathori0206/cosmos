# CX Settings — Purpose of visit

**Surfaces:** Command Unit → **CX Settings** (`/command-unit/cx-settings`), CX module → **CX Settings** (`/cx/settings`)  
**Consumers:** GatePass check-in (Store OS, Store Pilot), `cosmos-cx-search` purpose badges, CX Customer 360 Visits tab labels  
**Storage:** `dbo.gatepass_purpose_catalog` (migration 94)

## Purpose

HQ configures the dropdown options and badge colours for **Purpose of visit** at GatePass check-in. Keys are stable (`order`, `eye_test`, …); labels are editable without code deploy.

## Permissions

| Action | Command Unit | CX module |
|--------|--------------|-----------|
| View list | `command_unit.settings.view` | `cx.customers.view` or `cx.admin` |
| Add / edit / deactivate | `command_unit.settings.edit` | `cx.admin` |

## API

| Method | Path |
|--------|------|
| `GET` | `/api/settings/gatepass-purpose-catalog` |
| `POST` | `/api/settings/gatepass-purpose-catalog` |
| `PUT` | `/api/settings/gatepass-purpose-catalog/:purposeKey` |
| `DELETE` | `/api/settings/gatepass-purpose-catalog/:purposeKey` (soft deactivate) |
| `GET` | `/api/meta/gatepass-purposes` — active rows only (POS / SP / CX) |

## Pencil frames (target)

- `CU — CX Settings · /command-unit/cx-settings`
- `CX — CX Settings · /cx/settings`

## Rules

- Deactivate blocked when `store_visitors` rows reference the purpose key.
- Inactive purposes hidden from new check-in dropdowns; historical visits keep label via key lookup.
- Badge variants from `gatepassPurposeBadgeCatalog.js` (blue, purple, amber, gray, green, teal, red, orange).

## Migration

`npm run migrate:94-gatepass-purpose-catalog`

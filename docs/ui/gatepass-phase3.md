# GatePass Phase 3 — Operations (Store Pilot + Command Unit)

## Goal

Run the visitor queue outside POS: assign staff, auto-expire stale visits, configure VMS per store in Command Unit, and a **full queue page** in Store Pilot.

**Not in scope:** public / customer self check-in (Phase 5 — Eyewoot Go).

## Pencil frames (target)

| Frame name | Surface |
|------------|---------|
| `SP — Visitors queue · /storepilot/visitors` | Store Pilot full page |
| `CU — Store VMS settings · store detail` | Command Unit store config tab/section |

## Store Pilot — Visitors page

### Default view

- Filters: status (`waiting`, `in_service`, all active), optional phone/name search  
- Table: name, phone, purpose badge, wait time, assigned staff, status, linked Cx dot  
- Row actions: Select (if POS handoff later), Assign to me, In service, Complete, No-show  
- Primary: **+ Check In** → same fields as POS check-in modal  
- Empty: headline + subtext + Check In CTA  
- Loading: skeleton table; errors: `cosmosToastError`

### Permissions

- Page visible: `gatepass.view`  
- Check-in: `gatepass.checkin`  
- Status / assign: `gatepass.action`

## Command Unit — VMS settings

Per store ( `store_app_settings` ), keys from catalog:

| Key | Label | Type |
|-----|-------|------|
| `vms.visitor_expiry_minutes` | Visitor expiry (minutes) | int |
| `vms.max_active_visitors` | Max active visitors | int |
| `vms.self_checkin_enabled` | Self check-in (Eyewoot Go) | bool — **display only until Phase 5** |

Global defaults remain in `app_settings`; CU shows effective value (override → global).

## API (additions)

| Method | Path | Permission |
|--------|------|------------|
| `PATCH` | `/api/gatepass/visitor/:id/assign` | `gatepass.action` |
| `GET` | `/api/gatepass/settings?storeId=` | `gatepass.view` |
| `PUT` | `/api/gatepass/settings` | `command_unit` store config (or dedicated `gatepass.config`) |
| `POST` | `/api/gatepass/expire-run` | internal / admin cron secret OR `gatepass.action` at HQ |

Existing: checkin, search, queue, status PATCH.

## Database

Migration **86**:

- `sp_gatepass_assign_staff` (or extend status SP)  
- `sp_gatepass_expire_visitors` — `waiting`/`in_service` past `expiry_at` → `expired` + audit  
- Optional: `gatepass.config` permission in catalogue + seed for `command_unit_admin`

## Auto-expiry job

- Node script: `scripts/gatepass-expire-visitors.js`  
- `npm run gatepass:expire`  
- Uses IST `expiry_at` already set at check-in  

## Implementation files (planned)

- `sql/migrations/86_gatepass_phase3_ops.sql`  
- `src/api/gatepass.js` (extend)  
- `StorePilot_Prototype.html`, `src/public/js/storepilot-prototype.js`, CSS  
- `CommandUnit_Prototype.html`, `src/public/js/command-unit-prototype.js` (store VMS block)  
- `src/config/permissionsCatalogue.js` (if `gatepass.config` added)

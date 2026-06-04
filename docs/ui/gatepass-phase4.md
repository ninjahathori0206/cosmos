# GatePass Phase 4 — Store Pilot embed & shared search

## Goal

Visitor queue visible while staff work other Store Pilot tasks; reuse **`cosmos-cx-search`** anywhere SP captures customer phone.

**Depends on:** Phase 3 queue APIs and assign staff.

## Pencil frames

| Frame name | Surface |
|------------|---------|
| `SP — Visitor widget · sidebar` | Compact queue under SP nav |
| `SP — cosmos-cx-search · embedded` | Lab / handover phone fields (if applicable) |

## Store Pilot sidebar widget

- Mirror POS `#pos-gatepass-widget`: count, top N rows, tap → action sheet  
- Poll `GET /api/gatepass/queue/:storeId` every 30s  
- **+ Check In** when `gatepass.checkin`  
- Gated: `gatepass.view`

## cosmos-cx-search in Store Pilot

- Load `cosmos-cx-search.css/js` on `StorePilot_Prototype.html`  
- Init on phone inputs used for customer lookup (inventory/lab flows — list TBD in implementation)  
- `onSelect`: SP-specific handler (link job/customer context, not POS cart)

## RBAC

- Reuse `gatepass.view` / `gatepass.checkin` / `gatepass.action` — no new keys unless SP-only assign scope needed later.

## Out of scope

- Eyewoot Go self check-in (Phase 5)  
- Dedicated GatePass-only HTML shell (optional future; SP page is canonical for Phase 3–4)

## Implementation status ✅

| Item | File |
|------|------|
| `cosmos-cx-search` assets on SP shell | `StorePilot_Prototype.html` |
| Check-in phone dropdown | `storepilot-gatepass.js` → `#sp-gatepass-checkin-phone` |
| Invoices search dropdown | `storepilot-gatepass.js` → `#sp-invoice-search` |
| Sidebar widget (POS parity) | `storepilot-gatepass.js` `spGpRefreshWidget` |
| Linked Cx context for SP flows | `window._spGpCxContext` / `spGpGetLinkedCxContext()` |
| PWA cache bump | `storepilot-sw.js` `storepilot-v7-gatepass-phase4` |

## Verify

1. Hard refresh Store Pilot (unregister SW if cached).  
2. **Check-in modal** — type 10 digits → Cx profiles + visitors; select Cx → auto check-in.  
3. **Invoices** — same search; select row → filter invoices + queue check-in when permitted.  
4. Sidebar widget shows purpose · wait (matches POS).

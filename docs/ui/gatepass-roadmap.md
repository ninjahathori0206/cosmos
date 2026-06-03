# GatePass — Roadmap (revised)

## Phase order

| Phase | Scope | Module / surface |
|-------|--------|------------------|
| **1** ✅ | Store OS: check-in, `cosmos-cx-search`, sidebar widget, Cx link (85) | `POS_Prototype.html` |
| **3** ▶ | Operations: full queue board, assign staff, auto-expiry, CU VMS settings | Store Pilot + Command Unit + jobs |
| **4** | Embed: SP widget, `cosmos-cx-search` on SP flows; POS polish | Store Pilot |
| **5** (last) | **Self check-in** via existing **Eyewoot Go** (`/go`, customer app) — not a new public PWA | Eyewoot Go |

**Deferred from old “Phase 2”:** standalone `/checkin` PWA and CU QR generator → replaced by **Eyewoot Go** in Phase 5.

---

## Phase 3 — Execute now

See [`gatepass-phase3.md`](gatepass-phase3.md).

1. **DB / SP** — assign staff on visitor; batch expiry job; audit rows  
2. **API** — `PATCH` assign; queue filters; `GET/PUT` VMS settings (store + global)  
3. **Command Unit** — per-store VMS overrides (`vms.*` keys)  
4. **Store Pilot** — **Visitors** nav page: live queue, filters, assign, status actions  
5. **Ops** — `npm run gatepass:expire` (cron-friendly)

---

## Phase 4 — After Phase 3

See [`gatepass-phase4.md`](gatepass-phase4.md).

1. Store Pilot **sidebar visitor widget** (parity with POS)  
2. Wire **`cosmos-cx-search`** on SP screens that capture customer phone  
3. RBAC: same `gatepass.*` keys; no duplicate matrices  

---

## Phase 5 — Eyewoot Go self check-in (last)

1. **Markdown + Pencil** — Go “Check in at store” flow (store picker / QR payload)  
2. **API** — customer-scoped check-in (`channel: self_qr`), rate limits, `vms.self_checkin_enabled` gate  
3. **Go app** — new screen calling gatepass check-in; reuse Go auth/session  
4. **CU** (optional) — display store check-in QR deep link for printing (not a separate PWA)

---

## References

- Phase 1: [`gatepass-phase1.md`](gatepass-phase1.md)  
- Migrations: `84_gatepass_phase1.sql`, `85_gatepass_link_pos_customers.sql`  
- API: `src/api/gatepass.js`  
- Component: `src/public/js/cosmos-cx-search.js`

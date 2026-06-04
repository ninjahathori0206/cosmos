# Add Rx Modal — 3-step wizard

**Surfaces:** GatePass visitor actions, CX Customer 360 Prescriptions, Store OS lens wizard (**Enter Power Manually**)  
**Storage:** `dbo.eye_tests` (migration 93)

## Flow

| Step | Shell | Content |
|------|--------|---------|
| 1 | Centered sheet ~480px + step nav | Patient: who, **birthday** (drum picker + **Age** chip), test date, spectacles |
| 2 | Same sheet | Lifestyle: screen time, working conditions, medical toggles, family eye history |
| 3 | Expanded `rx-modal--eyetest-full` | Eye test — segmented nav + shell Save visible |

## Navigation (iOS segmented)

| Class | Role |
|-------|------|
| `rx-segnav` | Pill track: Patient · Lifestyle · Eye test |
| `rx-segnav-item` | Segment button — `is-active` / `is-done` (✓) / `is-pending` (●) |
| `rx-pending-hint` | e.g. `Pending: Eye test` when Save is disabled |
| `rx-save-foot-btn` | Sole footer action — **Save Rx** |

- **Header:** always **Record prescription** + close (`#rx-modal-close-btn`).
- **No** Back, Cancel, or Next buttons.
- **Tap segment:** backward always; forward only if current step validates.
- **Save Rx:** disabled until steps 1–3 validate; enabled on all steps including Eye test.
- **Pencil frames:** Step 1–2 IDs vary by file revision; Step 3 + wheel in `pencil-new.pen` (editor): mobile `c0wy7` (`CX — Add Rx Step 3 Eye Test Full · shared`), tablet `nlx6N`, wheel `UDYIH` (`CX — Rx Power Wheel · bottom sheet`). Sync canonical copy to `UIX/pencil-new.pen` when merging design.

## Step 3 — Eye Test (Pencil + code)

**Pencil frames (UIX/pencil-new.pen):**

- `CX — Add Rx Step 3 Eye Test Full · shared` — 390×844 mobile
- `CX — Add Rx Step 3 Eye Test Full · tablet` — 1024×768

**Components:**

| Class | Role |
|-------|------|
| `rx-et-patient-chip` | Primary / family / walk-in label |
| `rx-et-section` | Section title (Pre-test vision, Prescribed power) |
| `rx-et-va-row` | RE or LE label + horizontal VA chips |
| `rx-et-va-chip` | Vision acuity quick pick (catalog) |
| `rx-et-eye-grid` | RE + LE cards stacked (RE above LE, all breakpoints) |
| `rx-et-eye-card` | Eye card container |
| `rx-et-power-combo` | One iOS-style tap field per eye — opens unified 4-column wheel |
| `rx-power-sheet` | Power wheel (prescribed) or list (PD, lens type) |
| `rx-power-wheel-cols` | Four scroll columns: SPH · CYL · AXIS · ADD |
| `rx-power-wheel-labels` | Column headers above drums |
| `rx-et-meta` | PD, lens type, notes row |

**Superseded (do not use in new work):** `rx-et-power-cell`, `rx-et-power-btn`, `#rx-drum-power` single-column prescribed-power drum.

**Theme:** Cosmos CSS variables (`--acc2`, `--card`, `--border`); CX pages may use Go accent `#5B4FE8` via existing tokens.

**Patient step — birthday**

| Class | Role |
|-------|------|
| `rx-birthday-btn` | Opens `rx-birthday-sheet` (no keyboard) |
| `rx-age-chip` | Live age from birthday (IST) |
| `rx-drum-col` | Year / month / day scroll columns with center highlight |

- Preloads `dob` from Cx profile or `GET /api/pos/customers/:id/profile-brief` when a customer is linked.
- Save sends `patient_dob` (`YYYY-MM-DD`); stored on `eye_tests.patient_dob` (migration 97). Primary patient also syncs `pos_customers.dob` when permitted.

**Behavior:**

- Entering step 3 adds `rx-modal--eyetest-full` on `#modal-add-rx` (taller pane); **segmented nav and shell footer stay visible**.
- VA chips replace `<select>`.
- **Prescribed power — unified wheel** (see below). **PD** and **lens type** use list bottom sheet. Notes remain a text field.
- Ranges (SSOT `rxModalCatalog.js`): SPH −20.00…+20.00 (0.25), CYL **−6.00…+6.00** (0.25), AXIS 0…180 (step **5**), ADD 0.00…+4.00 (0.25), PD 48…72 mm (0.5).
- Save uses existing APIs + `cosmosBtnLoading`.

## Prescribed power — unified wheel

**Pencil frames (`UIX/pencil-new.pen`):**

- `CX — Add Rx Step 3 Eye Test Full · shared` (`c0wy7`) — `rx-et-power-combo` on RE and LE cards (white field + `›`, sample summary on LE)
- `CX — Add Rx Step 3 Eye Test Full · tablet` — same combo pattern
- `CX — Rx Power Wheel · bottom sheet` (`UDYIH`) — 4-column drum overlay + Submit

| Class / id | Role |
|------------|------|
| `rx-et-power-combo` | Per-eye summary button (`data-rx-power-eye="re"` \| `"le"`) — **visual parity with `rx-birthday-btn`** (white card field, muted placeholder, `›` chevron; not a primary button) |
| `rx-power-wheel-labels` | Headers: SPH · CYL · AXIS · ADD |
| `#rx-drum-sph` … `#rx-drum-add` | Scroll columns (iOS calendar-style) |
| `#rx-power-drum-submit` | Applies all four fields for current eye |

**Flow:**

1. Tap RE combo → bottom sheet title **RIGHT EYE (RE)**; four columns scroll to saved values (empty → **0** per field).
2. **Submit** writes `re_sph`, `re_cyl`, `re_axis`, `re_add`; combo summary updates (e.g. `+2.50 · −1.00 · 90° · +2.00`).
3. Sheet **auto-opens LE** with title **LEFT EYE (LE)** and LE values.
4. **Submit** on LE writes `le_*` fields and closes sheet.
5. Close (✕ / backdrop) dismisses sheet without clearing saved state.

**PD / lens type:** unchanged list sheet on `#rx-power-sheet-list`.

Ranges (SSOT `rxModalCatalog.js`): SPH −20.00…+20.00 (0.25), CYL −6.00…+6.00 (0.25), AXIS 0…180 (step 5), ADD 0.00…+4.00 (0.25).

## Catalog

`GET /api/meta/rx-modal-catalog` — from [`src/config/rxModalCatalog.js`](../src/config/rxModalCatalog.js).

## APIs

| Action | Route |
|--------|--------|
| Save (GatePass) | `POST /api/gatepass/visitor/:id/rx` (+ optional `lifestyle`) |
| Save (CX) | `POST /api/cx/customers/:id/eye-tests` |
| Lifestyle preload | `GET /api/cx/customers/:id/lifestyle` |

## RBAC

- GatePass: `gatepass.action`
- CX save: `cx.eye_tests.create`
- Store OS save: `pos.prescriptions.create` (fallback: `cx.eye_tests.create`)
- Lifestyle: `cx.customers.edit`, `cx.eye_tests.create`, or `gatepass.action` (OR)

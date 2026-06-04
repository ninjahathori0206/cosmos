# Add Rx Modal — 3-step wizard

**Surfaces:** GatePass visitor actions, CX Customer 360 Prescriptions  
**Storage:** `dbo.eye_tests` (migration 93)

## Flow

| Step | Shell | Content |
|------|--------|---------|
| 1 | Centered sheet ~480px + step nav | Patient: who, store, test date, spectacles |
| 2 | Same sheet | Lifestyle: screen time, working conditions, medical toggles, family eye history |
| 3 | **Full screen** `rx-modal--eyetest-full` | Eye test — no step tab bar |

## Step 3 — Full-screen Eye Test (Pencil + code)

**Pencil frames (UIX/pencil-new.pen):**

- `CX — Add Rx Step 3 Eye Test Full · shared` — 390×844 mobile
- `CX — Add Rx Step 3 Eye Test Full · tablet` — 1024×768

**Components:**

| Class | Role |
|-------|------|
| `rx-et-topbar` | Back, title "Eye test", close |
| `rx-et-patient-chip` | Primary / family / walk-in label |
| `rx-et-section` | Section title (Pre-test vision, Prescribed power) |
| `rx-et-va-row` | RE or LE label + horizontal VA chips |
| `rx-et-va-chip` | Vision acuity quick pick (catalog) |
| `rx-et-eye-grid` | RE + LE cards (2-col tablet) |
| `rx-et-eye-card` | Eye card container |
| `rx-et-power-cell` | SPH / CYL / AXIS / ADD labeled input cell |
| `rx-et-meta` | PD, lens type, notes row |
| `rx-et-foot` | Sticky: Back to lifestyle + Save Rx |

**Theme:** Cosmos CSS variables (`--acc2`, `--card`, `--border`); CX pages may use Go accent `#5B4FE8` via existing tokens.

**Behavior:**

- Entering step 3 adds `rx-modal--eyetest-full` on `#modal-add-rx`; hides `#rx-modal-stepnav` and default header/footer chrome.
- VA chips replace `<select>`; power uses 48px min-height tabular inputs.
- Save uses existing APIs + `cosmosBtnLoading`.

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
- Lifestyle: `cx.customers.edit`, `cx.eye_tests.create`, or `gatepass.action` (OR)

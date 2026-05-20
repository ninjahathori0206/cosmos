# Sidebar module switcher (footer)

**Applies to:** All ERP shells (Foundry, StorePilot, Finance, CX, Command Unit) — first implementation on **Command Unit**; roll out to siblings after approval.

**Pencil frames** (`pencil-new.pen`):

| Frame | Purpose |
|-------|---------|
| `CU Sidebar Footer · module strip (default)` | Collapsed icon strip below user role |
| `CU Sidebar Footer · module strip (hover menu)` | Flyout row above strip on hover |
| `Command Unit Mobile Nav · /command-unit (drawer + modules)` | Mobile drawer with same footer |

---

## Problem

“Switch Module” as vertical nav items wastes scroll space and duplicates chrome. Users need quick module jumps from the **sidebar footer**, beside profile + sign-out.

---

## Layout (sidebar footer)

```
┌─────────────────────────────┐
│ [Av] Talha            [⎋]   │
│      super_admin            │
├─────────────────────────────┤
│ ⚙️ Command Unit             │  ← active module name (from header)
│ SWITCH MODULE               │
│ [🔩][💰][🏬][🧾][⚙️][📊]  │  ← horizontal icon strip (scroll if needed)
└─────────────────────────────┘
```

Sidebar **header** shows only “Cosmos ERP” branding — not the module title.

- **Current module:** purple fill + `#8B5CF6` border on its chip.
- **Sign-out:** icon button right of name (existing pattern).
- **Remove** the scrollable nav block `Switch Module` + list items once footer switcher ships.

---

## Interaction

### Desktop (≥769px)

| State | Behaviour |
|-------|-----------|
| Default | Icon-only chips in one row; `overflow-x: auto` if >5 modules |
| Hover strip or “MODULES” label | Show **flyout** directly **above** the strip: horizontal panel with icon + short label per module |
| Hover item | Subtle highlight; click navigates (`/foundry/dashboard`, etc.) |
| Leave | Flyout hides (CSS `:hover` on `.cosmos-module-switch` wrapper) |

### Mobile (≤768px)

| State | Behaviour |
|-------|-----------|
| Default | Same icon strip in drawer footer |
| Tap strip / label | Toggle flyout open (class `.is-open`); second tap outside closes |
| Tap module | Navigate + close drawer |

No hover-only behaviour on touch devices.

---

## Data / RBAC

- Reuse `data-cosmos-module` keys: `foundry`, `finance`, `storepilot`, `pos`, `command_unit`, `cx`.
- Visibility via existing `applyCosmosModuleSwitchNav(wrapId, user)` — footer wrap id e.g. `cosmos-module-switch-footer`.
- Hide entire footer section if zero allowed modules.
- Mark current module with `aria-current="page"` and `.is-active` on chip + flyout item.

---

## Implementation contract (after approval)

| Area | Change |
|------|--------|
| HTML | Footer block `#cosmos-module-switch-footer` under `.sidebar-user`; remove `#cu-switch-module-wrap` from nav (CU first) |
| CSS | `cosmos-ui-polish.css` — `.cosmos-module-switch`, flyout, chips (shared) |
| JS | `cosmos-module-switch.js` — extend or add `initCosmosModuleSwitchFooter(wrapId, user, currentModuleKey)` |
| Routes | Same hrefs as today’s switch-module nav items |

---

## Visual tokens (Command Unit)

- Footer bg: sidebar navy `#0F1E35`
- Active chip: `rgba(108,63,197,0.35)` + stroke `#8B5CF6`
- Flyout: `#162640`, radius 12px, purple border glow
- Label caps: `MODULES`, 9px, letter-spacing 2px, 25% white

---

## Status

**Implemented** across Foundry, StorePilot, Finance, CX, and Command Unit (May 2026).

- Catalog: `src/config/cosmosModulesCatalog.js` + `src/public/js/cosmos-modules-catalog.js`
- UI: `cosmos-module-switch.js`, styles in `cosmos-ui-polish.css`
- Vertical “Switch Module” nav blocks removed from all five prototypes

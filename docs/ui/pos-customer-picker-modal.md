# Store OS — Customer picker modal

**Route:** `/pos/order` overlay `#overlay-pos-customer-picker`  
**Purpose:** Staff selects an existing customer or registers a new one before checkout. Opened from cart **Select Cx** / **Change Cx**.

## Design principle

**Search first** — default view is **Find Cx** only (phone search + dropdown results). **Quick Cx registration** is hidden until staff tap **Create Cx** after a **10-digit mobile** search returns **no Cx profile**.

## Pencil frames (`UIX/pencil-new.pen`)

| Frame name | State |
|------------|--------|
| `Store OS Customer picker · /pos/order` | Default — search only |
| `Store OS Customer picker · Create Cx · /pos/order` | Create Cx revealed — read-only mobile + name + **Create Cx** (after 10-digit search, no profile) |
| `Store OS Customer picker · Visitor Create Cx · /pos/order` | Focused create from GatePass visitor — no Find Cx, no banner **Create Cx** |

## Layout — default

- **Overlay:** dimmed backdrop, centered sheet **560px** wide, radius **20px**
- **Header:** **Select Cx**, subtitle *Search by phone or name.*, close **×**
- **Banner (top):** Amber when required; green when Cx selected
- **Find Cx:** Search icon + phone input; `cosmos-cx-search` dropdown (visitors + Cx profiles)
- **Footer:** **Cancel** + **Continue to cart** (disabled until selection)

## Layout — Visitor Create Cx (focused)

Opened from cart or picker **Create Cx** when a GatePass visitor is already selected (no central Cx):

- **Header:** **Create Cx**, subtitle *From visitor queue — confirm name.*
- **Banner:** Visitor name · phone (text only; **Clear Cx** retained)
- **Find Cx:** Hidden
- **Form:** Full name (editable), mobile (read-only), single primary **Create Cx**
- On success: Cx linked to cart; modal closes

**Select Cx** with a pending visitor still uses the default search-first layout (banner may show **Create Cx** shortcut).

## Layout — Create Cx revealed

After **Create Cx** from dropdown (10-digit search, no Cx profile):

- **Divider**
- **Quick Cx registration:** Full name (required), mobile (read-only, prefilled from search), primary **Create Cx**
- Email **not shown** in this quick path
- On success: Cx linked, **Continue to cart** enabled

## Dropdown — empty Cx (10-digit mobile)

When no central Cx profile matches:

- **Create Cx** row (primary CTA) — reveals registration block
- **Check in as new visitor** (gatepass, when no visitor phone match) — separate action below

## States

| State | Banner | Continue |
|-------|--------|----------|
| No selection | *Cx required before payment.* (amber) | Disabled |
| Visitor selected (GatePass, no Cx) | *Selected visitor: Name · phone* + **Create Cx** (blue) | Stays on cart — no auto-link |
| Cx row selected / created | *Selected Cx: Name · phone* (green) | Cart Cx linked |

## Accessibility

- `role="dialog"`, `aria-modal="true"`
- Results `role="listbox"` / rows `role="option"`, `aria-live="polite"`
- Read-only mobile: `readonly`, `aria-readonly="true"`
- Field validation via `cosmosFieldError` — no `alert()`

## Related

- [pos-mandatory-customer.md](pos-mandatory-customer.md)

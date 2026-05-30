# Store OS — Customer picker modal

**Route:** `/pos/order` overlay `#overlay-pos-customer-picker`  
**Purpose:** Staff selects an existing customer or registers a new one before checkout. Opened from cart **Select customer** / **Change customer**.

## Design principle

**No steps or tabs** — one scrollable panel with **Find customer** (search + results) and **Register new customer** (form) visible together. All functionality on a single surface.

## Pencil frames (`pencil-new.pen`)

| Frame name | State |
|------------|--------|
| `Store OS Customer picker · /pos/order` | Single panel — search, results, divider, register form |

## Layout

- **Overlay:** dimmed backdrop, centered sheet **560px** wide, radius **20px**
- **Header:** **Select customer**, subtitle, close **×**
- **Banner (top):** Amber when required; green when customer selected
- **Find customer:** Search icon + input + **Search**; result rows with avatar initials
- **Divider**
- **Register new customer:** Name, phone, email (optional), **Create customer**
- **Footer:** **Cancel** + **Continue to cart** (disabled until selection)

## States

| State | Banner | Continue |
|-------|--------|----------|
| No selection | *Customer required before payment.* (amber) | Disabled |
| Row selected / created | *Selected: Name · phone* (green) | Enabled |

## Accessibility

- `role="dialog"`, `aria-modal="true"`
- Results `role="list"` / rows `role="listitem"`, `aria-live="polite"`
- Field validation via `cosmosFieldError` — no `alert()`

## Related

- [pos-mandatory-customer.md](pos-mandatory-customer.md)

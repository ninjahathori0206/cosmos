# Foundry Catalogue — permissions (Command Unit)

Access for the **Catalogue** sidebar in Foundry is controlled by **permission keys** in Command Unit, not by role names like `hq_manager`. Assign keys under **Foundry — Catalogue & Inventory** in [`src/config/permissionsCatalogue.js`](../../src/config/permissionsCatalogue.js).

**Phase B (granular):** one Command Unit checkbox per screen area. **`foundry.catalogue.view` / `.edit` apply to SKU Catalogue only** — they do not unlock lens or master nav (assign granular lens / master keys separately).

Canonical mapping: [`src/config/foundryCatalogueNavCatalog.js`](../../src/config/foundryCatalogueNavCatalog.js) · API aliases: [`src/config/foundryCatalogueAuth.js`](../../src/config/foundryCatalogueAuth.js)

After role changes, users must **sign out and sign in again** so the JWT includes updated `permissions`.

---

## Permission keys (Command Unit)

| Permission key | Label | Screen / scope |
|----------------|-------|----------------|
| `foundry.catalogue.view` | SKU catalogue — View | SKU Catalogue (+ legacy alias for all lens/master nav) |
| `foundry.catalogue.edit` | SKU catalogue — Edit | SKU edits (+ legacy alias for all lens/master edits) |
| `foundry.lens.packages.view` | Lens packages — View | Lens packages (categories + packages) |
| `foundry.lens.packages.edit` | Lens packages — Edit | |
| `foundry.lens.addons.view` | Lens add-ons — View | Lens add-ons |
| `foundry.lens.addons.edit` | Lens add-ons — Edit | |
| `foundry.lens.matrix.view` | Lens link matrix — View | Package ↔ add-on matrix |
| `foundry.lens.matrix.edit` | Lens link matrix — Edit | |
| `foundry.lens.wizard.view` | Lens wizard rules — View | Product-type wizard policies |
| `foundry.lens.wizard.edit` | Lens wizard rules — Edit | |
| `foundry.master_catalogue.view` | Master catalogue — View | Master Catalogue (`foundry.purchases.view` also allows read) |
| `foundry.master_catalogue.edit` | Master catalogue — Edit | Digitisation fields on master products |
| `foundry.stock.view` | Stock transfers — View | Stock View |
| `foundry.stock.create` | Stock transfers — Create | Create transfers from Stock View |

---

## Sidebar nav → permission (OR)

| Nav item | View (any grants nav) |
|----------|------------------------|
| SKU Catalogue | `foundry.catalogue.view` |
| Stock View | `foundry.stock.view` |
| Lens packages | `foundry.lens.packages.view` |
| Lens add-ons | `foundry.lens.addons.view` |
| Lens link matrix | `foundry.lens.matrix.view` |
| Lens wizard rules | `foundry.lens.wizard.view` |
| Master Catalogue | `foundry.master_catalogue.view`, `foundry.purchases.view` |

Nav uses comma-separated `data-foundry-permission` (OR). `applyFoundryPermissionNav` in `foundry-prototype.js` matches any listed key.

---

## API enforcement

| Area | View | Edit |
|------|------|------|
| Lens admin `GET /api/foundry/lens-config` | Any lens view key or `foundry.catalogue.view` | — |
| Lens categories / packages | `foundry.lens.packages.view` (+ legacy) | `foundry.lens.packages.edit` (+ legacy) |
| Lens add-ons | `foundry.lens.addons.view` (+ legacy) | `foundry.lens.addons.edit` (+ legacy) |
| Package ↔ add-on links | `foundry.lens.matrix.view` (+ legacy) | `foundry.lens.matrix.edit` (+ legacy) |
| Product-type wizard rules | `foundry.lens.wizard.view` (+ legacy) | `foundry.lens.wizard.edit` (+ legacy) |
| SKU catalogue `/api/skus/*` | `foundry.catalogue.view` | `foundry.catalogue.edit` |
| Master Catalogue `/api/products/*` | `foundry.master_catalogue.view`, `foundry.catalogue.view`, `foundry.purchases.view` | `foundry.master_catalogue.edit`, `foundry.catalogue.edit`; product create still `foundry.purchases.create` |
| Stock View | `foundry.stock.view` | `foundry.stock.create` |

---

## HQ Manager setup

**Grant full catalogue (recommended):**

```bash
node scripts/grant_hq_manager_catalogue_permissions.js
```

**Migrate existing roles** that only have coarse `foundry.catalogue.view` / `.edit` to granular keys:

```bash
node scripts/migrate_catalogue_granular_permissions.js
```

Then **re-login**.

---

## Meta API

`GET /api/meta/foundry-catalogue-nav` — nav rows with `view_permissions` / `edit_permissions` arrays (Foundry module JWT).

---

## Split access example

Grant only `foundry.lens.wizard.view` + `foundry.lens.wizard.edit` (no `foundry.catalogue.view`) → user sees **Lens wizard rules** only in Catalogue nav; other lens screens hidden.

---

## Foundry — Intelligence (Rate Intelligence)

| Permission key | Command Unit label | Foundry nav |
|----------------|-------------------|-------------|
| `foundry.rate_intelligence.view` | Rate Intelligence — View | Intelligence → **Rate Intelligence** |

This is separate from **Purchases — View** (`foundry.purchases.view`). Assign explicitly in Command Unit under **Foundry — Intelligence**.

To copy access from existing purchase viewers:

```bash
node scripts/grant_rate_intelligence_from_purchases_view.js
```

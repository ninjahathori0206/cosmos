# Store Pilot & Foundry — Pencil audit (live parity)

**Date:** 2026-05-31  
**Note:** Superseded by monolith `UIX/pencil-new.pen` — SP/FY frames live in the same file (search `SP —`, `FY —`). Audit was against split files before consolidation.

## File health

| File | Size | Assessment |
|------|------|------------|
| `UIX/Store-Pilot.pen` | ~69 KB | Non-empty; likely retains partial SP mobile frames from earlier split |
| `UIX/Foundry.pen` | ~156 KB | Non-empty; likely retains FY mobile + desktop frames from earlier split |

Do **not** shell-copy `.pen` files — path-bound encryption breaks reads. Edit each file only with that file as the sole open tab in Pencil.

## Store Pilot — prototype vs expected Pencil

**Live:** `StorePilot_Prototype.html` pages include dashboard, stock browse, store catalogue, transfers history, reports, lab orders, invoices, bucket scan flow.

**Rule / prior design (`pencil-module-files.mdc`):** priority frames:

- SP Dashboard
- Browse Catalogue
- Request Goods
- PWA popup

**Audit result:** On-disk file is substantial (~69 KB) — consistent with **3–4 detailed mobile screens**, not an empty stub. Full pixel parity should be confirmed with `get_screenshot` on each top-level frame when `Store-Pilot.pen` is the active document. **No redraw in this pass** — gap risk only for prototype pages not in the pen (reports, lab orders, invoices).

## Foundry — prototype vs expected Pencil

**Live:** `Foundry_Prototype.html` has many admin pages (dashboard, purchases, bill verify, branding, digitisation, SKU catalogue, stock, transfers, lens packages, lab orders, etc.).

**Rule:** ~8 screens (Dashboard, Goods Requests, Movement List, 3× Lens Config, 2× mobile).

**Audit result:** On-disk file is large (~156 KB) — consistent with **detailed FY mobile + desktop** artwork from the pre-split monolith. **No redraw in this pass.** Confirm sidebar + white main on desktop dashboard and mobile tab bars via screenshot when `Foundry.pen` is open.

## Recommended follow-up (when each file is open in Pencil)

1. `batch_get` top-level frame names and routes.
2. `get_screenshot` per frame; compare to running prototype (`npm start` + prototype HTML).
3. `batch_design` only for frames that fail layout/copy/token check.

## MCP constraint (important)

While another `.pen` is active, `batch_design` with a different `filePath` writes to the **active** document. Always close other module tabs or open only one `UIX/<Module>.pen` before editing Army-HR, Command-Unit, Store-Pilot, or Foundry.

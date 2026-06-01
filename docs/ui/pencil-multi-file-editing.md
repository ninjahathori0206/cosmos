# Pencil — single monolith (`UIX/pencil-new.pen`)

**Updated:** User consolidated all design into **`UIX/pencil-new.pen`** only. Per-module `UIX/*.pen` files are no longer used.

## Workflow

1. Open **`UIX/pencil-new.pen`** in Pencil Design Editor.
2. Confirm `get_editor_state` shows `Currently active editor` → `/e:/Curser/cosmos/UIX/pencil-new.pen`.
3. Use `filePath: "/e:/Curser/cosmos/UIX/pencil-new.pen"` on every Pencil MCP call.
4. Find screens by frame `name` (e.g. `AR Mobile —`, `SP —`, `CU —`, `Store OS`).

## Canvas regions (approximate)

| Module | x range | y |
|--------|---------|---|
| Command Unit | 0–1280 | 0 |
| Store OS | -15800 … -10300 | -600 … 1600 |
| Store Pilot | -13150 … -12310 | -5400 |
| Foundry mobile | -13150 … -12273 | -4520 |
| Army HR (Careers) | 14000 … 15260 | -5400 |

Pan in Pencil to the region you are editing.

## Optional mirror

`src/public/design/pencil-local/pencil-new.pen` may exist for local preview — copy **from** `UIX/pencil-new.pen` after changes; **do not** treat the mirror as source of truth.

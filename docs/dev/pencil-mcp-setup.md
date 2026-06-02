# Pencil MCP setup (Cosmos local Agent)

Agents need **Pencil MCP tools** in the session to edit `UIX/pencil-new.pen`. If tools are missing, you will see messages like *“Pencil MCP isn't available in this session”* and the agent will fall back to code-only work.

## Two MCP servers (use both when possible)

| Settings label / `mcp.json` key | `CallMcpTool` server ID | Best for |
|--------------------------------|-------------------------|----------|
| **`pencil`** | **`user-pencil`** | File on disk via [`openpencil-mcp-safe/mcp-server.cjs`](../../openpencil-mcp-safe/mcp-server.cjs); bulk edits; works **without** editor open |
| **`extension-pencil`** | **`user-highagency.pencildev-extension-pencil`** | Live canvas; `get_editor_state`, `get_screenshot`; requires **`UIX/pencil-new.pen` open** in Pencil |

They use **different** `batch_design` arguments:

- **Extension:** `{ filePath, input: "..." }` (Pencil DSL string)
- **OpenPencil (`pencil`):** `{ filePath, operations: "...", postProcess: true }` (one op per line)

Canonical file path for every call: **`E:/Curser/cosmos/UIX/pencil-new.pen`** (see [`scripts/_pencil_paths.mjs`](../../scripts/_pencil_paths.mjs)).

Do **not** use root `pencil-new.pen` (stub). Do **not** Read/Write `.pen` as text.

## One-time setup

1. Install OpenPencil deps:
   ```bash
   npm run pencil:install
   ```
2. Verify server + file:
   ```bash
   npm run pencil:mcp-check
   ```
3. **Cursor → Settings → MCP**
   - Enable **`pencil`** (from project `.cursor/mcp.json`) — Agent calls it as **`user-pencil`**.
   - Enable **`extension-pencil`** if the Pencil extension is installed — Agent calls **`user-highagency.pencildev-extension-pencil`**.
4. **Developer: Reload Window** after changing MCP config.
5. Open **`UIX/pencil-new.pen`** in the Pencil app for live edits.

Optional: merge the same `pencil` entry into global `~/.cursor/mcp.json` if you work outside this repo.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Agent says MCP unavailable | MCP not enabled for this chat — enable servers in Settings → MCP, Reload Window, **new Agent chat** |
| `pencil` server red / error | Run `npm run pencil:install` then `npm run pencil:mcp-check` |
| `pencil:mcp-check` file truncated | Restore `UIX/pencil-new.pen` from git; save from Pencil |
| Edits go to wrong file | Close other `.pen` tabs; extension edits the **active** editor tab — open `UIX/pencil-new.pen` only |
| `batch_design` fails | Wrong server schema — extension uses `input`, OpenPencil uses `operations` |
| Plan mode only | Switch to **Agent** mode for MCP tool use |

## CLI fallback (scripts, not Agents)

```bash
node scripts/_pencil_invoke.mjs batch_get '{"readDepth":0}'
```

Uses the same stdio server as `pencil:mcp-check`.

## CI

Do not expect Pencil MCP in CI. Design changes are local (Pencil app + Agent).

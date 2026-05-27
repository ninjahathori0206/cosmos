# PWA — App update popup

**Purpose:** When a new service-worker version is available for an installed Cosmos PWA, show an in-app modal so staff can tap **Update** without leaving the module.

## Modules (v1)

| Module | App label | SW | Scope |
|--------|-----------|-----|-------|
| Store Pilot | Store Pilot | `/storepilot-sw.js` | `/` |
| Store OS | Store OS | `/storeos-sw.js` | `/storeos/` |
| Eyewoot Go | Eyewoot Go | `/go-sw.js` | `/` |

Foundry / Command Unit / Finance: browser-only (no SW) — out of scope v1.

## Pencil frames

| Frame | Route hint |
|-------|------------|
| `PWA — App update popup /storepilot/dashboard` | Any PWA shell when `registration.waiting` |

Same modal pattern reused for Store OS and Go (label + version string differ).

## User flow

1. User works inside installed PWA (or browser tab with active SW).
2. Server deploys new SW (`CACHE_NAME` bump) → browser installs waiting worker.
3. Modal opens: icon, title **Update available**, subtext with app name, optional version label.
4. **Update** → `SKIP_WAITING` message → page reloads on `controllerchange` → same module route.
5. **Later** → modal closes until next app session (sessionStorage dismiss) or next detected update.

## UI

- Container: `.overlay.cosmos-pwa-update-overlay` + `.modal.cosmos-pwa-update-modal` (injected by `cosmos-pwa-update.js`).
- Primary **Update** uses `cosmosBtnLoading` / reload; **Later** ghost button.
- No `alert()`; errors use `cosmosToastError` where polish JS is loaded.
- z-index above app chrome; safe-area padding on mobile.

## Service worker contract

- Install: cache shell, **do not** `skipWaiting()` until client sends `{ type: 'SKIP_WAITING' }`.
- Activate: delete old caches, `clients.claim()`.
- Client checks: on load, `updatefound`, window `focus`, interval ~30 min → `registration.update()`.

## Deploy checklist

**Automatic (no manual step):** On server start, `app.js` injects each service worker’s `CACHE_NAME` from the current **git commit short hash** (or `PWA_BUILD_ID` env if set in CI). When you deploy new code and **restart Node/PM2**, installed PWAs detect a new version and show the update popup.

Optional override for release pipelines:

```bash
PWA_BUILD_ID=2026-05-28-release-1 npm start
```

The placeholder `CACHE_NAME` strings in `*-sw.js` source files are defaults only — the served SW always uses the injected stamp.

## Related

- [storepilot-pwa.md](storepilot-pwa.md) — install banner (separate from update)
- [storeos-pwa.md](storeos-pwa.md)

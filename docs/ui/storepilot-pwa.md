# Store Pilot PWA — UI specification

**Module:** Store Pilot (`/storepilot/*`)  
**Purpose:** Installable mobile PWA for store managers — standalone chrome, fast shell, shell-only offline (no data sync).

## Pencil frames (`pencil-new.pen`)

| Frame name | Route hint | State |
|------------|------------|--------|
| `StorePilot PWA — Install banner` | `/storepilot/dashboard` | Chrome `beforeinstallprompt`; dismissible topbar chip |
| `StorePilot PWA — iOS Add to Home` | `/storepilot/dashboard` | Safari coach mark (Share → Add to Home Screen) |
| `StorePilot PWA — Offline gate` | `/` (login) | No network; cached login shell + message |

## Manifest & head

| Field | Value |
|-------|--------|
| `name` / `short_name` | Store Pilot |
| `start_url` | `/?source=pwa&module=storepilot` |
| `scope` | `/storepilot/` |
| `display` | `standalone` |
| `orientation` | `portrait` |
| `background_color` | `#0B1F33` (navy) |
| `theme_color` | `#1D6FD4` (accent) |
| Icons | `/img/storepilot-icon-192.png`, `512.png` (maskable) |

Head on [`StorePilot_Prototype.html`](../../StorePilot_Prototype.html) and [`login.html`](../../src/public/login.html): manifest link, `theme-color`, Apple standalone meta, `viewport-fit=cover`, `apple-touch-icon`, zoom-lock viewport + `html.cosmos-lock-zoom` (see [`cosmos-mobile-chrome.md`](cosmos-mobile-chrome.md#zoom-lock-store-os-store-pilot-login)).

## Install prompt UI

- **Container:** `#sp-pwa-install-banner` — fixed below topbar on mobile, full-width card inside main column.
- **Chrome/Android:** After `beforeinstallprompt`, show banner with primary **Install** and ghost **Not now**.
- **Dismiss:** `localStorage` key `sp_pwa_install_dismissed` (timestamp); hide 7 days.
- **iOS:** No programmatic install; show `#sp-pwa-ios-hint` once (`sp_pwa_ios_hint_seen`) with copy: “Tap Share, then Add to Home Screen”.
- **Never** `alert()` — use existing button styles + `cosmosToastInfo` on successful install.
- Hidden when `display-mode: standalone` or `navigator.standalone`.

## Offline gate

- Service worker: `/storepilot/*` navigations network-first; offline → cached `/` (login).
- Login page shows `#sp-pwa-offline-msg` when `navigator.onLine === false` (amber hint above form).
- In-app: `offline` event → `cosmosToastWarn('You are offline. Some actions need a connection.')` — no blocking overlay unless user navigates while offline (SW serves login).

## Safe areas (mobile ≤768px)

- `.topbar`: `padding-top: env(safe-area-inset-top)`; min-height `calc(54px + env(safe-area-inset-top))`.
- `.sidebar` / `.sidebar.open`: `padding-top/bottom` with `env(safe-area-inset-*)`.
- `.menu-toggle`: min 44×44px tap target.
- Modals: rely on [`cosmos-ui-polish.css`](../../src/public/css/cosmos-ui-polish.css) bottom-sheet rules at ≤768px; handover / QC / bucket scan stay as overlays outside `.cosmos-app-scroll`.

## Touch & scroll

- `body.cosmos-app-shell` + `.cosmos-app-scroll` (existing).
- Mobile: `touch-action: manipulation` on `.btn`, `.nav-item`, table rows with `.tr-link`.
- `-webkit-tap-highlight-color: transparent` on chrome controls.
- `body.sp-pwa-standalone` optional class when installed for slightly tighter topbar padding.

## Related

Store OS tablet PWA uses the same patterns in [storeos-pwa.md](storeos-pwa.md) (separate manifest/SW).

## Out of scope

- Offline read cache / sync queues for transfers or scans.
- Merged manifest with Store OS.
- Push notifications.

## Verification

HTTPS (ngrok) required for install on device. See plan checklist: Android install, iOS Add to Home Screen, notch safe areas, airplane mode login shell.

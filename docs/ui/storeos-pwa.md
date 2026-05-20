# Store OS PWA — UI specification

**Module:** Store OS (`/storeos/*`, POS tablet)  
**Purpose:** Installable landscape PWA for in-store tablets — standalone chrome, shell-only offline (tablet login), no order/sync offline queues.

Aligned with [Store Pilot PWA](storepilot-pwa.md) patterns; separate manifest and service worker.

## Pencil frames (optional)

| Frame name | Route hint | State |
|------------|------------|--------|
| `Store OS PWA — Install banner` | `/storeos/login` | Chrome install chip (fixed top) |
| `Store OS PWA — iOS Add to Home` | `/storeos/login` | Safari coach mark |
| `Store OS PWA — Offline gate` | `/storeos/login` | Offline message on tablet login card |

## Manifest & head

| Field | Value |
|-------|--------|
| `start_url` | `/storeos/login?source=pwa` |
| `scope` | `/storeos/` |
| `orientation` | `landscape` |
| `background_color` | `#0F172A` |
| `theme_color` | `#2563EB` |

Head on [`POS_Prototype.html`](../../POS_Prototype.html): manifest, Apple standalone meta, `apple-touch-icon`, [`storeos-pwa.js`](../../src/public/js/storeos-pwa.js).

## Install prompt UI

- `#sos-pwa-install-banner` — fixed top strip (below safe area); **Install** / **Not now**
- `#sos-pwa-ios-hint` — gold coach mark for iOS Add to Home Screen
- `localStorage`: `sos_pwa_install_dismissed`, `sos_pwa_ios_hint_seen`
- `body.sos-pwa-standalone` when installed

## Offline gate

- `#sos-pwa-offline-msg` on tablet login card (`screen-login-tablet`)
- SW: `/storeos/*` navigations → network-first; offline → `/storeos/login`
- `storeos-v2` cache; does not cache Foundry / Store Pilot / other modules

## Verification

HTTPS via `npm run tunnel:storeos`. Same checklist as Store Pilot (install, iOS home screen, offline login shell, API errors via toasts).

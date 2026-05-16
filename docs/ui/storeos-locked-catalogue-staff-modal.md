# Store OS — Locked catalogue + staff PIN modal

## Purpose

After tablet unlock, staff sign-in uses a modal on the catalogue shell instead of a separate full-screen route. When Command Unit ends the tablet session, the client validates the tablet JWT with `GET /api/pos/tablet-session` and returns to tablet unlock instead of showing an error on `/storeos/login/staff`.

## Flow

1. Tablet PIN completes → navigate to `/storeos/catalogue`; catalogue shows dimmed “locked” placeholder; staff PIN modal opens (`#overlay-pos-staff-login`).
2. Staff PIN OK → modal closes, catalogue loads with staff JWT.
3. Staff sign-out → same locked catalogue + modal if tablet session still valid; otherwise `/storeos/login` (tablet).

## States

- **Locked catalogue**: `body.pos-catalogue-locked`; no catalogue API calls until staff session exists; `triggerCatalogueSearch` no-ops.
- **Tablet invalid (401)**: clear `pos_tablet_token` + staff session; `/storeos/login`; toast with server message.

## Pencil

Primary frame: catalogue + centred PIN modal (align with `pencil-new.pen` when updated).

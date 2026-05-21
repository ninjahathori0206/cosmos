# Cosmos extended detail panel

Shared overlay pattern for **transfer** and **goods-request** detail — never a footer card below the list.

## Applies to

| Module | Route | Panel IDs |
|--------|-------|-----------|
| StorePilot Incoming Goods | `/storepilot/incoming-transfers` | `#sp-inc-detail`, `#sp-inc-detail-backdrop` |
| Foundry Goods Request | `/foundry/transfer-requests` | `#ftr-detail-card`, `#ftr-detail-backdrop` |

## Behaviour

- Tapping a list row opens a **fixed overlay sheet** (mobile: near full viewport; desktop: right sheet).
- **Backdrop** dims the list; tap or **Close** dismisses.
- **Sticky toolbar:** title, meta (status + date), **primary actions**, **Close**.
- **Body** scrolls: meta chips, line items, form fields (notes) — no primary actions at bottom.

## StorePilot toolbar

| Doc status | Actions |
|------------|---------|
| DISPATCHED | Accept · Close |
| ACCEPTED | Open bucket · Verify & Stock · Reset (if units) · Close |
| STOCKED | Stocked label · Close |

## Foundry toolbar

| Request status | Actions |
|----------------|---------|
| SUBMITTED | Approve · Reject · Close |
| APPROVED / PARTIALLY_DISPATCHED | Open bucket · Confirm shipment · Close |
| Other | Close only |

## Implementation

- CSS: [`cosmos-ui-polish.css`](../../src/public/css/cosmos-ui-polish.css) — `.cosmos-extended-detail__*`
- JS helpers: `cosmosOpenExtendedDetail`, `cosmosCloseExtendedDetail` in [`cosmos-ui-polish.js`](../../src/public/js/cosmos-ui-polish.js)

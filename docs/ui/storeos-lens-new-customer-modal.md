# Store OS — Lens setup: “Customer not found” modal

**Route:** `/storeos/lens-config` · Step **3 · Add Power** · Customer dropdown (`Change`).

## Purpose

When staff search CRM and there are **no matches**, open a modal to **create a customer** quickly. Phone (or search text that looks phone-like) is **prefilled** from what they typed.

## Behaviour

| Trigger | Result |
|---------|--------|
| Search runs; API returns zero rows | Show “No customers found” plus **auto-open modal** prefilled via heuristic below |
| Tap “Add new customer” under empty state | Opens same modal using current query string |
| Create success | Calls `POST /api/pos/customer`, runs `setPosCustomerSelection`, refreshes banner, closes modal & dropdown |

## Prefill heuristic

1. Trim search string `q`.
2. Strip non-digits: if **`digits.length ≥ 8`**, treat as **phone** → prefill Phone with original `q` (staff may correct).
3. Else if **`q`** has letters and **`length ≥ 2`**, prefill **Full name**.
4. Else leave both editable.

## Modal content

- Title: Customer not found
- Body line: contextual (e.g. no match for `…`)
- Fields: Full name (required), Phone (required); validation via `cosmosFieldError` / clear on input
- Primary: Create and link (`cosmosBtnLoading` / `cosmosBtnDone` / toast on errors)
- Close: X, Cancel, backdrop click (and Escape optional)

## Pencil mapping

(To be aligned with `pencil-new.pen`: lens flow “customer / add-power” frames when those frames carry this interaction.)

## Data / backend

No schema change — reuses **`/api/pos/customer`** as today.

## Approval

Aligned with UX request: modal instead of inline new-customer block; implementation approved for delivery.

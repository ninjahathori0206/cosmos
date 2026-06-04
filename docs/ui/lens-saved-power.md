# Store OS — Lens wizard · Saved Power

**Route:** `/storeos/lens-config` · lens step **Cx** (checkout stage 4, `lensWizard.step === 2`, profile sub-phase)

## Purpose

Staff pick a **saved prescription** from the linked Cx profile (`eye_tests`) and apply it to the current lab cart line, or **upload** a prescription image. New eye tests are recorded in **GatePass + Add Rx** or **CX 360** — not on this lens step.

## Flow

1. **Cx required** — `posSelectedCustomerId` must be set (cart / lens **Who is this pair for?** block with **Change** for Cx account).
2. Tap **Saved Power** on the lens step → opens **`#overlay-pos-lens-saved-rx`** modal.
3. `GET /api/pos/customers/:customerId/prescriptions/for-pos` loads up to 30 tests (maps via `mapEyeTestForPos` on server).
4. Staff tap **Use for this order** on a row → values copied to `lensWizard.rx`, `lensWizard.savedTestId = test_id`, internal `powerMode` set for lab line persistence.
5. **Next** on lens wizard → `confirmLensWizard` writes `line.rx` including `eye_test_id` when a saved test was selected.

## Pencil frame

`Store OS Lens wizard · Saved Rx picker · /pos/order/lens` in `UIX/pencil-new.pen`

## API

| Method | Path |
|--------|------|
| GET | `/api/pos/customers/:customerId/prescriptions/for-pos` |

Permission: `pos.customers.view` (same as other POS customer reads).

## Patient chips (unified Cx block)

Linked Cx: one block — **Who is this pair for?** + patient chips + **Change** (Cx search). Optional **Bill / invoice: {primary}** when a family member is selected. No separate “Shopping for” name row.

Saved Rx list is **filtered** to the chip selection (primary vs family name). Talha primary sees only primary-account tests; Shifa sees only rows linked to that family name / patient label.

## Lens step power options (Pencil + app)

Under **I know my power**: **Saved Power** and **Upload Prescription** only (no Enter Power Manually).

Pencil frame: `Order Creation - Add Power + add-ons & Rx · /storeos/lens-config`

## Related

- [lens-manual-rx-wizard.md](lens-manual-rx-wizard.md) — Add Rx wizard (GatePass/CX only; removed from lens step)
- [storeos-lens-new-customer-modal.md](storeos-lens-new-customer-modal.md) — separate “customer not found” create flow
- [gatepass-phase1.md](gatepass-phase1.md) — visitors via GatePass FAB on same step

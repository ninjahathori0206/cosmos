# Store OS — Add Rx wizard (not on lens step)

**Routes:** GatePass **+ Add Rx**, CX Customer 360 — **not** lens wizard Cx step.

## Status

**Enter Power Manually** was **removed** from the lens Cx step (May 2026). Staff on lens checkout use:

- **Saved Power** — pick existing Rx ([lens-saved-power.md](lens-saved-power.md))
- **Upload Prescription** — JPG/PDF

New eye tests: record in **GatePass** or **CX 360** via the shared 3-step Add Rx wizard ([rx-modal.md](rx-modal.md)).

## APIs (GatePass / CX / optional POS)

| Method | Path | Permission |
|--------|------|------------|
| POST | `/api/pos/customers/:customerId/eye-tests` | `pos.prescriptions.create` |
| POST | `/api/gatepass/visitor/:id/rx` | `gatepass.action` |
| POST | `/api/cx/customers/:id/eye-tests` | `cx.eye_tests.create` |

## Pencil

- `Order Creation - Add Power + add-ons & Rx · /storeos/lens-config` — Saved + Upload cards only
- `CX — Add Rx Step 3 Eye Test Full` frames in [rx-modal.md](rx-modal.md)

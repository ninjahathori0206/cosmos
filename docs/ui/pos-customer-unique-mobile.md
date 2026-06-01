# POS — unique mobile per customer + family names



## Behaviour



- One **active** `pos_customers` row per normalized 10-digit Indian mobile (`UQ_pos_customers_phone_active` after merge).

- Registering the same mobile with a **different name** shows a confirmation modal; on confirm a **family name** is stored (same `customer_id`, table `pos_customer_family_names`).

- **Cart Cx picker:** **primary Cx only** — one row per search hit (no family sub-rows, no “Add family name for this mobile” link). `family_names[]` still loads into the customer snapshot for lens wizard chips.

- **Family names created in lens flow:** when staff save **prescription / lens Step 2** with a patient name that differs from the primary Cx, `ensureFamilyNameForPatient()` calls `POST /api/pos/customer` with the existing confirm modal (`confirm_family_name` flow). No separate “+ Add family name” chip in the lens wizard.

- **Bill / invoice:** always **primary** registered name — not the family name used for lab/RX.

- **Lab / RX:** lens wizard **Step 2 only** — patient chips (primary + on-file family names) + **Patient name** field on prescription entry; `line.patient_name` stored on LAB cart lines.

- **Cart lab lines:** each LAB line card shows **`For · {patient name}`** when `patient_name` is set and differs from primary (case-insensitive).



Distinct from **Eyewoot Plus buddies** (membership dependents) — those use `/membership/dependents` and “Buddy” copy.



## APIs



| Method | Path | Purpose |

|--------|------|---------|

| `POST` | `/api/pos/customer/check-phone` | `{ exists, primary_name, family_names[], needs_family_name_confirm, proposed_family_name }` |

| `POST` | `/api/pos/customer` | Create or link; `confirm_family_name: true` to save family name |

| `GET` | `/api/pos/customer-search?q=` | Rows include `family_names[]`, `matched_family_name`, `display_name` |



409 on register without confirm: `code: PHONE_FAMILY_NAME_REQUIRED`, `data` includes `primary_name`, `proposed_family_name`, `family_names`.



## POS UI



- Copy catalog: `src/config/posCustomerFamilyNameCopyCatalog.js` (server), `src/public/js/pos-customer-family-name-copy.js` (browser).

- Customer picker: primary row only (`customerSearchDisplayParts` / `buildCustomerSearchRowHtml` with `primaryOnly: true`).

- Lens wizard: patient UI **Step 2 only** — chips for primary + on-file family names; **Shopping for** card shows selected patient. **Patient name** only on manual RX modal (`pos-lk-rx-patient-name`) when entering a new name on prescription.

- Cart lab line: `.pos-lk-cart-patient-row` — **For · name** when patient ≠ primary.

- Cart banner / receipt bill name: **primary** only.



## Database / ops



1. `npm run migrate:80-pos-customer-aliases` (if greenfield)

2. `npm run migrate:81-pos-customer-family-names` (rename table/columns)

3. `node scripts/merge-duplicate-pos-customers-by-phone.js --dry-run` then `--execute`

4. `npm run deploy:pos-sp`



## Verification



1. Cart Cx picker: primary row only; snapshot still has `family_names[]` after link.

2. Lens Step 0 / 1: no patient UI.

3. Lens Step 2: new patient name on RX save → family row in DB; `line.patient_name` set.

4. Cart lab line: **`For · {family name}`** when patient ≠ primary; hidden when patient is primary or missing.

5. Two lab lines → each card shows its own patient name.

6. Refresh cart: patient labels persist from `localStorage`.

7. Invoice: still primary Cx name.



# Army Careers — 4-Step Apply Wizard & Status Tracker

**Module:** Army HR · Candidate Portal  
**Route:** `/army/careers/:slug/apply` (single URL, internal steps 1–4)  
**Status route:** `/army/careers/status`  
**Pencil file:** [`UIX/pencil-new.pen`](../../UIX/pencil-new.pen) — frames `AR Mobile — Apply Form · /army/careers/:slug/apply`

## Purpose

Let candidates apply for a published job opening from their phone via a **4-step wizard**, with WhatsApp OTP verification on step 1, and check application status later using the same phone number.

## Pencil frames

| Step | Frame name |
|------|------------|
| 1 | `AR Mobile — Apply Step 1 · OTP · /army/careers/:slug/apply` |
| 2 | `AR Mobile — Apply Step 2 · Personal · /army/careers/:slug/apply` |
| 3 | `AR Mobile — Apply Step 3 · Joining · /army/careers/:slug/apply` |
| 4 | `AR Mobile — Apply Step 4 · CV · /army/careers/:slug/apply` |

Shared chrome on all steps: job summary chip, step indicator (“Step N of 4” + progress bar), sticky bottom bar (Back + Continue / Submit).

## Apply flow (wizard)

1. User taps **Apply for this Role** on job detail (or **Apply Now** on home card).
2. **Step 1 — Mobile + OTP:** 10-digit mobile → Send OTP → 6-digit verify → **Continue** (blocked until verified).
3. **Step 2 — Personal details:** full name, email, DOB, experience (years + months), highest education; optional preferred store, last employer, referral code.
4. **Step 3 — Joining availability:** segment choice **Instant** or **On notice period**. If on notice: **notice days remaining** (1–180) and **expected joining date** (≥ today IST) — both required.
5. **Step 4 — CV upload:** resume **required** (PDF/DOC/DOCX ≤5 MB), mini review summary → **Submit Application**.
6. Success card → link to status tracker.

Back behaviour: step 1 back → job detail; steps 2–4 back → previous step. Draft fields may persist in `sessionStorage` per job slug.

## Validation (client)

| Step | Required |
|------|----------|
| 1 | Valid 10-digit phone + OTP verified (`verification_token`) |
| 2 | Full name, email, DOB, education |
| 3 | `joining_availability_key`; if `ON_NOTICE` → `notice_period_days` + `expected_join_date` |
| 4 | Resume file present, allowed type, ≤5 MB |

Use `cosmosFieldError`, `cosmosToastError`, `cosmosBtnLoading` — no `alert()`, no raw “Loading…”.

## Status tracker flow

Unchanged: careers home → **Track my application** → mobile + OTP → latest application card.

## States

| Screen | Loading | Empty | Error |
|--------|---------|-------|-------|
| Apply steps | Skeleton on job summary | — | Field errors + toast |
| Status | Skeleton after verify | “No application found for this number” | Toast |

## Accessibility

- All inputs labelled; phone/OTP use `inputmode="numeric"`.
- Minimum tap target 48px.
- Step progress announced via visible “Step N of 4” text.
- `aria-live` on status result.

## API (public, no staff JWT)

- `POST /api/army/careers/otp/send` `{ phone }`
- `POST /api/army/careers/otp/verify` `{ phone, otp_code }` → `verification_token`
- `GET /api/army/careers/meta/education`
- `GET /api/army/careers/meta/joining-availability`
- `POST /api/army/careers/applications` (multipart, **resume required**) + header `X-Army-Verification-Token`
  - Body fields include: `joining_availability_key`, `notice_period_days` (when ON_NOTICE), `expected_join_date` (when ON_NOTICE)
- `GET /api/army/careers/applications/status` + verification header

## Source capture

Query param `?source=whatsapp|promoter|direct` stored on application; default `direct`.

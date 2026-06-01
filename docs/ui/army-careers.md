# Army HR — Careers candidate portal

**Module:** Army HR  
**Live app:** `src/public/army-careers.html`, `src/public/css/army-careers.css`, `src/public/js/army-careers.js`  
**Pencil file:** `UIX/pencil-new.pen` (Army HR artboards — search frame names `AR Mobile —`)  
**Artboard:** 390×812 mobile (portrait), max content width 480px in CSS

## Theme (from implementation)

| Token | Value | Usage |
|-------|--------|--------|
| Primary green | `#047857` | CTAs, brand, theme-color |
| Green dark | `#065f46` | pressed / dark accents |
| Green light | `#f0fdf4` | hero / badges |
| Background | `#f8fafc` | page |
| Card | `#ffffff` | cards, topbar |
| Border | `#e2e8f0` | dividers |
| Text primary | `#0f172a` | headings |
| Text secondary | `#64748b` | body |
| Font | Inter 400–700 | all copy |

Department chip colours: sales (blue), optometry (violet), lab (green), mgmt (amber), admin (red), hq (slate) — see CSS `--dept-*` vars.

---

## Screens → Pencil frame names

| # | Section id (HTML) | Pencil frame name | Route |
|---|-------------------|-------------------|--------|
| 1 | `screen-careers-home` | `AR Mobile — Careers Home · /army/careers` | `/army/careers` | In monolith (~x=14000, y=-5400) |
| 2 | `screen-careers-detail` | `AR Mobile — Job Detail · /army/careers/:slug` | `/army/careers/:slug` | In monolith |
| 3 | `screen-careers-apply` | `AR Mobile — Apply Form · /army/careers/:slug/apply` | `/army/careers/:slug/apply` | In monolith |
| 4 | `screen-careers-status` | `AR Mobile — Application Status · /army/careers/status` | `/army/careers/status` | In monolith |

Apply screen includes inline **success** state (`#careers-apply-success`) — optional second frame or variant on same artboard.

---

## 1. Careers Home

**Top bar:** Green “E” mark + “Eyewoot” + “Careers” label.

**Hero:** Pill “HIRING NOW”, title “Build Your Career at Eyewoot”, sub “Optical retail roles across Mumbai…”

**Search:** Full-width rounded field, magnifier icon, placeholder “Search by role or location…”

**Filters:** Horizontal scroll chips (departments from API meta).

**List:** Count line (“12 openings”) + job cards (role title, store/location, department badge, “Apply →”).

**Footer link:** Text button “Track my application →”.

**States:** skeleton job list while loading; empty “No openings match your search” with subtext.

---

## 2. Job Detail

**Top bar:** Back chevron + dynamic title (role name).

**Body:** Job summary card (title, store, department badge, employment type), description sections (responsibilities, requirements), meta rows.

**Bottom bar (fixed):** Primary “Apply for this Role”.

---

## 3. Apply Form

**Top bar:** Back + “Apply” / role name.

**Blocks (stacked cards):**

1. Job summary (read-only).
2. **WhatsApp OTP** — +91 phone, Send OTP, 6-digit verify, “Number verified” badge.
3. **Your details** (disabled until OTP): full name, email, DOB, experience years/months, education select, optional store, employer, referral, resume file.
4. **Success card** (hidden by default): submitted message + “Track application status”.

**Bottom bar:** “Submit Application” (disabled until OTP + valid form).

**Validation:** field-level red borders via `cosmosFieldError`; banner `#careers-apply-error`.

---

## 4. Status Tracker

**Top bar:** Back + “Track Application”.

**Intro:** Short copy about OTP on the number used when applying.

**OTP card:** Same pattern as apply (phone, send, verify).

**Result area:** Latest application card — role, store, applied date (IST), status badge, hint text; empty “No application found for this number”.

---

## Pencil layout grid

Place frames on canvas with ~450px horizontal gap:

- Row 1: Home (x=0), Detail (x=450), Apply (x=900), Status (x=1350)
- y = 0 for all; width 390, height 812

No `type: "note"` nodes on canvas.

## API reference

See `docs/ui/army-careers-apply.md` for OTP and application endpoints.

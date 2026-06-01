# Army HR — Interview stage templates (Track B · B1 + B2)

**Module:** Army HR (web admin)  
**PRD:** `prd/Army_HR_PRD_v1_0.md` §5.1.3–5.1.4  
**Live app (after build):** `Army_Prototype.html`, `src/public/js/army-prototype.js`, `src/public/css/army-prototype.css`  
**Pencil file:** `UIX/pencil-new.pen` (Army HR web frames — search `AR Web —`)  
**Theme:** Store Pilot (`storepilot-theme.css` / `army-prototype.css`) — navy sidebar, blue accents, white cards

## Scope (this slice)

| ID | Deliverable | In this slice |
|----|-------------|---------------|
| **B1** | Interview stage templates — list + create/edit | Yes |
| **B2** | Attach template to job opening (optional on create/edit) | Yes |
| B3 | Schedule interview date/time per candidate | Next slice |
| B4 | Candidate modal — Interviews tab | Next slice |
| B5 | Rubric rating form | Next slice (after scheduling) |

**Out of scope (B1+B2):** calendar scheduling, rubric scoring, WhatsApp interview reminders, Command Unit template admin (templates live in Army HR admin only for v1).

---

## Theme (match existing HR admin)

| Token | Usage |
|-------|--------|
| `--navy` / `--navy2` | Sidebar |
| `--acc` / `--acc2` | Primary buttons, active nav, links |
| `--card`, `--border`, `--bg` | Surfaces |
| `--text1` / `--text2` / `--text3` | Hierarchy |
| `--greenL` / `--green` | Published / active badges |
| `--goldL` / `--gold` | Pending / warning |
| Font | DM Sans (body), JetBrains Mono (stats if any) |

Artboard: **1280×900** desktop (same as Job Openings / Pipeline frames).

---

## Screens → Pencil frame names

| # | Route | Pencil frame name |
|---|--------|-------------------|
| 1 | `/army/hr/interview-templates` | `AR Web — Interview Templates · /army/hr/interview-templates` |
| 2 | (modal on #1) | `AR Web — Template Editor Modal · create/edit` |
| 3 | `/army/hr/job-openings` (existing) | `AR Web — Job Opening Form · interview template field` (delta on existing job modal frame) |

---

## 1. Interview Templates list

**Nav:** New sidebar item under **Hiring** — `Interview Templates` (icon: calendar or clipboard-list), between Job Openings and Candidate Pipeline.

**Page header**

- Title: **Interview Templates**
- Sub: *Reusable interview stages for job openings*
- Primary: **+ New template** (permission: `army.hiring.interview_templates.edit`)

**Table columns**

| Column | Content |
|--------|---------|
| Template name | Bold name + optional one-line description (truncated) |
| Stages | e.g. `3 stages · HR Screening → Store Manager → HQ Final` |
| Used by | Count of job openings referencing template (0 = "—") |
| Status | Active (green) / Inactive (gray) |
| Actions | Edit · Duplicate · Deactivate (or — if view-only) |

**Filters:** Search by name (debounced).

**Empty state**

- Headline: **No interview templates yet**
- Sub: *Create a template to define screening and interview rounds for new hires.*
- Action: **+ New template**

**Loading:** `cosmosSkeletonTable` on tbody — no raw "Loading…".

**Permissions**

- View list: `army.hiring.interview_templates.view`
- Create/edit/deactivate: `army.hiring.interview_templates.edit`

---

## 2. Template editor modal

Opens from **+ New template** or row **Edit**. Modal width: `modal-lg` (~720px).

**Header:** `New interview template` / `Edit interview template` · close ✕

**Fields**

| Field | Type | Required |
|-------|------|----------|
| Template name | text, max 120 | Yes |
| Description | textarea, max 500 | No |
| Active | toggle (default on) | — |

**Stages section**

- Section title: **Interview stages** · helper: *Order is top to bottom. Candidates progress through each stage.*
- **+ Add stage** adds a row at the bottom.
- Each stage row (reorder via up/down buttons in v1 — no drag handle required):

| Field | Type | Notes |
|-------|------|-------|
| Stage name | text | e.g. "HR Screening" |
| Interviewer role | select | From catalog (see below) |
| Mode | select | `In-person` only in v1 (disabled single option OK) |

- Minimum **1 stage**, maximum **6** stages.
- Remove stage (✕) allowed if more than one row.

**Footer**

- Cancel (secondary)
- **Save template** (primary) — `cosmosBtnLoading` / toast on success

**Validation**

- Template name required
- Each stage: name + interviewer role required
- Duplicate stage names in same template: warn (allow but show inline hint) OR block — **block** preferred
- `cosmosFieldError` on invalid fields; banner `#modal-template-error` for summary

**Seed examples (for Pencil mock data)**

| Template | Stages |
|----------|--------|
| Retail Staff | HR Screening → Store Manager Interview |
| Store Manager | HR Screening → Regional Manager → HQ Final |
| Optometrist | HR Screening → Technical Assessment → Store Manager |

---

## 3. Job opening form — interview template field (B2)

**Location:** In existing `#modal-job` form, after **Employment type** row (or after Apply by row), full width:

| Field | Type | Required |
|-------|------|----------|
| Interview template | select | No (empty = no structured interviews; pipeline status-only) |

**Select options**

- First option: `None — manual pipeline only`
- Then active templates from API: `{name} ({n} stages)`

**Helper text:** *When set, new applicants get these interview stages automatically.*

**Edit behaviour:** Changing template on an existing opening does **not** retroactively change stages for applications already received (show info toast if user changes template on edit).

---

## Catalogs (config — single source of truth)

### `armyInterviewerRoleCatalog.js`

| key | label |
|-----|--------|
| `HR_ADMIN` | HR Admin |
| `STORE_MANAGER` | Store Manager |
| `REGIONAL_MANAGER` | Regional Manager |
| `HQ_PANEL` | HQ / Final panel |
| `TECHNICAL` | Technical assessor |

### `armyInterviewModeCatalog.js`

| key | label |
|-----|--------|
| `IN_PERSON` | In-person |

(Rubric template catalog deferred to B5.)

---

## API (B1 + B2)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/army/hr/interview-templates` | List templates + stage counts |
| GET | `/api/army/hr/interview-templates/:id` | Template + ordered stages |
| POST | `/api/army/hr/interview-templates` | Create |
| PUT | `/api/army/hr/interview-templates/:id` | Update stages (replace set) |
| PATCH | `/api/army/hr/interview-templates/:id/status` | Activate/deactivate |

**Job opening extension**

- `POST/PUT /api/army/hr/job-openings` body adds optional `interview_template_id` (null allowed)
- `GET` job detail returns `interview_template_id` + template name

**On application submit** (backend, B2)

- If job has `interview_template_id`, insert rows into `army_application_interviews` (status `PENDING`, no schedule yet) — one row per template stage, copied by `sort_order`.

---

## Database (migration 80)

- `army_interview_templates` — template_id, name, description, is_active, audit columns (IST defaults)
- `army_interview_template_stages` — stage_id, template_id, sort_order, stage_name, interviewer_role_key, mode_key
- `army_job_openings.interview_template_id` — nullable FK
- `army_application_interviews` — application_id, template_stage_id snapshot fields (stage_name, sort_order, interviewer_role_key, mode_key), status_key (`PENDING`|`SCHEDULED`|`COMPLETED`|`SKIPPED`), scheduled_at, location (nullable) — **rows created on apply; scheduling UI in B3**

---

## RBAC (`permissionsCatalogue.js`)

| Key | Label |
|-----|--------|
| `army.hiring.interview_templates.view` | Hiring — View interview templates |
| `army.hiring.interview_templates.edit` | Hiring — Create / edit interview templates |

Reuse `army.hiring.job_openings.edit` for attaching template to job (same HR editors).

---

## States & polish

- List: skeleton table, empty with CTA, toast errors
- Modal: field errors, button loading states, no `alert()`
- Nav item hidden without `interview_templates.view`
- **+ New template** hidden without `interview_templates.edit`

---

## Accessibility

- Modal: `role="dialog"`, `aria-modal`, labelledby title
- Stage rows: labels associated with inputs
- Table actions: `type="button"`, keyboard reachable

---

## Verification (after implementation)

1. Create template "Retail Staff" with 2 stages → appears in list
2. Create job opening with that template → save draft → publish
3. Apply on careers portal → application created
4. (B3) Interview rows exist in DB for that application — manual SQL or API until Interviews tab ships

---

## Pencil checklist

- [ ] Frame 1: Templates list (table + sidebar + header)
- [ ] Frame 2: Template editor modal (2–3 stage rows visible)
- [ ] Frame 3: Job modal delta showing Interview template dropdown
- [ ] Screenshots exported for user approval

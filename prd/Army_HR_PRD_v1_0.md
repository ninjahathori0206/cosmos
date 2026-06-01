# 🪖 Army — HR & People Management
## Product Requirements Document · v1.0
### Cosmos · Eyewoot Retail OS · Confidential

---

> **Project Lead:** Talha Junani  
> **Module:** Army (apps/army-mobile)  
> **Last Updated:** 2026-05-28  
> **Status:** Draft — Approved for Design

---

## 1. Overview

Army is the People Engine of Cosmos. It covers the full employee lifecycle — from the moment a job opens, through hiring, onboarding, training, day-to-day operations (attendance, leave, shifts), payroll, and all the way to offboarding. It is a **mobile-first** product (Capacitor Android/iOS) for employees and managers, paired with a **web admin panel** for HR Admin and Super Admin.

Army gives every Eyewoot employee full ownership of their work identity and performance data. Managers get fair, data-backed tools to lead their teams. HR Admin gets end-to-end hiring and workforce visibility across all stores from a single command interface.

---

## 2. Users & Roles

| Role | Platform | Core Responsibilities |
|---|---|---|
| **Candidate** | Public web (no login) | Apply for jobs, track application status |
| **Employee** | Mobile app | Attendance, leave, tasks, training, payslips, roster |
| **Store Manager** | Mobile app + Web | Manage team, approve/assign tasks, publish roster, raise vacancy requests |
| **Interviewer** | Mobile app + Web | Conduct interviews, submit rubric ratings |
| **Trainer** | Web panel | Create/deliver training content and schedules |
| **HR Admin** | Web panel (primary) | Full hiring lifecycle, payroll, leave config, employee records, offboarding |
| **Super Admin** | Web panel | Full access + cross-store visibility + config |

---

## 3. Platform Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  army-mobile  (Next.js + Capacitor 7 · Android / iOS)       │
│  Target users: Employee, Store Manager, Interviewer          │
├─────────────────────────────────────────────────────────────┤
│  army-web-admin  (web panel inside Command Unit shell)       │
│  Target users: HR Admin, Trainer, Super Admin                │
├─────────────────────────────────────────────────────────────┤
│  Candidate Portal  (public web, no auth)                     │
│  /army/careers — job listings + application form             │
└─────────────────────────────────────────────────────────────┘
         ↕ REST API  (Node.js · HrModule)
         ↕ Shared Cosmos DB (MSSQL · Prisma)
```

**Key integration:** Army reads POS orders (`WHERE cashier_id = employee_id`) for sales performance — read-only, no service call. Army uses Command Unit's UserService to create/deactivate auth accounts.

---

## 4. Departments & Job Titles

### 4.1 Departments (formal, configurable by HR Admin)

Default departments at launch:

| Code | Name |
|---|---|
| `SALES` | Sales |
| `OPTOMETRY` | Optometry |
| `LAB` | Lab / Lens Processing |
| `ADMIN` | Administration |
| `MGMT` | Management |
| `HQ` | HQ / Corporate |

HR Admin can add custom departments via Command Unit settings.

### 4.2 Job Titles

**Fixed core titles** (predefined, cannot be deleted):

| Title | Department |
|---|---|
| Sales Associate | Sales |
| Senior Sales Associate | Sales |
| Store Manager | Management |
| Assistant Store Manager | Management |
| Optometrist | Optometry |
| Lab Technician | Lab |
| Admin Executive | Admin |
| HR Executive | Admin |
| Trainer | HQ |

HR Admin can create **additional custom titles** and assign them to any department.

---

## 5. Module Breakdown

### 5.1 Hiring Pipeline (Phase 1 Priority)

The hiring pipeline follows this flow:

```
Job Opening (Manager Request → HR Approval)
       ↓
Candidate Registration (Public Portal)
       ↓
Candidate Profile Created in System
       ↓
Interview Stage(s) — per template, in-person
       ↓
Rubric Rating per Stage
       ↓
Selection Decision
       ↓
Offer Letter (Template-generated + Candidate Digital Acknowledgment)
       ↓
Employee Contract (Signed)
       ↓
Auto-Convert to Employee Profile
```

---

#### 5.1.1 Job Opening Management

**Who creates:** Store Manager raises a vacancy request → HR Admin reviews and publishes.

**Job Opening fields:**

| Field | Notes |
|---|---|
| Job Title | From fixed + custom title catalog |
| Department | From department catalog |
| Store / Location | Which store this vacancy is for |
| Number of Vacancies | Integer |
| Employment Type | Full-time · Part-time · Contract |
| Salary Range | Internal only (not shown to candidate on portal) |
| Job Description | Rich text — responsibilities |
| Requirements | Education, experience, skills |
| Application Deadline | Date |
| Status | Draft · Published · Closed · Filled |

**States:**
- `Draft` — Manager has submitted, HR has not yet approved
- `Published` — Live on candidate portal
- `Closed` — Deadline passed or HR manually closed
- `Filled` — All vacancies filled, auto-closes

**Manager flow (mobile):**
1. Tap "Raise Vacancy Request"
2. Fill job opening form
3. Submit → HR Admin gets notification
4. HR Admin reviews, edits if needed, publishes

---

#### 5.1.2 Candidate Portal (`/army/careers`)

A **public web page** — no login required.

**Pages:**
1. **Job Listings** — cards for all open positions (title, store, type, deadline). Filter by role, store, type.
2. **Job Detail** — full description + "Apply Now" button
3. **Application Form** — see fields below
4. **Status Tracker** — candidate enters phone number / email → sees current status of their application

**Application Form fields:**

| Field | Type | Notes |
|---|---|---|
| Full Name | Text | Required |
| Phone Number | Phone + WhatsApp OTP | Verified before submit |
| Email | Email | Required |
| Date of Birth | Date | Required |
| Role Applying For | Dropdown | From open job listings |
| Preferred Store | Dropdown | Optional |
| Total Work Experience | Years + Months | |
| Highest Education | Dropdown | 10th / 12th / Graduate / Post-Graduate / Other |
| Current / Last Employer | Text | Optional |
| Resume / CV | File upload (PDF/DOC ≤5MB) | Optional |
| Referral Code | Text | Optional — employee ID or promoter code of who referred them |
| Source | Auto-captured | Walk-in / WhatsApp link / Direct URL / Promoter / Internal |

**WhatsApp OTP flow:** Phone number entered → OTP sent via WhatsApp → verified → form unlocks submission. Prevents duplicate/fake applications.

**Status Tracker:** Candidate enters their registered phone → sees current stage (Applied → Screening → Interview Round N → Selected / Not Selected → Offer Issued → Joined).

**Walk-in registration:** HR/Manager staff can register a walk-in candidate manually from within the Army admin panel on behalf of the candidate.

**Internal transfer:** Existing employee applies via same portal with their employee ID prefilled as referral code — system links application to existing employee record.

---

#### 5.1.3 Interview Stage Templates

HR Admin creates **reusable stage templates** in Command Unit, e.g.:

| Template Name | Stages |
|---|---|
| Retail Staff | Stage 1: HR Screening → Stage 2: Store Manager Interview |
| Store Manager | Stage 1: HR Screening → Stage 2: Regional Manager → Stage 3: HQ Final |
| Optometrist | Stage 1: HR Screening → Stage 2: Technical Assessment → Stage 3: Store Manager |

Each stage has:
- Stage name (e.g. "HR Screening")
- Assigned interviewer role (HR Admin / Store Manager / Specific Employee)
- Mode (In-person — only mode for now)
- Scheduled date/time slot
- Rubric template to use (see 5.1.4)

When HR Admin creates a job opening, they select a stage template. Stages can be customised per opening after selection.

---

#### 5.1.4 Interview Rubric Rating

After each interview stage, the interviewer fills a **rubric form** for the candidate.

**Default rubric parameters** (HR Admin can configure these per template):

| Parameter | Score (1–10) |
|---|---|
| Communication Skills | 1–10 |
| Product / Domain Knowledge | 1–10 |
| Attitude & Professionalism | 1–10 |
| Relevant Experience | 1–10 |
| Culture Fit | 1–10 |

Plus:
- Free-text **Interviewer Notes** (mandatory)
- Final **Recommendation**: Proceed / Hold / Reject

**Aggregate score** = average of all parameters. All stage scores visible to HR Admin. Final decision by HR Admin based on all stage scores + recommendations.

---

#### 5.1.5 Candidate Management

HR Admin has a **Candidate Pipeline** view (Kanban or list):

| Column / Status | Meaning |
|---|---|
| Applied | New application received |
| Screening | Under initial HR review |
| Interview Round N | In active interview stage |
| On Hold | Pending — might be considered later |
| Selected | Passed all stages |
| Offer Issued | Offer letter sent, awaiting acknowledgment |
| Offer Accepted | Candidate confirmed joining |
| Not Selected | Rejected at any stage |
| No Show | Did not appear for interview |
| Joined | Converted to employee |

**Rejection communication:** Auto-SMS + WhatsApp message sent to candidate's registered number on status change to "Not Selected."

---

#### 5.1.6 Offer Letter

When HR Admin marks a candidate as "Selected":

1. System generates offer letter from **template** (configurable in Command Unit):
   - Candidate name, role, store, department, joining date, salary (CTC), probation period, employment type
2. HR Admin reviews the generated letter, edits if needed, and issues it
3. Candidate receives **WhatsApp / SMS notification** with a secure link
4. Candidate opens link → reads offer letter → taps **"Accept Offer"** button (digital acknowledgment)
5. Status moves to "Offer Accepted"
6. Joining date confirmed

---

#### 5.1.7 Employee Contract

After offer acceptance, HR Admin creates the employee contract:

| Section | Fields |
|---|---|
| **Role & Assignment** | Role, Department, Store, Employment type, Joining date |
| **Probation** | Probation period (default configurable by HR, e.g. 3 months). During probation: reduced leave quota + not eligible for incentives |
| **Salary Structure** | CTC components (from salary components master — see Payroll section) |
| **Documents** | Upload ID proof, address proof, photo, bank details, education certificates |
| **NDA / Confidentiality** | Standard NDA text (configurable template) |
| **Digital Signature** | Employee reads contract on app → taps "I Agree & Sign" → timestamp + device metadata recorded |

Contract PDF generated and stored. Visible to employee in their profile under "My Documents."

---

#### 5.1.8 Candidate → Employee Auto-Conversion

On contract sign:
- System **auto-creates** employee profile pre-filled from candidate data (name, phone, email, DOB, documents)
- HR Admin reviews the pre-filled profile, adds any missing fields, and confirms
- Employee account created in Command Unit's auth system
- Employee receives **Welcome SMS/WhatsApp** with login credentials
- Onboarding checklist automatically triggered

---

### 5.2 Employee Onboarding (Profiling)

After account creation, new employee and HR Admin complete the full profile together.

**Profile sections:**

| Section | Fields |
|---|---|
| **Personal Info** | Full name, DOB, gender, blood group, address (current + permanent), emergency contact (name, relation, phone) |
| **Government ID** | Aadhaar number + upload, PAN card number + upload |
| **Bank Details** | Bank name, account number, IFSC code, account type |
| **Profile Photo** | Selfie upload |
| **Previous Employment** | Employer name, role, period, reason for leaving (repeatable) |
| **Education** | Degree, institution, year, upload certificate (repeatable) |
| **Medical Declaration** | Any chronic conditions, disabilities (self-declared, confidential) |
| **Family / Dependents** | Spouse, children, parents — name, DOB, relation |
| **PF / ESI Nomination** | Nominee name, relation, percentage share |

**Onboarding Checklist** (visible to employee + HR Admin):

- [ ] Profile photo uploaded
- [ ] Aadhaar verified
- [ ] PAN uploaded
- [ ] Bank details added
- [ ] Emergency contact added
- [ ] Contract signed
- [ ] Orientation completed (see 5.3)
- [ ] Day 1 training assigned

Progress percentage shown. HR Admin can see all new employees with incomplete onboarding.

---

### 5.3 Orientation

Two-phase orientation:

#### 5.3.1 General Orientation (HQ / HR Admin manages)

- Company overview, values, policies
- Dress code and conduct guidelines
- HR policies: leave, attendance, grievance
- Cosmos app walkthrough (Store OS, Army mobile)
- **Employee signs acknowledgment** digitally

#### 5.3.2 Store Orientation (Store Manager manages)

Checklist — manager marks each item as done for each new employee:

- [ ] Physical store tour completed (each section visited)
- [ ] Introduced to full team
- [ ] Store OS / POS hands-on walkthrough
- [ ] Store-specific policies explained
- [ ] Product knowledge basics covered
- [ ] **Store Manager sign-off** — marks orientation complete

---

### 5.4 Training & Learning Management

#### 5.4.1 Training Schedule

- **HR Admin** creates training schedules
- On new employee onboarding, a **default training schedule is auto-assigned** (HR Admin defines the default)
- Schedules are assigned to individual employees or groups (by store / role / department)

A Training Schedule is a sequence of training items (LMS modules + sessions) with due dates.

#### 5.4.2 LMS — Learning Management System

HR Admin creates and publishes training content.

**Supported content types:**

| Type | Details |
|---|---|
| Text Article | Rich text editor with images |
| Video Lesson | Upload video or YouTube/Vimeo embed link |
| PDF Document | Upload SOP, guide, manual |
| Quiz / Assessment | Multiple choice + true/false. Pass mark configurable. Re-attempt allowed (max attempts configurable) |
| SCORM Package | Upload standard SCORM 1.2/2004 packages |
| Live Session | Scheduled date/time, trainer, location or video link, batch of attendees |
| Completion Certificate | Auto-generated PDF on module completion (name, module, date, score) |

**Module structure:**

```
Course
  └── Module 1
        ├── Lesson (text/video/PDF)
        ├── Lesson
        └── Quiz (must pass to complete module)
  └── Module 2
  └── Final Assessment
  └── Certificate (if all modules passed)
```

**Employee LMS view (mobile):**
- My Learning Path — assigned courses with progress bars
- Due today / this week
- Completed courses + certificates

#### 5.4.3 Onsite Training (at Store)

- Conducted at the employee's assigned store
- Trainer or Store Manager leads
- Attendance recorded within the session
- Linked to LMS module for content (optional)
- Manager marks session complete → employee's training score updated

#### 5.4.4 Offsite Training (at Training Center / HQ)

- External venue: Training Center or HQ
- Additional fields vs. onsite:
  - Venue address
  - Travel arrangement (Yes/No)
  - Accommodation required (Yes/No)
  - Estimated cost (for HR budgeting)
  - Attendance proof: **selfie at venue** (GPS tagged at HQ/Training Center location)
  - External completion certificate upload (mandatory on completion)
- Employee submits attendance proof via Army mobile

---

### 5.5 Placement & Store Allocation

**Placement** = Post-training confirmation of final store assignment.

Flow:
1. During onboarding, employee is assigned to a **primary store** (from contract)
2. After onboarding + orientation + mandatory training schedule is complete, HR Admin confirms **final placement**
3. Placement confirmation unlocks: full attendance tracking, leave quota activation, performance score tracking

**Store Allocation rules:**
- Every employee has exactly **one primary store**
- Employee can be sent on **temporary assignment** to another store (defined period, reason required, HR Admin approves)
- During temporary assignment, attendance is tracked at the assigned store's GPS coordinates
- HQ/Trainer staff are marked as **"Floating"** — no fixed store GPS for attendance (manual check-in by HR Admin)

---

### 5.6 Attendance

**Method:** GPS + mandatory selfie — the only check-in method for field staff.

**Check-in flow (employee mobile):**
1. Employee opens Army app → taps "Check In"
2. App captures GPS coordinates
3. System validates: within 100m of assigned store GPS coordinates
4. If valid: **selfie capture** prompted
5. Selfie uploaded → check-in recorded with server timestamp (anti-fraud — client cannot send custom timestamps)
6. If outside 100m: error shown, employee cannot check in (exception: Floating staff)

**Check-out flow:** Same as check-in — GPS + selfie.

**Attendance states per day:**

| State | Meaning |
|---|---|
| Present | Check-in + check-out recorded |
| Half Day | Only one of check-in/out recorded, or manager marks as half-day |
| Late Mark | Check-in after configured grace period (e.g. 15 min after shift start) |
| Absent | No check-in for the day |
| Leave | Approved leave for that day |
| Holiday | Public/store holiday |
| Tour Duty | Employee marked on travel duty by HR Admin — no GPS check-in required |
| Floating | HQ/Trainer staff — manual mark by HR Admin |

**Late mark:** Configurable grace period (HR Admin sets in minutes, e.g. 15 min). Late marks affect Attendance performance sub-score.

**Manager attendance override:** Store Manager can raise an **attendance correction request** for an employee (e.g. system failure, GPS error). HR Admin approves/rejects the correction. Full audit trail maintained.

**Monthly attendance summary** visible to employee and manager — working days, present days, late marks, absences, leaves.

---

### 5.7 Leave Management

#### 5.7.1 Leave Types

| Type | Code | Notes |
|---|---|---|
| Casual Leave | CL | Short-notice leave |
| Sick Leave | SL | Medical certificate required if > 2 consecutive days |
| Earned / Privilege Leave | EL | Accrued over time (monthly accrual rate configurable) |
| Maternity Leave | ML | As per statutory rules |
| Paternity Leave | PL | Configurable days |
| Unpaid Leave | UL | No pay, no quota limit |
| Compensatory Off | CO | Awarded for working on holidays. Expires if not used within configurable window |
| Loss of Pay | LOP | Auto-applied when employee is absent without approved leave |

#### 5.7.2 Leave Quota Configuration

HR Admin configures in **Command Unit → Army Settings → Leave Policy**:

- Per leave type: annual quota, accrual rules, carry-forward limit, max consecutive days
- Probation employees: separate (reduced) quota configurable
- Separate quotas can be set by job role if needed

#### 5.7.3 Leave Request Flow

1. Employee taps "Apply Leave" on Army mobile
2. Selects leave type, date range, reason
3. Uploads medical certificate if SL > 2 days
4. Submits → **HR Admin receives notification**
5. HR Admin approves / rejects with optional comment
6. Employee notified (push + WhatsApp/SMS)
7. If approved: dates blocked in attendance calendar, quota decremented
8. If absent without approval: auto-LOP applied at month end

**Cancellation:** Employee can cancel an approved leave (if not yet started). HR Admin notified.

**Leave balance** visible to employee on Army mobile home screen.

---

### 5.8 Shift Scheduling & Roster

**Model:** Weekly roster — manager publishes a schedule covering Mon–Sun for the entire store team.

**Roster creation flow:**
1. Manager opens "Roster" tab in Army app
2. Selects week
3. For each employee: assigns shift (start time, end time) per day or marks as Off/Holiday
4. Can copy previous week's roster as template
5. Submits roster → **HR Admin receives notification for review**
6. HR Admin reviews and **confirms / approves** the roster
7. On HR Admin approval → roster is **published** → all employees get push notification ("Your roster for week of [date] is live")

**Shift definition:** HR Admin defines standard shift types in Command Unit (e.g. Morning 9am–6pm, Evening 1pm–9pm, Full Day 10am–7pm). Manager selects from these when building roster.

**Roster visibility:**
- Employee sees their own week schedule on mobile
- Manager sees full team roster
- Absence of a published roster = default shift times used for attendance

**Attendance link:** Shift start time used to calculate late marks for that employee on that day.

---

### 5.9 Payroll

#### 5.9.1 Salary Components Master

HR Admin configures all salary components in **Command Unit → Army Settings → Salary Components**. Components are:

| Component | Type | Default |
|---|---|---|
| Basic Salary | Earning | Required |
| HRA (House Rent Allowance) | Earning | Optional |
| Transport / Conveyance | Earning | Optional |
| Medical Allowance | Earning | Optional |
| Special Allowance | Earning | Optional |
| Provident Fund (Employee) | Deduction | 12% of Basic |
| Provident Fund (Employer) | Employer Contribution | 12% of Basic |
| ESI (Employee) | Deduction | 0.75% of Gross (if salary ≤ ₹21,000) |
| ESI (Employer) | Employer Contribution | 3.25% of Gross |
| TDS / Professional Tax | Deduction | As per slab |
| Salary Advance Repayment | Deduction | Per advance record |
| Overtime Pay | Earning | Calculated from extra hours |
| Performance Incentive | Earning | Added from score tier (Phase 2) |

HR Admin can add **custom components** (earning or deduction) with fixed amount or percentage formula.

#### 5.9.2 Payroll Processing (Monthly)

**Payroll cycle:**

1. **Payroll opens** on configured day (e.g. 25th of month) — HR Admin notified
2. System auto-calculates:
   - Attendance days present → LOP calculated for absent days
   - Leaves applied → approved leaves don't trigger LOP, unapproved absences do
   - Overtime hours (if applicable)
   - Advance repayments due
   - All component amounts per employee's salary structure
3. HR Admin sees **payroll summary table** — all employees, gross, deductions, net
4. HR Admin can manually adjust individual entries (with mandatory reason / audit note)
5. HR Admin **approves payroll** — locked for the month
6. **Payslips auto-generated** (PDF) and pushed to each employee's Army app + WhatsApp notification

#### 5.9.3 Payslip

Employee can view all payslips in Army mobile under "My Payslips."

Payslip shows:
- Month, employee name, ID, designation, store
- Earnings breakdown
- Deductions breakdown
- Net payable
- Days present, LOP days, leaves taken
- YTD (year-to-date) totals

Downloadable as PDF.

#### 5.9.4 Salary Advance

Employee can raise a **salary advance request** from Army mobile:
- Amount, reason, repayment plan (how many months)
- HR Admin approves/rejects
- Approved advances automatically deducted from subsequent payrolls

---

### 5.10 Performance Score

**Score is live** (employee can see their running score at any time on Army mobile) **and locked monthly** (snapshot taken at end of month, used for incentive calculation in Phase 2).

**Phase 1 score formula (Tasks + Manager Rating deferred to Phase 2):**

| Factor | Weight | Source | Phase |
|---|---|---|---|
| Sales | 40% | POS orders WHERE cashier_id = employee_id (this month) | Phase 1 |
| Attendance | 35% | Attendance records (present %, late marks penalty) | Phase 1 |
| Training Completed | 25% | Training modules completed / assigned this month | Phase 1 |
| Tasks Completed | — | Completed tasks / total assigned tasks | **Phase 2** |
| Manager Rating | — | Manager monthly rating form | **Phase 2** |

**Score tiers (for Phase 2 incentive):**

| Tier | Score Range | Bonus |
|---|---|---|
| Elite | 90–100 | 20% of basic salary |
| Strong | 75–89 | 10% of basic salary |
| Good | 60–74 | 5% of basic salary |
| Developing | < 60 | No bonus |

**Probation employees:** Performance score tracked but not linked to incentives until confirmed.

---

### 5.11 Task Management — **Phase 2**

Task management (manager-assigned tasks, proof upload, task completion feeding performance score) is deferred to Phase 2.

Phase 1 performance score uses: Sales + Attendance + Training only (tasks weight redistributed).

---

### 5.12 Offboarding / Exit Management

**Triggered by:** Employee resignation OR HR Admin initiates termination.

**Resignation flow (Employee-initiated):**
1. Employee submits resignation from Army mobile — reason, last working day request
2. HR Admin receives notification → confirms notice period and last working day
3. Notice period tracked in attendance calendar (employee marked "Serving Notice")

**Clearance Checklist (HR Admin manages):**

| Item | Cleared By |
|---|---|
| Company assets returned (phone, uniform, ID card) | Store Manager |
| Store OS access revoked | IT / HR Admin (auto on exit date) |
| Final payroll processed (including pending leaves, advances) | HR Admin |
| PF/ESI exit filing | HR Admin |
| Experience letter issued | HR Admin |
| Exit interview completed | HR Admin |

**Exit Interview:** Structured form with configurable questions (HR Admin sets in Command Unit). Submitted by departing employee, reviewed by HR Admin. Results are confidential — only HR Admin and Super Admin can view.

**Final Settlement:**
- Calculated automatically: unpaid salary + leave encashment (EL balance × per-day salary) − advance recoveries
- HR Admin reviews and approves
- Employee marked as **Inactive** on confirmed exit date
- Auth account deactivated automatically

**Employee record retained** (read-only) for audit, statutory compliance, and re-hire consideration.

---

## 6. Notifications — **Phase 2**

Full push + WhatsApp/SMS notification system is deferred to Phase 2.

Phase 1 will use in-app status indicators and manual refresh only. No background push notifications in Phase 1.

**Phase 2 notification events planned:**

| Event | Channel | Recipient |
|---|---|---|
| Interview scheduled / reminder (24h before) | Push + WhatsApp | Candidate |
| Offer letter issued | Push + WhatsApp | Candidate |
| Offer acceptance confirmed | Push | HR Admin |
| Employee account created (welcome) | WhatsApp | New Employee |
| Missed check-in reminder (30 min after shift start) | Push | Employee |
| Leave approved / rejected | Push + SMS | Employee |
| New task assigned | Push | Employee |
| Training module due (1 day before deadline) | Push | Employee |
| Payslip available | Push + WhatsApp | Employee |
| Weekly roster published | Push | Employee |
| Salary advance approved / rejected | Push | Employee |
| Resignation acknowledged / notice confirmed | Push | Employee |
| Employee performance score below threshold (< 60) | Push | Manager |
| Payroll ready for approval | Push | HR Admin |
| New vacancy request from manager | Push | HR Admin |
| Attendance correction request | Push | HR Admin |
| Leave request received | Push | HR Admin |

---

## 7. Data Model (Key Tables)

```
job_openings          — id, title_id, store_id, dept_id, vacancies, status, deadline, ...
candidates            — id, name, phone, email, dob, source, referral_code, resume_url, ...
applications          — id, candidate_id, job_opening_id, status, applied_at, ...
interview_templates   — id, name, stages_json, ...
interview_stages      — id, application_id, template_stage_id, interviewer_id, scheduled_at, ...
interview_ratings     — id, stage_id, interviewer_id, rubric_scores_json, notes, recommendation, ...
offer_letters         — id, application_id, template_id, generated_url, acknowledged_at, ...
employees             — id, candidate_id (nullable), name, phone, email, store_id, ...
employee_contracts    — id, employee_id, role_id, dept_id, salary_structure_json, probation_end, ...
employee_documents    — id, employee_id, doc_type, url, verified, ...
onboarding_checklists — id, employee_id, items_json, completed_at, ...
attendance            — id, employee_id, date, checkin_time, checkout_time, status, ...
attendance_corrections— id, attendance_id, requested_by, approved_by, reason, ...
leaves                — id, employee_id, leave_type, from_date, to_date, status, ...
leave_quotas          — id, employee_id, leave_type, annual_quota, used, balance, ...
shifts                — id, name, start_time, end_time, ...
rosters               — id, store_id, week_start, published_at, ...
roster_entries        — id, roster_id, employee_id, date, shift_id, is_off, ...
salary_components     — id, name, type (earning/deduction), formula, ...
employee_salary       — id, employee_id, components_json, effective_from, ...
payroll_runs          — id, month, status (draft/approved/locked), ...
payroll_entries       — id, payroll_run_id, employee_id, gross, deductions, net, lop_days, ...
payslips              — id, payroll_entry_id, pdf_url, generated_at, ...
salary_advances       — id, employee_id, amount, reason, repayment_months, status, ...
performance_scores    — id, employee_id, month, sales_score, attendance_score, task_score, training_score, total, snapshot, ...
tasks                 — id, title, description, assigned_by, assignee_id, due_date, status, proof_url, ...
training_schedules    — id, employee_id, assigned_by, items_json, ...
lms_courses           — id, title, dept_id, modules_json, ...
lms_progress          — id, employee_id, course_id, progress_pct, completed_at, certificate_url, ...
training_sessions     — id, type (onsite/offsite), trainer_id, venue, scheduled_at, cost, ...
training_attendance   — id, session_id, employee_id, proof_url, attended, ...
exit_requests         — id, employee_id, reason, last_working_day, status, ...
clearance_items       — id, exit_request_id, item, cleared_by, cleared_at, ...
exit_interviews       — id, exit_request_id, responses_json, submitted_at, ...
final_settlements     — id, exit_request_id, unpaid_salary, leave_encash, advance_deduction, net_payable, approved_by, ...
```

---

## 8. Inter-Module Dependencies

| Dependency | Direction | Purpose |
|---|---|---|
| POS Orders | Army reads | Sales score = POS orders WHERE cashier_id = employee_id (month) |
| Command Unit — UserService | Army writes | Create / deactivate auth accounts on hire / exit |
| Command Unit — Store Config | Army reads | Store GPS coordinates, shift defaults, leave policy settings |
| Command Unit — RBAC | Army reads | Role-permission enforcement |
| Foundry | None | No direct dependency |
| Eyewoot Go | None | No direct dependency |

---

## 9. Build Phases

### Phase 1 — Hiring Pipeline (Sprint 1–4, ~4 weeks)

| Sprint | Deliverables |
|---|---|
| S1 | Job Opening management (web admin) · Candidate portal (public web) · Application form + WhatsApp OTP |
| S2 | Candidate Pipeline board · Interview stage templates · Stage scheduling |
| S3 | Rubric rating form · Candidate status tracker · Auto-rejection messaging |
| S4 | Offer letter generation + candidate acknowledgment · Employee Contract · Auto-convert to employee |

### Phase 1 — Employee Management (Sprint 5–10, ~6 weeks)

| Sprint | Deliverables |
|---|---|
| S5 | Employee profile (onboarding) · Document management · Onboarding checklist |
| S6 | Orientation checklists · Placement + Store Allocation |
| S7 | Attendance (GPS + selfie) · Roster + Shift scheduling |
| S8 | Leave management (all types) · Leave quota configuration |
| S9 | Salary components master · Payroll processing · Payslips |
| S10 | LMS (content types) · Training schedules · Onsite + Offsite training |

### Phase 1 — Operations (Sprint 11–12, ~2 weeks)

| Sprint | Deliverables |
|---|---|
| S11 | Performance score (live + monthly snapshot — Sales, Attendance, Training) |
| S12 | Offboarding / Exit management · Final settlement |

### Phase 2 (Future)

- Performance incentive payout (linked to score tiers, added to payroll)
- Manager Rating (20% score component)
- Task Management (manager-assigned tasks, proof upload, feeds performance score)
- Full push + WhatsApp/SMS notification system
- Payroll generation / salary slips export to accounting
- Shift scheduling advanced (auto-suggestions, conflict detection)
- AI-assisted performance insights

---

## 10. Key Business Rules

1. **Server-side timestamps only** — check-in/check-out times are always set server-side. Client cannot send a custom timestamp. This prevents clock manipulation fraud.
2. **GPS radius enforcement** — 100m from store GPS coordinates. Configurable per store in Command Unit.
3. **Probation restrictions** — Probation employees: reduced leave quota (configurable), not eligible for performance incentives until confirmed.
4. **LOP is automatic** — If employee is absent without approved leave, LOP is auto-applied at payroll run. No manual trigger required.
5. **Payroll is locked** — Once HR Admin approves a payroll run, no further edits. Re-run requires HR Admin to unlock with audit note.
6. **Employee record retained on exit** — Inactive employees remain in DB. Auth access revoked, but all records (attendance, payroll, performance) kept for compliance.
7. **Candidate data carries forward** — When a candidate is hired, their application data auto-populates the employee profile. No re-entry.
8. **Floating staff attendance** — HQ and Trainer employees marked as "Floating" — no GPS radius enforcement. HR Admin manually approves their attendance corrections.
9. **Comp-off expiry** — Compensatory offs expire if not used within the configured window (default: 30 days, configurable).
10. **Performance score Phase 1 weights** — With Manager Rating deferred, weights are redistributed: Sales 40% · Attendance 30% · Tasks 15% · Training 15%.

---

## 11. Open Items / Decisions Pending

| # | Item | Owner | Notes |
|---|---|---|---|
| 1 | Biometric integration (fingerprint at store device) | HR Admin + Dev | Possible Phase 2 enhancement alongside GPS selfie |
| 2 | Payroll accounting export (Tally / CSV) | HR Admin | Phase 2 |
| 3 | Manager Rating rubric parameters | HR Admin | Phase 2 — defer full design |
| 4 | Incentive payout mechanism (manual bank transfer vs. auto) | Finance | Phase 2 |
| 5 | SCORM hosting (self-hosted vs. external CDN) | Dev | Decision needed before LMS sprint |
| 6 | Offer letter template design | HR Admin | Content and format to be provided |
| 7 | Statutory compliance rules (PF/ESI thresholds, PT slabs by state) | HR Admin | State-specific setup needed before payroll sprint |

---

*🪖 Army · Cosmos · Eyewoot Retail OS · PRD v1.0 · 2026-05-28*

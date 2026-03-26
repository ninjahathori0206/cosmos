## 🌌 Cosmos ERP — Command Unit + Foundry  
### Phase-wise Master Development TODO (Node.js · MSSQL · Stored Procedures · REST API · IIS + PM2)

> **Scope:** This master checklist covers the shared platform, ⚙️ Command Unit, and 🔩 Foundry modules, on a Node.js + MSSQL stack with stored procedures and REST APIs, deployable on both IIS and PM2.  
> **Authoritative Foundry details:** For deep Foundry-only tasks (tables, SPs, APIs, UI), see `COSMOS_FOUNDRY_DEV_TODO.md`. This file adds Command Unit and shared-platform tasks and unifies everything phase-wise.

---

## 🧱 Architecture Guardrails (Apply to Every Phase)

- **Database**
  - MSSQL only.
  - No `BIGINT`; use `INT IDENTITY(1,1)` for primary keys.
  - No `VARCHAR` longer than 500; prefer `VARCHAR(20–100)` for codes, `VARCHAR(200)` for names, `VARCHAR(500)` for descriptions.
  - All temporal fields are `DATETIME` with `DEFAULT GETDATE()` (server time only).
- **Data Access**
  - All reads/writes via stored procedures; **no raw SQL** in Node.js.
  - All DB access from the web app happens through REST APIs; **no direct DB connections** from frontend.
- **Security**
  - Two-layer API auth on every endpoint: `X-API-Key` + JWT Bearer token.
  - Optional AES-based encryption for especially sensitive payloads (auth, bills, some settings).
- **Error Handling & Logging**
  - Stored procedures use `TRY...CATCH` + transactions where integrity matters.
  - Node.js APIs translate DB errors into structured JSON `{ success, data, message, errors }`.
  - Global error handler and Winston logger record all errors and important events.
- **Auditability**
  - Every `CREATE` / `UPDATE` / `DELETE` on critical entities writes to `audit_logs`.
- **Supplier Confidentiality**
  - Internal fields like `maker_id`, `source_collection` never leave sensitive APIs; only authorised roles (HQ / Procurement) see them.
- **Performance**
  - Use pagination for all list endpoints.
  - Index primary foreign-key relationships and frequent filters (store, status, date).

---

## 🏗️ Phase 0 — Shared Platform & Infrastructure

> **Goal:** One Node.js + MSSQL platform serving Command Unit + Foundry, with 2-layer auth, logging, and dual IIS/PM2 deployment.

- [ ] P0.1 — **Repository & Project Structure (Backend + Frontend Shell)**
  - Create a Node.js project with `package.json` and the following layout:
    - `src/config` — environment and MSSQL config (connection strings, pool options, timeouts).
    - `src/middleware` — API key auth, JWT auth, role checks, error handler, request logging.
    - `src/services` — thin service layer that calls stored procedures via a shared MSSQL helper.
    - `src/api` — route handlers grouped by domain (`auth`, `users`, `stores`, `home-brands`, `settings`, `purchases`, `branding`, `digitisation`, `skus`, `stock`, `rate-intelligence`, `audit`, etc.).
    - `src/public` — static HTML/CSS/JS for Command Unit and Foundry UIs (based on the prototype HTML files).
    - `sql/tables` — table creation scripts for shared, Command Unit, Foundry.
    - `sql/sp` — stored procedure scripts grouped by module.
    - `sql/seed` — baseline seed scripts (admin users, default settings, sample data).
    - `logs/` — application log output for Winston + IIS/PM2 logs.
- [ ] P0.2 — **Core Dependencies & Configuration**
  - Install and configure:
    - `express`, `mssql`, `dotenv`, `helmet`, `cors`, `express-rate-limit`.
    - `winston`, `morgan` (or integrate into Winston), `jsonwebtoken`, `bcryptjs`.
    - `joi` for request validation; `multer` + `sharp` for uploads/media.
  - Define `.env` keys (with `.env.example`):
    - DB: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`.
    - Auth: `JWT_SECRET`, `JWT_EXPIRES_IN`, `API_KEY`, optional `ENCRYPTION_KEY`.
    - App: `PORT`, `NODE_ENV`, logging paths, upload paths.
- [ ] P0.3 — **MSSQL Connection & SP Helper**
  - Implement central MSSQL connection module:
    - A reusable pool with sensible timeouts.
    - A helper like `executeStoredProcedure(name, params)` that:
      - Uses parameterised calls.
      - Handles scalar and table-valued results.
      - Logs duration and error codes.
- [ ] P0.4 — **2-Layer Authentication (API Key + JWT)**
  - API key middleware:
    - Validates `X-API-Key` per client (web admin vs future mobile).
  - JWT middleware:
    - Validates token, attaches user claims (`user_id`, `role`, `store_id`, `module_access[]`) to `req`.
  - Encryption utility:
    - AES-256-CBC helpers for encrypting/decrypting sensitive responses (e.g. tokens).
- [ ] P0.5 — **Global Error Handling & Logging**
  - Error handler middleware:
    - Uniform JSON error response, no stack trace in production.
  - Request logging:
    - Per-request correlation ID, method, URL, duration, result code.
  - Winston logger:
    - Separate transports for console (dev) and file (prod).
- [ ] P0.6 — **Hosting Targets (IIS + PM2)**
  - `web.config` for IIS + iisnode (routes all requests to `app.js`, production env, logs path).
  - `ecosystem.config.js` for PM2 (cluster mode, log files, environments).
  - Basic `DEPLOYMENT.md` describing IIS and PM2 startup/stop/rollback procedures.

---

## 🗃️ Phase 1 — Database Schema (Shared + Command Unit + Foundry)

> **Goal:** A complete MSSQL schema for shared, Command Unit, and Foundry domains, aligned with the PRDs and respecting all constraints.

### P1.1 — Shared Core Tables

- [ ] P1.1.1 — **Users & Roles**
  - `users` — authentication + global identity; includes role key and optional `store_id`.
  - `roles` — role keys, labels, hierarchy level.
  - `role_permissions` — mapping of roles to permissions or capabilities.
- [ ] P1.1.2 — **Stores & Modules**
  - `stores` — master for all physical and virtual units (owned, franchise, kiosk, D2C).
  - `store_module_access` — which modules (Command Unit, Foundry, POS, Army, Go, Promoter) are enabled per store.
- [ ] P1.1.3 — **Settings, Tokens & Audit**
  - `app_settings` — configuration for GST thresholds, discrepancy thresholds, stock alert defaults, performance weights, loyalty rules, etc.
  - `token_blacklist` — invalidated JWT tokens (logout, forced expiry).
  - `audit_logs` — unified audit trail across modules.

### P1.2 — Command Unit Tables

- [ ] P1.2.1 — **Home Brands, Membership, Leave Types**
  - `home_brands` — Eyewoot private-label brand list, with `brand_code`, description, logo, active flag.
  - `membership_tiers` — membership products (Silver, Gold, etc.) with price, benefits, default loyalty tier impact.
  - `leave_types` — HR leave types (casual, sick, maternity, unpaid) with quotas, carry-forward, scoring impact.
- [ ] P1.2.2 — **System Settings & Business Rules**
  - `gst_rates` — HSN/SAC-specific GST splits and applicability.
  - `performance_weights` — sales/attendance/manager rating/task/training contributions to Army scores.
  - `loyalty_rules` — earn/burn rules, thresholds, expiry.
  - `promoter_commission_rules` — promoter commission percentages and payout thresholds.
  - `misc_settings` — attendance radius, Rx validity period, slow-mover days, low stock thresholds.
- [ ] P1.2.3 — **RBAC & Module Access**
  - `role_module_access` — which modules each role can access.
  - `role_store_scope` — defines if a role is global or store-scoped.

### P1.3 — Foundry Tables

- [ ] P1.3.1 — **Procurement & Branding**
  - Use the detailed table set already specified in `COSMOS_FOUNDRY_DEV_TODO.md`:
    - `product_master`, `suppliers`, `purchases`, `purchase_colours`, `branding_jobs`, `branding_job_colours`.
- [ ] P1.3.2 — **Digitisation & Catalogue**
  - `skus`, `sku_digitisation`, `sku_media` as per Foundry TODO.
- [ ] P1.3.3 — **Stock & Rate Intelligence**
  - `stock_balances`, `stock_movements`, `location_visibility_config`.
  - `vendor_product_rates`, `product_rate_summary`.

### P1.4 — Schema Verification

- [ ] P1.4.1 — Cross-check all tables against:
  - `Cosmos_Master_PRD_v1_0.md` (global architecture + module responsibilities).
  - `Foundry_Procurement_PRD_Master_v1_2_1.md` (procurement pipeline, repeat detection, stock distribution, rate intelligence).
  - `CommandUnit_Prototype.html` and `Foundry_Prototype.html` (UI elements and data fields).
- [ ] P1.4.2 — Ensure all foreign keys and indexes are defined and named.

---

## ⚙️ Phase 2 — Stored Procedures Catalogue

> **Goal:** Enumerate and group all required stored procedures before implementation, by table group and workflow. See `COSMOS_FOUNDRY_DEV_TODO.md` for the full Foundry SP list.

### P2.1 — Shared & Auth SPs

- [ ] Auth & Tokens
  - `sp_Auth_Login`, `sp_Auth_Logout`, `sp_Auth_CheckTokenBlacklist`, `sp_Auth_PurgeExpiredTokens`.
- [ ] Users & Roles
  - `sp_User_GetAll`, `sp_User_GetById`, `sp_User_Create`, `sp_User_Update`, `sp_User_Deactivate`, `sp_User_UpdatePassword`.
  - `sp_Role_GetAll`, `sp_Role_GetPermissions`, `sp_Role_UpdatePermissions`.
- [ ] Settings & Audit
  - `sp_Settings_Get`, `sp_Settings_Set`.
  - `sp_Audit_Log`, `sp_Audit_GetLogs`.

### P2.2 — Command Unit SPs

- [ ] Stores & Module Access
  - `sp_Store_GetAll`, `sp_Store_GetById`, `sp_Store_Create`, `sp_Store_Update`, `sp_Store_SetStatus`.
  - `sp_Store_GetModuleAccess`, `sp_Store_SetModuleAccess`.
- [ ] Home Brands, Membership, Leave Types
  - `sp_HomeBrand_*` (GetAll, GetById, Create, Update, Deactivate, CheckCodeExists).
  - `sp_MembershipTier_*` (CRUD, status updates).
  - `sp_LeaveType_*` (CRUD, status updates).
- [ ] System Settings
  - `sp_GSTRates_*` (CRUD).
  - `sp_PerformanceWeights_Get/Set`.
  - `sp_LoyaltyRules_Get/Set`.
  - `sp_PromoterCommissionRules_Get/Set`.
  - `sp_MiscSettings_Get/Set`.

### P2.3 — Foundry SPs

- [ ] Procurement, Branding, Digitisation, Stock, Rate Intelligence
  - Use the existing detailed SP list defined in `COSMOS_FOUNDRY_DEV_TODO.md`, grouped as:
    - Auth & user SPs (shared).
    - Product master & repeat detection SPs.
    - Purchase registration & bill verification SPs.
    - Branding workflows SPs (including bypass rules).
    - SKU & digitisation SPs.
    - Stock balance & movement SPs.
    - Rate intelligence SPs.

---

## 🔌 Phase 3 — REST API Surface (Express)

> **Goal:** Map all workflows from the PRDs and UI prototypes onto RESTful endpoints that call the stored procedures.

### P3.1 — Shared & Auth APIs

- [ ] `/api/auth/*` — login, refresh, logout, `me`, all using 2-layer auth and token blacklist SPs.
- [ ] `/api/settings/*` — generic settings gets/sets for app-wide configuration keys.
- [ ] `/api/audit-logs` — paginated audit query with filters for module, action, user, date.

### P3.2 — Command Unit APIs

- [ ] Stores & Module Access
  - `GET /api/stores`, `GET /api/stores/:id`, `POST /api/stores`, `PUT /api/stores/:id`, `PUT /api/stores/:id/status`.
  - `GET /api/stores/:id/modules`, `PUT /api/stores/:id/modules` (module enable/disable).
- [ ] Users & Roles
  - `GET/POST/PUT/DELETE /api/users` and `/api/users/:id` (Super Admin / HR Admin).
  - Role + permission endpoints to support the Roles & Permissions UI.
- [ ] System Settings
  - `GET/PUT /api/settings/gst-rates`.
  - `GET/PUT /api/settings/performance-weights`.
  - `GET/PUT /api/settings/loyalty-rules`.
  - `GET/PUT /api/settings/promoter-commission`.
  - `GET/PUT /api/settings/misc` (attendance radius, Rx validity, slow-mover days, low-stock threshold).
- [ ] Home Brands, Membership, Leave Types, Location Types
  - `/api/home-brands/*`, `/api/memberships/*`, `/api/leave-types/*`, `/api/location-types/*`.

### P3.3 — Foundry APIs

- [ ] Use the endpoint definitions already specified in `COSMOS_FOUNDRY_DEV_TODO.md`, including:
  - Procurement: `/api/purchases/*`, `/api/products/*`, `/api/suppliers/*`.
  - Bill verification: `/api/purchases/:id/bill*`.
  - Branding: `/api/purchases/:id/branding*`.
  - Digitisation & SKUs: `/api/skus/*`, `/api/products/:productId/digitisation-recall`.
  - Stock: `/api/stock/*`.
  - Rate Intelligence: `/api/rate-intelligence/*`.

---

## 🖥️ Phase 4 — Frontend Wiring (Command Unit + Foundry)

> **Goal:** Turn the static prototype HTML for Command Unit and Foundry into live, data-driven UIs that talk to the APIs.

### P4.1 — Shared Frontend Utilities

- [ ] Implement shared scripts used by both modules:
  - `public/js/api.js` — fetch wrapper with API key + JWT + unified error handling.
  - `public/js/auth.js` — login/logout, token storage (`sessionStorage`), route guards.
  - `public/js/toast.js` — toast notification component.
  - `public/js/loader.js` — page-level and inline loaders.
  - `public/js/validators.js` — client-side validation mirroring `joi` where useful.

### P4.2 — Command Unit UI Wiring

- [ ] Dashboard
  - Replace hard-coded stats and tables in `CommandUnit_Prototype.html` with data from:
    - Store, user, and module access APIs.
    - Foundry summaries (purchases, stock, alerts) where needed.
- [ ] Store Management
  - Wire store list, filters, and modals to `/api/stores` & module-access endpoints.
- [ ] User Management
  - Wire user list/search and Add Core User modal to `/api/users` and auth APIs.
- [ ] Roles & Permissions
  - Wire roles table and permission matrix to role SP-backed APIs.
- [ ] Module Access Control
  - Wire per-store module toggles to `store_module_access` APIs.
- [ ] System Settings
  - Wire GST, performance, loyalty, promoter, and misc settings tabs to their APIs.
- [ ] Membership Tiers, Home Brands, Leave Types, Location Types
  - Turn cards/tables + modals in the prototype into live CRUD forms.
- [ ] Audit Logs
  - Wire Audit Logs page filters and table to `/api/audit-logs`.

### P4.3 — Foundry UI Wiring

- [ ] Consult `COSMOS_FOUNDRY_DEV_TODO.md` and:
  - Replace static dashboard widgets with purchase/stock/alerts data.
  - Implement full New Purchase → Bill Verify → Branding → Digitisation → Warehouse flows with UI tied to their endpoints.
  - Wire the SKU Stock Distribution, Lens Portfolio, Rate Intelligence, and Suppliers screens to their respective APIs.

---

## 🧪 Phase 5 — Testing & QA

> **Goal:** Clear, repeatable testing strategy tied back to the PRDs.

- [ ] P5.1 — **Unit Tests (Backend)**
  - Test MSSQL helper, auth helpers (JWT, API key), encryption, and core utilities (GST calc, SKU code generation).
- [ ] P5.2 — **Integration Tests (APIs)**
  - Happy-path and error-path tests for:
    - Auth flows (login/refresh/logout).
    - Command Unit management APIs (stores, users, settings).
    - Foundry procurement pipeline (purchases, bill verification, branding, digitisation, stock, rate intelligence).
- [ ] P5.3 — **Frontend Tests**
  - Manual/automated UI checks for Command Unit and Foundry flows:
    - Form validations.
    - Error states and toasts.
    - Role-based visibility of actions.
- [ ] P5.4 — **Security & Performance**
  - Verify all endpoints enforce API key + JWT.
  - Attempt SQL injection and invalid inputs; confirm SPs and validation block them.
  - Load test key list endpoints (purchases, stock, suppliers, audit logs).

---

## 🚀 Phase 6 — Deployment & Operations

> **Goal:** Documented, repeatable deploy to Windows Server (IIS + PM2) with logging and monitoring.

- [ ] P6.1 — **Environment Setup**
  - Document how to configure `.env` for dev/staging/prod.
  - Describe DB provisioning and permissions for each environment.
- [ ] P6.2 — **IIS Deployment Runbook**
  - Step-by-step IIS app creation, iisnode setup, `web.config` tuning, log locations, and rollback.
- [ ] P6.3 — **PM2 Deployment Runbook**
  - `ecosystem.config.js` usage, starting/stopping, log inspection, and Windows service auto-start.
- [ ] P6.4 — **Monitoring & Logs**
  - Define what to monitor (errors, slow queries, low stock alerts, auth failures).
  - Document how to trace an issue from a UI error to API log to DB audit row.

---

*This master TODO is the high-level contract for building Cosmos ERP (Command Unit + Foundry) on Node.js + MSSQL. For Foundry-specific details, always cross-reference `COSMOS_FOUNDRY_DEV_TODO.md` and the Foundry PRD; for global architecture, refer to `Cosmos_Master_PRD_v1_0.md` and this file.*


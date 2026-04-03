# 🌌 COSMOS ERP — Foundry Module
## Master Development TODO List & Phase Plan
### Node.js Web App · MSSQL · Stored Procedures · REST API · IIS + PM2

> **Project Lead:** Talha Junani · **Platform:** Node.js (Windows Server / IIS + PM2)
> **Database:** Microsoft SQL Server (MSSQL) · **API Auth:** 2-Factor Auth + Encryption
> **Constraint:** No BIGINT / BIG VARCHAR · All datetime = server datetime (`GETDATE()`) · All DB access via Stored Procedures → API only (no direct DB calls from frontend)

---

## 📋 HOW TO USE THIS DOCUMENT

Each task follows this workflow:
1. ✅ **TODO** — Task defined here
2. 🔍 **VERIFY** — Review definition before starting
3. 🔨 **IMPLEMENT** — Code the task
4. ✔️ **DONE** — Mark complete after testing passes

**Status Legend:**
- `[ ]` — Not started
- `[~]` — In progress
- `[x]` — Complete
- `[!]` — Blocked / Needs review

---

## 🏗️ PHASE 0 — Project Foundation & Infrastructure

### P0.1 — Repository & Project Structure
- [ ] **P0.1.1** — Initialize Node.js project (`npm init`) with `package.json`
- [ ] **P0.1.2** — Set up folder structure:
  ```
  /cosmos-foundry
  ├── /src
  │   ├── /api          ← Express route handlers
  │   ├── /services     ← Business logic layer
  │   ├── /middleware   ← Auth, error, logging middleware
  │   ├── /utils        ← Helpers: GST calc, SKU gen, validators
  │   ├── /config       ← DB config, env config, constants
  │   └── /public       ← Static HTML/CSS/JS frontend
  ├── /sql
  │   ├── /tables       ← MSSQL CREATE TABLE scripts
  │   ├── /sp           ← All Stored Procedure scripts
  │   └── /seed         ← Seed data scripts
  ├── /logs             ← App logs (PM2 + custom)
  ├── app.js            ← Express entry point
  ├── ecosystem.config.js ← PM2 config
  ├── web.config        ← IIS config (iisnode)
  └── .env.example      ← Environment variable template
  ```
- [ ] **P0.1.3** — Install core dependencies:
  - `express` — Web framework
  - `mssql` — MSSQL driver
  - `dotenv` — Environment variables
  - `helmet` — HTTP security headers
  - `cors` — CORS handling
  - `express-rate-limit` — API rate limiting
  - `winston` — Logging
  - `jsonwebtoken` — JWT auth
  - `bcryptjs` — Password hashing
  - `crypto` — Encryption utilities (built-in Node)
  - `joi` — Request validation
  - `multer` — File upload handling
  - `sharp` — Image processing/compression
  - `uuid` — Unique ID generation
- [ ] **P0.1.4** — Set up `.env` file with variables: `DB_SERVER`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `API_KEY`, `ENCRYPTION_KEY`, `PORT`, `NODE_ENV`
- [ ] **P0.1.5** — Create `app.js` entry point with Express setup, middleware registration, and route mounting

### P0.2 — MSSQL Database Setup
- [ ] **P0.2.1** — Create MSSQL database `CosmosFoundryDB`
- [ ] **P0.2.2** — Create dedicated SQL login/user with least-privilege permissions (EXECUTE on stored procedures only — no direct table access for app user)
- [ ] **P0.2.3** — Configure MSSQL connection pool in `/src/config/db.js` using `mssql` package
- [ ] **P0.2.4** — Write and test DB connection health-check utility
- [ ] **P0.2.5** — Create base migration runner script to execute SQL scripts in order

### P0.3 — Two-Factor API Authentication System
- [ ] **P0.3.1** — Design auth flow:
  - **Layer 1 (API Key):** Static `X-API-Key` header — identifies the calling client app
  - **Layer 2 (JWT Token):** User login issues a signed JWT — identifies the authenticated user
- [ ] **P0.3.2** — Create `/sql/tables/T_001_users.sql` — user accounts table (no BIGINT, use INT; no large VARCHAR, use VARCHAR(200) max)
- [ ] **P0.3.3** — Create SP: `sp_User_Login` — validates credentials, returns user data for JWT generation
- [ ] **P0.3.4** — Write JWT generation utility: signs token with `user_id`, `role`, `store_id`, `module_access`, `exp` (configurable expiry)
- [ ] **P0.3.5** — Write JWT verification middleware: `/src/middleware/authMiddleware.js`
- [ ] **P0.3.6** — Write API Key middleware: `/src/middleware/apiKeyMiddleware.js`
- [ ] **P0.3.7** — Write request/response encryption utility (`AES-256-CBC`) for sensitive endpoints
- [ ] **P0.3.8** — Create `/api/auth/login` POST endpoint — returns encrypted JWT
- [ ] **P0.3.9** — Create `/api/auth/refresh` POST endpoint — refreshes JWT before expiry
- [ ] **P0.3.10** — Create `/api/auth/logout` POST endpoint — invalidates token (token blacklist in DB)
- [ ] **P0.3.11** — Test auth flow end-to-end: API Key → Login → JWT → Protected Route

### P0.4 — Global Error Handling & Logging
- [ ] **P0.4.1** — Create global error handler middleware: `/src/middleware/errorHandler.js`
  - Catches all unhandled errors
  - Returns structured JSON error response (never leaks stack trace in production)
  - Logs full error with Winston
- [ ] **P0.4.2** — Create request logger middleware (method, URL, IP, response time, status)
- [ ] **P0.4.3** — Configure Winston logger: console (dev) + rotating file (prod) in `/logs/`
- [ ] **P0.4.4** — Create DB error wrapper: translates MSSQL error codes to user-friendly messages
- [ ] **P0.4.5** — Create validation error handler: formats `joi` validation errors as structured API response
- [ ] **P0.4.6** — Test: trigger each error type and verify correct response format + log entry

### P0.5 — IIS + PM2 Server Configuration
- [ ] **P0.5.1** — Install `iisnode` on Windows Server
- [ ] **P0.5.2** — Create `web.config` for IIS:
  ```xml
  <!-- Route all requests through iisnode to app.js -->
  <!-- Set NODE_ENV=production -->
  <!-- Enable logging to /logs/ -->
  ```
- [ ] **P0.5.3** — Create `ecosystem.config.js` for PM2:
  ```javascript
  // App name, script: app.js, instances: max, exec_mode: cluster
  // watch: false (prod), log paths, env: production
  ```
- [ ] **P0.5.4** — Write deployment guide: `DEPLOYMENT.md` — steps for both IIS and PM2 startup
- [ ] **P0.5.5** — Test IIS deployment: app accessible via IIS on port 80/443
- [ ] **P0.5.6** — Test PM2 deployment: `pm2 start ecosystem.config.js`, verify cluster mode
- [ ] **P0.5.7** — Configure PM2 startup script for Windows auto-start on reboot (`pm2-windows-service` or `pm2 startup`)

### P0.6 — Base UI Shell
- [ ] **P0.6.1** — Create base HTML layout (`/src/public/index.html`) with:
  - Sidebar navigation
  - Header with user info + logout
  - Main content area
  - Toast notification container
  - Loading overlay
- [ ] **P0.6.2** — Create base CSS: Eyewoot design system (`#0056b3` primary, consistent spacing, typography)
- [ ] **P0.6.3** — Create base JS utilities:
  - `api.js` — Fetch wrapper with API Key + JWT header injection, error handling
  - `auth.js` — Login/logout, JWT storage (sessionStorage)
  - `toast.js` — Toast notification system
  - `loader.js` — Loading overlay control
  - `validator.js` — Client-side form validation helpers
- [ ] **P0.6.4** — Create Login page (`/public/login.html`) — username + password form
- [ ] **P0.6.5** — Test login flow: UI → API → JWT → redirect to dashboard

**✅ PHASE 0 VERIFY CHECKPOINT:** All infrastructure live. Auth works. IIS + PM2 both serve the app. Errors handled gracefully. Logging active.

---

## 🗃️ PHASE 1 — MSSQL Database Schema (All Tables)

> **Rules enforced in ALL tables:**
> - No `BIGINT` — use `INT` (max 2.1 billion rows, sufficient for this system)
> - No large VARCHAR — max `VARCHAR(500)` for descriptions, `VARCHAR(200)` for names, `VARCHAR(100)` for codes/refs
> - All datetime fields use `DATETIME` type with `DEFAULT GETDATE()` (server time only)
> - All tables have `created_at DATETIME DEFAULT GETDATE()` and `updated_at DATETIME DEFAULT GETDATE()`
> - All primary keys: `INT IDENTITY(1,1) PRIMARY KEY`
> - All foreign keys explicitly defined with `CONSTRAINT` naming

### P1.1 — Core Master Tables

- [ ] **P1.1.1** — `/sql/tables/T_001_users.sql`
  ```
  user_id INT PK, username VARCHAR(100), password_hash VARCHAR(200),
  full_name VARCHAR(200), email VARCHAR(200), phone VARCHAR(20),
  role VARCHAR(50), store_id INT NULL, is_active BIT DEFAULT 1,
  last_login DATETIME NULL, created_at DATETIME DEFAULT GETDATE(),
  updated_at DATETIME DEFAULT GETDATE()
  ```

- [ ] **P1.1.2** — `/sql/tables/T_002_stores.sql`
  ```
  store_id INT PK, store_name VARCHAR(200), store_code VARCHAR(20),
  store_type VARCHAR(50), gstin VARCHAR(20), address VARCHAR(500),
  city VARCHAR(100), state VARCHAR(100), pincode VARCHAR(10),
  phone VARCHAR(20), gps_lat VARCHAR(20), gps_lng VARCHAR(20),
  is_active BIT DEFAULT 1, created_at DATETIME DEFAULT GETDATE(),
  updated_at DATETIME DEFAULT GETDATE()
  ```

- [ ] **P1.1.3** — `/sql/tables/T_003_home_brands.sql`
  ```
  brand_id INT PK, brand_name VARCHAR(200), brand_code VARCHAR(10),
  brand_description VARCHAR(500), brand_logo_url VARCHAR(500),
  is_active BIT DEFAULT 1, created_by INT FK→users,
  created_at DATETIME DEFAULT GETDATE(), updated_at DATETIME DEFAULT GETDATE()
  ```

- [ ] **P1.1.4** — `/sql/tables/T_004_suppliers.sql`
  ```
  supplier_id INT PK, vendor_name VARCHAR(200), vendor_code VARCHAR(20),
  city VARCHAR(100), state VARCHAR(100), gstin VARCHAR(20),
  contact_person VARCHAR(200), contact_phone VARCHAR(20),
  payment_terms VARCHAR(200), source_types_supplied VARCHAR(200),
  vendor_status VARCHAR(20) DEFAULT 'active',
  created_by INT FK→users, created_at DATETIME DEFAULT GETDATE(),
  updated_at DATETIME DEFAULT GETDATE()
  ```

- [ ] **P1.1.5** — `/sql/tables/T_005_product_master.sql`
  ```
  product_id INT PK, source_type VARCHAR(30),
  maker_id INT NULL FK→suppliers, source_brand VARCHAR(200) NULL,
  home_brand_id INT NULL FK→home_brands,
  source_collection VARCHAR(200) NULL, ew_collection VARCHAR(200),
  style_model VARCHAR(200), product_type VARCHAR(50),
  branding_required BIT DEFAULT 1, catalogue_status VARCHAR(30),
  created_by INT FK→users, created_at DATETIME DEFAULT GETDATE(),
  updated_at DATETIME DEFAULT GETDATE()
  ```

### P1.2 — Procurement Pipeline Tables

- [ ] **P1.2.1** — `/sql/tables/T_006_purchases.sql`
  ```
  purchase_id INT PK, product_master_id INT FK→product_master,
  purchase_date DATETIME DEFAULT GETDATE(), purchase_rate DECIMAL(10,2),
  quantity INT, transport_cost DECIMAL(10,2) DEFAULT 0,
  gst_pct DECIMAL(5,2), expected_bill_amt DECIMAL(10,2),
  actual_bill_amt DECIMAL(10,2) NULL,
  bill_number VARCHAR(100) NULL, bill_date DATETIME NULL,
  bill_photo_url VARCHAR(500) NULL,
  bill_status VARCHAR(30) DEFAULT 'PENDING_BILL_VERIFICATION',
  pipeline_status VARCHAR(50) DEFAULT 'PENDING_BILL_VERIFICATION',
  po_reference VARCHAR(100) NULL, notes VARCHAR(500) NULL,
  discrepancy_note VARCHAR(500) NULL, store_id INT FK→stores,
  created_by INT FK→users, created_at DATETIME DEFAULT GETDATE(),
  updated_at DATETIME DEFAULT GETDATE()
  ```

- [ ] **P1.2.2** — `/sql/tables/T_007_purchase_colours.sql`
  ```
  colour_id INT PK, purchase_id INT FK→purchases,
  colour_name VARCHAR(100), colour_code VARCHAR(20), quantity INT,
  created_at DATETIME DEFAULT GETDATE()
  ```

- [ ] **P1.2.3** — `/sql/tables/T_008_branding_jobs.sql`
  ```
  branding_job_id INT PK, purchase_id INT FK→purchases,
  dispatch_date DATETIME NULL, expected_return_date DATETIME NULL,
  actual_return_date DATETIME NULL,
  branding_instructions VARCHAR(500) NULL,
  label_spec_url VARCHAR(500) NULL,
  status VARCHAR(30) DEFAULT 'PENDING_DISPATCH',
  bypass_reason VARCHAR(500) NULL, is_bypassed BIT DEFAULT 0,
  created_by INT FK→users, created_at DATETIME DEFAULT GETDATE(),
  updated_at DATETIME DEFAULT GETDATE()
  ```

- [ ] **P1.2.4** — `/sql/tables/T_009_branding_job_colours.sql`
  ```
  branding_colour_id INT PK, branding_job_id INT FK→branding_jobs,
  colour_id INT FK→purchase_colours, colour_code VARCHAR(20),
  qty_dispatched INT, qty_received INT NULL, discrepancy_note VARCHAR(500) NULL,
  created_at DATETIME DEFAULT GETDATE(), updated_at DATETIME DEFAULT GETDATE()
  ```

### P1.3 — SKU & Digitisation Tables

- [ ] **P1.3.1** — `/sql/tables/T_010_skus.sql`
  ```
  sku_id INT PK, product_master_id INT FK→product_master,
  purchase_colour_id INT FK→purchase_colours,
  sku_code VARCHAR(100) UNIQUE, barcode VARCHAR(100) UNIQUE,
  quantity INT, cost_price DECIMAL(10,2), sale_price DECIMAL(10,2),
  status VARCHAR(30) DEFAULT 'DRAFT',
  created_by INT FK→users, created_at DATETIME DEFAULT GETDATE(),
  updated_at DATETIME DEFAULT GETDATE()
  ```

- [ ] **P1.3.2** — `/sql/tables/T_011_sku_digitisation.sql`
  ```
  digitisation_id INT PK, sku_id INT FK→skus UNIQUE,
  lens_width DECIMAL(5,2) NULL, bridge_width DECIMAL(5,2) NULL,
  temple_length DECIMAL(5,2) NULL, frame_height DECIMAL(5,2) NULL,
  weight DECIMAL(5,2) NULL, material VARCHAR(100) NULL,
  frame_shape VARCHAR(100) NULL, gender VARCHAR(20) NULL,
  colour_display_name VARCHAR(100) NULL, title VARCHAR(200) NULL,
  short_desc VARCHAR(500) NULL, full_desc VARCHAR(500) NULL,
  tags VARCHAR(500) NULL, is_published BIT DEFAULT 0,
  approved_by INT NULL FK→users, approved_at DATETIME NULL,
  created_at DATETIME DEFAULT GETDATE(), updated_at DATETIME DEFAULT GETDATE()
  ```

- [ ] **P1.3.3** — `/sql/tables/T_012_sku_media.sql`
  ```
  media_id INT PK, sku_id INT FK→skus, media_type VARCHAR(10),
  file_url VARCHAR(500), angle_label VARCHAR(100) NULL,
  is_primary BIT DEFAULT 0, display_order INT DEFAULT 0,
  created_by INT FK→users, created_at DATETIME DEFAULT GETDATE()
  ```

### P1.4 — Stock Management Tables

- [ ] **P1.4.1** — `/sql/tables/T_013_stock_balances.sql`
  ```
  balance_id INT PK, sku_id INT FK→skus,
  location_type VARCHAR(50), location_id INT,
  location_name VARCHAR(200), qty INT DEFAULT 0,
  last_updated DATETIME DEFAULT GETDATE()
  -- UNIQUE constraint on (sku_id, location_type, location_id)
  ```

- [ ] **P1.4.2** — `/sql/tables/T_014_stock_movements.sql`
  ```
  movement_id INT PK, sku_id INT FK→skus,
  from_location_type VARCHAR(50) NULL, from_location_id INT NULL,
  to_location_type VARCHAR(50) NULL, to_location_id INT NULL,
  qty INT, movement_type VARCHAR(50),
  reference_id VARCHAR(100) NULL, notes VARCHAR(500) NULL,
  created_by INT FK→users, created_at DATETIME DEFAULT GETDATE()
  -- No updates allowed — audit log only
  ```

- [ ] **P1.4.3** — `/sql/tables/T_015_location_visibility_config.sql`
  ```
  config_id INT PK, location_type VARCHAR(50),
  display_name VARCHAR(100), display_icon VARCHAR(50),
  visible_to_roles VARCHAR(500), scope VARCHAR(50),
  is_active BIT DEFAULT 1,
  created_by INT FK→users, created_at DATETIME DEFAULT GETDATE(),
  updated_at DATETIME DEFAULT GETDATE()
  ```

### P1.5 — Rate Intelligence Tables

- [ ] **P1.5.1** — `/sql/tables/T_016_vendor_product_rates.sql`
  ```
  rate_id INT PK, product_master_id INT FK→product_master,
  supplier_id INT FK→suppliers, total_purchases INT DEFAULT 0,
  lowest_rate DECIMAL(10,2) NULL, highest_rate DECIMAL(10,2) NULL,
  last_rate DECIMAL(10,2) NULL, previous_rate DECIMAL(10,2) NULL,
  rate_trend VARCHAR(10) NULL, rate_delta DECIMAL(10,2) NULL,
  updated_at DATETIME DEFAULT GETDATE()
  -- UNIQUE constraint on (product_master_id, supplier_id)
  ```

- [ ] **P1.5.2** — `/sql/tables/T_017_product_rate_summary.sql`
  ```
  summary_id INT PK, product_master_id INT FK→product_master UNIQUE,
  network_lowest_rate DECIMAL(10,2) NULL,
  network_lowest_supplier_id INT NULL FK→suppliers,
  network_highest_rate DECIMAL(10,2) NULL,
  total_supplier_count INT DEFAULT 0,
  last_purchased_rate DECIMAL(10,2) NULL,
  last_purchased_supplier_id INT NULL FK→suppliers,
  updated_at DATETIME DEFAULT GETDATE()
  ```

### P1.6 — Audit & Token Tables

- [ ] **P1.6.1** — `/sql/tables/T_018_audit_logs.sql`
  ```
  audit_id INT PK, user_id INT FK→users,
  action VARCHAR(100), module VARCHAR(50), entity_type VARCHAR(100),
  entity_id INT NULL, old_value VARCHAR(500) NULL,
  new_value VARCHAR(500) NULL, ip_address VARCHAR(50) NULL,
  created_at DATETIME DEFAULT GETDATE()
  -- NEVER delete rows from this table
  ```

- [ ] **P1.6.2** — `/sql/tables/T_019_token_blacklist.sql`
  ```
  blacklist_id INT PK, token_hash VARCHAR(200),
  user_id INT FK→users, expires_at DATETIME,
  created_at DATETIME DEFAULT GETDATE()
  -- Purge rows WHERE expires_at < GETDATE() on schedule
  ```

- [ ] **P1.6.3** — `/sql/tables/T_020_app_settings.sql`
  ```
  setting_id INT PK, setting_key VARCHAR(100) UNIQUE,
  setting_value VARCHAR(500), setting_group VARCHAR(100),
  description VARCHAR(500) NULL,
  updated_by INT NULL FK→users,
  updated_at DATETIME DEFAULT GETDATE()
  ```

- [ ] **P1.6.4** — Run all table creation scripts in order (T_001 → T_020)
- [ ] **P1.6.5** — Verify all tables created with correct constraints using SSMS
- [ ] **P1.6.6** — Insert seed data: default settings, location visibility config, admin user

**✅ PHASE 1 VERIFY CHECKPOINT:** All 20 tables created. All relationships verified. Seed data inserted. No BIGINT or large VARCHAR used anywhere.

---

## ⚙️ PHASE 2 — Stored Procedures (All Modules)

> **SP Naming Convention:** `sp_[Module]_[Action]`
> **All SPs must:** Use `TRY...CATCH`, return structured result sets, use `GETDATE()` for all datetime, use transactions where data integrity matters

### P2.1 — Auth & User SPs

- [ ] **P2.1.1** — `sp_Auth_Login(username, password_hash)` → returns user record + role + store_id
- [ ] **P2.1.2** — `sp_Auth_Logout(user_id, token_hash, expires_at)` → adds to blacklist
- [ ] **P2.1.3** — `sp_Auth_CheckTokenBlacklist(token_hash)` → returns 1 if blacklisted
- [ ] **P2.1.4** — `sp_Auth_PurgeExpiredTokens()` → cleans expired blacklist rows
- [ ] **P2.1.5** — `sp_User_GetAll(store_id, role_filter)` → paginated user list
- [ ] **P2.1.6** — `sp_User_GetById(user_id)` → single user detail
- [ ] **P2.1.7** — `sp_User_Create(username, password_hash, full_name, email, phone, role, store_id, created_by)` → returns new user_id
- [ ] **P2.1.8** — `sp_User_Update(user_id, full_name, email, phone, role, store_id, updated_by)` → returns success
- [ ] **P2.1.9** — `sp_User_Deactivate(user_id, updated_by)` → soft delete
- [ ] **P2.1.10** — `sp_User_UpdatePassword(user_id, new_password_hash)` → returns success

### P2.2 — Home Brand SPs

- [ ] **P2.2.1** — `sp_HomeBrand_GetAll(include_inactive)` → full list
- [ ] **P2.2.2** — `sp_HomeBrand_GetById(brand_id)` → single brand
- [ ] **P2.2.3** — `sp_HomeBrand_Create(brand_name, brand_code, brand_description, brand_logo_url, created_by)` → returns brand_id
- [ ] **P2.2.4** — `sp_HomeBrand_Update(brand_id, brand_name, brand_description, brand_logo_url, updated_by)` → returns success
- [ ] **P2.2.5** — `sp_HomeBrand_Deactivate(brand_id, updated_by)` → soft deactivate
- [ ] **P2.2.6** — `sp_HomeBrand_CheckCodeExists(brand_code, exclude_brand_id)` → returns 1 if duplicate

### P2.3 — Supplier (Vendor) SPs

- [ ] **P2.3.1** — `sp_Supplier_GetAll(status_filter, search_term, page, page_size)` → paginated
- [ ] **P2.3.2** — `sp_Supplier_GetById(supplier_id)` → single supplier with stats
- [ ] **P2.3.3** — `sp_Supplier_Create(vendor_name, vendor_code, city, state, gstin, contact_person, contact_phone, payment_terms, source_types_supplied, created_by)` → returns supplier_id
- [ ] **P2.3.4** — `sp_Supplier_Update(supplier_id, vendor_name, city, state, gstin, contact_person, contact_phone, payment_terms, updated_by)` → returns success
- [ ] **P2.3.5** — `sp_Supplier_UpdateStatus(supplier_id, status, updated_by)` → active/inactive/blacklisted
- [ ] **P2.3.6** — `sp_Supplier_Search(search_term)` → quick lookup for purchase form

### P2.4 — Product Master SPs

- [ ] **P2.4.1** — `sp_ProductMaster_Create(source_type, maker_id, source_brand, home_brand_id, source_collection, ew_collection, style_model, product_type, branding_required, created_by)` → returns product_id
- [ ] **P2.4.2** — `sp_ProductMaster_GetById(product_id)` → full product with home brand + supplier details
- [ ] **P2.4.3** — `sp_ProductMaster_GetAll(status_filter, source_type_filter, page, page_size)` → paginated catalogue
- [ ] **P2.4.4** — `sp_ProductMaster_DetectRepeat(source_type, maker_id, home_brand_id, source_collection, ew_collection, style_model)` → returns match_found + product_id + summary if match
- [ ] **P2.4.5** — `sp_ProductMaster_CheckEWCollectionMismatch(maker_id, source_collection, ew_collection)` → returns mismatch warning if exists
- [ ] **P2.4.6** — `sp_ProductMaster_Update(product_id, ew_collection, style_model, product_type, updated_by)` → returns success
- [ ] **P2.4.7** — `sp_ProductMaster_UpdateCatalogueStatus(product_id, catalogue_status, updated_by)` → updates status

### P2.5 — Purchase Registration SPs

- [ ] **P2.5.1** — `sp_Purchase_Create(product_master_id, purchase_date, purchase_rate, quantity, transport_cost, gst_pct, po_reference, notes, store_id, created_by)` → inserts purchase, calculates expected_bill_amt, returns purchase_id
- [ ] **P2.5.2** — `sp_Purchase_AddColour(purchase_id, colour_name, colour_code, quantity)` → returns colour_id
- [ ] **P2.5.3** — `sp_Purchase_UpdateColour(colour_id, colour_name, colour_code, quantity)` → returns success
- [ ] **P2.5.4** — `sp_Purchase_DeleteColour(colour_id)` → removes colour row (only if purchase still in Stage 1)
- [ ] **P2.5.5** — `sp_Purchase_GetById(purchase_id)` → full purchase with colours + product details
- [ ] **P2.5.6** — `sp_Purchase_GetAll(store_id, status_filter, date_from, date_to, page, page_size)` → paginated
- [ ] **P2.5.7** — `sp_Purchase_GetPipelineStatus(purchase_id)` → current status + next action

### P2.6 — Bill Verification SPs

- [ ] **P2.6.1** — `sp_BillVerify_Submit(purchase_id, actual_bill_amt, bill_number, bill_date, bill_photo_url, updated_by)` → auto-reconciles, sets bill_status (MATCHED/DISCREPANCY), returns reconciliation result
- [ ] **P2.6.2** — `sp_BillVerify_GetDiscrepancyThreshold()` → returns configured threshold from app_settings
- [ ] **P2.6.3** — `sp_BillVerify_ApproveDiscrepancy(purchase_id, discrepancy_note, approved_by)` → Super Admin approves, advances pipeline
- [ ] **P2.6.4** — `sp_BillVerify_RejectPurchase(purchase_id, reject_reason, rejected_by)` → marks as REJECTED

### P2.7 — Branding SPs

- [ ] **P2.7.1** — `sp_Branding_CreateJob(purchase_id, dispatch_date, expected_return_date, branding_instructions, label_spec_url, created_by)` → creates branding_job + branding_job_colours rows, advances pipeline to DISPATCHED_TO_BRANDING, returns branding_job_id
- [ ] **P2.7.2** — `sp_Branding_BypassJob(purchase_id, bypass_reason, created_by)` → validates source_type ≠ LOCAL_SUPPLIER, marks pipeline as BRANDING_BYPASSED
- [ ] **P2.7.3** — `sp_Branding_ReceiveVerify(branding_job_id, colour_receipts_json, received_by)` → updates qty_received per colour, checks discrepancies, marks BRANDING_COMPLETE if all verified
- [ ] **P2.7.4** — `sp_Branding_GetJob(branding_job_id)` → full job detail with colours
- [ ] **P2.7.5** — `sp_Branding_GetHistory(product_master_id)` → all past branding jobs for repeat recall
- [ ] **P2.7.6** — `sp_Branding_GetPastInstructions(product_master_id)` → previous branding instructions for pre-fill

### P2.8 — SKU & Digitisation SPs

- [ ] **P2.8.1** — `sp_SKU_GenerateCode(brand_code, collection_code, colour_code)` → returns generated SKU code (format: BRANDCODE-COLCODE-COLOURCODE), checks for uniqueness
- [ ] **P2.8.2** — `sp_SKU_GenerateBarcode(sku_id)` → generates unique barcode, updates sku record
- [ ] **P2.8.3** — `sp_SKU_Create(product_master_id, purchase_colour_id, sku_code, barcode, quantity, cost_price, sale_price, created_by)` → returns sku_id
- [ ] **P2.8.4** — `sp_SKU_GetById(sku_id)` → full SKU with digitisation + media
- [ ] **P2.8.5** — `sp_SKU_GetByPurchase(purchase_id)` → all SKUs in a purchase batch
- [ ] **P2.8.6** — `sp_SKU_UpdatePricing(sku_id, sale_price, updated_by)` → updates, returns margin %
- [ ] **P2.8.7** — `sp_Digitisation_SaveSpecs(sku_id, lens_width, bridge_width, temple_length, frame_height, weight, material, frame_shape, gender, colour_display_name, updated_by)` → upsert
- [ ] **P2.8.8** — `sp_Digitisation_SaveContent(sku_id, title, short_desc, full_desc, tags, updated_by)` → upsert
- [ ] **P2.8.9** — `sp_Digitisation_PublishSKU(sku_id, approved_by)` → validates all required fields complete, sets is_published = 1, updates SKU status to PUBLISHED
- [ ] **P2.8.10** — `sp_Digitisation_GetRepeatRecall(product_master_id)` → returns all pre-fill data from last digitisation cycle for repeat products
- [ ] **P2.8.11** — `sp_SKUMedia_AddFile(sku_id, media_type, file_url, angle_label, is_primary, display_order, created_by)` → returns media_id
- [ ] **P2.8.12** — `sp_SKUMedia_DeleteFile(media_id, deleted_by)` → removes media record
- [ ] **P2.8.13** — `sp_SKUMedia_GetBySKU(sku_id)` → all media for a SKU
- [ ] **P2.8.14** — `sp_Digitisation_CheckAllComplete(purchase_id)` → returns true if all SKUs in purchase are published → triggers WAREHOUSE_READY

### P2.9 — Stock Management SPs

- [ ] **P2.9.1** — `sp_Stock_InitialiseWarehouse(sku_id, qty, created_by)` → called after digitisation complete, creates WAREHOUSE balance row + INWARD_DIGITISATION movement log
- [ ] **P2.9.2** — `sp_Stock_GetBySKU(sku_id, user_role, user_store_id)` → returns role-scoped stock distribution for a SKU
- [ ] **P2.9.3** — `sp_Stock_GetByStore(store_id, page, page_size)` → all SKUs at a store with quantities
- [ ] **P2.9.4** — `sp_Stock_GetWarehouseInventory(page, page_size, search_term)` → HQ warehouse view
- [ ] **P2.9.5** — `sp_Transfer_Create(sku_id, qty, from_location_id, to_store_id, created_by)` → deducts from WAREHOUSE, creates IN_TRANSIT balance, logs TRANSFER_DISPATCH movement
- [ ] **P2.9.6** — `sp_Transfer_Confirm(movement_id, confirmed_by)` → moves IN_TRANSIT → AT_STORE, logs TRANSFER_RECEIVED
- [ ] **P2.9.7** — `sp_Transfer_Cancel(movement_id, cancel_reason, cancelled_by)` → reverts IN_TRANSIT → WAREHOUSE, logs TRANSFER_CANCELLED
- [ ] **P2.9.8** — `sp_Stock_ReservePromoter(sku_id, qty, promoter_id, reserved_by)` → WAREHOUSE → PROMOTER_RESERVED
- [ ] **P2.9.9** — `sp_Stock_ReserveOnline(sku_id, qty, order_id, created_by)` → WAREHOUSE → ONLINE_RESERVED
- [ ] **P2.9.10** — `sp_Stock_ManualAdjust(sku_id, location_type, location_id, new_qty, reason, adjusted_by)` → Super Admin only, updates balance + logs STOCK_ADJUSTMENT
- [ ] **P2.9.11** — `sp_Stock_GetLowStockAlerts(threshold_override)` → returns all SKUs below reorder threshold
- [ ] **P2.9.12** — `sp_Stock_GetSlowMovers(days, store_id)` → SKUs with zero sales in N days at store

### P2.10 — Rate Intelligence SPs

- [ ] **P2.10.1** — `sp_RateIntelligence_UpsertVendorProduct(product_master_id, supplier_id, new_rate)` → called on every purchase save, updates vendor_product_rates (lowest, highest, last, previous, trend, delta)
- [ ] **P2.10.2** — `sp_RateIntelligence_UpsertProductSummary(product_master_id)` → recalculates network-wide rate summary after every purchase
- [ ] **P2.10.3** — `sp_RateIntelligence_GetByProduct(product_master_id)` → product-centric view — all vendors + rates
- [ ] **P2.10.4** — `sp_RateIntelligence_GetByVendor(supplier_id)` → vendor-centric view — all products + rates
- [ ] **P2.10.5** — `sp_RateIntelligence_GetContextForPurchase(product_master_id, supplier_id, current_rate)` → returns advisory panel data for purchase form inline display

### P2.11 — Audit Log SPs

- [ ] **P2.11.1** — `sp_Audit_Log(user_id, action, module, entity_type, entity_id, old_value, new_value, ip_address)` → inserts audit record
- [ ] **P2.11.2** — `sp_Audit_GetLogs(user_id_filter, module_filter, entity_type_filter, date_from, date_to, page, page_size)` → paginated audit log query
- [ ] **P2.11.3** — `sp_Settings_Get(setting_key)` → returns setting value
- [ ] **P2.11.4** — `sp_Settings_Set(setting_key, setting_value, updated_by)` → upsert setting

- [ ] **P2.11.5** — Run all SP creation scripts, verify with EXECUTE tests in SSMS
- [ ] **P2.11.6** — Test each SP with boundary values: empty inputs, nulls, duplicate detection, transaction rollback on error

**✅ PHASE 2 VERIFY CHECKPOINT:** All SPs created and tested. Each SP has TRY...CATCH. Datetime uses GETDATE(). Transactions used where required. All SPs execute cleanly in SSMS.

---

## 🔌 PHASE 3 — REST API Layer (Node.js / Express)

> **All API endpoints must:**
> - Require both `X-API-Key` header AND valid JWT Bearer token
> - Validate all request inputs with `joi` before calling SP
> - Call MSSQL SP via the DB service (never raw SQL)
> - Return consistent JSON: `{ success, data, message, errors }`
> - Write audit log entry for all mutating operations (POST/PUT/DELETE)
> - Handle errors with global error handler

### P3.1 — Auth API (`/api/auth`)

- [ ] **P3.1.1** — `POST /api/auth/login` → calls `sp_Auth_Login`, generates + returns encrypted JWT
- [ ] **P3.1.2** — `POST /api/auth/refresh` → validates current JWT, issues new one
- [ ] **P3.1.3** — `POST /api/auth/logout` → blacklists token via `sp_Auth_Logout`
- [ ] **P3.1.4** — `GET /api/auth/me` → returns current user from JWT claims (no DB call)

### P3.2 — User API (`/api/users`) — Super Admin + HR Admin only

- [ ] **P3.2.1** — `GET /api/users` → calls `sp_User_GetAll`
- [ ] **P3.2.2** — `GET /api/users/:id` → calls `sp_User_GetById`
- [ ] **P3.2.3** — `POST /api/users` → validates body, calls `sp_User_Create`
- [ ] **P3.2.4** — `PUT /api/users/:id` → validates body, calls `sp_User_Update`
- [ ] **P3.2.5** — `DELETE /api/users/:id` → calls `sp_User_Deactivate`
- [ ] **P3.2.6** — `PUT /api/users/:id/password` → calls `sp_User_UpdatePassword`

### P3.3 — Home Brand API (`/api/home-brands`) — Super Admin only for write

- [ ] **P3.3.1** — `GET /api/home-brands` → calls `sp_HomeBrand_GetAll`
- [ ] **P3.3.2** — `GET /api/home-brands/:id` → calls `sp_HomeBrand_GetById`
- [ ] **P3.3.3** — `POST /api/home-brands` → Super Admin only, calls `sp_HomeBrand_Create`
- [ ] **P3.3.4** — `PUT /api/home-brands/:id` → Super Admin only, calls `sp_HomeBrand_Update`
- [ ] **P3.3.5** — `DELETE /api/home-brands/:id` → Super Admin only, calls `sp_HomeBrand_Deactivate`

### P3.4 — Supplier API (`/api/suppliers`)

- [ ] **P3.4.1** — `GET /api/suppliers` → calls `sp_Supplier_GetAll` with filters
- [ ] **P3.4.2** — `GET /api/suppliers/search?q=` → calls `sp_Supplier_Search` for quick lookup
- [ ] **P3.4.3** — `GET /api/suppliers/:id` → calls `sp_Supplier_GetById`
- [ ] **P3.4.4** — `POST /api/suppliers` → calls `sp_Supplier_Create`
- [ ] **P3.4.5** — `PUT /api/suppliers/:id` → calls `sp_Supplier_Update`
- [ ] **P3.4.6** — `PUT /api/suppliers/:id/status` → calls `sp_Supplier_UpdateStatus`

### P3.5 — Product Master API (`/api/products`)

- [ ] **P3.5.1** — `GET /api/products` → calls `sp_ProductMaster_GetAll`
- [ ] **P3.5.2** — `GET /api/products/:id` → calls `sp_ProductMaster_GetById`
- [ ] **P3.5.3** — `POST /api/products/detect-repeat` → calls `sp_ProductMaster_DetectRepeat`
- [ ] **P3.5.4** — `POST /api/products/check-collection-mismatch` → calls `sp_ProductMaster_CheckEWCollectionMismatch`
- [ ] **P3.5.5** — `POST /api/products` → calls `sp_ProductMaster_Create`
- [ ] **P3.5.6** — `PUT /api/products/:id` → calls `sp_ProductMaster_Update`

### P3.6 — Purchase API (`/api/purchases`)

- [ ] **P3.6.1** — `GET /api/purchases` → calls `sp_Purchase_GetAll` with filters
- [ ] **P3.6.2** — `GET /api/purchases/:id` → calls `sp_Purchase_GetById`
- [ ] **P3.6.3** — `POST /api/purchases` → validates body, calls `sp_Purchase_Create` + `sp_RateIntelligence_UpsertVendorProduct` + `sp_Audit_Log`
- [ ] **P3.6.4** — `POST /api/purchases/:id/colours` → calls `sp_Purchase_AddColour`
- [ ] **P3.6.5** — `PUT /api/purchases/:id/colours/:colourId` → calls `sp_Purchase_UpdateColour`
- [ ] **P3.6.6** — `DELETE /api/purchases/:id/colours/:colourId` → calls `sp_Purchase_DeleteColour`
- [ ] **P3.6.7** — `GET /api/purchases/:id/pipeline-status` → calls `sp_Purchase_GetPipelineStatus`

### P3.7 — Bill Verification API (`/api/purchases/:id/bill`)

- [ ] **P3.7.1** — `POST /api/purchases/:id/bill` → handles file upload (multer), uploads to `/uploads/bills/`, calls `sp_BillVerify_Submit`
- [ ] **P3.7.2** — `POST /api/purchases/:id/bill/approve-discrepancy` → Super Admin only, calls `sp_BillVerify_ApproveDiscrepancy`
- [ ] **P3.7.3** — `POST /api/purchases/:id/bill/reject` → calls `sp_BillVerify_RejectPurchase`

### P3.8 — Branding API (`/api/purchases/:id/branding`)

- [ ] **P3.8.1** — `POST /api/purchases/:id/branding/dispatch` → calls `sp_Branding_CreateJob`
- [ ] **P3.8.2** — `POST /api/purchases/:id/branding/bypass` → validates source_type, calls `sp_Branding_BypassJob`
- [ ] **P3.8.3** — `POST /api/purchases/:id/branding/receive` → calls `sp_Branding_ReceiveVerify`
- [ ] **P3.8.4** — `GET /api/purchases/:id/branding` → calls `sp_Branding_GetJob`
- [ ] **P3.8.5** — `GET /api/products/:productId/branding-history` → calls `sp_Branding_GetHistory`

### P3.9 — SKU & Digitisation API (`/api/skus`)

- [ ] **P3.9.1** — `GET /api/skus/:id` → calls `sp_SKU_GetById`
- [ ] **P3.9.2** — `GET /api/purchases/:id/skus` → calls `sp_SKU_GetByPurchase`
- [ ] **P3.9.3** — `POST /api/skus` → calls `sp_SKU_GenerateCode` then `sp_SKU_Create` then `sp_SKU_GenerateBarcode`
- [ ] **P3.9.4** — `PUT /api/skus/:id/pricing` → calls `sp_SKU_UpdatePricing`
- [ ] **P3.9.5** — `PUT /api/skus/:id/specs` → calls `sp_Digitisation_SaveSpecs`
- [ ] **P3.9.6** — `PUT /api/skus/:id/content` → calls `sp_Digitisation_SaveContent`
- [ ] **P3.9.7** — `POST /api/skus/:id/publish` → calls `sp_Digitisation_PublishSKU`, then checks `sp_Digitisation_CheckAllComplete` to trigger WAREHOUSE_READY
- [ ] **P3.9.8** — `GET /api/products/:productId/digitisation-recall` → calls `sp_Digitisation_GetRepeatRecall`
- [ ] **P3.9.9** — `POST /api/skus/:id/media` → multer upload, calls `sp_SKUMedia_AddFile`
- [ ] **P3.9.10** — `DELETE /api/skus/:id/media/:mediaId` → calls `sp_SKUMedia_DeleteFile`
- [ ] **P3.9.11** — `GET /api/skus/:id/media` → calls `sp_SKUMedia_GetBySKU`

### P3.10 — Stock API (`/api/stock`)

- [ ] **P3.10.1** — `GET /api/stock/sku/:skuId` → calls `sp_Stock_GetBySKU` (role-scoped)
- [ ] **P3.10.2** — `GET /api/stock/store/:storeId` → calls `sp_Stock_GetByStore`
- [ ] **P3.10.3** — `GET /api/stock/warehouse` → calls `sp_Stock_GetWarehouseInventory`
- [ ] **P3.10.4** — `POST /api/stock/transfer` → calls `sp_Transfer_Create`
- [ ] **P3.10.5** — `POST /api/stock/transfer/:movementId/confirm` → calls `sp_Transfer_Confirm`
- [ ] **P3.10.6** — `POST /api/stock/transfer/:movementId/cancel` → calls `sp_Transfer_Cancel`
- [ ] **P3.10.7** — `POST /api/stock/reserve-promoter` → calls `sp_Stock_ReservePromoter`
- [ ] **P3.10.8** — `POST /api/stock/reserve-online` → calls `sp_Stock_ReserveOnline`
- [ ] **P3.10.9** — `PUT /api/stock/adjust` → Super Admin only, calls `sp_Stock_ManualAdjust`
- [ ] **P3.10.10** — `GET /api/stock/low-stock-alerts` → calls `sp_Stock_GetLowStockAlerts`
- [ ] **P3.10.11** — `GET /api/stock/slow-movers` → calls `sp_Stock_GetSlowMovers`

### P3.11 — Rate Intelligence API (`/api/rate-intelligence`)

- [ ] **P3.11.1** — `GET /api/rate-intelligence/product/:productId` → calls `sp_RateIntelligence_GetByProduct`
- [ ] **P3.11.2** — `GET /api/rate-intelligence/vendor/:supplierId` → calls `sp_RateIntelligence_GetByVendor`
- [ ] **P3.11.3** — `GET /api/rate-intelligence/context?product_id=&supplier_id=&rate=` → calls `sp_RateIntelligence_GetContextForPurchase`

### P3.12 — Settings & Audit API

- [ ] **P3.12.1** — `GET /api/settings/:key` → calls `sp_Settings_Get`
- [ ] **P3.12.2** — `PUT /api/settings/:key` → Super Admin only, calls `sp_Settings_Set`
- [ ] **P3.12.3** — `GET /api/audit-logs` → Super Admin only, calls `sp_Audit_GetLogs`

- [ ] **P3.12.4** — Write API integration tests for all endpoints (happy path + error cases)
- [ ] **P3.12.5** — Test auth enforcement: verify every endpoint rejects missing API key / expired JWT
- [ ] **P3.12.6** — Test role enforcement: verify role-restricted endpoints return 403 for wrong roles

**✅ PHASE 3 VERIFY CHECKPOINT:** All API endpoints respond correctly. Auth enforced on all routes. Input validation working. Audit logs written on all mutations. Error responses are structured and informative.

---

## 🖥️ PHASE 4 — Frontend Web Application

### P4.1 — Dashboard & Navigation

- [ ] **P4.1.1** — Main dashboard (`/dashboard`) with:
  - Summary cards: Total SKUs in warehouse, Pending bill verifications, Pending branding jobs, Low stock alerts count
  - Recent purchases list (last 10)
  - Quick action buttons: New Purchase, View Inventory, Check Alerts
- [ ] **P4.1.2** — Sidebar navigation with all module links + active state
- [ ] **P4.1.3** — Header with: logged-in user name, role badge, store name, logout button

### P4.2 — Home Brand Management UI

- [ ] **P4.2.1** — Home Brands list page: table with brand_code, brand_name, status, actions
- [ ] **P4.2.2** — Create / Edit Home Brand modal form:
  - Fields: Brand Name, Brand Code (unique check), Description, Logo URL
  - Inline validation: brand_code max 10 chars, uniqueness check via API
- [ ] **P4.2.3** — Deactivate confirmation dialog with warning

### P4.3 — Supplier (Vendor) Management UI

- [ ] **P4.3.1** — Supplier list page: searchable table, status filters, paginated
- [ ] **P4.3.2** — Create / Edit Supplier form:
  - Fields: Vendor Name, Code, City, State, GSTIN, Contact Person, Phone, Payment Terms, Source Types (multi-select checkboxes)
  - GSTIN validation (15-char format)
- [ ] **P4.3.3** — Supplier detail page: all fields + rate intelligence summary + purchase history
- [ ] **P4.3.4** — Status change (active/inactive/blacklist) with confirmation

### P4.4 — Purchase Registration UI (Stage 1)

- [ ] **P4.4.1** — Purchase form (`/purchases/new`):
  - **Step 1: Source Type selector** — LOCAL_SUPPLIER / DIRECT_BRAND / IMPORT / INHOUSE_PRIVATE_LABEL
  - Form adapts based on source type (Home Brand dropdown shows for LOCAL_SUPPLIER / INHOUSE; Source Collection shows for LOCAL_SUPPLIER only)
- [ ] **P4.4.2** — Supplier lookup with live search (typeahead) via `/api/suppliers/search`
- [ ] **P4.4.3** — Repeat detection: on entering Style/Model, call `/api/products/detect-repeat` and show REPEAT PRODUCT banner if match found with options: Reuse All / Reuse Some / Start Fresh
- [ ] **P4.4.4** — EW Collection mismatch guard: warn user if entering different EW Collection for same Source Collection
- [ ] **P4.4.5** — GST & Bill amount calculator: auto-calculates `Expected Bill Amount` live as user types
- [ ] **P4.4.6** — Colour variants row builder: add/remove colour rows dynamically (colour name, colour code, qty)
- [ ] **P4.4.7** — Rate Intelligence panel: shown inline after supplier + product selected — advisory data from `/api/rate-intelligence/context`
- [ ] **P4.4.8** — Form submission: POST to `/api/purchases`, handle success with redirect to purchase detail

### P4.5 — Bill Verification UI (Stage 2)

- [ ] **P4.5.1** — Bill verification section on purchase detail page
- [ ] **P4.5.2** — Bill entry form: Actual Bill Amount, Bill Number, Bill Date, Bill Photo upload (drag-drop)
- [ ] **P4.5.3** — Auto-reconciliation display: Expected vs Actual, difference highlighted (green if matched, red if discrepancy)
- [ ] **P4.5.4** — Discrepancy flow: show note field + "Send for approval" button if beyond threshold
- [ ] **P4.5.5** — Super Admin approval card: visible on discrepancy purchases, approve/reject with note

### P4.6 — Branding UI (Stage 3)

- [ ] **P4.6.1** — Branding section on purchase detail (visible after bill verified)
- [ ] **P4.6.2** — Dispatch form: pre-fills branding instructions from history (if repeat), editable; dispatch date, expected return date; per-colour qty verification
- [ ] **P4.6.3** — Bypass button: shown for non-LOCAL_SUPPLIER types; requires bypass reason; confirmation dialog
- [ ] **P4.6.4** — Receive & Verify form: per-colour received qty entry; discrepancy highlight; confirm receipt button
- [ ] **P4.6.5** — Branding Dispatch Order printable view (opens in new tab, print-formatted)

### P4.7 — Digitisation UI (Stage 4)

- [ ] **P4.7.1** — SKU list for a purchase: shows all colours as separate SKU cards with status badges (DRAFT / DIGITISING / PUBLISHED)
- [ ] **P4.7.2** — SKU detail / digitisation form:
  - **Tab 1: Specifications** — lens_width, bridge_width, temple_length, frame_height, weight, material, shape, gender
  - **Tab 2: Colour & Pricing** — colour_display_name, sale_price, cost_price (auto), gross margin % (auto)
  - **Tab 3: eCommerce Content** — title, short_desc, full_desc, tags (comma-separated chip input)
  - **Tab 4: Media** — photo upload with angle labels (Front, Side, Three-quarter, Temple, On-face), drag-to-reorder, primary photo selector, video upload
- [ ] **P4.7.3** — Repeat recall: if product is repeat, pre-fill all matching fields with "Previously used — confirm or edit" indicator
- [ ] **P4.7.4** — SKU Code display + barcode image (rendered from barcode library)
- [ ] **P4.7.5** — Publish SKU button: validates all required fields, POST to `/api/skus/:id/publish`; when last SKU in purchase published → toast "Purchase is now WAREHOUSE READY"

### P4.8 — Warehouse & Stock Distribution UI (Stage 5)

- [ ] **P4.8.1** — Warehouse inventory page (`/warehouse`): searchable, filterable table with qty by location
- [ ] **P4.8.2** — SKU stock distribution card: shows breakdown across all location types (WAREHOUSE / AT_STORE / IN_TRANSIT / PROMOTER_RESERVED / ONLINE_RESERVED / SOLD) with colour-coded badges; role-scoped (manager sees own store only)
- [ ] **P4.8.3** — Transfer request form: select SKU, qty, destination store; submit creates IN_TRANSIT movement
- [ ] **P4.8.4** — In-transit confirmation panel: store manager receives; "Confirm Receipt" button with qty validation
- [ ] **P4.8.5** — Low stock alerts list: SKUs below reorder threshold with "Create Transfer" quick action
- [ ] **P4.8.6** — Slow mover alerts list: configurable days filter

### P4.9 — Rate Intelligence UI

- [ ] **P4.9.1** — Rate Intelligence page (`/rate-intelligence`)
  - **Product-centric view:** search by product → shows all vendors + rate history table + trend indicators
  - **Vendor-centric view:** search by vendor → shows all products + rate range per product
- [ ] **P4.9.2** — Rate trend indicators: ↑ UP (red), ↓ DOWN (green), → STABLE (grey)
- [ ] **P4.9.3** — Staleness indicator: flag data >6 months old with "⚠️ May be stale" tooltip

### P4.10 — Procurement History & Analytics

- [ ] **P4.10.1** — Purchase history list with date range filter, source type filter, status filter, export CSV
- [ ] **P4.10.2** — Purchase detail page: full timeline of pipeline stages with timestamps
- [ ] **P4.10.3** — Product procurement history: per product → all past purchases with rate comparison table
- [ ] **P4.10.4** — Audit log viewer: filterable by user, module, action, date range (Super Admin only)

### P4.11 — Settings UI

- [ ] **P4.11.1** — Settings page (`/settings`): Discrepancy threshold, reorder thresholds, slow mover days
- [ ] **P4.11.2** — Location visibility config editor: manage which roles see which location types

**✅ PHASE 4 VERIFY CHECKPOINT:** All pages functional. Forms validate inputs. API calls succeed. Role-based access controls visible/invisible elements correctly. All error states shown with toast messages. No page-breaking JS errors.

---

## 🧪 PHASE 5 — Testing & Quality Assurance

### P5.1 — Unit Testing (Server-side)

- [ ] **P5.1.1** — Test all SP execution wrappers (mock MSSQL pool)
- [ ] **P5.1.2** — Test all `joi` validators — happy path + invalid inputs
- [ ] **P5.1.3** — Test JWT generation + verification + expiry
- [ ] **P5.1.4** — Test encryption/decryption utility
- [ ] **P5.1.5** — Test SKU code generation logic (uniqueness, format)
- [ ] **P5.1.6** — Test GST calculation utility

### P5.2 — API Integration Testing

- [ ] **P5.2.1** — Test all auth flows (login, refresh, logout, blacklist)
- [ ] **P5.2.2** — Test Purchase Registration: full flow from `POST /purchases` → colours → bill → branding → digitisation → publish
- [ ] **P5.2.3** — Test repeat detection scenarios
- [ ] **P5.2.4** — Test branding bypass (allowed for DIRECT_BRAND, blocked for LOCAL_SUPPLIER)
- [ ] **P5.2.5** — Test stock movements: transfer → confirm → cancel flow
- [ ] **P5.2.6** — Test rate intelligence auto-update on purchase creation
- [ ] **P5.2.7** — Test role enforcement: each role can/cannot access restricted endpoints

### P5.3 — Frontend Testing

- [ ] **P5.3.1** — Test purchase form: source type switching, repeat detection banner, GST calculator
- [ ] **P5.3.2** — Test bill upload + reconciliation display
- [ ] **P5.3.3** — Test branding dispatch + receive flow
- [ ] **P5.3.4** — Test digitisation: all tabs, media upload, publish button
- [ ] **P5.3.5** — Test stock distribution view across different roles
- [ ] **P5.3.6** — Cross-browser test: Chrome, Edge (Windows Server IIS environment)

### P5.4 — Performance & Security Testing

- [ ] **P5.4.1** — Load test: simulate 50 concurrent users hitting purchase list endpoint
- [ ] **P5.4.2** — Test API key rejection: requests without valid key return 401
- [ ] **P5.4.3** — Test JWT tampering: modified JWT returns 401
- [ ] **P5.4.4** — Test SQL injection via stored procedures (parameterized inputs — confirm no raw SQL possible)
- [ ] **P5.4.5** — Test file upload: only allow image/pdf types, max file size enforced
- [ ] **P5.4.6** — Check all API responses: no sensitive data (passwords, internal supplier names) leaked to unauthorized roles

**✅ PHASE 5 VERIFY CHECKPOINT:** All tests pass. No broken endpoints. Security checks all pass. Performance acceptable (<500ms p95 on main list endpoints).

---

## 🚀 PHASE 6 — Deployment & Go-Live

### P6.1 — Environment Configuration

- [ ] **P6.1.1** — Configure production `.env` on Windows Server (DB credentials, secrets, NODE_ENV=production)
- [ ] **P6.1.2** — Set up `/logs` directory with write permissions
- [ ] **P6.1.3** — Set up `/uploads` directory for bill photos + media files
- [ ] **P6.1.4** — Configure MSSQL production database + user permissions

### P6.2 — IIS Deployment

- [ ] **P6.2.1** — Install Node.js on Windows Server (LTS)
- [ ] **P6.2.2** — Install iisnode (`iisnode-full.msi`)
- [ ] **P6.2.3** — Create IIS Application pointing to app root
- [ ] **P6.2.4** — Verify `web.config` routes all requests to `app.js`
- [ ] **P6.2.5** — Set Application Pool: No Managed Code, Identity with file write permissions
- [ ] **P6.2.6** — Test: browse to server URL, confirm app loads

### P6.3 — PM2 Deployment (Parallel)

- [ ] **P6.3.1** — Install PM2 globally: `npm install -g pm2`
- [ ] **P6.3.2** — Install PM2 Windows service: `npm install -g pm2-windows-service`
- [ ] **P6.3.3** — Start app: `pm2 start ecosystem.config.js --env production`
- [ ] **P6.3.4** — Save PM2 state: `pm2 save`
- [ ] **P6.3.5** — Install as Windows service: `pm2-service-install`
- [ ] **P6.3.6** — Test: reboot server, confirm PM2 app auto-starts
- [ ] **P6.3.7** — Verify PM2 cluster mode is distributing requests (`pm2 monit`)

### P6.4 — Final Verification

- [ ] **P6.4.1** — Full end-to-end smoke test: login → create purchase → bill → branding → digitise → warehouse
- [ ] **P6.4.2** — Verify audit logs written for all actions
- [ ] **P6.4.3** — Verify logs written to `/logs/` directory
- [ ] **P6.4.4** — Verify rate intelligence updated after test purchase
- [ ] **P6.4.5** — Test with multiple simultaneous users (PM2 cluster validation)

**✅ PHASE 6 VERIFY CHECKPOINT:** App live on both IIS and PM2. Auto-starts on reboot. All production smoke tests pass.

---

## 📊 SUMMARY — Task Count by Phase

| Phase | Description | Tasks | Est. Duration |
|-------|-------------|-------|---------------|
| P0 | Foundation & Infrastructure | 35 | 1 week |
| P1 | MSSQL Database Schema (20 tables) | 28 | 1 week |
| P2 | Stored Procedures (~60 SPs) | 65 | 2 weeks |
| P3 | REST API Layer (~45 endpoints) | 55 | 2 weeks |
| P4 | Frontend Web Application | 45 | 3 weeks |
| P5 | Testing & QA | 22 | 1 week |
| P6 | Deployment & Go-Live | 18 | 3 days |
| **TOTAL** | | **~268 tasks** | **~10-11 weeks** |

---

## 🔒 ARCHITECTURE RULES (Must be enforced every sprint)

1. **No direct DB access from frontend** — all data via REST API only
2. **No raw SQL in Node.js** — all queries via stored procedures
3. **Two-layer auth on every API call** — API Key + JWT
4. **Server datetime only** — `GETDATE()` in all SPs, never client-supplied timestamps
5. **No BIGINT** — use INT. **No VARCHAR > 500** — redesign if needed
6. **Parameterised SP calls only** — zero SQL injection risk
7. **Error handling at every layer** — SP `TRY...CATCH` → API try/catch → Global error handler → Frontend toast
8. **Audit everything** — every CREATE/UPDATE/DELETE writes to `audit_logs`
9. **Supplier confidentiality** — `maker_id`, `source_collection` never exposed in public-facing API responses
10. **Role enforcement** — middleware checks role on every protected endpoint; RBAC based on JWT claims

---

## 🗒️ NOTES FOR DEVELOPERS

- Always implement in phase order — never skip ahead
- Mark task `[x]` only after testing passes, not just implementation
- For each SP, test with SSMS first before wiring to Node.js
- All file uploads stored in `/uploads/[type]/[YYYY-MM]/filename` (organized by month)
- Use environment variables for all secrets — never hardcode in source
- Keep all comments in English for maintainability
- Console.log is forbidden in production — use Winston logger only

---

*🌌 Cosmos ERP · Foundry Module · Master Dev TODO · Node.js + MSSQL + IIS/PM2*
*Project Lead: Talha Junani · Eyewoot Optical — Confidential*

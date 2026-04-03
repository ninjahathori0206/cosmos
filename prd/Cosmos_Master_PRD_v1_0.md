+-----------------------------------------------------------------------+
| 🌌                                                                    |
|                                                                       |
| **COSMOS**                                                            |
|                                                                       |
| Master Architecture & Constellation PRD                               |
|                                                                       |
| Eyewoot Retail OS · Version 1.0 · The Complete System                 |
+-----------------------------------------------------------------------+

+-----------------------+-----------------------+-----------------------+
| **⚙️ Command Unit**   | **🔩 Foundry**        | **🧾 POS**            |
|                       |                       |                       |
| Web Admin Panel       | Inventory & Orders    | Sales · Rx · Patients |
+-----------------------+-----------------------+-----------------------+
| **🪖 Army**           | **📱 Eyewoot Go**     | **🤝 Promoter**       |
|                       |                       |                       |
| Employee HR           | Consumer App          | Referral · Sales ·    |
|                       |                       | Membership            |
+-----------------------+-----------------------+-----------------------+

+-----------------------+-----------------------+-----------------------+
| **1 Supabase          | **1 Auth System**     | **1 Design System**   |
| Database**            |                       |                       |
|                       | Supabase OTP + JWT    | Shadcn + Tailwind +   |
| Shared schema + RLS   |                       | #0056b3               |
+-----------------------+-----------------------+-----------------------+

  ------------------------ ----------------------------------------------
  **Project**              Cosmos ERP --- Eyewoot Retail OS

  **Document Type**        Master Architecture & Constellation PRD ---
                           governs all 6 modules

  **Version**              1.0

  **Project Lead**         Talha Junani

  **Modules**              6 confirmed · Extensible --- new modules added
                           without re-architecture

  **Store Formats**        Franchise · Eyewoot-Owned · Online/D2C ·
                           Kiosk/Pop-up · Future formats pluggable

  **IDE / Method**         Cursor --- Vibe Coding (AI-Assisted
                           Development)

  **Date**                 8 March 2026
  ------------------------ ----------------------------------------------

> **1. The Cosmos Vision**

Cosmos is not a single app. It is a constellation --- six purpose-built
modules orbiting one shared core, each serving a distinct audience, each
deployable independently, all powered by the same database, the same
auth system, and the same design language.

Every technology and architectural decision in Cosmos is made to serve
two masters simultaneously: it must work for a franchise store owner in
Bharuch managing 3 staff and it must scale to 100+ stores across India
without any re-architecture. Cosmos achieves this through strict
multi-tenancy, modular NestJS services, and a Turborepo monorepo that
makes the AI in Cursor as productive on day 300 as it is on day 1.

+-----------------------------------------------------------------------+
| **🌌 The Cosmos Promise**                                             |
|                                                                       |
| Every rupee, every frame, every patient, every employee --- one       |
| system, one truth.                                                    |
|                                                                       |
| Built module by module: Command Unit first, then each module ships    |
| independently.                                                        |
|                                                                       |
| New modules plug in without touching existing ones. The constellation |
| grows forever.                                                        |
|                                                                       |
| AI-assisted development in Cursor: strict TypeScript + .cursorrules = |
| code that never goes wrong.                                           |
+-----------------------------------------------------------------------+

> **2. The Constellation --- All 6 Modules**

Each module has a distinct identity, colour, audience, and app path.
Together they form a complete Retail Operating System.

+-----------------------------------------------------------------------+
| **⚙️ Command Unit**                                                   |
|                                                                       |
| apps/admin-web · Web App (Next.js → Vercel)                           |
|                                                                       |
| *The brain and nervous system of Cosmos. Every store, every user,     |
| every setting lives here.*                                            |
+-----------------------------------------------------------------------+
| Store Management · User & Role Management · System Settings · Global  |
| Configuration · Audit Logs                                            |
+-----------------------------------------------------------------------+

+-----------------------------------------------------------------------+
| **🔩 Foundry**                                                        |
|                                                                       |
| apps/foundry-mobile + admin-web · Capacitor Mobile + Web              |
|                                                                       |
| *The supply chain engine. Frames, lenses, accessories --- from        |
| supplier to shelf.*                                                   |
+-----------------------------------------------------------------------+
| Inventory (Frames, Sunglasses, Accessories) · Lens Service Catalogue  |
| · Order Processing · Supplier Management · Inter-store Transfers      |
+-----------------------------------------------------------------------+

+-----------------------------------------------------------------------+
| **🧾 POS**                                                            |
|                                                                       |
| apps/pos-tablet · Capacitor Tablet (Android/iOS)                      |
|                                                                       |
| *The store\'s revenue engine. Every sale, every prescription, every   |
| patient --- recorded and linked.*                                     |
+-----------------------------------------------------------------------+
| Sales & Billing · Order Management · Patient Profiles & History ·     |
| Prescription (Rx) Records · Lifestyle Check · AI Frame & Lens         |
| Suggestions (Phase 2)                                                 |
+-----------------------------------------------------------------------+

+-----------------------------------------------------------------------+
| **🪖 Army**                                                           |
|                                                                       |
| apps/army-mobile · Capacitor Mobile (Android/iOS)                     |
|                                                                       |
| *The people engine. Every employee\'s performance, attendance, tasks, |
| and training.*                                                        |
+-----------------------------------------------------------------------+
| Employee Profiles · GPS + Selfie Attendance · Performance Scores      |
| (linked to POS sales) · Task Management · Training & Learning         |
+-----------------------------------------------------------------------+

+-----------------------------------------------------------------------+
| **📱 Eyewoot Go**                                                     |
|                                                                       |
| apps/eyewoot-go · Capacitor Mobile (Android/iOS)                      |
|                                                                       |
| *The customer\'s window into Eyewoot. Browse, book, buy, and track    |
| --- all from their phone.*                                            |
+-----------------------------------------------------------------------+
| Browse Frames & Products · Book Eye Test / Appointment · Track Order  |
| Status · View & Store Prescription · Loyalty Points & Offers · Store  |
| Locator · AI Frame Recommendations (Phase 2) · Customer Support       |
+-----------------------------------------------------------------------+

+-----------------------------------------------------------------------+
| **🤝 Eyewoot Promoter**                                               |
|                                                                       |
| apps/eyewoot-promoter · Capacitor Mobile (Android/iOS)                |
|                                                                       |
| *The growth engine. Promoters refer, sell, and earn --- with full     |
| visibility into their earnings.*                                      |
+-----------------------------------------------------------------------+
| Refer Customers to Stores · Share Product Catalogue Links · Sell      |
| Products Directly · Sell Eyewoot Membership · Track Commissions &     |
| Payouts · Leaderboard                                                 |
+-----------------------------------------------------------------------+

> **3. Monorepo Architecture (Turborepo)**

One Git repository. One CI/CD pipeline. Six apps. Four shared packages.
This is what makes Vibe Coding in Cursor so powerful --- the AI has the
entire system in context at once, and shared logic is written exactly
once.

  --------------------------- ------------------ ---------------------------
  **Path**                    **Type**           **Description**

  **apps/admin-web**          Next.js 16 →       Command Unit --- HQ web
                              Vercel             admin panel. All store,
                                                 user, config management.

  **apps/pos-tablet**         Next.js +          POS --- in-store sales,
                              Capacitor 7        billing, patient Rx, AI
                                                 suggestions.

  **apps/foundry-mobile**     Next.js +          Foundry --- inventory
                              Capacitor 7        scanning, stock management,
                                                 order processing.

  **apps/army-mobile**        Next.js +          Army --- employee HR,
                              Capacitor 7        attendance (GPS+selfie),
                                                 performance.

  **apps/eyewoot-go**         Next.js +          Eyewoot Go --- consumer
                              Capacitor 7        app. Browse, book, buy,
                                                 track.

  **apps/eyewoot-promoter**   Next.js +          Promoter app --- referrals,
                              Capacitor 7        catalogue sharing, direct
                                                 sales, membership.

  **packages/database**       Prisma + Supabase  Shared schema for ALL 6
                                                 modules. Single source of
                                                 truth.

  **packages/ui**             Shadcn + Tailwind  Eyewoot design system.
                                                 Module accent colours
                                                 defined here.

  **packages/utils**          TypeScript         GST calc · SPH/CYL
                                                 validation · performance
                                                 formula · SKU gen · loyalty
                                                 points.

  **backend/**                NestJS (modular)   One NestJS app with one
                                                 module per Cosmos module.
                                                 Railway.app.
  --------------------------- ------------------ ---------------------------

**3.1 NestJS Backend --- One Module Per App**

  --------------------- --------------- ----------------------------------
  **NestJS Module**     **Serves**      **Key Services**

  **CommandModule**     Command Unit    StoreService · UserService ·
                        Web             RoleService · AuditService ·
                                        ConfigService

  **FoundryModule**     Foundry         InventoryService · SkuService ·
                        Mobile + Web    OrderService · SupplierService ·
                                        TransferService

  **PosModule**         POS Tablet      SaleService · PatientService ·
                                        PrescriptionService ·
                                        AiSuggestionService

  **HrModule**          Army Mobile     EmployeeService ·
                                        AttendanceService ·
                                        PerformanceService · TaskService ·
                                        TrainingService

  **ConsumerModule**    Eyewoot Go      ProductCatalogueService ·
                                        AppointmentService ·
                                        LoyaltyService · SupportService

  **PromoterModule**    Eyewoot         ReferralService ·
                        Promoter        CommissionService ·
                                        MembershipService ·
                                        CatalogueService
  --------------------- --------------- ----------------------------------

> **4. Shared Infrastructure**

These four layers are built once in Phase 0 (Command Unit) and consumed
by every module that follows. No module re-implements auth, storage,
realtime, or the design system.

**4.1 Authentication --- One Login, All Modules**

  ---------------------- ------------------------------------------------
  **Layer**              **Specification**

  **Auth Provider**      Supabase Auth --- Phone OTP (primary) +
                         Email/Password for web admin users.

  **JWT Claims**         Every token includes: user_id · role · store_id
                         · module_access\[\] · employee_id (Army) ·
                         customer_id (Go) · promoter_id (Promoter).

  **Role Hierarchy**     super_admin → hr_admin → store_manager →
                         team_leader → employee / cashier / optometrist /
                         promoter / customer.

  **Single Sign-On**     One Supabase project. Login once on any Cosmos
                         app = access to permitted modules without
                         re-login.

  **Session Storage**    Mobile: Capacitor SecureStoragePlugin (native
                         keychain). Web: httpOnly cookie via Next.js
                         middleware.

  **OTP Flow**           Phone number entered → Supabase sends OTP →
                         verified → JWT issued with full claims. No
                         passwords for store staff.
  ---------------------- ------------------------------------------------

**4.2 Multi-Tenancy & RLS**

  ---------------------- ------------------------------------------------
  **Rule**               **Implementation**

  **store_id is king**   Every tenant table has a store_id column.
                         Supabase RLS policy: WHERE store_id =
                         auth.jwt()-\>\>\'store_id\'.

  **Super Admin bypass** bypass_rls: true JWT claim. Sees all stores, all
                         data, globally.

  **HR Admin bypass**    hr_bypass: true JWT claim. Sees all stores\'
                         employee data only.

  **Customer data**      customer_id scoped in Eyewoot Go. Customers see
                         only their own orders, Rx, loyalty points.

  **Promoter data**      promoter_id scoped. Promoters see only their own
                         referrals, commissions, catalogue links.

  **Cross-module reads** Army reads POS orders (read-only). Promoter
                         reads product catalogue (read-only). Never
                         cross-write.
  ---------------------- ------------------------------------------------

**4.3 Deployment Matrix**

  -------------------- ----------------- ---------------- ----------------------
  **Module**           **Platform**      **Deployment**   **Trigger**

  **Command Unit       Web               Vercel           Push to main →
  (admin-web)**                                           auto-deploy (\~2 min)

  **POS (pos-tablet)** Android/iOS APK   GitHub Actions   Git tag release
                                                          v\*.\*.\*

  **Foundry            Android/iOS APK   GitHub Actions   Git tag release
  (foundry-mobile)**                                      v\*.\*.\*

  **Army               Android/iOS APK   GitHub Actions   Git tag release
  (army-mobile)**                                         v\*.\*.\*

  **Eyewoot Go**       Android/iOS/PWA   GitHub Actions + Tag release + web
                                         Vercel           deploy

  **Eyewoot Promoter** Android/iOS APK   GitHub Actions   Git tag release
                                                          v\*.\*.\*

  **NestJS Backend**   Node.js API       Railway.app      Push to main →
                                                          auto-deploy (\~3 min)

  **DB Migrations**    Supabase/Prisma   On API deploy    prisma migrate deploy
  -------------------- ----------------- ---------------- ----------------------

> **5. The Master .cursorrules**

This file governs every line of AI-generated code across all 6 modules.
It is the single most important file in the Cosmos monorepo. It lives at
the root and is extended by each module\'s own rule set.

+-----------------------------------------------------------------------+
| **// .cursorrules --- COSMOS ERP Master Rules**                       |
|                                                                       |
| // These rules apply to ALL 6 modules. Module-specific rules extend   |
| these.                                                                |
|                                                                       |
| **RULE 1 --- MULTI-TENANCY:** Every single DB query on a tenant table |
| MUST include store_id filter. No exceptions. No unscoped reads.       |
|                                                                       |
| **RULE 2 --- NO DB IN UI:** Zero Supabase/Prisma calls in any UI      |
| component. All data access through packages/database or NestJS        |
| services.                                                             |
|                                                                       |
| **RULE 3 --- STRICT TYPES:** Never use \'any\'. Every prop, API       |
| response, DB result, and event payload has an explicit TypeScript     |
| type.                                                                 |
|                                                                       |
| **RULE 4 --- DESIGN SYSTEM:** Use packages/ui exclusively. Never      |
| write inline Tailwind for brand colours --- use CSS variables from    |
| the design system.                                                    |
|                                                                       |
| **RULE 5 --- ERROR BOUNDARIES:** Every async action has try/catch.    |
| Every error surfaces as a user-facing toast. Never swallow errors     |
| silently.                                                             |
|                                                                       |
| **RULE 6 --- OFFLINE-FIRST MOBILE:** All Capacitor apps (POS,         |
| Foundry, Army, Promoter) use Optimistic UI. Core actions never wait   |
| on a server response.                                                 |
|                                                                       |
| **RULE 7 --- RLS IS AUTHORITATIVE:** App-level permission checks are  |
| secondary. Supabase RLS is the real security layer. Never remove RLS  |
| to fix a bug.                                                         |
|                                                                       |
| **RULE 8 --- READ-ONLY CROSS-MODULE:** When Module A reads Module     |
| B\'s data, it is ALWAYS read-only. Cross-module writes go through the |
| owning module\'s API.                                                 |
|                                                                       |
| **RULE 9 --- SHARED UTILS ONLY:** Business logic (GST, SPH/CYL,       |
| performance score, commission calc) lives in packages/utils. Never    |
| duplicated in apps.                                                   |
|                                                                       |
| **RULE 10 --- MODULE ISOLATION:** Each NestJS module imports only its |
| own services. No circular dependencies. Each app route group is       |
| self-contained.                                                       |
|                                                                       |
| **RULE 11 --- AUDIT EVERYTHING:** Every CREATE, UPDATE, DELETE on     |
| critical tables writes an audit log row. Never delete audit logs.     |
|                                                                       |
| **RULE 12 --- EXTENSIBILITY:** Never hardcode store formats, product  |
| types, or role lists in UI. Always read from DB config managed by     |
| Command Unit.                                                         |
+-----------------------------------------------------------------------+

> **6. Module Summaries**

**⚙️ Command Unit**

Command Unit is the nervous system of Cosmos. It is the first module
built --- because nothing else can exist without stores, users, and
roles. It lives in apps/admin-web and is accessed only by Super Admin
and HR Admin via browser.

  ---------------------- ------------------------------------------------
  **Sub-Module**         **What It Does**

  **Store / Unit         Create, configure, and activate every store.
  Management**           Store type (franchise/owned/kiosk/D2C), GSTIN,
                         UPI VPA, GPS coordinates, printer MAC address,
                         status.

  **User Management**    Create all user accounts across all modules.
                         Assign roles and store_id JWT claims. Deactivate
                         / offboard.

  **Role & Permission    Define role capabilities. New roles added here
  Config**               --- no code changes needed. RBAC is data-driven.

  **System Settings**    Global configuration: GST rates per HSN/SAC,
                         leave types, performance formula weights,
                         loyalty point rules, membership tiers.

  **Audit Logs**         Every action by every user across every module
                         is logged here. Filter by user, module, action,
                         date.

  **Module Access        Enable/disable modules per store. A kiosk store
  Control**              may only have POS active. A franchise may have
                         all 6.
  ---------------------- ------------------------------------------------

**🔩 Foundry --- Inventory & Order Processing**

Foundry is the supply chain brain of Cosmos. It tracks every physical
product from supplier to shelf to customer. It is the only module that
owns inventory write access --- POS reads from Foundry\'s stock, never
writes to it directly.

  ---------------------- ------------------------------------------------
  **Sub-Module**         **What It Does**

  **SKU & Product        Master catalogue of all Frames, Sunglasses,
  Catalogue**            Accessories, and Branded Merchandise. Managed by
                         Super Admin. Read by all modules.

  **Lens Service         Virtual services (Single Vision, Bifocal,
  Catalogue**            Progressive) with pricing and GST rates. Not
                         physical stock.

  **Eye Test /           Service SKUs for eye test appointments. Booked
  Consultation**         via Eyewoot Go, fulfilled via POS.

  **Stock Management**   Per-store live stock count. Inward via CSV
                         upload or HQ push. Cycle counts. Low-stock
                         alerts.

  **Supplier             Supplier profiles, purchase orders, inward
  Management**           receipts. Supplier data linked to stock
                         movements.

  **Inter-store          HQ creates transfer → destination store confirms
  Transfers**            receipt → stock auto-adjusted both ends.

  **Order Processing**   Wholesale/bulk orders from HQ to stores. Order
                         status: Placed → Packed → Dispatched → Received.

  **D2C Order            Orders from Eyewoot Go are routed to nearest/HQ
  Fulfilment**           Foundry location for pack and dispatch.
  ---------------------- ------------------------------------------------

**🧾 POS --- Sales, Prescriptions & Patient History**

The POS is where Eyewoot makes money and where every patient\'s optical
journey is recorded. It is the richest module in Cosmos --- combining
retail billing with a full clinical record system and, in Phase 2,
AI-powered recommendations.

  ---------------------- ------------------------------------------------
  **Sub-Module**         **What It Does**

  **Sales & Billing**    Cart, GST auto-split (frames 12% / lens service
                         18%), Cash + UPI QR + Card + Split payment,
                         receipts (58mm BLE thermal, WhatsApp PDF,
                         on-screen).

  **Order Management**   Store-level order lifecycle: New → In Progress →
                         Ready → Delivered. Lens orders with fitting
                         status.

  **Patient Profile**    Full patient record: name, phone, DOB, lifestyle
                         data, purchase history, Rx history, AI
                         suggestion history.

  **Prescription (Rx)**  RE/LE: SPH, CYL, AXIS, ADD, PD, Visual Acuity.
                         Three entry paths: Optometrist, Staff at
                         billing, auto-link from history.

  **Lifestyle Check**    Structured questionnaire at eye test: screen
                         time, driving habits, outdoor activity,
                         occupation, reading needs. Used to inform lens
                         recommendations.

  **Power Details**      Full history of all Rx records per patient ---
                         chronological, with delta (change in power)
                         highlighted.

  **Preferences**        Patient\'s frame preferences: style
                         (rimless/full/half), material, colour, face
                         shape, budget range. Captured once, updated on
                         each visit.

  **AI Suggestions       Based on Rx + Lifestyle + Preferences + current
  (Phase 2)**            stock → Claude API generates top 3 frame and
                         lens recommendations with reasoning. UX designed
                         now, API wired in Phase 2.
  ---------------------- ------------------------------------------------

+-----------------------------------------------------------------------+
| **🤖 AI Suggestion Engine --- Design Now, Wire Phase 2**              |
|                                                                       |
| UX: After Rx entry, a screen shows \'AI Recommendations\' with 3      |
| frame cards + 1 lens recommendation.                                  |
|                                                                       |
| Each card shows: frame image, name, price, and a 1-line AI reasoning  |
| (e.g. \'Lightweight titanium suits high SPH and active lifestyle\').  |
|                                                                       |
| Input to AI: SPH/CYL/AXIS/ADD + lifestyle answers + preferences +     |
| available stock (live from Foundry).                                  |
|                                                                       |
| Phase 2 implementation: Claude API (claude-sonnet-4-6) with           |
| structured JSON output for frame/lens suggestions.                    |
|                                                                       |
| Phase 1: Show the UX with rule-based suggestions (highest-rated       |
| frames matching style + budget). Swap in Claude API without changing  |
| any UI.                                                               |
+-----------------------------------------------------------------------+

**🪖 Army --- HR & People Management**

Army gives every Eyewoot employee full ownership of their work identity
and performance data. Managers get tools to lead their teams fairly.
Performance incentives are calculated transparently --- linked directly
to live POS sales data.

  ---------------------- ------------------------------------------------
  **Sub-Module**         **What It Does**

  **Employee Profile**   Full employee record: designation, department,
                         salary, documents, status. Onboarding and
                         offboarding flows.

  **Attendance**         GPS + mandatory selfie check-in/check-out.
                         Server-set timestamps (anti-fraud). 100m radius
                         validation from store GPS.

  **Performance Score**  5-factor monthly score: Sales 35% (live POS) +
                         Attendance 25% + Manager Rating 20% + Tasks
                         10% + Training 10%.

  **Incentives**         Score-based bonus tiers: Elite (90--100) = 20%
                         bonus · Strong (75--89) = 10% · Good (60--74) =
                         5%.

  **Task Management**    Manager assigns daily/weekly tasks. Employee
                         completes with proof. Feeds performance score.

  **Training**           HR Admin creates modules (text/video/quiz).
                         Completion feeds performance score.
  ---------------------- ------------------------------------------------

**📱 Eyewoot Go --- Consumer App**

Eyewoot Go is the customer\'s personal optical companion. It connects
every Eyewoot customer to their prescription history, their orders, the
nearest store, and in Phase 2, an AI that recommends frames based on
their face and lifestyle.

  ---------------------- ------------------------------------------------
  **Feature**            **Specification**

  **Browse Products &    Full catalogue from Foundry (read-only). Filter
  Frames**               by brand, style, material, colour, price, face
                         shape.

  **Book Eye Test /      Customer books at any store. Slot availability
  Appointment**          from store calendar. Confirmation + reminder
                         push notification.

  **Track Order Status** Real-time order status: Placed → Lens Fitting →
                         Ready → Delivered. Linked to POS order
                         management.

  **View & Store         Customer\'s full Rx history, readable in plain
  Prescription**         language. Shareable as PDF. Linked from POS
                         records.

  **Loyalty Points &     Points earned per purchase (configurable rate in
  Offers**               Command Unit). Redeemable at POS. Tier system
                         (Bronze/Silver/Gold).

  **Store Locator**      Map view of all active Eyewoot stores. GPS-based
                         nearest store. Store hours, phone, and
                         directions.

  **AI Frame             Upload selfie → Claude API analyses face shape →
  Recommendations (Phase recommends frames from live catalogue with
  2)**                   try-on preview.

  **Customer Support**   In-app chat / ticket raising. FAQ. Order-related
                         queries linked to order records.
  ---------------------- ------------------------------------------------

**🤝 Eyewoot Promoter**

Promoters are Eyewoot\'s growth force --- independent sellers who earn
commissions by referring customers, sharing the catalogue, selling
products, and selling Eyewoot memberships. The Promoter app gives them
everything they need to earn and track.

  ---------------------- ------------------------------------------------
  **Feature**            **Specification**

  **Refer Customers to   Promoter shares a unique referral link / QR
  Stores**               code. Customer visits store, code is scanned at
                         POS. Referral commission auto-calculated.

  **Share Product        Promoter gets a personal catalogue link with
  Catalogue**            their referral tag. Shares via WhatsApp,
                         Instagram, etc. D2C orders through their link =
                         their commission.

  **Sell Products        Promoter can place a direct order on behalf of a
  Directly**             customer (like a field agent). Order routed
                         through Foundry for fulfilment.

  **Sell Eyewoot         Promoter sells annual membership plans to
  Membership**           customers. Membership = loyalty tier upgrade +
                         exclusive offers. Commission on each membership
                         sold.

  **Commission           Dashboard showing: referrals made, sales
  Tracking**             generated, membership sold, commissions earned,
                         pending payouts.

  **Leaderboard**        Rank among all promoters (store-level and
                         national). Top performers highlighted. Drives
                         healthy competition.
  ---------------------- ------------------------------------------------

> **7. Inter-Module Data Flows**

Cosmos modules are isolated by design --- but they share a single
database, so data flows between them are direct, type-safe DB reads
through the shared Prisma schema. No external API calls between modules.
No data duplication.

  -------------- ------- ------------- ---------------------------------------
  **From**       **→**   **To**        **Data Transferred & Purpose**

  **Command      **→**   **ALL         stores, roles, config --- every module
  Unit**                 Modules**     reads store settings from Command Unit

  **Foundry**    **→**   **POS**       SKU catalogue + live stock levels ---
                                       POS reads to populate cart and check
                                       availability

  **Foundry**    **→**   **Eyewoot     Product catalogue (public, read-only)
                         Go**          --- consumer browses Foundry\'s
                                       catalogue

  **POS**        **→**   **Army**      orders WHERE cashier_id = employee_id
                                       --- Army reads for sales performance
                                       score calculation

  **POS**        **→**   **Eyewoot     orders, Rx records, appointment status
                         Go**          --- customer tracks their own data in
                                       Go app

  **POS**        **→**   **Foundry**   stock deduction on sale --- POS
                                       triggers Foundry\'s
                                       StockService.deduct() after confirmed
                                       payment

  **Eyewoot Go** **→**   **POS**       appointment bookings --- Go creates
                                       appointment records, POS retrieves on
                                       day of visit

  **Eyewoot Go** **→**   **Foundry**   D2C order placement --- consumer order
                                       routes through Foundry for fulfilment

  **Promoter**   **→**   **POS**       referral code scan at billing --- POS
                                       records promoter_id on order for
                                       commission calculation

  **Promoter**   **→**   **Foundry**   direct sale order placement --- routed
                                       through Foundry fulfilment pipeline

  **Army**       **→**   **Command     employee accounts --- Army uses Command
                         Unit**        Unit\'s UserService to
                                       create/deactivate auth accounts
  -------------- ------- ------------- ---------------------------------------

+-----------------------------------------------------------------------+
| **⚡ The Golden Rule of Inter-Module Data Flow**                      |
|                                                                       |
| Module A READS from Module B\'s tables directly via shared Prisma     |
| schema (same DB, zero latency).                                       |
|                                                                       |
| Module A WRITES to Module B\'s data only by calling Module B\'s       |
| NestJS service --- never direct DB write.                             |
|                                                                       |
| Example: POS deducts stock by calling                                 |
| FoundryModule.StockService.deduct(skuId, qty, storeId).               |
|                                                                       |
| Example: Army reads sales by querying SELECT orders WHERE cashier_id  |
| = :id --- read-only, no service call needed.                          |
|                                                                       |
| This keeps modules independent while keeping data consistent and      |
| auditable.                                                            |
+-----------------------------------------------------------------------+

> **8. Roles Across the Cosmos**

Every role is defined once in Command Unit and embedded in the Supabase
JWT. Each module respects the role --- no module has its own auth
system.

  ----------------- ----------- ------------- ----------- -------------- --------------
  **Role**          **Command   **Foundry +   **Army**    **Eyewoot Go** **Promoter**
                    Unit**      POS**                                    

  **Super Admin (HQ Full        Full          Full        Read-only      Full
  / Talha)**                                                             

  **HR Admin**      User Mgmt   None          Full        None           None
                    only                                                 

  **Store Manager** Own store   Full --- own  Own store   None           None
                    config      store         team                       

  **Team Leader**   None        POS billing   Own team    None           None
                                              tasks                      

  **Cashier / Sales None        POS billing   Own records None           None
  Staff**                       only                                     

  **Optometrist**   None        Rx + patient  Own records None           None
                                only                                     

  **Customer**      None        None          None        Full           None
                                                          self-service   

  **Promoter**      None        None          None        Browse only    Full
                                                                         self-service
  ----------------- ----------- ------------- ----------- -------------- --------------

> **9. Build Sequence & Roadmap**

Cosmos is built in strict module order. Command Unit is the foundation
--- no other module can exist without stores and users. Each subsequent
module is a self-contained sprint with a clear definition of done.

  ----------- ------------ ---------------- --------------------------- --------------
  **Phase**   **Module**   **Name**         **Definition of Done**      **Duration**

  **P0**      ---          **Cosmos         Turborepo init · Supabase   1 week
                           Foundation**     project · Prisma base       
                                            schema · shared packages ·  
                                            master .cursorrules · CI/CD 
                                            pipeline                    

  **P1**      ⚙️           **Command Unit** Store CRUD · User           2--3 weeks
                                            management · Role config ·  
                                            System settings · Audit     
                                            logs · Module access        
                                            toggles                     

  **P2**      🔩           **Foundry**      SKU catalogue · Stock       3 weeks
                                            management · CSV inward ·   
                                            HQ push · Supplier          
                                            management · Inter-store    
                                            transfers                   

  **P3**      🧾           **POS**          Sales + GST · Patient       4 weeks
                                            profiles · Rx entry (3      
                                            paths) · Lifestyle check ·  
                                            Power history · Preferences 
                                            · Receipts · Order          
                                            management                  

  **P4**      🪖           **Army**         Employee profiles ·         3 weeks
                                            GPS+selfie attendance ·     
                                            Performance score (POS live 
                                            link) · Tasks · Training ·  
                                            Incentives                  

  **P5**      📱           **Eyewoot Go**   Product catalogue ·         3 weeks
                                            Appointment booking · Order 
                                            tracking · Rx view ·        
                                            Loyalty points · Store      
                                            locator · Support           

  **P6**      🤝           **Promoter**     Referral QR · Catalogue     2 weeks
                                            sharing · Direct sales ·    
                                            Membership selling ·        
                                            Commission dashboard ·      
                                            Leaderboard                 

  **P7**      🤖           **AI Layer**     Claude API for POS          2 weeks
                                            suggestions + Eyewoot Go    
                                            frame recommendations ·     
                                            Structured JSON output · UX 
                                            already built in P3/P5      

  **P8**      ---          **Hardening &    RLS audit · load testing ·  2 weeks
                           Pilot**          all APK signing · staff     
                                            training · 1--5 stores live 
  ----------- ------------ ---------------- --------------------------- --------------

+-----------------------------------------------------------------------+
| **📅 Total Estimated Build Timeline**                                 |
|                                                                       |
| P0 Foundation: 1 week                                                 |
|                                                                       |
| P1--P6 All Modules: \~18 weeks (Vibe Coding velocity may compress     |
| this significantly)                                                   |
|                                                                       |
| P7 AI Layer: 2 weeks (UX already built --- only API wiring)           |
|                                                                       |
| P8 Hardening + Pilot: 2 weeks                                         |
|                                                                       |
| Total: \~23 weeks from Turborepo init to 5 stores live on full Cosmos |
|                                                                       |
| Note: Modules are independent. P3 (POS) and P4 (Army) can run in      |
| parallel once P2 (Foundry) is done.                                   |
+-----------------------------------------------------------------------+

> **10. Scope Boundaries --- What Cosmos Does NOT Do (V1)**

  ------------------ ---------------------------------- ------------------
  **Module**         **Out of Scope in V1**             **Phase**

  POS                AI frame/lens suggestions (UX      Phase 2 (P7)
                     built, API wired in P7)            

  POS                Credit / Due payment collection    Phase 2

  Eyewoot Go         AI face-shape frame                Phase 2 (P7)
                     recommendations                    

  Eyewoot Go         Virtual try-on (AR)                Phase 3

  Promoter           Automated commission payout to     Phase 2
                     bank                               

  Army               Payroll generation / salary slips  Phase 2 (M6)

  Army               Shift scheduling and rosters       Phase 2 (M7)

  Foundry            Supplier self-service portal       Phase 2

  All                WhatsApp Business API automation   Phase 2

  All                Multi-currency / international     Future
                     stores                             
  ------------------ ---------------------------------- ------------------

+-----------------------------------------------------------------------+
| **🌌 COSMOS · Eyewoot Retail OS · Master PRD v1.0**                   |
|                                                                       |
| ⚙️ Command Unit · 🔩 Foundry · 🧾 POS · 🪖 Army · 📱 Eyewoot Go · 🤝  |
| Promoter                                                              |
|                                                                       |
| Project Lead: Talha Junani · Confidential --- Eyewoot Optical         |
| Internal Use Only                                                     |
+-----------------------------------------------------------------------+

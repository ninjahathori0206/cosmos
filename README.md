# Cosmos ERP

> **Enterprise Resource Planning system** for Eyewoot — covering the full optical product lifecycle from procurement to catalogue publishing.

---

## Modules

| Module | Description |
|---|---|
| **Command Unit** | Store management, user & role administration, system settings, audit logs, rate intelligence |
| **Foundry** | End-to-end procurement pipeline — Purchase Registration → Bill Verification → Branding → Digitisation → Warehouse Ready → SKU Catalogue |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 18+ |
| Web Framework | Express.js |
| Database | Microsoft SQL Server (MSSQL) |
| DB Access | Stored Procedures only — no inline SQL |
| Authentication | Two-layer: `X-API-Key` header + JWT Bearer token |
| Frontend | Vanilla HTML / CSS / JavaScript (no framework) |
| File Uploads | Multer (images up to 5 MB, videos up to 100 MB) |
| QR Generation | `qrcode` npm package (server-side PNG) |
| Validation | Joi |
| Logging | Winston |
| Deployment | Windows Server · IIS (reverse proxy) · PM2 (process manager) |

---

## Project Structure

```
cosmos/
├── app.js                          # Express app entry point
├── package.json
├── .env.example                    # Environment variable template
│
├── sql/
│   ├── create_database.sql         # Create CosmosERP database
│   ├── manifest.json               # Canonical order for sql/tables (run-sql.js)
│   ├── README.md                   # SQL deploy guide
│   ├── tables/                     # Table definitions (order = manifest.json)
│   │   ├── 01_shared_core.sql
│   │   ├── 02_command_unit.sql
│   │   ├── 03_foundry_core.sql
│   │   ├── 04_branding_agents.sql
│   │   └── 04_foundry_stock_rate.sql
│   ├── sp/                         # Stored procedures
│   │   ├── auth.sql
│   │   ├── stores.sql
│   │   ├── users.sql
│   │   ├── roles.sql
│   │   ├── suppliers.sql
│   │   ├── maker_master.sql
│   │   ├── pipeline_v2.sql         # Full Foundry procurement pipeline
│   │   ├── product_master.sql
│   │   ├── foundry_lookups.sql
│   │   ├── system_settings.sql
│   │   └── ...
│   ├── alter/                      # Early incremental DDL (numeric order)
│   ├── migrations/               # Ongoing release migrations
│   └── seed/                       # Seed data
│
├── docs/
│   ├── sku-generation.md           # sp_SKUv2_Generate, pid, unit barcodes
│   ├── qr-pid-sku-structure.md     # sku_code / pid / QR payload reference
│   └── database/
│       └── schema-overview.md      # How SQL is layered and deployed
│
├── src/
│   ├── api/                        # REST API route handlers
│   │   ├── auth.js
│   │   ├── stores.js
│   │   ├── users.js
│   │   ├── roles.js
│   │   ├── suppliers.js
│   │   ├── makerMaster.js
│   │   ├── purchases.js            # Full Foundry pipeline API
│   │   ├── products.js
│   │   ├── skus.js
│   │   ├── uploads.js
│   │   ├── qr.js                   # QR code image generator
│   │   ├── settings.js
│   │   ├── foundryLookups.js
│   │   └── ...
│   ├── config/
│   │   └── db.js                   # MSSQL connection pool
│   ├── middleware/
│   │   ├── apiKeyAuth.js           # Layer 1: API key check
│   │   ├── authJwt.js              # Layer 2: JWT verification
│   │   └── errorHandler.js         # Global error handler
│   └── public/
│       ├── js/
│       │   └── foundry-prototype.js
│       └── uploads/
│           └── products/           # Uploaded product images & videos
│
├── CommandUnit_Prototype.html      # Command Unit frontend
├── Foundry_Prototype.html          # Foundry frontend
└── scripts/                        # Utility scripts (DB setup, seed, etc.)
```

---

## Prerequisites

- **Node.js** v18 or higher
- **Microsoft SQL Server** (Express or full) with TCP/IP enabled
- **Windows Server** with IIS installed (for production)
- **PM2** (`npm install -g pm2`) for production process management

---

## Setup & Installation

### 1. Clone the repository

```bash
git clone https://github.com/ninjahathori0206/cosmos.git
cd cosmos
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
copy .env.example .env
```

Edit `.env` with your actual values:

```env
PORT=4000

DB_HOST=localhost
DB_PORT=1433
DB_NAME=CosmosERP
DB_USER=cosmos_app
DB_PASSWORD=your_db_password

JWT_SECRET=your_jwt_secret_32_chars_minimum
JWT_EXPIRES_IN=1d
API_KEY=your_api_key

ENCRYPTION_KEY=your_32_byte_encryption_key
```

### 4. Set up the database

Run these SQL scripts against your MSSQL instance **in order**:

```bash
# 1. Create the database
sqlcmd -S localhost -U sa -P password -i sql/create_database.sql

# 2. Create tables in the order listed in sql/manifest.json (or run the helper below)
npm run sql:tables

# 3. Deploy all stored procedures (sql/sp/)
# 4. Run sql/alter/*.sql in numeric filename order, then sql/migrations/* as needed
# 5. Configure roles, stores, users, and reference data in Command Unit / Foundry (sql/seed is disabled)
```

See `sql/README.md` and `docs/database/schema-overview.md` for layout and deploy order.

### 5. Start the server

**Development:**
```bash
npm run dev
```

**Production (PM2):**
```bash
pm2 start app.js --name cosmos-erp
pm2 save
pm2 startup
```

The server runs on **http://localhost:4000** by default.

### 6. Flush existing CosmosERP data (destructive)

Use this only when you want to wipe an existing database and start fresh on the same schema.

```bash
# 0. Take full backup first (mandatory)
# 1) Flush all rows from all user tables (keeps schema/SPs/constraints)
sqlcmd -S <host>,<port> -U <admin_user> -P <password> -d CosmosERP -i sql/maintenance/flush_all_data.sql

# 2) Configure lookups, store types, roles, and users in Command Unit / Foundry (no SQL auto-seed)
```

Then update `.env` for your actual SQL Server values and restart app/PM2:

```env
DB_HOST=<actual_server_or_ip>
DB_PORT=<actual_port>
DB_NAME=CosmosERP
DB_USER=<app_sql_user>
DB_PASSWORD=<app_sql_password>

JWT_SECRET=<strong_random_secret>
API_KEY=<strong_random_api_key>
ENCRYPTION_KEY=<32_byte_random_key>
```

Optional cleanup (recommended): clear orphan uploads after DB flush.

```powershell
Remove-Item -Path ".\src\public\uploads\products\*" -Force
```

`sql/maintenance/flush_all_data.sql` requires elevated SQL privileges (`sa` or migration admin). Do not run it with the limited app DB user.

---

## API Authentication

All API routes (except `/api/auth/login` and `/api/qr`) require **two headers**:

```http
X-API-Key: your_api_key
Authorization: Bearer <jwt_token>
```

**Login flow:**

```http
POST /api/auth/login
Content-Type: application/json
X-API-Key: your_api_key

{
  "username": "admin",
  "password": "Admin@123"
}
```

Returns a JWT token to use in subsequent requests.

### Authorization (RBAC)

After login, the JWT includes:

- **`modules`** — effective module flags from `sp_User_EffectiveModules` (lowercase keys, e.g. `foundry`, `command_unit`, `finance`, `storepilot`). An **empty** module object keeps legacy behaviour (all modules allowed for routing checks only when the map is empty).
- **`permissions`** — permission strings for the user’s role from `role_permissions` (lowercase). The role **`super_admin`** bypasses all permission and module checks on the API.

Protected routes combine **module access** and **permission** checks (see `src/middleware/authorize.js`). Examples:

| Action | Module | Permission |
|--------|--------|------------|
| List / view purchases | `foundry` | `foundry.purchases.view` |
| Create purchase | `foundry` | `foundry.purchases.create` |
| Finance reports / dashboard | `finance` | `finance.view` |
| Record payments | `finance` | `finance.manage` |

Assign permissions in **Command Unit → Roles** (matrix includes `finance.view` / `finance.manage`). For **`hq_manager`**, grant `foundry.purchases.view`, `foundry.suppliers.view`, `foundry.branding.manage`, `foundry.sku.generate`, and `foundry.warehouse.approve` in the Roles UI (SQL seeds are disabled). See `sql/maintenance/verify_hq_manager_foundry_access.sql` for diagnostics.

**Important:** Changing a role’s permissions in the database does not update existing JWTs until the user **logs in again**.

---

## Key API Endpoints

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/auth/me` | Get current user profile |

### Command Unit
| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/api/stores` | Store management |
| GET/POST/PUT | `/api/users` | User management |
| GET/POST/PUT | `/api/roles` | Role & permissions |
| GET/PUT | `/api/settings` | System settings |

### Foundry — Procurement Pipeline
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/purchases` | List all purchase headers |
| POST | `/api/purchases` | Create new purchase (header + items + colours) |
| GET | `/api/purchases/:id` | Get full purchase details |
| PUT | `/api/purchases/:id/verify-bill` | Stage 2: Verify bill |
| PUT | `/api/purchases/:id/branding-dispatch` | Stage 3: Dispatch for branding |
| PUT | `/api/purchases/:id/branding-receive` | Stage 3: Receive from branding |
| PUT | `/api/purchases/:id/colours/:colourId/media` | Upload colour image/video |
| PUT | `/api/purchases/:id/generate-sku` | Stage 4: Generate SKU |
| PUT | `/api/purchases/:id/warehouse-ready` | Stage 5: Mark warehouse ready |

### Catalogue
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/skus` | SKU catalogue with search & filters |
| GET | `/api/qr?data=VALUE&size=120` | Generate QR code PNG (public) |

### Masters
| Method | Endpoint | Description |
|---|---|---|
| GET/POST/PUT | `/api/suppliers` | Supplier management (auto-code) |
| GET/POST/PUT | `/api/maker-master` | Maker master |
| GET/POST/PUT | `/api/products` | Product master |
| GET | `/api/foundry-lookups` | All Foundry dropdown values |

---

## Foundry Procurement Pipeline

```
New Purchase
    │
    ▼
[Stage 1] Purchase Registration
    │  → Supplier, Bill details, Source type
    │  → Multiple products per bill (items + colour variants)
    │
    ▼
[Stage 2] Bill Verification
    │  → Enter supplier invoice, verify GST
    │
    ▼
[Stage 3] Branding
    │  → Dispatch to branding vendor
    │  → Receive back + dispatch confirmation PDF
    │
    ▼
[Stage 4] Digitisation
    │  → Add product specs (frame dimensions, material)
    │  → Upload per-colour photos & videos
    │  → Generate SKUs
    │
    ▼
[Stage 5] Warehouse Ready
    │  → Publish to stock
    │  → Print QR code labels (TSC P210 · TSPL2 · 6UP · 15mm×15mm)
    │
    ▼
SKU Catalogue (LIVE)
    → Model-wise grouped cards with colour swatches
```

---

## Production Deployment (IIS + PM2)

1. **Start app with PM2** (see above)
2. **IIS Reverse Proxy** — Add a URL Rewrite rule to forward traffic from port 80/443 to `http://localhost:4000`
3. **Install URL Rewrite & ARR** modules for IIS
4. Ensure `uploads/products/` folder has write permissions for the IIS app pool identity

---

## Environment Notes

- All dates stored and returned as SQL Server `DATETIME`; displayed in UI as `dd/MM/yyyy HH:mm:ss`
- Passwords are stored as bcrypt hashes (`bcryptjs`); legacy plaintext rows are auto-migrated on successful login and can be bulk-migrated with `npm run migrate:passwords`
- All database access through **stored procedures only** — no inline SQL in application code
- Data types: `INT`, `VARCHAR(200/500)`, `DATETIME`, `DECIMAL(10,2)` / `DECIMAL(5,2)` — no `BIGINT` or unbounded `VARCHAR(MAX)`

---

## License

UNLICENSED — Proprietary software for Eyewoot. All rights reserved.

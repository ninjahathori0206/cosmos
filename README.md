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
│   ├── tables/                     # Table definitions (run in order)
│   │   ├── 01_shared_core.sql
│   │   ├── 02_command_unit.sql
│   │   ├── 03_foundry_core.sql
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
│   ├── alter/                      # Incremental schema migrations (01–11)
│   └── seed/                       # Seed data
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

# 2. Create tables (run in numbered order)
sqlcmd -S localhost -U sa -P password -d CosmosERP -i sql/tables/01_shared_core.sql
sqlcmd -S localhost -U sa -P password -d CosmosERP -i sql/tables/02_command_unit.sql
sqlcmd -S localhost -U sa -P password -d CosmosERP -i sql/tables/03_foundry_core.sql
sqlcmd -S localhost -U sa -P password -d CosmosERP -i sql/tables/04_foundry_stock_rate.sql

# 3. Deploy all stored procedures (sp/ folder)
# 4. Run alter scripts in order (alter/01_ through alter/11_)
# 5. Seed initial data
sqlcmd -S localhost -U sa -P password -d CosmosERP -i sql/seed/01_seed_core.sql
```

Or use the helper script:

```bash
node scripts/run-sql.js
```

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
- Passwords stored as plain `VARCHAR` (system requirement — no bcrypt)
- All database access through **stored procedures only** — no inline SQL in application code
- Data types: `INT`, `VARCHAR(200/500)`, `DATETIME`, `DECIMAL(10,2)` / `DECIMAL(5,2)` — no `BIGINT` or unbounded `VARCHAR(MAX)`

---

## License

UNLICENSED — Proprietary software for Eyewoot. All rights reserved.

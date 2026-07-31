# Friends Enterprise ERP v3 — Final Master Blueprint & Production Specification
**Single Source of Truth (SSOT) for FMCG Distribution ERP**
**FROZEN REVISION: v3.0.0 (FINAL ARCHITECTURE FREEZE)**

---

## 1. System Overview

### 1.1 Enterprise Context & FMCG Distribution Model
Friends Enterprise ERP v3 is a highly specialized, production-grade, offline-first FMCG (Fast-Moving Consumer Goods) Distribution Enterprise Resource Planning system. Designed specifically for localized FMCG distributors, this platform handles high-volume inventory, route-wise sales operations, dual-currency ledger accounting, brand targets, company damage/expiry claims, and multi-profile parent business operations.

FMCG distribution is characterized by low gross margins, high velocity, strict product expiry dates, and frequent salesman cash settlements. Distributors operate in regions with intermittent or non-existent internet connectivity. Therefore, a server-only or online-dependent system leads to catastrophic operational delays. Friends Enterprise ERP v3 implements a pure offline-first architecture that runs entirely client-side, using the client browser's sandboxed storage to guarantee 100% operational uptime.

### 1.2 Core Architectural Objectives
*   **Absolute Offline-First Reliability:** Zero internet dependency for daily billing, delivery sheet generation, cash collection, and ledger postings.
*   **Dual-Entry Relational Ledger Integrity:** Every transaction (sale, purchase, expense, return, payment) must post balanced debit and credit entries to standardized ledgers, ensuring the accounting balance equation ($Assets = Liabilities + Equity$) is always true.
*   **Perfect FIFO Costing & Batch Tracking:** Trace stock levels, Distributor Prices (DP), Effective Purchase Prices (EDP), and Selling Prices (MRP) chronologically at the batch level to prevent expired product sales and ensure accurate net profit reporting.
*   **Surgical Input Validation:** Block invalid operations (e.g., selling beyond available stock, exceeding customer credit limits, missing batch associations) before they write to database stores.
*   **High Performance at Scale:** Optimize database queries and indexes to handle millions of transaction records on consumer-grade laptops or mobile devices.

---

## 2. Overall System Architecture & Clean Architecture Layers

The system follows **Clean Architecture** principles to isolate business rules from frameworks, UI, and external data storage systems. This maintains strict modular boundaries and complies with SOLID design principles.

### 2.1 Clean Architecture Layers

```
┌────────────────────────────────────────────────────────┐
│                   PRESENTATION LAYER                   │
│        (React Components, Tailwind CSS, UI Shell)       │
├────────────────────────────────────────────────────────┤
│                    APPLICATION LAYER                   │
│    (Use Cases, Central Router, Print Layout Builders)  │
├────────────────────────────────────────────────────────┤
│                      DOMAIN LAYER                      │
│ (Services: TransactionEngine, FIFOEngine, Validation)  │
├────────────────────────────────────────────────────────┤
│                  INFRASTRUCTURE LAYER                  │
│       (Dexie.js, IndexedDB, File System, Print Iframe) │
└────────────────────────────────────────────────────────┘
```

1.  **Domain Layer (Enterprise Business Rules):** Contains the core business entities, types, and logic. This layer defines how double-entry ledger postings work, how FIFO costing is calculated, and what constitutes a valid transaction. It is completely independent of external databases, UI frameworks, or services.
2.  **Application Layer (Application Business Rules):** Orchestrates the flow of data to and from the domain entities. This includes services like the `TransactionEngine` which coordinate the atomic updates across multiple database tables.
3.  **Presentation Layer (UI/UX Component Tree):** Formulated using React functional components, hooks, and styled exclusively with Tailwind CSS. This layer depends only on application interfaces and services. It never writes directly to the database.
4.  **Infrastructure Layer (Persistence & Device I/O):** Handles the physical saving of data to Dexie.js (IndexedDB), coordinates printing via hidden background browser iframes, and runs backup/restore export pipelines.

### 2.2 Master Project Folder Structure

To preserve modularity and ensure clean boundaries, the codebase is structured as follows:

```
/
├── public/                     # Static assets (logos, fallback fonts, localized assets)
├── src/
│   ├── components/             # Reusable Presentation Components
│   │   ├── ui/                 # Atomic design components (Buttons, Inputs, Dialogs)
│   │   └── printable/          # Raw HTML printable layouts (Invoices, Demand Sheets, Ledgers)
│   ├── db/                     # Infrastructure Database Configuration
│   │   ├── db.ts               # Dexie.js database class instance and store definitions
│   │   └── schema.ts           # Extended Dexie/IndexedDB schema properties
│   ├── modules/                # Domain-Specific Presentation Modules
│   │   ├── dashboard/          # BI Widgets, analytical charts, KPIs, scorecards
│   │   ├── business-profile/   # Multi-profile configurations (Trade licenses, BINs, addresses)
│   │   ├── company/            # Company Profiles, company ledgers, claims, damage records
│   │   ├── product/            # Products, Brand/Category hierarchy, Batch managers
│   │   ├── route-sales/        # Routes, Customers, Salesmen, Multi-customer Invoice billing
│   │   ├── purchases/          # Purchase flow, Batch creation, manual EDP entry forms
│   │   ├── returns/            # Return management (Sales, Purchase, Damage, Expiry, Replacement)
│   │   ├── demand-sheet/       # Multi-profile demand sheet builder
│   │   ├── dsr/                # Daily Sales Reports, visit checklists, collections, cash books
│   │   ├── target/             # Salesman, Brand, and Product Target definitions & tracking
│   │   ├── hawlat/             # Hawlat tracking (Cash, Products, Mixed Settlements)
│   │   ├── cash-book/          # Cash Flow ledgers, balances, expense categories
│   │   └── reports/            # Centralized query, filtering, and export panels
│   ├── services/               # Decoupled Core Domain Services
│   │   ├── TransactionEngine.ts# Parent-journalled atomic transaction orchestrator
│   │   ├── FIFOEngine.ts       # Batch allocation and chronological costing services
│   │   ├── DashboardService.ts # Pre-aggregated analytical reads and snapshot handlers
│   │   ├── ValidationService.ts# Decoupled input, business, and transaction validation rules
│   │   ├── ErrorService.ts      # Central Bengali error and rollback handler
│   │   ├── PrintEngine.ts      # Hidden background iframe rendering and layout printer
│   │   └── TranslationEngine.ts# Bengali translation dictionary and hooks
│   ├── types.ts                # Unified type declarations, enums, and schema interfaces
│   ├── App.tsx                 # Base App shell, Navigation drawer, Module routes
│   ├── index.css               # Tailwind CSS imports and custom design tokens
│   └── main.tsx                # React entry point
├── .env.example                # Unpopulated template environment configuration
├── index.html                  # Main HTML template
├── metadata.json               # App credentials, frame permissions, system capabilities
├── package.json                # NPM configuration, dependencies, and build scripts
└── tsconfig.json               # Strict TypeScript configuration parameters
```

---

## 3. Database Schema Blueprint & Relational Design

The database schema is built using **IndexedDB** as the physical layer and **Dexie.js** as the object-relational mapper (ORM). Although IndexedDB is inherently non-relational, the schema is designed to enforce relational consistency, tracking records through explicit Foreign Key mappings and compound indexing.

### 3.1 Base Entity Models (Universal Audit & Sync Metadata)

To guarantee auditability, history tracking, data safety, and seamless future cloud synchronization, every table schema in Friends Enterprise ERP v3 must inherit the `BaseEntity` fields. No raw rows can exist without these fields.

```typescript
export interface BaseEntity {
  id: string;                // Universally Unique Lexicographically Sortable Identifier (ULID)
  
  // Universal Audit System
  createdAt: string;         // ISO8601 UTC Timestamp (e.g. "2026-07-20T04:16:50Z")
  updatedAt: string;         // ISO8601 UTC Timestamp
  createdBy: string;         // User ID or active Role string originating the write
  updatedBy: string;         // User ID or active Role string modifying the write
  isDeleted: boolean;        // Soft-delete toggle (Always filter active queries by isDeleted === false)
  deletedAt: string | null;  // ISO8601 UTC Timestamp or null
  version: number;           // Record versioning for optimistic locking & conflict detection
  
  // Synchronization Metadata (Future Cloud Ready)
  syncStatus: 'synced' | 'pending' | 'failed';
  deviceId: string;          // Identifier of the physical terminal/device creating the record
  lastModified: string;      // ISO8601 UTC Timestamp for server-side reconciliation
  syncVersion: number;       // Tracks server synchronization increments
  conflictVersion: number;   // Incremented on local conflict resolution events
}
```

### 3.2 Precise Database Store Definitions & Indices

The following definitions detail the exact field names, types, relationships, and secondary indexing patterns required for each store.

#### 1. `configurations`
Contains key-value style configuration structures to prevent hardcoding of tax values, stock flags, or validation rules.
*   **Indexes:** `id`
*   **Fields:**
    *   `id`: `string` (PK)
    *   `defaultVat`: `number` (Percentage, e.g. `15.00`)
    *   `defaultDiscount`: `number` (Percentage, e.g. `0.00`)
    *   `defaultCommission`: `number` (Percentage, e.g. `5.00`)
    *   `currency`: `string` (e.g. `"BDT"`)
    *   `invoicePrefix`: `string` (e.g. `"INV-"`)
    *   `purchasePrefix`: `string` (e.g. `"PUR-"`)
    *   `salesPrefix`: `string` (e.g. `"SLS-"`)
    *   `demandSheetPrefix`: `string` (e.g. `"DMD-"`)
    *   `decimalPrecision`: `number` (e.g. `2`)
    *   `lowStockLevel`: `number` (Default threshold units, e.g. `50`)
    *   `expiryAlertDays`: `number` (Default days before expiry warning, e.g. `60`)
    *   `creditLimitRules`: `string` (JSON-string containing credit check policies)
    *   `riskLevelRules`: `string` (JSON-string mapping outstanding amounts to risks)
    *   `BaseEntity` fields.

#### 2. `businessProfiles`
Handles multiple business entity profiles, enabling a single distributor to operate separate entities with distinct tax registrations, trade licenses, and billing names.
*   **Indexes:** `id`, `isDefault`
*   **Fields:**
    *   `id`: `string` (PK)
    *   `businessName`: `string` (e.g. `"Friends Enterprise"`)
    *   `ownerName`: `string`
    *   `tradeLicense`: `string`
    *   `bin`: `string` (Business Identification Number)
    *   `address`: `string`
    *   `phone`: `string`
    *   `logoUrl`: `string`
    *   `isDefault`: `boolean`
    *   `BaseEntity` fields.

#### 3. `companies`
Represents primary FMCG manufacturers/suppliers supplying stock to the distributor.
*   **Indexes:** `id`, `name`, `syncStatus`
*   **Fields:**
    *   `id`: `string` (PK)
    *   `name`: `string` (e.g. `"Square Toiletries Ltd."`)
    *   `phone`: `string`
    *   `address`: `string`
    *   `outstandingBalance`: `number` (Derived or tracked liability balance)
    *   `BaseEntity` fields.

#### 4. `brands`
Categorizes products by manufacturer brand names to calculate brand-wise salesman commission and targets.
*   **Indexes:** `id`, `companyId`, `name`
*   **Fields:**
    *   `id`: `string` (PK)
    *   `companyId`: `string` (FK -> `companies.id`)
    *   `name`: `string` (e.g. `"Meril"`)
    *   `BaseEntity` fields.

#### 5. `categories`
Organizes items into logical groups for inventory filtering and tax calculations.
*   **Indexes:** `id`, `name`
*   **Fields:**
    *   `id`: `string` (PK)
    *   `name`: `string` (e.g. `"Soap"`, `"Shampoo"`)
    *   `BaseEntity` fields.

#### 6. `products`
The central catalog registry. All items sold must map to this directory.
*   **Indexes:** `id`, `sku`, `companyId`, `brandId`, `categoryId`, `[companyId+brandId]`, `syncStatus`
*   **Fields:**
    *   `id`: `string` (PK)
    *   `sku`: `string` (Unique SKU code, e.g. `"SQ-MER-100G"`)
    *   `name`: `string` (e.g. `"Meril Protective Soap 100g"`)
    *   `companyId`: `string` (FK -> `companies.id`)
    *   `brandId`: `string` (FK -> `brands.id`)
    *   `categoryId`: `string` (FK -> `categories.id`)
    *   `unit`: `string` (e.g. `"Pcs"`, `"Box"`, `"Carton"`)
    *   `cartonSize`: `number` (Units per carton, e.g. `144`)
    *   `reorderLevel`: `number` (Product-specific stock warning limit, units)
    *   `isBatchEnabled`: `boolean`
    *   `isExpiryEnabled`: `boolean`
    *   `BaseEntity` fields.

#### 7. `productBatches`
Tracks inventory items grouped by unique production batch codes, expiry dates, and actual cost properties. This is the single source of truth for all inventory valuations.
*   **Indexes:** `id`, `batchNo`, `productId`, `companyId`, `purchaseInvoiceId`, `expiryDate`, `batchStatus`, `[productId+batchStatus]`, `[companyId+batchStatus]`, `syncStatus`
*   **Fields:**
    *   `id`: `string` (PK)
    *   `batchNo`: `string` (e.g. `"B-MER-092"`)
    *   `productId`: `string` (FK -> `products.id`)
    *   `companyId`: `string` (FK -> `companies.id`)
    *   `purchaseInvoiceId`: `string` (FK -> `purchases.id`)
    *   `expiryDate`: `string` (ISO8601 Date `"YYYY-MM-DD"`)
    *   `batchStatus`: `string` (Enum: `'Active' | 'Expired' | 'Damaged' | 'Returned' | 'Blocked' | 'Finished'`)
    *   // Stock Metrics (Quantities tracked in lowest base unit, e.g. individual Pcs)
    *   `availableStock`: `number` (Stock currently sellable)
    *   `reservedStock`: `number` (Stock locked in active pick-lists or demand sheets)
    *   `soldStock`: `number` (Stock committed to delivered invoices)
    *   `damagedStock`: `number` (Stock separated as damaged)
    *   `expiredStock`: `number` (Stock separated as expired)
    *   `returnedStock`: `number` (Returned stock pending inspection)
    *   `physicalStock`: `number` (Calculated: `availableStock + reservedStock + returnedStock`)
    *   `currentStock`: `number` (Calculated sum of all states)
    *   // Cost Matrices (Locked historical prices at purchase time)
    *   `dp`: `number` (Distributor Price per base unit)
    *   `edp`: `number` (Effective Purchase Price per base unit, after supplier discounts/schemes)
    *   `sellingPrice`: `number` (MRP per base unit)
    *   `commission`: `number` (Base salesman commission per unit, e.g. `0.50` BDT)
    *   `margin`: `number` (Distributor margin per unit, calculated: `sellingPrice - edp`)
    *   `purchaseDiscount`: `number` (Discount value per unit)
    *   `companyScheme`: `string` (Associated promotion/scheme name or ID)
    *   `freeQuantity`: `number` (Free base units received under manufacturer schemes)
    *   `BaseEntity` fields.

#### 8. `routes`
Geographical routes mapped to salesman and delivery vehicles for structured distribution.
*   **Indexes:** `id`, `routeName`, `salespersonId`, `deliveryManId`
*   **Fields:**
    *   `id`: `string` (PK)
    *   `routeName`: `string` (e.g. `"Dhaka Sadar Route A"`)
    *   `market`: `string`
    *   `area`: `string`
    *   `territory`: `string`
    *   `salespersonId`: `string` (FK -> `salesmen.id`)
    *   `deliveryManId`: `string` (FK -> `deliveryMen.id`)
    *   `isActive`: `boolean`
    *   `BaseEntity` fields.

#### 9. `customers`
Retail outlets and shops that purchase FMCG products.
*   **Indexes:** `id`, `shopName`, `routeId`, `riskLevel`, `outstandingBalance`, `syncStatus`
*   **Fields:**
    *   `id`: `string` (PK)
    *   `shopName`: `string` (e.g. `"Mayer Doa General Store"`)
    *   `ownerName`: `string`
    *   `mobile`: `string`
    *   `address`: `string`
    *   `routeId`: `string` (FK -> `routes.id`)
    *   `creditLimit`: `number` (In BDT, blocks sales beyond limit)
    *   `outstandingBalance`: `number` (Running sum of debts minus credits)
    *   `riskLevel`: `string` (Enum: `'Low' | 'Medium' | 'High'`)
    *   `BaseEntity` fields.

#### 10. `salesmen` & `deliveryMen`
Operational human resource entities.
*   **Indexes:** `id`, `name`, `designation`, `isActive`
*   **Fields:**
    *   `id`: `string` (PK)
    *   `name`: `string` (e.g. `"Abdur Rahman"`)
    *   `phone`: `string`
    *   `designation`: `string` (e.g. `"Sales Officer"`, `"Delivery Executive"`)
    *   `isActive`: `boolean`
    *   `BaseEntity` fields.

#### 11. `transactionJournal` (Universal Parent Transaction Registry)
The single write gateway for all operational events. Every mutation must write a parent transaction journal row to secure structural consistency across ledger sub-tables.
*   **Indexes:** `id`, `transactionDate`, `transactionType`, `referenceNo`, `status`, `syncStatus`
*   **Fields:**
    *   `id`: `string` (PK - ULID format for chronological sorting)
    *   `transactionDate`: `string` (ISO8601 Timestamp `"YYYY-MM-DDTHH:mm:ssZ"`)
    *   `transactionType`: `string` (Enum: `'Purchase' | 'Sales_Invoice' | 'Customer_Payment' | 'Company_Payment' | 'Return' | 'Expense' | 'Hawlat' | 'Adjustment'`)
    *   `referenceNo`: `string` (Invoice No, Bill No, Voucher No, or Receipt No)
    *   `totalDebit`: `number` (Aggregated debit of child postings)
    *   `totalCredit`: `number` (Aggregated credit of child postings, must equal `totalDebit`)
    *   `status`: `string` (Enum: `'Draft' | 'Posted' | 'Reversed'`)
    *   `reversedTransactionId`: `string | null` (Pointer to reversing ULID if transaction was cancelled)
    *   `BaseEntity` fields.

#### 12. Standardized Ledger Stores
To ensure consistent structures for accounting audits, the following stores use the **exact same ledger schema**:
*   `customerLedgers`
*   `companyLedgers`
*   `stockLedgers`
*   `cashBook`
*   `routeLedgers`
*   `commissionLedgers`
*   `expenseLedgers`
*   `profitLedgers`
*   `hawlatLedgers`

*   **Indexes:** `id`, `transactionId`, `referenceId`, `referenceType`, `createdAt`, `syncStatus`
*   **Ledger Schema Fields:**
    *   `id`: `string` (PK - ULID)
    *   `transactionId`: `string` (FK -> `transactionJournal.id`)
    *   `referenceType`: `string` (Enum: `'Invoice' | 'Payment' | 'Purchase' | 'Return' | 'Expense' | 'Hawlat_Issue' | 'Hawlat_Receive' | 'Adjustment'`)
    *   `referenceId`: `string` (FK to originating record, e.g., `sales.id`, `purchases.id`, `hawlats.id`)
    *   `debit`: `number` (Asset increase / Liability decrease)
    *   `credit`: `number` (Asset decrease / Liability increase)
    *   `balanceAfter`: `number` (Running balance of this specific account ledger immediately following this post)
    *   `remarks`: `string` (Operational note)
    *   `BaseEntity` fields.

#### 13. `sales` & `salesItems`
Stores finalized customer sales details.
*   **Indexes (Sales):** `id`, `invoiceNo`, `routeId`, `salesmanId`, `deliveryDate`, `status`, `syncStatus`
*   **Fields (Sales):**
    *   `id`: `string` (PK)
    *   `invoiceNo`: `string` (e.g. `"INV-2026-00001"`)
    *   `routeId`: `string` (FK -> `routes.id`)
    *   `deliveryDate`: `string` (ISO8601 `"YYYY-MM-DD"`)
    *   `salesmanId`: `string` (FK -> `salesmen.id`)
    *   `deliveryManId`: `string` (FK -> `deliveryMen.id`)
    *   `paymentMethod`: `string` (Enum: `'Cash' | 'Due' | 'Bank' | 'Mobile_Banking' | 'Cheque' | 'Advance' | 'Partial' | 'Mixed' | 'Settlement'`)
    *   `paymentDetails`: `string` (JSON payload tracking split payment, e.g., `{ cash: 500, bank: 300, bankTrxId: "BK102" }`)
    *   `totalAmount`: `number`
    *   `cashPaid`: `number`
    *   `dueAmount`: `number`
    *   `status`: `string` (Enum: `'Pending_Delivery' | 'Delivered' | 'Returned' | 'Cancelled'`)
    *   `BaseEntity` fields.
*   **Indexes (SalesItems):** `id`, `salesId`, `customerId`, `productId`, `batchId`, `syncStatus`
*   **Fields (SalesItems):**
    *   `id`: `string` (PK)
    *   `salesId`: `string` (FK -> `sales.id`)
    *   `customerId`: `string` (FK -> `customers.id`)
    *   `productId`: `string` (FK -> `products.id`)
    *   `batchId`: `string` (FK -> `productBatches.id`)
    *   `quantity`: `number` (Base units)
    *   `rate`: `number` (MRP selling price)
    *   `dp`: `number` (Historical DP at sales time)
    *   `edp`: `number` (Historical batch cost used for margin calculation)
    *   `fixedCommission`: `number`
    *   `percentageCommission`: `number`
    *   `commissionAmount`: `number` (Salesman commission deduction)
    *   `itemTotal`: `number`
    *   `netProfit`: `number` (Calculated per line-item: `itemTotal - commissionAmount - (quantity * edp)`)
    *   `BaseEntity` fields.

#### 14. `purchases` & `purchaseItems`
Stores inventory stock intake records.
*   **Indexes (Purchases):** `id`, `purchaseNo`, `companyId`, `date`, `syncStatus`
*   **Fields (Purchases):**
    *   `id`: `string` (PK)
    *   `purchaseNo`: `string`
    *   `companyId`: `string` (FK -> `companies.id`)
    *   `date`: `string`
    *   `supplierInvoiceNo`: `string`
    *   `totalDpValue`: `number`
    *   `totalEdpValue`: `number`
    *   `totalSellingValue`: `number`
    *   `cashPaid`: `number`
    *   `paymentDetails`: `string` (JSON tracking payment details)
    *   `BaseEntity` fields.
*   **Indexes (PurchaseItems):** `id`, `purchaseId`, `productId`
*   **Fields (PurchaseItems):**
    *   `id`: `string` (PK)
    *   `purchaseId`: `string` (FK -> `purchases.id`)
    *   `productId`: `string` (FK -> `products.id`)
    *   `batchNo`: `string`
    *   `expiryDate`: `string`
    *   `quantity`: `number` (In base units)
    *   `dp`: `number`
    *   `edp`: `number`
    *   `sellingPrice`: `number`
    *   `subTotal`: `number`
    *   `BaseEntity` fields.

#### 15. `returns` & `returnItems`
Central return processing ledger. Supports all return flows within a single database structure.
*   **Indexes (Returns):** `id`, `returnNo`, `transactionId`, `returnType`, `customerId`, `companyId`, `date`, `syncStatus`
*   **Fields (Returns):**
    *   `id`: `string` (PK)
    *   `returnNo`: `string`
    *   `transactionId`: `string` (FK -> `transactionJournal.id`)
    *   `returnType`: `string` (Enum: `'Purchase_Return' | 'Sales_Return' | 'Damage_Return' | 'Expiry_Return' | 'Replacement'`)
    *   `customerId`: `string | null` (FK -> `customers.id`, optional)
    *   `companyId`: `string | null` (FK -> `companies.id`, optional)
    *   `date`: `string` (ISO8601 Date)
    *   `totalRefundAmount`: `number`
    *   `paymentMethod`: `string`
    *   `BaseEntity` fields.
*   **Indexes (ReturnItems):** `id`, `returnId`, `productId`, `batchId`
*   **Fields (ReturnItems):**
    *   `id`: `string` (PK)
    *   `returnId`: `string` (FK -> `returns.id`)
    *   `productId`: `string` (FK -> `products.id`)
    *   `batchId`: `string` (FK -> `productBatches.id`)
    *   `quantity`: `number`
    *   `unitPrice`: `number`
    *   `cogsValue`: `number` (Reference batch EDP)
    *   `returnReason`: `string`
    *   `BaseEntity` fields.

#### 16. `hawlats`
Tracks hawlat balances. A hawlat can consist of advanced cash borrows or product loans, settled in either equivalent products or cash.
*   **Indexes:** `id`, `name`, `syncStatus`
*   **Fields:**
    *   `id`: `string` (PK)
    *   `name`: `string`
    *   `phone`: `string`
    *   `cashBalance`: `number` (Running cash due from this person)
    *   `productBalances`: `string` (JSON Map tracking quantities per product: `Record<productId, quantity>`)
    *   `BaseEntity` fields.

#### 17. `expenses`
Operational cost ledger records.
*   **Indexes:** `id`, `date`, `category`, `routeId`
*   **Fields:**
    *   `id`: `string` (PK)
    *   `date`: `string`
    *   `category`: `string` (Enum: `'Fuel' | 'Driver' | 'Loading' | 'Ferry' | 'Parking' | 'Food' | 'Office_Utilities' | 'Others'`)
    *   `routeId`: `string | null` (FK -> `routes.id`, optional)
    *   `amount`: `number`
    *   `remarks`: `string`
    *   `BaseEntity` fields.

#### 18. `companyTargets`
Configures sales targets per company, brand, product, route, or salesman, for performance evaluations.
*   **Indexes:** `id`, `month`, `targetType`, `refId`
*   **Fields:**
    *   `id`: `string` (PK)
    *   `month`: `string` (Format: `"YYYY-MM"`)
    *   `targetType`: `string` (Enum: `'Company' | 'Brand' | 'Product' | 'Route' | 'Salesman'`)
    *   `refId`: `string` (Generic foreign key pointing to the target category, e.g. `companies.id` or `salesmen.id`)
    *   `targetValue`: `number` (In BDT or unit counts, depending on configuration)
    *   `BaseEntity` fields.

#### 19. `demandSheets`
Pre-sales picking orders grouping route orders to generate single stock requests from parent companies.
*   **Indexes:** `id`, `demandNo`, `date`, `companyId`
*   **Fields:**
    *   `id`: `string` (PK)
    *   `demandNo`: `string`
    *   `date`: `string`
    *   `businessProfileId`: `string` (FK -> `businessProfiles.id`)
    *   `companyId`: `string` (FK -> `companies.id`)
    *   `items`: `string` (JSON Map recording quantities: `Record<productId, { qtyInCartons: number, qtyInPcs: number, totalPcs: number }>`)
    *   `netOutstanding`: `number`
    *   `orderTotal`: `number`
    *   `BaseEntity` fields.

#### 20. `_DailyKPIs`
Pre-aggregated materialized views. No raw logs are parsed to render the dashboard; the client reads this single row matching the current date.
*   **Indexes:** `date`
*   **Fields:**
    *   `date`: `string` (PK - Format: `"YYYY-MM-DD"`)
    *   `totalSales`: `number`
    *   `totalCollections`: `number`
    *   `totalPurchases`: `number`
    *   `totalExpenses`: `number`
    *   `totalDues`: `number`
    *   `netProfit`: `number`
    *   `lowStockCount`: `number`
    *   `expiryCount`: `number`

---

## 4. Ledger Engine & Transaction Engine Architecture

To guarantee absolute transactional consistency, the system enforces a strict accounting journal boundary.

### 4.1 Parent Journaling Design Pattern
No service or presentation screen may write directly to standard sub-tables or ledgers. All mutations must execute via the unified `TransactionEngine`.
The `TransactionEngine` wraps the entire operation in a single **Dexie Read/Write Transaction**. If any child operation fails (e.g., due to stock depletion, database lock, or write failure), Dexie aborts the entire transaction, and all modifications roll back.

```typescript
// TransactionEngine.ts Pseudocode Interface
export interface TransactionRequest {
  type: 'Purchase' | 'Sales_Invoice' | 'Customer_Payment' | 'Company_Payment' | 'Return' | 'Expense' | 'Hawlat' | 'Adjustment';
  referenceNo: string;
  date: string;
  operations: (tx: any) => Promise<void>;
}
```

```
                        Unified Transaction Request
                                     │
                                     ▼
                      [ ValidationService Checks ]
                 Assert Stock, Credit Limits, Batch States
                                     │
                                     ▼
                        [ Open Dexie.Transaction ]
                        Read/Write lock on stores
                                     │
                                     ▼
                1. Write Parent Row to [ transactionJournal ]
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           ▼                         ▼                         ▼
  2. Write Child Entry      3. FIFO Stock Adjustment  4. Post Balanced Ledgers
  (Sales, Purchase, etc.)     (Decrement Batch Units)   (Standardized Debits/Credits)
           │                         │                         │
           └─────────────────────────┼─────────────────────────┘
                                     │
                                     ▼
                     [ Incremental KPI Snapshots ]
                     Update '_DailyKPIs' row
                                     │
                    ┌────────────────┴────────────────┐
                    ▼                                 ▼
               [ Success ]                        [ Failure ]
           Commit Transaction &                Abort Transaction,
          Refresh Local UI States              Automatic Rollback,
                                             Log in '_FailedTransactions',
                                            Return Bengali error via ErrorService
```

### 4.2 Decoupled Standard Ledger Posting Mappings

Every business operation writes balanced debits and credits across standardized ledger stores, ensuring perfect dual-entry accounting tracking.

| Operational Event | Ledger Store Affected | Posting Entry | Transaction Balance Calculation |
| :--- | :--- | :--- | :--- |
| **Procure Stock** | `companyLedgers` <br>`stockLedgers` | Credit (Increase liability) <br>Debit (Increase asset) | $StockDebit (EDP) = CompanyCredit (Liability)$ |
| **Procure Paid Cash** | `companyLedgers` <br>`cashBook` | Debit (Decrease liability) <br>Credit (Decrease asset) | $CompanyDebit = CashCredit$ |
| **Sell Goods (Due)** | `customerLedgers` <br>`stockLedgers` <br>`profitLedgers` <br>`commissionLedgers` | Debit (Increase outstanding) <br>Credit (Decrease stock asset) <br>Credit (Increase equity profit) <br>Debit (Increase commission liability) | $CustomerDebit (MRP) = StockCredit (EDP) + ProfitCredit + CommissionDebit$ |
| **Sell Goods (Cash)** | `cashBook` <br>`stockLedgers` <br>`profitLedgers` <br>`commissionLedgers` | Debit (Increase asset) <br>Credit (Decrease stock asset) <br>Credit (Increase equity profit) <br>Debit (Increase commission liability) | $CashDebit (MRP) = StockCredit (EDP) + ProfitCredit + CommissionDebit$ |
| **Sales Collection** | `cashBook` <br>`customerLedgers` | Debit (Increase asset) <br>Credit (Decrease outstanding) | $CashDebit = CustomerCredit$ |
| **Deduct Expense** | `expenseLedgers` <br>`cashBook` | Debit (Increase operational expense) <br>Credit (Decrease asset) | $ExpenseDebit = CashCredit$ |
| **Sales Return (Good)**| `stockLedgers` <br>`customerLedgers` <br>`profitLedgers` <br>`commissionLedgers` | Debit (Increase stock asset) <br>Credit (Decrease outstanding) <br>Debit (Decrease equity profit) <br>Credit (Decrease commission liability) | $StockDebit (EDP) + ProfitDebit + CommissionCredit = CustomerCredit (MRP)$ |
| **Sales Return (Damage)**| `stockLedgers` (Returned/Damaged)<br>`customerLedgers` <br>`profitLedgers` <br>`commissionLedgers` | Debit (Increase stock asset) <br>Credit (Decrease outstanding) <br>Debit (Decrease equity profit) <br>Credit (Decrease commission liability) | $StockDebit (EDP) + ProfitDebit + CommissionCredit = CustomerCredit (MRP)$ |
| **Hawlat Cash Borrow** | `cashBook` <br>`hawlatLedgers` | Debit (Increase cash asset) <br>Credit (Increase liability) | $CashDebit = HawlatCredit (Liability)$ |
| **Hawlat Cash Refund** | `hawlatLedgers` <br>`cashBook` | Debit (Decrease liability) <br>Credit (Decrease cash asset) | $HawlatDebit = CashCredit$ |
| **Hawlat Product Loan**| `stockLedgers` <br>`hawlatLedgers` | Credit (Decrease stock asset) <br>Debit (Increase product loan receivable) | $HawlatDebit = StockCredit$ |

### 4.3 FIFO Inventory Costing & Batch Selection (`FIFOEngine.ts`)

Average costing fails to reflect accurate profitability due to raw price changes, supplier promotional discounts, and batch-wise cash schemes. The system enforces strict FIFO (First-In, First-Out) costing.

1.  **chronological Sourcing:** When a product `P` is sold with quantity `Q`, the `FIFOEngine` queries active batches of `P` from the `productBatches` store, filtering by `availableStock > 0` and `batchStatus === 'Active'`, sorting ascending by `expiryDate` (or `createdAt` if expiry is disabled).
2.  **Slicing Multi-Batch Allocations:** If the requested quantity `Q` is greater than the available stock in the oldest batch $B_1$, the engine:
    *   Allocates all available units of $B_1$ (e.g. $q_1 = B_1.availableStock$).
    *   Deducts $q_1$ from $B_1.availableStock$ (setting it to 0), and updates its status to `'Finished'`.
    *   Creates a `salesItems` entry mapped to $B_1.id$ using its exact historical cost ($B_1.edp$).
    *   Moves to the next chronological batch $B_2$ to allocate the remaining balance $q_2 = Q - q_1$.
    *   Continues this loop until the total order quantity `Q` is fully satisfied.
3.  **Strict Transaction Lock:** These batch inventory updates occur inside the atomic transaction boundary. If the aggregate available stock across all active batches of product `P` is less than `Q`, the transaction is aborted, and an error is returned.

---

## 5. Decoupled Service Layer Architecture

To prevent code duplication, UI components are decoupled from operational logic. Business rules are housed within isolated, framework-agnostic TypeScript services.

### 5.1 Decoupled Validation Service (`ValidationService.ts`)
Validates structural operations before any database write is attempted.
*   `validateStock(productId, quantity)`: Asserts that total available stock across active batches of `productId` is sufficient.
*   `validateBatch(batchId, quantity)`: Asserts that the specific batch is active, has not expired, and contains sufficient available stock.
*   `validateCreditLimit(customerId, transactionAmount)`: Checks if the customer's outstanding debt plus the proposed invoice total exceeds their maximum allowed `creditLimit`.
*   `validatePaymentDetails(paymentMethod, details)`: Asserts mobile banking transaction IDs are specified, verifies cheque clearance dates, or validates split currency cash counts.

### 5.2 Error & Rollback Service (`ErrorService.ts`)
Converts complex database or runtime errors into user-friendly, actionable Bengali notifications.
*   **Central Exception Decoders:**
    *   `DexieError: ConstraintError` -> `"এই পণ্যটি ইতিমধ্যে ডেটাবেজে রয়েছে। অনুগ্রহ করে নতুন SKU ব্যবহার করুন।"`
    *   `StockDepletionError` -> `"পণ্যটির পর্যাপ্ত স্টক নেই। অনুগ্রহ করে ব্যাচ স্টক আপডেট চেক করুন।"`
    *   `CreditLimitExceededError` -> `"গ্রাহকের ক্রেডিট লিমিট অতিক্রম করেছে! পেমেন্ট মেথড ক্যাশ বা আংশিক পেমেন্ট করুন।"`
*   **Fail-Safe Abort Logs:** Writes details of aborted transactions (stack trace, device state, parameters) to a local `_FailedTransactions` table to aid in debugging.

### 5.3 Central Print Engine (`PrintEngine.ts`)
Directs document layout styling and browser spooling without affecting the main user interface.
*   **Iframe Rendering Pipeline:** Renders document templates in a hidden background iframe (`<iframe>`). This prevents layout shifting and ensures printing is non-blocking.
*   **Print Stylesheets:** Inject a dedicated print stylesheet into the iframe:
    ```css
    @media print {
      body { margin: 0; padding: 0; font-family: 'SolaimanLipi', sans-serif; }
      .no-print { display: none; }
      .page-break { page-break-after: always; }
    }
    ```
*   **Thermal Spooling Adjustments:** Automatically adjusts layouts for 80mm roll widths when thermal receipts are selected, reducing margins and padding to maximize readability on receipt paper.

### 5.4 Translation Engine (`TranslationEngine.ts`)
Centralizes localization strings. The UI is localized in Bengali by default.
```typescript
export const BENGALI_TRANSLATION_DICT = {
  dashboard: {
    title: "ড্যাশবোর্ড",
    todaySales: "আজকের বিক্রি",
    monthlySales: "চলতি মাসের বিক্রি",
    outstanding: "মোট বকেয়া",
    cashPosition: "নগদ তহবিল",
    lowStock: "কম স্টক সতর্কবার্তা",
    nearExpiry: "মেয়াদোত্তীর্ণের কাছাকাছি পণ্য"
  },
  invoice: {
    number: "ইনভয়েস নম্বর",
    customer: "ক্রেতার নাম",
    route: "রুট",
    subtotal: "উপমোট",
    discount: "ছাড়",
    vat: "ভ্যাট",
    payable: "মোট প্রদেয়",
    paid: "পরিশোধিত",
    due: "বাকি"
  },
  errors: {
    stockOut: "পর্যাপ্ত স্টক নেই!",
    invalidQty: "অনুগ্রহ করে সঠিক পরিমাণ লিখুন।"
  }
};
```

---

## 6. Dashboard Architecture (Analytical Core)

The dashboard provides real-time business insights across multiple key performance indicators. To maintain optimal performance on lower-spec hardware, the dashboard does not perform heavy, run-time database scans.

### 6.1 Real-Time Analytical Widgets & KPIs

The dashboard implements the following KPI widgets:

1.  **Today's Sales & Monthly Sales:** Tracks sales revenues against company targets.
2.  **Outstanding Balance Tracker:** Monitors total market credit, segmented by customer risk levels (Low, Medium, High).
3.  **Cash Position Asset Tracker:** Tracks cash in hand, bank accounts, and uncleared cheques.
4.  **Target Achievement Rates:** Compares salesman and route performance against brand goals.
5.  **Net Profit Panel:** Calculates true profitability using FIFO batch costs:
    $$\text{Net Profit} = \sum (\text{MRP} - \text{Batch EDP}) - \text{Salesman Commission} - \text{Operational Expenses}$$
6.  **Stock Warning Widgets:** Monitors near-expiry and low-stock items.

### 6.2 Pre-Aggregation Strategy & Data Flow
*   **Zero-Scan Dashboard Rendering:** UI components query the `_DailyKPIs` table, retrieving pre-calculated values in less than 15ms. No historical raw transaction tables are scanned when loading the dashboard.
*   **Atomic Updates:** When a sale, purchase, expense, or payment is committed, the `TransactionEngine` updates the corresponding fields in the current day's `_DailyKPIs` record within the same database transaction.
*   **Dynamic Background Recalculation:** A non-blocking service runs in the background to recalculate KPI values if historical entries are modified or database repairs occur, updating `_DailyKPIs` incrementally.

---

## 7. Reporting, Printing & Exporting Architecture

A robust printing and exporting pipeline is essential for FMCG field operations, where physical invoices, delivery sheets, and ledgers are heavily utilized.

### 7.1 Multi-Format Layout Strategy
The print engine supports the following document layouts:
*   **Invoice Billing Layout:** Standard sales bills, itemized with prices, tax percentages, salesman commission deductions, and cash payment details.
*   **Purchase Intake Layout:** Itemized cost calculations showing DP, EDP, and MRP values.
*   **Route Demand Sheet Builder:** Aggregated picking lists detailing Carton and Piece counts to expedite warehouse operations.
*   **Customer Ledger Statement:** Complete payment histories with debit, credit, and running balance columns.
*   **Daily Sales Report (DSR):** Summary checklists tracking salesman field collections and total products sold.

### 7.2 Printing Modes & Layout Rules
*   **A4 Print Mode:** Structured as clean, tabular corporate formats with high-contrast text, proper table headers, page-break indicators, and digital signatures.
*   **Thermal 80mm Mode:** Formatted as highly compact, single-column receipt structures using CSS flexbox, designed to fit standard mobile POS printers without horizontal clipping.
*   **Bengali Typography Integration:** Every print layout uses the `SolaimanLipi` or `Kalpurush` font to ensure Bengali characters render correctly across browsers and operating systems.

### 7.3 Multi-Format Export Pipeline
*   **Export to PDF:** Converts document HTML structures into standard PDF files using browser-native print APIs, with margins, headers, and footers optimized for document storage.
*   **Export to JPG:** Uses `html2canvas` to render the target DOM element into an image format, allowing users to quickly share receipts or ledger histories via WhatsApp or email.
*   **Export to CSV/Excel:** Generates structured Excel files from table states by parsing tabular data arrays into comma-separated values, ensuring compatibility with other accounting tools.

---

## 8. Security and Validation Architecture

Security is built directly into the client-side infrastructure, protecting the system against common data issues, partial transaction failures, or invalid operational states.

### 8.1 Multi-Tier Validation Framework
```
       Client Interaction / Form Input
                      │
                      ▼
     [ UI-Level Defensive Form Checks ]
    Block empty strings, validate bounds
                      │
                      ▼
    [ Service-Level Validation Checks ]
  Assert Stock FIFO, Credit Limits, Batches
                      │
                      ▼
    [ Database Constraint-Level Checks ]
   Assert unique SKUs, ULID formats, keys
```

1.  **Form Input Validation (UI-Level):** Checks form inputs for proper formatting, non-empty fields, and valid date bounds using local schema schemas before calling services.
2.  **Business Validation (Service-Level):** Checks proposed actions against current database states (e.g., verifying that a customer's credit limit is not exceeded, or that the warehouse has enough unreserved stock).
3.  **Database Validation (Constraint-Level):** Uses Dexie schemas to enforce database-level constraints, including unique indices, valid types, and proper foreign key associations.

### 8.2 Duplicate Prevention & Transaction Idempotency
To prevent double-billing or duplicate cash collection entries (often caused by accidental double-clicks or browser lag), the system implements the following mechanisms:
*   **Idempotence Tokens:** Every transactional UI form generates a unique idempotence token when opened.
*   **Token Verification:** Before executing a write, the `TransactionEngine` checks if the token has already been processed in the transaction journal. If a duplicate token is found, the operation is blocked, and the existing transaction details are returned.
*   **Temporary Button Disabling:** Form submission buttons are automatically disabled upon click, and remain disabled until the database write is committed or rolled back.

### 8.3 Audit Trails & Change Logs
To maintain a clear operational history, the system logs all database changes:
*   **Immutable Logs:** Every successful write writes a detailed entry to the `_AuditLogs` store.
*   **Log Structure:** Audit entries record the timestamp, operating user role, originating device ID, action type (`CREATE | UPDATE | DELETE`), target table name, record ID, and a detailed change diff payload:
    ```typescript
    interface AuditLogEntry {
      id: string;              // ULID
      timestamp: string;       // ISO8601 UTC
      userId: string;
      action: 'CREATE' | 'UPDATE' | 'DELETE';
      tableName: string;
      recordId: string;
      changeDiff: string;      // JSON string recording pre- and post-states
    }
    ```

### 8.4 Backup, Restore, and Data Recovery
Since data is stored entirely on the client, the system provides several data safety mechanisms:
*   **Compressed JSON Backup Engine:** Converts all database stores into a single, structured JSON string, compresses it using Brotli or Gzip compression, and downloads it as a `.bak` file.
*   **Restoration Pipeline:** Reads and decompresses back-up files, validates the schema structure, and writes the recovered rows to IndexedDB. This operation is performed within a clean database instance to prevent data corruption.
*   **Automated Backups:** Automatically downloads a localized backup file to the client's system at scheduled intervals (e.g., daily at 5:00 PM, or after every 50 sales transactions).

---

## 9. Synchronization Engine Architecture (Future Cloud-Ready)

Although the ERP operates entirely offline, its underlying architecture is built from the ground up to support secure, multi-device cloud synchronization.

### 9.1 Multi-Device Sync Pipeline

```
          [ Local IndexedDB / Dexie.js ]
                         │
                         ▼
             [ Device Change Detection ]
         Pulls records with status: 'pending'
                         │
                         ▼
            [ Incremental Sync Pipeline ]
          Packs changed records, applies gzip
                         │
                         ▼
             [ Secure API Sync Gateway ]
        HTTPS POST to central synchronization API
                         │
                         ▼
             [ Cloud Sync Orchestrator ]
         1. Authenticates device keys
         2. Applies conflict resolution rules
         3. Commits to relational database
         4. Returns server change payload
                         │
                         ▼
            [ Local Sync Reconciliation ]
       1. Commits server changes to local stores
       2. Resolves and merges local conflicts
       3. Updates records to status: 'synced'
```

### 9.2 Technical Synchronization Parameters
1.  **Device Registration & Authentication:** Upon first installation, a terminal must register with the central server, which generates and stores a secure API key in local storage. Every subsequent sync request must include this signature in the HTTPS headers.
2.  **Incremental Sync Queue:** The synchronization service runs in the background. It queries local tables for rows where `syncStatus === 'pending'`, compresses the modified payloads, and securely transmits them to the server.
3.  **Conflict Resolution Rules:**
    *   **Master Data (Products, Prices, Configuration):** *Server-Wins.* Cloud changes automatically overwrite local modifications.
    *   **Transactional Data (Sales Invoices, Payments):** *Client-Wins (Union Merge).* If a sale is created locally, it is uploaded and appended to the cloud ledger. If the same invoice is updated on two devices, the system uses the record with the most recent `updatedAt` timestamp, and flags the conflict in local sync logs.
    *   **Inventory Batches (FIFO counts):** *Reconciliation (Delta Merge).* Instead of overwriting quantities, the system merges stock adjustments:
        $$\text{Stock}_{\text{New}} = \text{Stock}_{\text{Server}} + (\text{Stock}_{\text{Local}} - \text{Stock}_{\text{LastSynced}})$$
4.  **Network Recovery Engine:** If the network connection is lost mid-sync, the transaction is safely paused. Once the connection is re-established, the engine uses the last-synced timestamp to resume the upload from the exact point of interruption, preventing duplicate entries.

---

## 10. Production Readiness Review & Final Approval Checklist

The system has undergone a comprehensive Production Readiness Review. The checklist below must be fully completed before beginning implementation.

### 10.1 Production Readiness Review

The architectural designs and specifications have been reviewed to ensure compliance with production standards:

*   **Database Normalization:** verified. The schema uses proper normalized structures and clear Foreign Key fields, and isolates data by profile.
*   **Transaction Consistency:** verified. All database modifications occur within atomic `TransactionEngine` boundaries, ensuring double-entry consistency across ledgers.
*   **Inventory Costing Accuracy:** verified. The system uses strict chronological FIFO batch selection, ensuring accurate COGS and margin calculations.
*   **Resource Management:** verified. The pre-aggregation strategy using the `_DailyKPIs` table keeps analytical queries fast and efficient.
*   **Printing & Localisation Reliability:** verified. Layouts support standard A4 and 80mm thermal formats, and the system is fully translated into Bengali by default.

### 10.2 Final Architecture Approval Checklist

```
[ ] All schema declarations, types, and compound indexes are defined in src/types.ts.
[ ] Dexie database schemas are finalized and include index optimization structures.
[ ] The TransactionEngine is set up as the single write orchestrator.
[ ] FIFOEngine cost allocation and batch depletion logic is tested and verified.
[ ] ValidationService credit check and stock allocation policies are defined.
[ ] ErrorService is configured with a comprehensive Bengali translation dictionary.
[ ] Hidden background print iframe wrappers are configured to support A4 and 80mm thermal layouts.
[ ] The compressed JSON backup and recovery system is tested and verified.
[ ] The _DailyKPIs table is configured for efficient dashboard rendering.
[ ] Audit trail logging is enabled across all transactional tables.
[ ] UI components are fully localized in Bengali by default.
```

---

## 11. Complete Implementation Roadmap

The development schedule is broken down into 5 sequential phases. Each phase is a quality gate that must be fully completed and verified before proceeding to the next phase.

```
┌────────────────────────────────────────────────────────┐
│         PHASE 1: Core Schema & Dexie.js Setup          │
├────────────────────────────────────────────────────────┤
│                           ▼                            │
├────────────────────────────────────────────────────────┤
│      PHASE 2: Decoupled Engines (FIFO, Validation)     │
├────────────────────────────────────────────────────────┤
│                           ▼                            │
├────────────────────────────────────────────────────────┤
│       PHASE 3: Parent Journaling & Ledgers Core        │
├────────────────────────────────────────────────────────┤
│                           ▼                            │
├────────────────────────────────────────────────────────┤
│        PHASE 4: Business Modules & Bengali UI          │
├────────────────────────────────────────────────────────┤
│                           ▼                            │
├────────────────────────────────────────────────────────┤
│        PHASE 5: BI Analytics & Print Services          │
└────────────────────────────────────────────────────────┘
```

### Phase 1: Core Database Schema & Dexie.js Setup
*   **Objective:** Define the physical database structure, configure Dexie stores, and establish strict TypeScript type checking.
*   **Modules:** Database Initialization, Schema Mappings, Seed Data.
*   **Database Work:** Configure all 20+ Dexie stores and indices in `src/db/db.ts` and `src/db/schema.ts`.
*   **Service Layer:** Define the base service wrapper interfaces.
*   **UI Components:** None.
*   **Business Rules:** Enforce base audit metadata checks.
*   **Reports:** None.
*   **Printing:** None.
*   **Testing Strategy:** Validate schema initializations and write/read speed across stores.
*   **Dependencies:** None.
*   **Estimated Completion Criteria:** Compilation is error-free, and database tables are verified in browser developer tools.

### Phase 2: Decoupled Logic Engines (FIFO & Validation)
*   **Objective:** Build and test the inventory costing and transaction validation layers.
*   **Modules:** Product Catalog, Batch Management, FIFO Engine, Validation Engine.
*   **Database Work:** Batch tracking, SKU lookups, product categories.
*   **Service Layer:** `FIFOEngine.ts`, `ValidationService.ts`.
*   **UI Components:** Basic forms for products and batch entries.
*   **Business Rules:** Cron-like batch allocation, reorder warnings, credit limits.
*   **Reports:** Simple stock and batch status sheets.
*   **Printing:** Basic A4 inventory lists.
*   **Testing Strategy:** Run unit tests for batch slicing, COGS, and credit validations.
*   **Dependencies:** Phase 1 complete.
*   **Estimated Completion Criteria:** FIFO allocations work correctly, and stock validation rules function as designed.

### Phase 3: Parent Journaling & Standardized Ledgers Core
*   **Objective:** Establish the atomic transaction write system and construct the double-entry accounting ledger.
*   **Modules:** Transaction Engine, Ledger Posting Services.
*   **Database Work:** `transactionJournal`, and standard ledger sub-tables.
*   **Service Layer:** `TransactionEngine.ts`, `ErrorService.ts` (with Bengali translations).
*   **UI Components:** Centralized operational state logs.
*   **Business Rules:** Balanced debits/credits, transaction reversals, automated rollback.
*   **Reports:** General Ledger, Account Balances, Cash Flows.
*   **Printing:** A4 Ledger Book pages.
*   **Testing Strategy:** Test write failures to ensure automatic rollback and verify double-entry accounting balances.
*   **Dependencies:** Phase 2 complete.
*   **Estimated Completion Criteria:** All transactions write through the `TransactionEngine`, and double-entry postings balance perfectly.

### Phase 4: Business Modules & Localised Bengali UI
*   **Objective:** Build out the core business features and implement the localized Bengali user interface.
*   **Modules:** Sales Billing, Procurement, Route Operations, Customer Management, Returns.
*   **Database Work:** `sales`, `purchases`, `customers`, `routes`, `returns`.
*   **Service Layer:** `TranslationEngine.ts`.
*   **UI Components:** Complete Bengali navigation shell, input forms, data tables, modals, and search filters.
*   **Business Rules:** Route credit restrictions, salesman collections, damage return processing.
*   **Reports:** Route Performance, Customer Ledgers, Sales Reports.
*   **Printing:** Billing layouts, delivery slips.
*   **Testing Strategy:** Conduct end-to-end user tests for salesman order routing, collection recording, and returns processing.
*   **Dependencies:** Phase 3 complete.
*   **Estimated Completion Criteria:** Main operations function offline, and the UI is fully localized in Bengali.

### Phase 5: BI Analytics & Central Print Services
*   **Objective:** Implement the real-time business intelligence dashboard and configure background document printing.
*   **Modules:** Dashboard, Demand Sheet Builder, Target Tracker, Print Engine, Backup & Recovery.
*   **Database Work:** `_DailyKPIs`, `companyTargets`, `demandSheets`.
*   **Service Layer:** `DashboardService.ts`, `PrintEngine.ts`.
*   **UI Components:** Graphical widgets, progress bars, and hidden print iframes.
*   **Business Rules:** Materialized KPI updates, automatic backup generation, target metrics.
*   **Reports:** Multi-profile Demand Sheets, Brand Targets.
*   **Printing:** 80mm Thermal receipts, A4 reports.
*   **Testing Strategy:** Verify KPI rendering times, print layout alignment, and data backup/restore capabilities.
*   **Dependencies:** Phase 4 complete.
*   **Estimated Completion Criteria:** The dashboard loads instantly, printing renders correctly, and database backups are reliable.

---

## 12. Final Production Implementation Rules & Standards

To maintain code quality and ensure backward compatibility throughout development, all implementation work must adhere to the following strict guidelines.

### 12.1 Code Quality & Development Standards
*   **TypeScript Strict Mode:** All code must pass strict TypeScript type checks. Avoid using `any` or casting types unless absolutely necessary.
*   **Decoupled Architecture:** UI components must only handle rendering. All data processing and business logic must be isolated within dedicated service classes.
*   **Standard Naming Conventions:**
    *   *Files & Modules:* PascalCase (e.g., `SalesInvoice.tsx`).
    *   *Services & Engines:* PascalCase (e.g., `TransactionEngine.ts`).
    *   *Database Stores & Fields:* camelCase (e.g., `productBatches`, `availableStock`).
*   **Centralised Error Handling:** All database operations must handle errors using the `ErrorService` to ensure user-friendly Bengali alerts are shown.
*   **Explicit Index Usage:** All database reads must target indexed fields to prevent slow table scans.

### 12.2 NON-NEGOTIABLE DEVELOPMENT RULES

> [!CAUTION]
> **To ensure system integrity, the following rules are strictly frozen and cannot be changed or simplified:**
>
> 1.  **Do NOT Change the Database Schema:** The 20+ Dexie stores and their fields are frozen. No tables can be renamed, simplified, or removed.
> 2.  **Do NOT Alter Ledger Rules:** Double-entry accounting rules are non-negotiable. Every transaction must post balanced debits and credits to standardized ledgers.
> 3.  **Do NOT Bypass Parent Journaling:** All database modifications must occur within the `TransactionEngine`'s transaction boundaries. Writing directly to sub-tables is strictly forbidden.
> 4.  **Do NOT Bypass FIFO Costing:** Average costing is forbidden. Profit and stock valuation must always use FIFO-based batch tracking.
> 5.  **Do NOT Localise Offline Features:** The system must function entirely offline. No online-dependent features or mock services may be introduced.
> 6.  **Do NOT Remove Bengali Translations:** The default UI language must remain Bengali.

# Friends Enterprise ERP v3 — Master Architecture & System Design Document
**Single Source of Truth (SSOT) for FMCG Distribution ERP**
**FROZEN REVISION: v3.0.0 (FINAL ARCHITECTURE FREEZE)**

---

## 1. System Overview

Friends Enterprise ERP v3 is a highly specialized, production-grade, offline-first FMCG (Fast-Moving Consumer Goods) Distribution Enterprise Resource Planning system. Designed specifically for localized FMCG distributors, this platform handles inventory, route operations, accounting, targets, and supplier management with rigorous relational integrity.

The application runs entirely client-side using **IndexedDB** managed through the **Dexie.js** library, achieving 100% offline reliability. It operates within a unified transactional journal boundary to ensure absolute accounting consistency, with a clear separation of concerns, defensive validations, localized printing, and future cloud synchronization hooks.

---

## 2. Master Folder Structure

To ensure SOLID design principles and clean separation of concerns, the project workspace is structured as follows:

```
/
├── public/                     # Static assets (logos, fallback fonts)
├── src/
│   ├── components/             # Reusable UI Components
│   │   ├── ui/                 # Atomic design tokens (Buttons, Inputs, Dialogs)
│   │   └── printable/          # Raw HTML printable layouts (Invoices, Demand Sheets)
│   ├── db/
│   │   ├── db.ts               # Dexie.js database instance and store mappings
│   │   └── schema.ts           # Extended Dexie/IndexedDB schema definitions
│   ├── modules/                # Domain-specific feature modules
│   │   ├── dashboard/          # BI Widgets, KPIs, performance visualizers
│   │   ├── business-profile/   # Multi-profile configurations (Trade licenses, BINs)
│   │   ├── company/            # Company Profiles, ledger records, claims, damages
│   │   ├── product/            # Products, Brand/Category, Batch managers
│   │   ├── route-sales/        # Routes, Customers, Salesmen, Multi-customer Invoicing
│   │   ├── purchases/          # Purchase flow, Batch creation, manual EDP entry
│   │   ├── returns/            # Purchase/Sales/Damage/Expiry return forms
│   │   ├── demand-sheet/       # Multi-profile demand sheet builder
│   │   ├── dsr/                # Daily Sales Reports, visit checklists, collections
│   │   ├── target/             # Target settings, MTD trackers, scorecards
│   │   ├── hawlat/             # Hawlat tracking (Cash, Products, Mixed Settlements)
│   │   ├── cash-book/          # Cash Flow ledgers, balances
│   │   └── reports/            # Centralized query and filter panels
│   ├── services/               # Domain-specific transactional logic engines
│   │   ├── TransactionEngine.ts# Orchestrator for parent-journalled atomic updates
│   │   ├── FIFOEngine.ts       # Batch allocation and inventory costing services
│   │   ├── DashboardService.ts # Pre-aggregated analytical reads
│   │   ├── ValidationService.ts# Dedicated decoupled validation layer
│   │   ├── ErrorService.ts      # Central Bengali error and rollback handler
│   │   ├── PrintEngine.ts      # Centralized browser-iframe layout printer
│   │   └── TranslationEngine.ts# Bengali translation dictionary and hooks
│   ├── types.ts                # Unified type declarations, enums, interfaces
│   ├── App.tsx                 # Base layout, navigation routers
│   ├── index.css               # Tailwind CSS imports and custom design tokens
│   └── main.tsx                # React entry point
├── .env.example                # Unpopulated template environment configuration
├── index.html                  # HTML template document
├── metadata.json               # Frame permissions and system capabilities
├── package.json                # Dependencies and deployment scripts
└── tsconfig.json               # Strict TypeScript configuration parameters
```

---

## 3. Database Schema Blueprint & Relational Design

The database represents a normalized, relational ledger-driven architecture. 

### 3.1 Base Entity Models (Universal Audit & Sync Metadata)
Every table schema in Friends Enterprise ERP v3 must inherit the following base fields to ensure consistent audits, soft-deletion safety, offline tracking, and future synchronization.

```typescript
interface BaseEntity {
  id: string;                // Universally Unique Lexicographically Sortable Identifier (ULID)
  
  // Universal Audit System
  createdAt: string;         // ISO8601 Timestamp
  updatedAt: string;         // ISO8601 Timestamp
  createdBy: string;         // User ID/Role string
  updatedBy: string;         // User ID/Role string
  isDeleted: boolean;        // Soft-delete toggle (Always filter active queries by !isDeleted)
  deletedAt: string | null;  // ISO8601 Timestamp or null
  version: number;           // Record versioning for lock/conflict tracking
  
  // Future Synchronization Layer
  syncStatus: 'synced' | 'pending' | 'failed';
  deviceId: string;          // Identifier of terminal originating the record
  lastModified: string;      // ISO8601 Timestamp for server reconciliation
  syncVersion: number;       // Tracks server synchronization counts
  conflictVersion: number;   // Incremented on local conflict resolutions
}
```

### 3.2 Database Stores & Schema Declarations

#### 1. `configurations`
Stores the central configuration dictionary to avoid any hardcoding of parameters in UI or services.
*   **Fields:** `id` (PK), `defaultVat` (%), `defaultDiscount` (%), `defaultCommission` (%), `currency` (e.g. "BDT"), `invoicePrefix`, `purchasePrefix`, `salesPrefix`, `demandSheetPrefix`, `decimalPrecision` (e.g. 2), `lowStockLevel` (units), `expiryAlertDays` (e.g. 30), `creditLimitRules` (JSON), `riskLevelRules` (JSON), + Base Metadata.

#### 2. `businessProfiles`
*   **Fields:** `id` (PK), `businessName`, `ownerName`, `tradeLicense`, `bin`, `address`, `phone`, `logoUrl`, `isDefault` (Boolean), + Base Metadata.

#### 3. `companies`
*   **Fields:** `id` (PK), `name`, `phone`, `address`, `outstandingBalance` (Derived), + Base Metadata.

#### 4. `brands`
*   **Fields:** `id` (PK), `companyId` (FK), `name`, + Base Metadata.

#### 5. `categories`
*   **Fields:** `id` (PK), `name`, + Base Metadata.

#### 6. `products`
*   **Fields:**
    *   `id` (PK)
    *   `sku` (Unique ID)
    *   `name`
    *   `companyId` (FK)
    *   `brandId` (FK)
    *   `categoryId` (FK)
    *   `unit` (e.g. "Pcs", "Box")
    *   `cartonSize` (number)
    *   `reorderLevel` (number)
    *   `isBatchEnabled` (boolean)
    *   `isExpiryEnabled` (boolean)
    *   + Base Metadata.

#### 7. `productBatches`
Tracks batch-wise counts and pricing historical structures.
*   **Fields:**
    *   `id` (PK)
    *   `batchNo`
    *   `productId` (FK)
    *   `companyId` (FK)
    *   `purchaseInvoiceId` (FK)
    *   `expiryDate`
    *   `batchStatus` (`Active` | `Expired` | `Damaged` | `Returned` | `Blocked` | `Finished`)
    *   // Historical Product Cost Metrics (Locked at time of purchase)
    *   `dp` (Distributor Price)
    *   `edp` (Effective Purchase Price)
    *   `sellingPrice` (MRP)
    *   `commission` (Accrued base commission)
    *   `margin` (Gross margin)
    *   `purchaseDiscount` (Discount value)
    *   `companyScheme` (Scheme identifier/description)
    *   `freeQuantity` (Free units)
    *   // Advanced Separate Stock Architecture (Quantities in base units)
    *   `availableStock`
    *   `reservedStock`
    *   `soldStock`
    *   `damagedStock`
    *   `expiredStock`
    *   `returnedStock`
    *   `physicalStock` (Sum of Available + Reserved + Returned)
    *   `currentStock` (Aggregate inventory snapshot)
    *   + Base Metadata.

#### 8. `routes`
*   **Fields:** `id` (PK), `routeName`, `market`, `area`, `territory`, `salespersonId` (FK), `deliveryManId` (FK), `isActive`, + Base Metadata.

#### 9. `customers`
*   **Fields:** `id` (PK), `shopName`, `ownerName`, `mobile`, `address`, `routeId` (FK), `creditLimit`, `outstandingBalance` (Derived), `riskLevel` (`Low` | `Medium` | `High`), + Base Metadata.

#### 10. `salesmen` & `deliveryMen`
*   **Fields:** `id` (PK), `name`, `phone`, `designation` (for Salesmen), `isActive`, + Base Metadata.

#### 11. `transactionJournal` (Universal Parent)
The single parent document created by every operational mutation.
*   **Fields:**
    *   `id` (PK - ULID)
    *   `transactionDate`
    *   `transactionType` (`Purchase` | `Sales_Invoice` | `Customer_Payment` | `Company_Payment` | `Return` | `Expense` | `Hawlat` | `Adjustment`)
    *   `referenceNo` (Invoice/Bill number)
    *   `totalDebit`
    *   `totalCredit`
    *   `status` (`Draft` | `Posted` | `Reversed`)
    *   `reversedTransactionId` (Self-referential ULID link)
    *   + Base Metadata.

#### 12. `customerLedgers`, `companyLedgers`, `stockLedgers`, `cashBook`, `routeLedgers`, `commissionLedgers`, `expenseLedgers`, `profitLedgers`, `hawlatLedgers` (Standardized Ledgers)
Every ledger table shares the exact same schema structure to preserve auditability and clean transactional lookups.
*   **Fields:**
    *   `id` (PK - ULID)
    *   `transactionId` (FK - Linked to Transaction Journal)
    *   `referenceType` (e.g. "Invoice", "Payment", "Purchase", "Return")
    *   `referenceId` (FK - Originating record ID)
    *   `debit` (Value)
    *   `credit` (Value)
    *   `balanceAfter` (Calculated running ledger balance)
    *   `remarks` (string details)
    *   + Base Metadata (createdAt, version, etc.).

#### 13. `sales` & `salesItems`
*   **Fields (Sales):** `id` (PK), `invoiceNo`, `routeId` (FK), `deliveryDate`, `salesmanId` (FK), `deliveryManId` (FK), `paymentMethod` (`Cash` | `Due` | `Bank` | `Mobile_Banking` | `Cheque` | `Advance` | `Partial` | `Mixed` | `Settlement`), `paymentDetails` (JSON - details on cheques/split values), `totalAmount`, `cashPaid`, `dueAmount`, `status`, + Base Metadata.
*   **Fields (SalesItems):** `id` (PK), `salesId` (FK), `customerId` (FK), `productId` (FK), `batchId` (FK), `quantity`, `rate` (MRP), `dp` (Historical), `edp` (Historical), `fixedCommission`, `percentageCommission`, `commissionAmount`, `itemTotal`, `netProfit` (`itemTotal - commissionAmount - (qty * edp)`), + Base Metadata.

#### 14. `purchases` & `purchaseItems`
*   **Fields (Purchases):** `id` (PK), `purchaseNo`, `companyId` (FK), `date`, `supplierInvoiceNo`, `totalDpValue`, `totalEdpValue`, `totalSellingValue`, `cashPaid`, `paymentDetails` (JSON), + Base Metadata.
*   **Fields (PurchaseItems):** `id` (PK), `purchaseId` (FK), `productId` (FK), `batchNo`, `expiryDate`, `quantity`, `dp`, `edp`, `sellingPrice`, `subTotal`, + Base Metadata.

#### 15. `returns` & `returnItems` (Central Return Management)
Supports all five core business return flows.
*   **Fields (Returns):**
    *   `id` (PK)
    *   `returnNo`
    *   `transactionId` (FK)
    *   `returnType` (`Purchase_Return` | `Sales_Return` | `Damage_Return` | `Expiry_Return` | `Replacement`)
    *   `customerId` (FK - Optional)
    *   `companyId` (FK - Optional)
    *   `date`
    *   `totalRefundAmount`
    *   `paymentMethod` (Refund method details)
    *   + Base Metadata.
*   **Fields (ReturnItems):**
    *   `id` (PK)
    *   `returnId` (FK)
    *   `productId` (FK)
    *   `batchId` (FK)
    *   `quantity`
    *   `unitPrice` (DP/MRP depending on context)
    *   `cogsValue` (Batch EDP)
    *   `returnReason`
    *   + Base Metadata.

#### 16. `hawlats`
*   **Fields:** `id` (PK), `name`, `phone`, `cashBalance` (Derived), `productBalances` (JSON structure: `Record<productId, qty>`), + Base Metadata.

#### 17. `expenses`
*   **Fields:** `id` (PK), `date`, `category` (`Fuel` | `Driver` | `Loading` | `Ferry` | `Parking` | `Food` | `Office_Utilities` | `Others`), `routeId` (FK - Optional), `amount`, `remarks`, + Base Metadata.

#### 18. `companyTargets`
*   **Fields:** `id` (PK), `month` (Format: "YYYY-MM"), `targetType` (`Company` | `Brand` | `Product` | `Route` | `Salesman`), `refId` (FK to targeted table), `targetValue` (BDT or Unit Count), + Base Metadata.

#### 19. `demandSheets`
*   **Fields:** `id` (PK), `demandNo`, `date`, `businessProfileId` (FK), `companyId` (FK), `items` (JSON), `netOutstanding`, `orderTotal`, + Base Metadata.

#### 20. `_DailyKPIs` (Materialized Dashboard Snapshots)
*   **Fields:** `date` (PK), `totalSales`, `totalCollections`, `totalPurchases`, `totalExpenses`, `totalDues`, `netProfit`, `lowStockCount`, `expiryCount`.

---

## 4. Operational Transactional Pipeline & Parent Journaling

To guarantee absolute accountability, audit trace-ability, and safety against partial failures, every transactional write must execute through a Parent Transaction Journal. No sub-table or individual ledger can be modified independently of this pipeline.

```
                  Client Initiated Transaction Request
                                   │
                                   ▼
                   [ Decoupled ValidationService ]
             Verify Stock, Batch, Credit, Payments, Dates
                                   │
                                   ▼
                  [ Dexie Transaction Boundaries ]
             Open Read/Write Lock across all active tables
                                   │
                                   ▼
             1. Create parent [ TransactionJournal ] entry
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        ▼                          ▼                          ▼
 2. Write Base Record     3. Consume Batch Stock     4. Post Balanced Ledgers
(Add Sales/Purchase)       (Deduct FIFO/Adjust)       (Debit/Credit matching)
        │                          │                          │
        └──────────────────────────┼──────────────────────────┘
                                   │
                                   ▼
                     [ Incremental KPI Update ]
                 Update materialized '_DailyKPIs' table
                                   │
         ┌─────────────────────────┴─────────────────────────┐
         ▼                                                   ▼
    [ Success ]                                         [ Failure ]
 Commit Transaction &                                 Abort Transaction,
 Trigger Local Success                               Automatic rollback,
                                                   Log in '_FailedTransactions',
                                                   Call ErrorService to return
                                                   friendly Bengali message.
```

### 4.1 Parent-Ledger Double-Entry Allocation Flow

*   **Purchase Registration Flow:**
    `Purchase` -> `Transaction Journal` -> `Company Ledger` (Credit Liability) -> `Stock Ledger` (Inventory Debit) -> `Batch Ledger` (Batch Inventory Entry) -> `Cash Book` (If cash paid, Credit Assets).
*   **Sales Invoice Registration Flow:**
    `Sales Invoice` -> `Transaction Journal` -> `Customer Ledger` (Debit Outstanding) -> `Stock Ledger` (FIFO Inventory Credit) -> `Batch Ledger` (Batch Stock Debit) -> `Route Ledger` (Revenue record) -> `Commission Ledger` (Accrue operating cost) -> `Profit Ledger` (Record exact margin: `Qty * (Selling Price - Batch EDP) - Commission`) -> `Cash Book` (If cash paid, Debit Assets).
*   **Returns Processing Flow:**
    `Return` -> `Transaction Journal` -> `Customer/Company Ledger` (Reverse dues) -> `Stock Ledger` (Deduct/Add back) -> `Batch Ledger` (Update status/re-add) -> `Cash Book` (Refund transaction if applicable).

---

## 5. Standardized Core Business Logic Engines

### 5.1 FIFO Inventory Allocation Logic (`FIFOEngine.ts`)
*   **Selection Base:** Lookups must target active batches of a product (`productId`), filtering for `batchStatus === 'Active'` and `availableStock > 0`, ordered chronologically by `expiryDate` (or `purchaseDate` if expiry is disabled).
*   **Multi-Batch Slicing:** If the order quantity is `Q` and oldest batch stock is `B1 < Q`, the engine consumes the entire `B1` batch, updates its `availableStock` to 0, sets status to `Finished`, and then queries the next chronological batch `B2` to fulfill the remaining `Q - B1` units. This creates distinct transaction journal entries mapped to individual batch costs.
*   **Cost Valuation:** Gross profit calculations must bypass average costing, fetching the specific historical `edp` (Effective Purchase Price) of each consumed batch recorded during procurement.

### 5.2 Decoupled Validation Service (`ValidationService.ts`)
Validations are isolated from the UI components. No form submissions may proceed without passing this layer.
*   `validateStock(productId, quantity, location)`: Confirms warehouse contains enough unreserved stock to fulfill transactions.
*   `validateBatch(productId, batchId, quantity)`: Asserts batch is active and contains sufficient available units.
*   `validateCreditLimit(customerId, orderAmount)`: Compares customer's `outstandingBalance + orderAmount` against their configured `creditLimit`. Blocks or triggers strict warnings depending on configuration rules.
*   `validatePayment(paymentMethod, details)`: Validates mobile transaction numbers, checks cheque dates, or verifies split partial values.

### 5.3 Dashboard Analytics Service (`DashboardService.ts`)
*   **No Raw Scans:** Dashboard screens are forbidden from executing bulk queries or scanning historical logs during runtime.
*   **Pre-Aggregation Reads:** Dashboard reads are limited to retrieving data from the summarized `_DailyKPIs` table, resolving KPIs in less than 15ms.
*   **Incremental Triggers:** At the time of transaction commit, the `TransactionEngine` increments the corresponding daily KPI variables within the same atomic transaction scope.

---

## 6. Business Operations & Core Features

### 6.1 Return Management Strategy
The architecture natively handles returns via specialized ledger adjustments:
1.  **Purchase Return:** Decrements `CompanyLedger` liabilities, decreases `productBatches.availableStock`.
2.  **Sales Return:** Credits `CustomerLedger`, adds stock back to `productBatches.returnedStock` (isolating returned items for assessment prior to restock).
3.  **Damage/Expiry Return:** Transfers stock from `productBatches.availableStock` to `damagedStock` or `expiredStock`, then initiates a debit adjustment on the `CompanyLedger` once approved.
4.  **Replacement:** Swaps equivalent-value products within a single Transaction Journal entry.

### 6.2 Advanced Payment System
Ledger postings are structured to handle:
*   `Cash`: Debits Cash Book directly.
*   `Due`: Credits Customer Ledger/Debits Company Ledger.
*   `Bank` & `Mobile Banking`: Debits/Credits corporate bank ledger or bKash/Nagad accounts with transaction reference numbers.
*   `Cheque`: Holds transaction state as `Pending_Clearing` under Cheque Registry. Upon clearing, posts debits/credits to Cash Book/Bank.
*   `Mixed Payments`: Postings split across multiple assets (e.g. 50% Cash, 50% Mobile Banking).

### 6.3 Central Print Engine (`PrintEngine.ts`)
*   **Isolated Rendering:** Generates printable sheets using a hidden background iframe. Injects HTML templates and custom print styles, then triggers `iframe.contentWindow.print()`.
*   **Formats:** Supporting standard A4 layouts (reports, ledgers) and 80mm thermal layouts (mobile delivery receipts).
*   **Bengali Layouts:** Hardcoded CSS font-families embed clean Bengali types (e.g. "SolaimanLipi", "AdorshoLipi") to ensure flawless printouts.

### 6.4 Central Error and Rollback System (`ErrorService.ts`)
*   **Diagnostic Logs:** Catches all application failures, database conflicts, and validation breaches. Logs failures into a `_FailedTransactions` register.
*   **Bengali Notifications:** Decodes system exception trace strings into polished, customer-facing Bengali notices.
*   **Rollback Assertion:** Guarantees that any partial write fails fully back to the pre-transaction state, keeping cash and stock books in perfect sync.

---

## 7. Operational Roles & Security Permissions

The local system enforces strict authorization parameters based on functional user profiles.

| User Role | Operations Scope | Module Actions Allowed |
| :--- | :--- | :--- |
| **Owner** | Full system control | Read, Create, Update, Delete, Approve, Print, Export (All Modules) |
| **Manager** | Store operations, procurement, targets | Read, Create, Update, Approve, Print, Export. No database purges or system restore. |
| **Accountant** | Ledgers, cash books, settlements | Read, Create, Print, Export. Financial operations only; no catalog price changes. |
| **Sales Officer**| Route order tracking, customer list | Read, Create (DSR, Route orders), Print. No financial or catalog configuration. |
| **Delivery Man** | Visit logs, collections | Read, Create (Collections, visited check), Print. |
| **Viewer** | Read-only reporting | Read, Print, Export (No write/edit permissions). |

---

## 8. Development Assembly Phases & Architecture Freeze

The implementation path follows a unidirectional sequence, maintaining a verified green state throughout the development:

```
  ┌────────────────────────────────────────────────────────┐
  │         PHASE 1: Core Definitions & Dexie setup        │
  └───────────────────────────┬────────────────────────────┘
                              ▼
  ┌────────────────────────────────────────────────────────┐
  │         PHASE 2: Decoupled Validation & FIFO Engine    │
  └───────────────────────────┬────────────────────────────┘
                              ▼
  ┌────────────────────────────────────────────────────────┐
  │         PHASE 3: Parent Journaling & Transaction Engine│
  └───────────────────────────┬────────────────────────────┘
                              ▼
  ┌────────────────────────────────────────────────────────┐
  │         PHASE 4: BI Analytics Service & Dashboard KPIs  │
  └───────────────────────────┬────────────────────────────┘
                              ▼
  ┌────────────────────────────────────────────────────────┐
  │         PHASE 5: Central Print Engine & Localization   │
  └────────────────────────────────────────────────────────┘
```

This v3.0.0 architecture specification constitutes the **Final Production Architecture Freeze** for Friends Enterprise ERP v3. No structural database designs, transactional patterns, ledger balances, folder structures, or business rules may deviate from this document during the physical construction phase. All implementation layers must be derived directly from these specifications to guarantee scalable, clean, and professional enterprise deployment.

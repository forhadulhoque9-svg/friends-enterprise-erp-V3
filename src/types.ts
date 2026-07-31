/**
 * Friends Enterprise ERP v3 Master Type Definitions
 * Single Source of Truth for Unified domain types, enums, and models.
 * FROZEN REVISION: v3.0.0
 */

/**
 * Base Entity Interface for Universal Audits & Cloud Sync layers
 */
export interface BaseEntity {
  id?: string; // Universally Unique Identifier (ULID) (Optional for instantiation compatibility)
  
  // Universal Audit Fields
  createdAt?: string;         // ISO8601 Timestamp
  updatedAt?: string;         // ISO8601 Timestamp
  createdBy?: string;         // User ID/Role identifier
  updatedBy?: string;         // User ID/Role identifier
  isDeleted?: boolean;        // Soft-delete toggle (Filter all operational queries by !isDeleted)
  deletedAt?: string | null;  // ISO8601 Timestamp or null
  version?: number;           // Entity version lock

  // Synchronization Metadata
  syncStatus?: 'synced' | 'pending' | 'failed';
  deviceId?: string;          // Originating device hardware ID
  lastModified?: string;      // Last sync date
  syncVersion?: number;       // Sync iteration count
  conflictVersion?: number;   // Conflict count resolved
}

/**
 * Universal Master Configurations Module
 */
export interface MasterConfiguration extends BaseEntity {
  defaultVat: number;             // Default Value-Added Tax percentage (e.g. 5)
  defaultDiscount: number;        // Default generic discount percentage
  defaultCommission: number;      // Default salesperson commission
  currency: string;               // Currency code, e.g., 'BDT'
  invoicePrefix: string;          // Prefix for sales bills (e.g., 'INV-')
  purchasePrefix: string;         // Prefix for purchasing invoices (e.g., 'PUR-')
  salesPrefix: string;            // Prefix for sales pipelines (e.g., 'SL-')
  demandSheetPrefix: string;      // Prefix for demand slips (e.g., 'DS-')
  decimalPrecision: number;       // Rounding precision decimal places (e.g., 2)
  lowStockLevel: number;          // Default quantity for low stock warning
  expiryWarningDays: number;      // Danger threshold for expiring batches
  creditLimitRules: string;       // JSON configuration defining credit policies
  riskLevelRules: string;         // JSON configuration mapping customer Risk scores
}

/**
 * Multi-Profile Business Configurations
 */
export interface BusinessProfile extends BaseEntity {
  businessName: string;
  owner: string;
  tradeLicense: string;
  bin: string;
  address: string;
  phone: string;
  logoBase64?: string;
  isDefault: boolean;
}

/**
 * Company Profile
 */
export interface Company extends BaseEntity {
  name: string;
  phone: string;
  address: string;
  outstandingBalance: number;     // Liability of what ERP owes this Company (Derived/Materialized)
}

/**
 * Brand Profile
 */
export interface Brand extends BaseEntity {
  companyId: string;              // Foreign Key to companies
  name: string;
}

/**
 * Category Profile
 */
export interface Category extends BaseEntity {
  name: string;
}

/**
 * Product Master Catalog
 */
export interface Product extends BaseEntity {
  sku?: string;                   // Unique identifier SKU Code
  productCode?: string;           // Product Code (প্রোডাক্ট কোড)
  productName?: string;          // Product Name (প্রোডাক্টের নাম)
  name: string;
  companyId?: string;             // Foreign Key to companies
  company?: string;               // Company name (কোম্পানির নাম)
  brandId?: string;               // Foreign Key to brands
  brand: string;                  // Mapped brand name (for backward compatibility)
  categoryId?: string;            // Foreign Key to categories
  category: string;               // Mapped category name (for backward compatibility)
  unit: string;                   // Unit measurements, e.g. 'Pcs', 'Box', 'Carton'
  cartonSize?: number;            // Multiplier count inside a carton
  pcsPerCarton?: number;          // Pcs per Carton (প্রতি কার্টনে পিস)
  reorderLevel?: number;          // Safe minimum stock levels before alerting
  isBatchEnabled?: boolean;       // Enables batch tracking for SKU
  isExpiryEnabled?: boolean;      // Enables expiry validations for SKU
  stock: number;                  // Aggregate stock (backward compatibility)
  stockInPcs?: number;            // Stock in Pcs (মোট স্টক পিসে)
  purchasePrice: number;          // Standard base DP (Distributor Price per piece)
  purchasePriceCarton?: number;    // Purchase price per carton
  purchasePricePcs?: number;       // Purchase price per piece
  dp?: number;                     // Distributor price alias
  edp?: number;                   // Effective DP cost (backward compatibility)
  retailPrice: number;            // standard base MRP (Selling Price per piece)
  sellingPrice?: number;          // Retail price alias
  salesPriceCarton?: number;       // Sales price per carton
  salesPricePcs?: number;          // Sales price per piece
  profit?: number;
  margin?: number;
  imageUrl?: string;              // Product Image URL
}

/**
 * Batch Status Enums
 */
export type BatchStatus = 'Active' | 'Expired' | 'Damaged' | 'Returned' | 'Blocked' | 'Finished';

/**
 * Detailed Product Batch Inventory
 */
export interface ProductBatch extends BaseEntity {
  batchNo: string;
  productId: string;              // Foreign Key to products
  productName: string;            // Cached name (readability)
  companyId: string;              // Foreign Key to companies
  purchaseInvoiceId: string;      // Foreign Key to purchaseInvoices
  supplierInvoiceNo?: string;     // Cached reference
  expiryDate?: string;            // ISO8601 Date
  purchaseDate: string;           // ISO8601 Date
  batchStatus?: BatchStatus;      // Core active state
  
  // Advanced Separate Stock Architecture (Base Units)
  availableStock?: number;        // Stock available for trade and allocation (FIFO baseline)
  reservedStock?: number;         // Stock locked under active orders/draft bills
  soldStock?: number;             // Total stock sold from this batch
  damagedStock?: number;          // Total stock damaged in this batch
  expiredStock?: number;          // Total stock expired in this batch
  returnedStock?: number;         // Stock returned by customer awaiting quality assurance
  physicalStock?: number;         // Total stock currently in warehouse (Available + Reserved + Returned)
  currentStock: number;           // Stock ledger legacy matching

  // Historical costing metrics (Forever locked at point of purchase)
  dp: number;                     // Base Distributor Price
  edp: number;                    // Effective Purchase Price (COGS Baseline)
  sellingPrice: number;           // MRP (Retail Price)
  commission?: number;            // Negotiated commission rate
  margin?: number;                // Gross margin percentage
  purchaseDiscount?: number;      // Discount value recorded
  companyScheme?: string;         // Applicable supplier scheme code
  freeQuantity?: number;          // Bonus items included
}

/**
 * Route Market Module
 */
export interface Route extends BaseEntity {
  routeName: string;
  marketName?: string;            // Market / Gunj reference
  area?: string;
  territory?: string;
  salespersonId?: string;         // Mapped Sales Officer PK
  salesOfficer?: string;          // Salesperson display name (compatibility)
  deliveryManId?: string;         // Mapped Delivery Man PK
  deliveryMan?: string;           // Delivery display name (compatibility)
  status?: 'Active' | 'Inactive';
  isActive?: boolean;             // Boolean status flag
}

/**
 * Customer / Shop Profile
 */
export interface Customer extends BaseEntity {
  shopName?: string;
  ownerName?: string;
  mobile?: string;
  phone: string;                  // Mobile alias (compatibility)
  address: string;
  routeId?: string;               // Foreign Key to routes
  creditLimit: number;            // Maximum safe outstanding limit
  outstandingBalance: number;     // Cumulative accounts receivable (Derived/Materialized)
  riskLevel?: 'Low' | 'Medium' | 'High'; // Risk matrix
  name: string;                   // Customer legacy name (compatibility)
}

/**
 * Sales Officers / Delivery Staff
 */
export interface Salesman extends BaseEntity {
  name: string;
  phone: string;
  mobile?: string;
  designation?: string;
  address?: string;
  monthlySalary?: number;
  isActive: boolean;
}

export type DSR = Salesman;

export interface DSRShortLedgerEntry extends BaseEntity {
  dsrId: string;
  dsrName: string;
  date: string;
  expectedAmount: number;
  submittedAmount: number;
  shortAmount: number;
  refInvoiceId?: string;
  refInvoiceNo?: string;
  status: 'Pending' | 'Deducted' | 'Waived';
  remarks?: string;
  entryType?: 'Shortage' | 'Advance';
}

export interface DSRPayrollRecord extends BaseEntity {
  dsrId: string;
  dsrName: string;
  month: string;                    // YYYY-MM
  totalDaysInMonth: number;
  presentDays: number;
  monthlyBaseSalary: number;
  earnedBaseSalary: number;
  commissionBonus: number;
  advanceTaken: number;
  shortDeduction: number;
  netPayableSalary: number;
  paymentDate?: string;
  paymentStatus: 'Pending' | 'Paid';
  remarks?: string;
}

export interface DeliveryMan extends BaseEntity {
  name: string;
  phone: string;
  isActive: boolean;
}

/**
 * Central Operational Journal Entry (Double-Entry Parent Orchestrator)
 */
export interface TransactionJournal extends BaseEntity {
  transactionDate: string;        // ISO8601 Timestamp of operational booking
  transactionType: 
    | 'Purchase' 
    | 'Sales_Invoice' 
    | 'Customer_Payment' 
    | 'Company_Payment' 
    | 'Return' 
    | 'Expense' 
    | 'Hawlat' 
    | 'Adjustment';
  referenceNo: string;            // Originating bill/invoice serial number
  totalDebit: number;             // Matching absolute debit sum
  totalCredit: number;            // Matching absolute credit sum
  status: 'Draft' | 'Posted' | 'Reversed';
  reversedTransactionId?: string; // Links back to reversed ledger entry
}

/**
 * Standardized Double-Entry Ledger Entry Structure
 * All modular Ledgers share this exact identical schema structure
 */
export interface StandardLedgerEntry extends BaseEntity {
  transactionId?: string;         // Foreign Key to transactionJournal
  referenceType?: 'Invoice' | 'Payment' | 'Purchase' | 'Return' | 'Adjustment' | 'Damage Credit' | 'Incentive' | 'Claim Settlement';
  referenceId?: string;           // Foreign Key to originating tables
  debit?: number;                 // Debit value posted (optional for compatibility)
  credit?: number;                // Credit value posted (optional for compatibility)
  balanceAfter?: number;          // Materialized running ledger balance after posting
  remarks: string;
}

// Concrete Ledgers leveraging the Standardized Schema Pattern
export interface CustomerLedgerEntry extends StandardLedgerEntry {
  customerId: string;             // Linked Customer FK
  // Compatibility fields
  date: string;
  type: 'Invoice' | 'Payment' | 'Return' | 'Discount';
  refId: string;
  balance: number;
}

export interface CompanyLedgerEntry extends StandardLedgerEntry {
  companyId: string;              // Linked Company FK
  // Compatibility fields
  date: string;
  type: 'Purchase' | 'Payment' | 'Damage Credit' | 'Incentive' | 'Claim Settlement' | 'Adjustment';
  refId: string;
  balance: number;
}

export type StockLedgerType = 
  | 'Purchase' 
  | 'Sale' 
  | 'Damage' 
  | 'Return' 
  | 'Company Damage' 
  | 'Hawlat' 
  | 'Adjustment';

export interface StockLedgerEntry extends StandardLedgerEntry {
  productId: string;              // Linked Product FK
  productName?: string;
  qtyIn: number;                  // Quantity received
  qtyOut: number;                 // Quantity sold/transferred
  // Compatibility fields
  date: string;
  type: StockLedgerType;
  refId: string;
  balance: number;
}

export interface CashTransaction extends StandardLedgerEntry {
  cashIn: number;
  cashOut: number;
  // Compatibility fields
  date: string;
  type: 'Sales_Collection' | 'Purchase_Payment' | 'Hawlat_Cash' | 'Expense' | 'Other' | 'Hawlat_Custody_Out' | 'Bank_Deposit_In';
  refId: string;
  balance: number;
}

export interface RouteLedgerEntry extends StandardLedgerEntry {
  routeId: string;
}

export interface CommissionLedgerEntry extends StandardLedgerEntry {
  salesmanId: string;
}

export interface ExpenseLedgerEntry extends StandardLedgerEntry {}

export interface ProfitLedgerEntry extends StandardLedgerEntry {}

export type HawlatTransactionType = 
  | 'Cash_Lend'
  | 'Cash_Receive'
  | 'Product_Lend'
  | 'Product_Receive'
  | 'Cash_Settle'
  | 'Product_Settle'
  | 'Mixed_Settle'
  | 'Cash_Custody_Deposit'
  | 'Bank_Deposit_Settle';

export interface HawlatLedgerEntry extends StandardLedgerEntry {
  hawlatId: string;
  hawlatName: string;
  cashAmount: number;
  productId?: string;
  productName?: string;
  productQty: number;
  cartons?: number;
  loosePcs?: number;
  pcsPerCarton?: number;
  ratePerCarton?: number;
  ratePerPcs?: number;
  totalValue?: number;
  bankName?: string;
  bankSlipNo?: string;
  cashBalanceAfter: number;
  custodyBalanceAfter?: number;
  productBalanceAfter: number;
  // Compatibility fields
  date: string;
  type: HawlatTransactionType;
  refId: string;
}

/**
 * Sales Invoicing Structures
 */
export type PaymentMethod = 
  | 'Cash' 
  | 'Due' 
  | 'Bank' 
  | 'Mobile_Banking' 
  | 'Cheque' 
  | 'Advance' 
  | 'Partial' 
  | 'Mixed' 
  | 'Settlement';

export interface CustomerDueBreakdown {
  customerId: string;
  customerName: string;
  shopName?: string;
  dueAmount: number;
  remarks?: string;
}

export interface SalesInvoice extends BaseEntity {
  invoiceNo: string;
  customerId: string;              // Foreign Key to customers
  customerName: string;            // Cached name
  routeId?: string;                // Foreign Key to routes
  date: string;                    // Booking date
  deliveryDate?: string;           // Delivery execution date
  salesmanId?: string;             // Foreign Key to salesmen
  deliveryManId?: string;          // Foreign Key to deliveryMen
  dsrId?: string;                  // Foreign Key to DSR / Delivery Officer
  dsrName?: string;                // Cached DSR Name
  paymentMethod?: PaymentMethod;   // Unified multi-method configuration
  paymentDetails?: string;         // JSON serialised split allocations
  subTotal: number;
  discount: number;                // Flat discount value applied to invoice
  netTotal: number;                // Final payable sum (revenue)
  cashPaid: number;                // Cash collected on booking
  dueAmount?: number;              // Remaining accounts receivable added to outstanding
  isMasterInvoice?: boolean;       // Master Load / Consolidated Delivery Invoice flag
  customerDuesBreakdown?: CustomerDueBreakdown[]; // Multiple Customer Due allocations
  totalReturnedAmount?: number;    // Accumulated returned items valuation
  isReturnProcessed?: boolean;     // End of day return reconciliation flag
  returnDate?: string;             // Last return entry date
  remarks: string;
  items: SalesInvoiceItem[];       // Embedded records for Dexie lookup
  // Compatibility fields
  outstandingBalanceBefore: number;
  outstandingBalanceAfter: number;
}

export interface SalesInvoiceItem extends BaseEntity {
  salesId?: string;                // Foreign Key to salesInvoices
  customerId?: string;             // Foreign Key to customers
  productId: string;               // Foreign Key to products
  name: string;                    // Cached product name
  batchId?: string;                // Foreign Key to productBatches (strict audit trace)
  qty: number;                     // Sale quantity (base units)
  baseQty?: number;                // Base quantity in pieces
  quantity?: number;               // Sale quantity alias
  price: number;                   // Selling price
  discount?: number;               // Discount percentage or amount
  total: number;                   // Line item total
  isFree?: boolean;                // Bonus/Trade offer item
  rate?: number;                   // Booking selling rate (MRP)
  dp?: number;                     // Historical distributor price
  edp?: number;                    // Historical effective cost price (COGS Baseline)
  fixedCommission?: number;        // Fixed commission margin applied
  percentageCommission?: number;   // Percentage commission margin applied
  commissionAmount?: number;       // Accumulated margin value
  itemTotal?: number;              // Quantity * rate
  netProfit?: number;              // Exact margin calculation: itemTotal - commissionAmount - (quantity * edp)
  commissionType?: 'Fixed' | 'Percentage';
  returnedQty?: number;            // Quantity returned by customer (in pcs)
  returnedCartons?: number;        // Returned cartons count
  returnedLoosePcs?: number;       // Returned loose pcs count
  returnedAmount?: number;         // Monetary value of returned pcs
  netQty?: number;                 // Net sold quantity = qty - returnedQty
  actualMargin?: number;
}

/**
 * Purchase Invoicing Structures
 */
export interface PurchaseInvoice extends BaseEntity {
  purchaseNo: string;
  companyId: string;               // Foreign Key to companies
  companyName: string;             // Cached name
  date: string;
  supplierInvoiceNo?: string;      // Direct invoice reference code
  totalDpValue?: number;           // Total procurement cost baseline
  totalEdpValue?: number;          // Actual EDP value (excluding scheme/incentives)
  totalSellingValue?: number;      // Forecasted sales baseline
  cashPaid: number;
  paymentDetails?: string;         // JSON cheque / account detail tracking
  remarks: string;
  items: PurchaseItem[];           // Embedded records for Dexie lookup
  // Compatibility fields
  totalAmount: number;
  outstandingBalanceBefore: number;
  outstandingBalanceAfter: number;
}

export interface PurchaseItem extends BaseEntity {
  purchaseId?: string;             // Foreign Key to purchaseInvoices
  productId: string;               // Foreign Key to products
  name: string;                    // Cached product name
  batchNo?: string;                // Created batch tag
  expiryDate?: string;             // Target expiry date
  quantity?: number;               // Procurement count
  cartons?: number;
  loosePcs?: number;
  pcsPerCarton?: number;
  ratePerCarton?: number;
  ratePerPcs?: number;
  dp?: number;                     // Distributor cost
  edp?: number;                    // Effective distributor cost
  sellingPrice?: number;           // Retail base price (MRP)
  subTotal?: number;               // Quantity * EDP
  // Compatibility fields
  qty: number;
  purchasePrice: number;
  total: number;
}

/**
 * Return Management Module
 */
export type ReturnType = 
  | 'Purchase_Return' 
  | 'Sales_Return' 
  | 'Damage_Return' 
  | 'Expiry_Return' 
  | 'Replacement';

export interface Return extends BaseEntity {
  returnNo: string;
  transactionId: string;           // Foreign Key to transactionJournal
  returnType: ReturnType;          // Domain return trigger
  customerId?: string;             // Optional Customer FK
  companyId?: string;              // Optional Company FK
  date: string;
  totalRefundAmount: number;
  paymentMethod: string;           // Cash, Ledger Adjust, etc.
  remarks?: string;
}

export interface ReturnItem extends BaseEntity {
  returnId: string;                // Foreign Key to returns
  productId: string;               // Foreign Key to products
  batchId: string;                 // Foreign Key to productBatches
  quantity: number;                // Returned unit counts
  unitPrice: number;               // Unit return valuation (DP/MRP)
  cogsValue: number;               // Valuation cost basis (Batch EDP)
  returnReason: string;            // Diagnostic feedback tag
}

/**
 * Hawlat Module Structures
 */
export interface Hawlat extends BaseEntity {
  name: string;
  phone: string;
  address?: string;
  remarks: string;
  cashBalance: number;             // Aggregate cash owed. Positive: we owe them; Negative: they owe us
  custodyBalance?: number;         // Cash held in custody by this hawlat contact
  openingCashBalance?: number;     // Initial opening balance
  productBalances: Record<string, number>; // Maps productId to quantities owed
}

/**
 * Expenses Module
 */
export interface Expense extends BaseEntity {
  date: string;
  category: string;                // Category tag (e.g. 'Fuel', 'Utilities')
  routeId?: string;                // Optional route linked mapping
  amount: number;
  remarks: string;
}

/**
 * Target Management Module
 */
export interface CompanyTarget extends BaseEntity {
  month: string;                   // YYYY-MM Format
  targetType: 'Company' | 'Brand' | 'Product' | 'Route' | 'Salesman';
  refId: string;                   // FK mapping
  refName: string;
  primaryTarget: number;
  secondaryTarget: number;
  primaryAchievement: number;
  secondaryAchievement: number;
}

/**
 * Demand Slip Structs
 */
export interface DemandSheet extends BaseEntity {
  demandNo: string;
  date: string;
  businessProfileId: string;       // Foreign Key to businessProfiles
  businessName: string;
  companyId: string;               // Foreign Key to companies
  companyName: string;
  items: DemandSheetItem[];        // JSON serialized inside indexDB
  remarks: string;
  status?: string;                 // e.g. 'সম্পন্ন / স্টক ইন (Completed)' | 'অপেক্ষমান (Pending)'
  netOutstanding?: number;
  orderTotal?: number;
  // Compatibility fields
  companyOutstanding: number;
  currentOrderAmount: number;
}

export interface DemandSheetItem {
  productId: string;
  productName: string;
  cartons?: number;
  loosePcs?: number;
  pcsPerCarton?: number;
  qty: number;
  rate: number;
  ratePerCarton?: number;
  ratePerPcs?: number;
  total: number;
}

/**
 * Materialised Analytics / Diagnostic Snapshots
 */
export interface DailyKPIEntry {
  id: string;                      // YYYY-MM-DD Date
  salesAmount: number;
  collectionAmount: number;
  expenseAmount: number;
  duesAmount: number;
  profitAmount: number;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;                      // ULID
  timestamp: string;
  userId: string;
  userRole: string;
  actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'ADJUST';
  tableName: string;
  recordId: string;
  diffData: string;                // JSON difference representation
  integrityHash: string;           // Block chained hash
}

export interface FailedTransactionEntry {
  id: string;                      // ULID
  timestamp: string;
  transactionName: string;
  errorName: string;
  errorMessage: string;
  stackTrace?: string;
  payload: string;                 // JSON formatted inputs
}

export interface ConfigRegistryEntry {
  id: string;                      // 'current'
  lowStockThreshold: number;
  expiryWarningDays: number;
  defaultPrinterWidth: '80mm' | '58mm' | 'A4';
  allowCreditOverLimit: boolean;
}

/**
 * ERP System User Roles
 */
export type UserRole = 'Owner' | 'Manager' | 'Accountant' | 'Sales Officer' | 'Delivery Man' | 'Viewer';

/**
 * Legacy support structures (Backward Compatibility)
 */
export interface ERPConfig {
  id: string;
  companyName: string;
  phone: string;
  address: string;
  logoBase64?: string;
}

export interface Shop extends BaseEntity {
  shopName: string;
  ownerName: string;
  mobile: string;
  previousDue: number;
  newDue: number;
  totalDue: number;
  creditLimit: number;
  address: string;
  routeId?: string;
}

export type ShopLedgerType = 'Opening' | 'Sale' | 'Collection' | 'Return' | 'Adjustment';

export interface ShopLedgerEntry extends BaseEntity {
  shopId: string;
  date: string;
  type: ShopLedgerType;
  refId: string;
  debit: number;
  credit: number;
  balance: number;
  remarks: string;
  transactionId?: string;
}

export interface ShopCollection {
  id: string;
  shopId: string;
  shopName: string;
  date: string;
  amountCollected: number;
  remarks: string;
}

export interface SalesTrip extends BaseEntity {
  tripNo: string;
  date: string;
  salesperson: string;
  routeId: string;
  route: string;
  remarks: string;
  dueEntries: {
    shopId: string;
    shopName: string;
    previousDue: number;
    newDue: number;
    cashCollected: number;
    totalDue: number;
  }[];
  totalCashCollected: number;
  totalNewDue: number;
}

export interface CompanyDamage extends BaseEntity {
  companyId: string;
  companyName: string;
  productId: string;
  productName: string;
  qty: number;
  damageValue: number;
  status: 'Pending' | 'Approved' | 'Paid';
  date: string;
  remarks: string;
}

export type IncentiveType = 'Target Incentive' | 'Online Order Incentive' | 'Scheme Bonus' | 'Festival Bonus' | 'Special Bonus' | 'Manual Adjustment';

export interface CompanyIncentive extends BaseEntity {
  companyId: string;
  companyName: string;
  date: string;
  type: IncentiveType;
  amount: number;
  remarks: string;
}

export type ClaimType = 'Damage Claim' | 'Shortage Claim' | 'Expiry Claim' | 'Return Claim';

export interface CompanyClaim extends BaseEntity {
  companyId: string;
  companyName: string;
  date: string;
  type: ClaimType;
  amount: number;
  status: 'Submitted' | 'In-Process' | 'Settled';
  remarks: string;
}

export type SchemeType = 'FreeProduct' | 'Discount' | 'Promo';

export interface CompanyScheme extends BaseEntity {
  companyId: string;
  companyName: string;
  name: string;
  type: SchemeType;
  productId: string;
  productName: string;
  triggerQty: number;
  rewardQty: number;
  discountPercent: number;
  isActive: boolean;
  remarks: string;
}

export interface DSRRecord extends BaseEntity {
  date: string;
  routeId: string;
  routeName: string;
  salesperson: string;
  customerId: string;
  customerName: string;
  visited: boolean;
  ordered: boolean;
  sold: boolean;
  salesAmount: number;
  collectionAmount: number;
  dueAmount: number;
  remarks: string;
}

/**
 * STEP 2 Standard/Alias Mappings for Full Architectural Compliance
 */
export type Purchase = PurchaseInvoice;
export type Sales = SalesInvoice;
export type SalesItem = SalesInvoiceItem;
export type DailySalesReport = DSRRecord;
export type CashBook = CashTransaction;
export type CustomerLedger = CustomerLedgerEntry;
export type CompanyLedger = CompanyLedgerEntry;
export type RouteLedger = RouteLedgerEntry;
export type StockLedger = StockLedgerEntry;
export type CommissionLedger = CommissionLedgerEntry;
export type HawlatLedger = HawlatLedgerEntry;
export type Settings = ERPConfig;
export type Configurations = MasterConfiguration;


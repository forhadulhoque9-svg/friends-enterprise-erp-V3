import Dexie, { type Table } from 'dexie';
import { 
  DB_NAME, 
  CURRENT_DB_VERSION, 
  MASTER_SCHEMAS, 
  executeDatabaseMigrations 
} from './schema';
import { 
  Product, 
  Customer, 
  CustomerLedgerEntry, 
  SalesInvoice, 
  SalesInvoiceItem,
  Company, 
  CompanyLedgerEntry, 
  PurchaseInvoice, 
  PurchaseItem,
  CompanyDamage, 
  CompanyIncentive, 
  CompanyClaim, 
  CompanyScheme, 
  Hawlat, 
  HawlatLedgerEntry, 
  CashTransaction, 
  ERPConfig,
  HawlatTransactionType,
  Shop,
  ShopLedgerEntry,
  SalesTrip,
  Expense,
  StockLedgerEntry,
  Route,
  CompanyTarget,
  DemandSheet,
  BusinessProfile,
  ProductBatch,
  DSRRecord,
  AuditLogEntry,
  FailedTransactionEntry,
  DailyKPIEntry,
  ConfigRegistryEntry,
  MasterConfiguration,
  Brand,
  Category,
  Salesman,
  DeliveryMan,
  TransactionJournal,
  RouteLedgerEntry,
  CommissionLedgerEntry,
  ExpenseLedgerEntry,
  ProfitLedgerEntry,
  Return,
  ReturnItem,
  DSRShortLedgerEntry,
  DSRPayrollRecord
} from '../types';

/**
 * Friends Enterprise ERP v3 Dexie IndexedDB Database Instance
 */
export class FriendsEnterpriseDB extends Dexie {
  // Original / Core Tables
  products!: Table<Product, string>;
  customers!: Table<Customer, string>;
  customerLedgers!: Table<CustomerLedgerEntry, string>;
  salesInvoices!: Table<SalesInvoice, string>;
  companies!: Table<Company, string>;
  companyLedgers!: Table<CompanyLedgerEntry, string>;
  purchaseInvoices!: Table<PurchaseInvoice, string>;
  companyDamages!: Table<CompanyDamage, string>;
  companyIncentives!: Table<CompanyIncentive, string>;
  companyClaims!: Table<CompanyClaim, string>;
  companySchemes!: Table<CompanyScheme, string>;
  hawlats!: Table<Hawlat, string>;
  hawlatLedgers!: Table<HawlatLedgerEntry, string>;
  cashBook!: Table<CashTransaction, string>;
  config!: Table<ERPConfig, string>;
  
  // Multi-shop due & ledger tables
  shops!: Table<Shop, string>;
  shopLedgers!: Table<ShopLedgerEntry, string>;
  salesTrips!: Table<SalesTrip, string>;
  expenses!: Table<Expense, string>;
  stockLedgers!: Table<StockLedgerEntry, string>;
  
  // Route, Target, Demand & Business Profiles
  routes!: Table<Route, string>;
  companyTargets!: Table<CompanyTarget, string>;
  demandSheets!: Table<DemandSheet, string>;
  businessProfiles!: Table<BusinessProfile, string>;
  productBatches!: Table<ProductBatch, string>;
  dailySalesReports!: Table<DSRRecord, string>;

  // Enterprise Core Logging & caching tables
  auditLogs!: Table<AuditLogEntry, string>;
  failedTransactions!: Table<FailedTransactionEntry, string>;
  dailyKPIs!: Table<DailyKPIEntry, string>;
  configRegistry!: Table<ConfigRegistryEntry, string>;

  // Phase-1 Advanced Schema Addition tables
  configurations!: Table<MasterConfiguration, string>;
  brands!: Table<Brand, string>;
  categories!: Table<Category, string>;
  salesmen!: Table<Salesman, string>;
  deliveryMen!: Table<DeliveryMan, string>;
  transactionJournal!: Table<TransactionJournal, string>;
  
  // New Standardized Double-Entry Ledgers
  routeLedgers!: Table<RouteLedgerEntry, string>;
  commissionLedgers!: Table<CommissionLedgerEntry, string>;
  expenseLedgers!: Table<ExpenseLedgerEntry, string>;
  profitLedgers!: Table<ProfitLedgerEntry, string>;
  
  // Return & Claim Management System Tables
  salesInvoiceItems!: Table<SalesInvoiceItem, string>;
  purchaseInvoiceItems!: Table<PurchaseItem, string>;
  returns!: Table<Return, string>;
  returnItems!: Table<ReturnItem, string>;

  // DSR Short & Payroll Ledger System
  dsrShortLedgers!: Table<DSRShortLedgerEntry, string>;
  dsrPayrolls!: Table<DSRPayrollRecord, string>;

  constructor() {
    super(DB_NAME);

    // Apply Schema Version 1 configuration
    this.version(1).stores(MASTER_SCHEMAS[1]);
    this.version(2).stores(MASTER_SCHEMAS[2]);

    // Apply Schema Version 3 configuration with custom migration triggers
    this.version(3)
      .stores(MASTER_SCHEMAS[3])
      .upgrade(async (tx) => {
        // Run database migration triggers
        await executeDatabaseMigrations(this, tx.db.verno, 3);
      });

    // Apply Schema Version 4 (Performance & Sorting Index)
    this.version(4)
      .stores(MASTER_SCHEMAS[4]);

    // Setup global hooks for audit, versioning and sync tracking
    this.setupDatabaseHooks();
  }

  /**
   * Automatically intercepts database operations to append audit tracking and soft-delete fields
   */
  private setupDatabaseHooks() {
    const auditableTables = [
      'products', 'customers', 'customerLedgers', 'salesInvoices', 'companies',
      'companyLedgers', 'purchaseInvoices', 'companyDamages', 'companyIncentives',
      'companyClaims', 'companySchemes', 'hawlats', 'hawlatLedgers', 'cashBook',
      'shops', 'shopLedgers', 'salesTrips', 'expenses', 'stockLedgers', 'routes',
      'companyTargets', 'demandSheets', 'businessProfiles', 'productBatches',
      'dailySalesReports', 'configurations', 'brands', 'categories', 'salesmen',
      'deliveryMen', 'transactionJournal', 'routeLedgers', 'commissionLedgers',
      'expenseLedgers', 'profitLedgers', 'returns', 'returnItems', 'salesInvoiceItems',
      'purchaseInvoiceItems'
    ];

    for (const tableName of auditableTables) {
      const table = this.table(tableName);
      if (!table) continue;

      // Intercept insertion to append audit timestamps and GUIDs automatically
      table.hook('creating', (primKey, obj: any) => {
        const now = new Date().toISOString();
        obj.createdAt = obj.createdAt || now;
        obj.updatedAt = obj.updatedAt || now;
        obj.createdBy = obj.createdBy || 'system_service';
        obj.updatedBy = obj.updatedBy || 'system_service';
        obj.isDeleted = obj.isDeleted !== undefined ? obj.isDeleted : false;
        obj.deletedAt = obj.deletedAt || null;
        obj.version = obj.version || 1;

        // Sync Metadata
        obj.syncStatus = obj.syncStatus || 'synced';
        obj.deviceId = obj.deviceId || 'local_device';
        obj.lastModified = obj.lastModified || now;
        obj.syncVersion = obj.syncVersion || 1;
        obj.conflictVersion = obj.conflictVersion || 0;
      });

      // Intercept update to append updated timestamps and increment record versions
      table.hook('updating', (mods: any, primKey, obj: any) => {
        const now = new Date().toISOString();
        const updates: any = { ...mods };
        updates.updatedAt = now;
        updates.updatedBy = mods.updatedBy || 'system_service';
        updates.lastModified = now;
        if (obj.version) {
          updates.version = obj.version + 1;
        }
        return updates;
      });
    }
  }
}

export const db = new FriendsEnterpriseDB();

/**
 * High-performance cash balance query
 * Uses cashBook running ledger or defaults to opening baseline
 */
export async function getCashBalance(): Promise<number> {
  const allCashTx = await db.cashBook.toArray();
  const lastTx = allCashTx.length > 0 ? allCashTx[allCashTx.length - 1] : null;
  return lastTx ? (lastTx.balance ?? lastTx.balanceAfter ?? 0) : 0; // Clean opening cash 0 BDT
}

// Database Seeding & Initialization Logic
export async function seedDatabase() {
  console.log('Checking database status for seeding...');
  const configCount = await db.config.count();
  if (configCount > 0) {
    console.log('Database already initialized with seed values.');
    return;
  }

  // 1. Initial ERP Config
  await db.config.add({
    id: 'main',
    companyName: 'মেসার্স ফাহিম এন্টারপ্রাইজ',
    phone: '০১৮৩৫৯১২৫৯৭',
    address: 'তেজগাঁও, ঢাকা',
  });

  // 2. Initial Default Business Profile
  await db.businessProfiles.add({
    id: 'bp_default',
    businessName: 'মেসার্স ফাহিম এন্টারপ্রাইজ',
    owner: 'ফরহাদুল হক',
    tradeLicense: 'TR-102934-2026',
    bin: '001293847-0102',
    address: 'তেজগাঁও, ঢাকা',
    phone: '০১৮৩৫৯১২৫৯৭',
    whatsapp: '০১৮৩৫৯১২৫৯৭',
    isDefault: true,
    updatedAt: new Date().toISOString()
  });

  // 3. Central System Configurations
  await db.configRegistry.add({
    id: 'current',
    lowStockThreshold: 10,
    expiryWarningDays: 30,
    defaultPrinterWidth: '80mm',
    allowCreditOverLimit: false
  });

  // 4. Master Configurations Table
  await db.configurations.add({
    id: 'master',
    defaultVat: 5,
    defaultDiscount: 0,
    defaultCommission: 2.5,
    currency: 'BDT',
    invoicePrefix: 'INV-',
    purchasePrefix: 'PUR-',
    salesPrefix: 'SL-',
    demandSheetPrefix: 'DS-',
    decimalPrecision: 2,
    lowStockLevel: 10,
    expiryWarningDays: 30,
    creditLimitRules: JSON.stringify({ action: 'block', warningPercentage: 90 }),
    riskLevelRules: JSON.stringify({ highRiskOutstanding: 150000, mediumRiskOutstanding: 50000 })
  });

  console.log('Database seeding successfully completed.');
}

/**
 * One-time developer action to clear the entire FriendsEnterpriseDB_v3 IndexedDB database,
 * recreate the schema, and re-seed default configurations.
 */
export async function clearAndResetDatabase() {
  console.log('Clearing FriendsEnterpriseDB_v3 database...');
  try {
    db.close();
    await db.delete();
    await db.open();
    await seedDatabase();
    console.log('Database reset successfully.');
  } catch (err) {
    console.error('Error during database reset:', err);
    await Dexie.delete(DB_NAME);
  }
}

// Transaction Engine delegate imports & exports for full backward compatibility
import { 
  TransactionEngine,
  recordStockLedger,
  recordCashTransaction
} from '../services/TransactionEngine';

export { recordStockLedger, recordCashTransaction };

export async function postSalesInvoice(invoice: SalesInvoice): Promise<void> {
  return TransactionEngine.postSalesInvoice(invoice);
}

export async function postPurchaseInvoice(invoice: PurchaseInvoice): Promise<void> {
  return TransactionEngine.postPurchaseInvoice(invoice);
}

export async function postCustomerPayment(customerId: string, amount: number, date: string, remarks: string): Promise<void> {
  return TransactionEngine.postCustomerPayment(customerId, amount, date, remarks);
}

export async function postCompanyPayment(companyId: string, amount: number, date: string, remarks: string): Promise<void> {
  return TransactionEngine.postCompanyPayment(companyId, amount, date, remarks);
}

export async function approveDamageReturn(damageId: string): Promise<void> {
  return TransactionEngine.approveDamageReturn(damageId);
}

export async function settleDamagePayment(damageId: string): Promise<void> {
  return TransactionEngine.settleDamagePayment(damageId);
}

export async function postCompanyIncentive(incentive: CompanyIncentive): Promise<void> {
  return TransactionEngine.postCompanyIncentive(incentive);
}

export async function settleCompanyClaim(claimId: string): Promise<void> {
  return TransactionEngine.settleCompanyClaim(claimId);
}

export async function postHawlatTransaction(
  hawlatId: string, 
  type: HawlatTransactionType, 
  cashAmount: number, 
  productId: string | undefined, 
  productQty: number, 
  remarks: string,
  date: string,
  extraDetails?: {
    cartons?: number;
    loosePcs?: number;
    pcsPerCarton?: number;
    ratePerCarton?: number;
    ratePerPcs?: number;
    totalValue?: number;
    bankName?: string;
    bankSlipNo?: string;
  }
): Promise<void> {
  return TransactionEngine.postHawlatTransaction(hawlatId, type, cashAmount, productId, productQty, remarks, date, extraDetails);
}

export async function settleHawlatDebt(
  hawlatId: string,
  settleCash: boolean,
  settleProducts: boolean,
  date: string
): Promise<void> {
  return TransactionEngine.settleHawlatDebt(hawlatId, settleCash, settleProducts, date);
}

export async function postExpense(
  date: string,
  category: string,
  amount: number,
  remarks: string,
  paidBy?: string
): Promise<void> {
  return TransactionEngine.postExpense(date, category, amount, remarks, paidBy);
}

export async function postShopCollection(
  shopId: string, 
  amount: number, 
  date: string, 
  remarks: string
): Promise<void> {
  return TransactionEngine.postShopCollection(shopId, amount, date, remarks);
}

export async function postSalesTrip(trip: SalesTrip): Promise<void> {
  return TransactionEngine.postSalesTrip(trip);
}

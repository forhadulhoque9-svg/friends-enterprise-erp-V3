/**
 * Friends Enterprise ERP v3 Master Schema Configuration
 * This file serves as the Single Source of Truth for Database Versions, Table Schemas, Indexes, and Migrations.
 */

export const DB_NAME = 'FriendsEnterpriseDB_v3';
export const CURRENT_DB_VERSION = 3; // Incremented for DSR Short Ledger & Payroll Integration

export const MASTER_SCHEMAS: Record<number, Record<string, string>> = {
  1: {
    products: 'id, name, brand, category',
    customers: 'id, name, phone, routeId',
    customerLedgers: 'id, customerId, date, type, refId',
    salesInvoices: 'id, invoiceNo, customerId, date',
    companies: 'id, name, phone',
    companyLedgers: 'id, companyId, date, type, refId',
    purchaseInvoices: 'id, purchaseNo, companyId, date',
    companyDamages: 'id, companyId, productId, status, date',
    companyIncentives: 'id, companyId, type, date',
    companyClaims: 'id, companyId, type, status, date',
    companySchemes: 'id, companyId, name, productId, isActive',
    hawlats: 'id, name, phone',
    hawlatLedgers: 'id, hawlatId, date, type, refId',
    cashBook: 'id, date, type, refId',
    config: 'id',
    shops: 'id, shopName, mobile, routeId',
    shopLedgers: 'id, shopId, date, type, refId',
    salesTrips: 'id, tripNo, date, routeId',
    expenses: 'id, date, category',
    stockLedgers: 'id, productId, date, type, refId',
    routes: 'id, routeName, salesOfficer',
    companyTargets: 'id, month, targetType, refId',
    demandSheets: 'id, demandNo, date, companyId',
    businessProfiles: 'id, businessName, isDefault',
    productBatches: 'id, productId, batchNo, companyId',
    dailySalesReports: 'id, date, routeId, customerId',
    auditLogs: 'id, timestamp, tableName, recordId',
    failedTransactions: 'id, timestamp, transactionName',
    dailyKPIs: 'id, updatedAt',
    configRegistry: 'id'
  },
  2: {
    // Keep all version 1 stores fully compatible, and introduce all Phase-1 required tables
    products: 'id, sku, name, companyId, brandId, categoryId, isDeleted',
    customers: 'id, shopName, routeId, mobile, riskLevel, isDeleted',
    customerLedgers: 'id, transactionId, referenceType, referenceId, customerId, isDeleted',
    salesInvoices: 'id, invoiceNo, routeId, salesmanId, deliveryManId, paymentMethod, isDeleted',
    salesInvoiceItems: 'id, salesId, customerId, productId, batchId, isDeleted',
    companies: 'id, name, phone, isDeleted',
    companyLedgers: 'id, transactionId, referenceType, referenceId, companyId, isDeleted',
    purchaseInvoices: 'id, purchaseNo, companyId, date, isDeleted',
    purchaseInvoiceItems: 'id, purchaseId, productId, batchNo, isDeleted',
    companyDamages: 'id, companyId, productId, status, date, isDeleted',
    companyIncentives: 'id, companyId, type, date, isDeleted',
    companyClaims: 'id, companyId, type, status, date, isDeleted',
    companySchemes: 'id, companyId, name, productId, isActive, isDeleted',
    hawlats: 'id, name, phone, isDeleted',
    hawlatLedgers: 'id, transactionId, referenceType, referenceId, hawlatId, isDeleted',
    cashBook: 'id, date, type, refId, transactionId, referenceType, referenceId, isDeleted', // Backwards compatible index mapping
    config: 'id',
    shops: 'id, shopName, mobile, routeId, isDeleted',
    shopLedgers: 'id, shopId, date, type, refId, transactionId, isDeleted',
    salesTrips: 'id, tripNo, date, routeId, isDeleted',
    expenses: 'id, date, category, routeId, isDeleted',
    stockLedgers: 'id, productId, date, type, refId, transactionId, referenceType, referenceId, isDeleted',
    routes: 'id, routeName, salespersonId, deliveryManId, isActive, isDeleted',
    companyTargets: 'id, month, targetType, refId, isDeleted',
    demandSheets: 'id, demandNo, date, businessProfileId, companyId, isDeleted',
    businessProfiles: 'id, businessName, isDefault, isDeleted',
    productBatches: 'id, productId, batchNo, companyId, purchaseInvoiceId, batchStatus, isDeleted',
    dailySalesReports: 'id, date, routeId, customerId, isDeleted',
    auditLogs: 'id, timestamp, tableName, recordId',
    failedTransactions: 'id, timestamp, transactionName',
    dailyKPIs: 'id, updatedAt',
    configRegistry: 'id',
    
    // Phase-1 Enterprise Centralized Schema Additions
    configurations: 'id, isDeleted',
    brands: 'id, companyId, name, isDeleted',
    categories: 'id, name, isDeleted',
    salesmen: 'id, name, isActive, isDeleted',
    deliveryMen: 'id, name, isActive, isDeleted',
    transactionJournal: 'id, transactionDate, transactionType, referenceNo, status, isDeleted',
    
    // New Standardized Double-Entry Ledgers
    routeLedgers: 'id, transactionId, referenceType, referenceId, routeId, isDeleted',
    commissionLedgers: 'id, transactionId, referenceType, referenceId, salesmanId, isDeleted',
    expenseLedgers: 'id, transactionId, referenceType, referenceId, isDeleted',
    profitLedgers: 'id, transactionId, referenceType, referenceId, isDeleted',
    
    // Return & Claim Management System
    returns: 'id, returnNo, transactionId, returnType, customerId, companyId, isDeleted',
    returnItems: 'id, returnId, productId, batchId, isDeleted'
  },
  3: {
    // Version 3 includes DSR Short Ledgers & DSR Payrolls
    products: 'id, sku, name, companyId, brandId, categoryId, isDeleted',
    customers: 'id, shopName, routeId, mobile, riskLevel, isDeleted',
    customerLedgers: 'id, transactionId, referenceType, referenceId, customerId, isDeleted',
    salesInvoices: 'id, invoiceNo, routeId, salesmanId, deliveryManId, dsrId, paymentMethod, isDeleted',
    salesInvoiceItems: 'id, salesId, customerId, productId, batchId, isDeleted',
    companies: 'id, name, phone, isDeleted',
    companyLedgers: 'id, transactionId, referenceType, referenceId, companyId, isDeleted',
    purchaseInvoices: 'id, purchaseNo, companyId, date, isDeleted',
    purchaseInvoiceItems: 'id, purchaseId, productId, batchNo, isDeleted',
    companyDamages: 'id, companyId, productId, status, date, isDeleted',
    companyIncentives: 'id, companyId, type, date, isDeleted',
    companyClaims: 'id, companyId, type, status, date, isDeleted',
    companySchemes: 'id, companyId, name, productId, isActive, isDeleted',
    hawlats: 'id, name, phone, isDeleted',
    hawlatLedgers: 'id, transactionId, referenceType, referenceId, hawlatId, isDeleted',
    cashBook: 'id, date, type, refId, transactionId, referenceType, referenceId, isDeleted',
    config: 'id',
    shops: 'id, shopName, mobile, routeId, isDeleted',
    shopLedgers: 'id, shopId, date, type, refId, transactionId, isDeleted',
    salesTrips: 'id, tripNo, date, routeId, isDeleted',
    expenses: 'id, date, category, routeId, isDeleted',
    stockLedgers: 'id, productId, date, type, refId, transactionId, referenceType, referenceId, isDeleted',
    routes: 'id, routeName, salespersonId, deliveryManId, isActive, isDeleted',
    companyTargets: 'id, month, targetType, refId, isDeleted',
    demandSheets: 'id, demandNo, date, businessProfileId, companyId, isDeleted',
    businessProfiles: 'id, businessName, isDefault, isDeleted',
    productBatches: 'id, productId, batchNo, companyId, purchaseInvoiceId, batchStatus, isDeleted',
    dailySalesReports: 'id, date, routeId, customerId, isDeleted',
    auditLogs: 'id, timestamp, tableName, recordId',
    failedTransactions: 'id, timestamp, transactionName',
    dailyKPIs: 'id, updatedAt',
    configRegistry: 'id',
    configurations: 'id, isDeleted',
    brands: 'id, companyId, name, isDeleted',
    categories: 'id, name, isDeleted',
    salesmen: 'id, name, isActive, isDeleted',
    deliveryMen: 'id, name, isActive, isDeleted',
    transactionJournal: 'id, transactionDate, transactionType, referenceNo, status, isDeleted',
    routeLedgers: 'id, transactionId, referenceType, referenceId, routeId, isDeleted',
    commissionLedgers: 'id, transactionId, referenceType, referenceId, salesmanId, isDeleted',
    expenseLedgers: 'id, transactionId, referenceType, referenceId, isDeleted',
    profitLedgers: 'id, transactionId, referenceType, referenceId, isDeleted',
    returns: 'id, returnNo, transactionId, returnType, customerId, companyId, isDeleted',
    returnItems: 'id, returnId, productId, batchId, isDeleted',
    dsrShortLedgers: 'id, dsrId, date, status, isDeleted',
    dsrPayrolls: 'id, dsrId, month, paymentStatus, isDeleted'
  }
};

/**
 * Migration triggers for safe transition of offline-first IndexedDB datasets
 */
export async function executeDatabaseMigrations(dbInstance: any, oldVersion: number, newVersion: number) {
  console.log(`Executing IndexedDB database migration from v${oldVersion} to v${newVersion}...`);
  
  if (oldVersion < 2) {
    // Upgrade existing store records with new BaseEntity and synchronization fields if missing
    const tablesToUpgrade = [
      'products', 'customers', 'customerLedgers', 'salesInvoices', 'companies',
      'companyLedgers', 'purchaseInvoices', 'companyDamages', 'companyIncentives',
      'companyClaims', 'companySchemes', 'hawlats', 'hawlatLedgers', 'cashBook',
      'shops', 'shopLedgers', 'salesTrips', 'expenses', 'stockLedgers', 'routes',
      'companyTargets', 'demandSheets', 'businessProfiles', 'productBatches',
      'dailySalesReports'
    ];

    for (const tableName of tablesToUpgrade) {
      try {
        const table = dbInstance.table(tableName);
        await table.toCollection().modify((record: any) => {
          // Setup Universal Audit defaults
          if (!record.createdAt) record.createdAt = new Date().toISOString();
          if (!record.updatedAt) record.updatedAt = new Date().toISOString();
          if (!record.createdBy) record.createdBy = 'system_migration';
          if (!record.updatedBy) record.updatedBy = 'system_migration';
          if (record.isDeleted === undefined) record.isDeleted = false;
          if (record.deletedAt === undefined) record.deletedAt = null;
          if (record.version === undefined) record.version = 1;

          // Setup Sync Layer defaults
          if (!record.syncStatus) record.syncStatus = 'synced';
          if (!record.deviceId) record.deviceId = 'local_device';
          if (!record.lastModified) record.lastModified = new Date().toISOString();
          if (record.syncVersion === undefined) record.syncVersion = 1;
          if (record.conflictVersion === undefined) record.conflictVersion = 0;
        });
        console.log(`Successfully migrated schema properties for table: ${tableName}`);
      } catch (err) {
        console.warn(`Migration skipped or failed for table '${tableName}':`, err);
      }
    }
  }
}

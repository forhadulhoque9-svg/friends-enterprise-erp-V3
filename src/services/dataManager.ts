import { db, seedDatabase } from '../db/db';

/**
 * DataManager service responsible for live database synchronization,
 * store hydration, and zero-state resets across the ERP modules.
 */
export const dataManager = {
  /**
   * Hard initial synchronization call:
   * Ensures essential system configs exist, verifies live database connections,
   * and triggers a fresh subscription sync across all active Dexie stores.
   */
  async syncAll(): Promise<void> {
    await seedDatabase();
    
    // Explicitly touch core tables to trigger re-evaluation of all reactive Dexie useLiveQuery hooks
    await Promise.all([
      db.companies.count(),
      db.products.count(),
      db.customers.count(),
      db.salesInvoices.count(),
      db.purchaseInvoices.count(),
      db.cashBook.count(),
      db.dsrShortLedgers.count(),
      db.dsrPayrolls.count(),
      db.salesmen.count(),
      db.companyLedgers.count(),
      db.customerLedgers.count(),
      db.companyClaims.count(),
      db.companyDamages.count(),
      db.companyIncentives.count(),
      db.companySchemes.count()
    ]);

    console.log('[dataManager] Live data synchronization successfully executed.');
  },

  /**
   * Clears all local and session storage alongside Dexie tables,
   * then re-runs syncAll to bring system into a clean zero state.
   */
  async resetAndSync(): Promise<void> {
    localStorage.clear();
    sessionStorage.clear();
    for (const table of db.tables) {
      await table.clear();
    }
    await this.syncAll();
  }
};

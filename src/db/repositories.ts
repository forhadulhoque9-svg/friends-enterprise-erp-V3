import { db } from './db';
import { AuditLogEntry, FailedTransactionEntry, DailyKPIEntry, ConfigRegistryEntry } from '../types';
import { generateULID } from '../utils/helpers';

/**
 * Repository handling tamper-resistant write-once-read-many (WORM) audit logs
 */
export const AuditRepository = {
  async log(
    actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'ADJUST',
    tableName: string,
    recordId: string,
    oldValues: any,
    newValues: any,
    userId: string = 'system_operator',
    userRole: string = 'Operator'
  ): Promise<string> {
    const id = generateULID();
    const timestamp = new Date().toISOString();
    const diffData = JSON.stringify({ oldValues, newValues });
    
    // Simplistic progressive integrity chain hashing to verify data-integrity
    const lastEntry = await db.auditLogs.orderBy('id').last();
    const prevHash = lastEntry ? lastEntry.integrityHash : 'GENESIS';
    const rawString = `${id}-${timestamp}-${actionType}-${tableName}-${recordId}-${diffData}-${prevHash}`;
    
    let hash = 0;
    for (let i = 0; i < rawString.length; i++) {
      const char = rawString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    const integrityHash = `hash_${Math.abs(hash).toString(16)}`;

    const entry: AuditLogEntry = {
      id,
      timestamp,
      userId,
      userRole,
      actionType,
      tableName,
      recordId,
      diffData,
      integrityHash
    };

    await db.auditLogs.add(entry);
    return id;
  },

  async getAll(): Promise<AuditLogEntry[]> {
    return db.auditLogs.orderBy('timestamp').toArray();
  }
};

/**
 * Repository handling diagnostics of multi-table transaction rollback/failures
 */
export const FailedTransactionRepository = {
  async log(
    transactionName: string,
    error: any,
    payload: any
  ): Promise<string> {
    const id = generateULID();
    const timestamp = new Date().toISOString();
    
    const entry: FailedTransactionEntry = {
      id,
      timestamp,
      transactionName,
      errorName: error?.name || 'Error',
      errorMessage: error?.message || String(error),
      stackTrace: error?.stack,
      payload: JSON.stringify(payload)
    };

    await db.failedTransactions.add(entry);
    return id;
  },

  async getAll(): Promise<FailedTransactionEntry[]> {
    return db.failedTransactions.orderBy('timestamp').reverse().toArray();
  }
};

/**
 * Repository managing materialized daily KPIs for zero-lag dashboard loading
 */
export const KPIRepository = {
  async updateDailyKPI(
    date: string,
    adjustments: {
      sales?: number;
      collections?: number;
      expenses?: number;
      dues?: number;
      profit?: number;
    }
  ): Promise<void> {
    await db.transaction('rw', [db.dailyKPIs], async () => {
      let kpi = await db.dailyKPIs.get(date);
      if (!kpi) {
        kpi = {
          id: date,
          salesAmount: 0,
          collectionAmount: 0,
          expenseAmount: 0,
          duesAmount: 0,
          profitAmount: 0,
          updatedAt: new Date().toISOString()
        };
      }

      kpi.salesAmount = Math.max(0, kpi.salesAmount + (adjustments.sales || 0));
      kpi.collectionAmount = Math.max(0, kpi.collectionAmount + (adjustments.collections || 0));
      kpi.expenseAmount = Math.max(0, kpi.expenseAmount + (adjustments.expenses || 0));
      kpi.duesAmount = kpi.duesAmount + (adjustments.dues || 0);
      kpi.profitAmount = kpi.profitAmount + (adjustments.profit || 0);
      kpi.updatedAt = new Date().toISOString();

      await db.dailyKPIs.put(kpi);
    });
  },

  async getKPIForDate(date: string): Promise<DailyKPIEntry | undefined> {
    return db.dailyKPIs.get(date);
  },

  async getAll(): Promise<DailyKPIEntry[]> {
    return db.dailyKPIs.orderBy('id').toArray();
  }
};

/**
 * Repository holding global configuration settings and operational flags
 */
export const ConfigRegistryRepository = {
  async get(): Promise<ConfigRegistryEntry> {
    let config = await db.configRegistry.get('current');
    if (!config) {
      config = {
        id: 'current',
        lowStockThreshold: 10,
        expiryWarningDays: 30,
        defaultPrinterWidth: '80mm',
        allowCreditOverLimit: false
      };
      await db.configRegistry.add(config);
    }
    return config;
  },

  async update(updates: Partial<Omit<ConfigRegistryEntry, 'id'>>): Promise<void> {
    const current = await this.get();
    const updated = { ...current, ...updates };
    await db.configRegistry.put(updated);
  }
};

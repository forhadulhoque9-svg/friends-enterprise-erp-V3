import { db } from '../db/db';
import { 
  SalesInvoice, 
  PurchaseInvoice, 
  CompanyIncentive, 
  HawlatTransactionType, 
  SalesTrip, 
  StockLedgerType, 
  CashTransaction 
} from '../types';
import { AuditRepository, FailedTransactionRepository, KPIRepository } from '../db/repositories';
import { generateULID } from '../utils/helpers';

/**
 * Reusable Centralized Stock Ledger Recording Helper
 */
export async function recordStockLedger(
  productId: string, 
  type: StockLedgerType, 
  refId: string, 
  qtyIn: number, 
  qtyOut: number, 
  date: string, 
  remarks: string
): Promise<number> {
  const prod = await db.products.get(productId);
  if (!prod) throw new Error(`Product ${productId} not found`);

  const oldStock = prod.stock || 0;
  const oldStockInPcs = prod.stockInPcs !== undefined ? prod.stockInPcs : oldStock;
  const newStock = Math.max(0, oldStock + qtyIn - qtyOut);
  const newStockInPcs = Math.max(0, oldStockInPcs + qtyIn - qtyOut);
  await db.products.update(productId, { stock: newStock, stockInPcs: newStockInPcs });

  const entryId = `st_${type.toLowerCase().replace(/ /g, '_')}_${refId}_${productId}_${Date.now()}`;
  await db.stockLedgers.add({
    id: entryId,
    productId,
    productName: prod.name,
    date,
    type,
    refId,
    qtyIn,
    qtyOut,
    balance: newStock,
    remarks
  });

  await AuditRepository.log(
    'ADJUST',
    'products',
    productId,
    { stock: oldStock },
    { stock: newStock }
  );

  return newStock;
}

/**
 * Reusable Centralized Cash Transaction Recording Helper
 */
export async function recordCashTransaction(
  date: string,
  type: 'Sales_Collection' | 'Purchase_Payment' | 'Hawlat_Cash' | 'Expense' | 'Other' | 'Hawlat_Custody_Out' | 'Bank_Deposit_In',
  refId: string,
  cashIn: number,
  cashOut: number,
  remarks: string
): Promise<number> {
  const allCashTx = await db.cashBook.toArray();
  const lastTx = allCashTx.length > 0 ? allCashTx[allCashTx.length - 1] : null;
  const currentCash = lastTx ? (lastTx.balance ?? lastTx.balanceAfter ?? 0) : 0; // Clean opening cash 0 BDT
  const newBalance = currentCash + cashIn - cashOut;

  const txId = `cash_${Date.now()}_${refId}`;
  await db.cashBook.add({
    id: txId,
    date,
    type,
    refId,
    cashIn,
    cashOut,
    balance: newBalance,
    balanceAfter: newBalance,
    remarks
  });

  // Increment daily KPIs
  await KPIRepository.updateDailyKPI(date, {
    collections: cashIn,
    expenses: type === 'Expense' ? cashOut : 0
  });

  return newBalance;
}

/**
 * Centralized Enterprise Transaction Engine
 */
export const TransactionEngine = {
  /**
   * Atomic transaction helper for Sales Invoice (Supports single customer or Master Invoice with Multiple Customer Dues)
   */
  async postSalesInvoice(invoice: SalesInvoice): Promise<void> {
    const payload = { invoice };
    try {
      await db.transaction('rw', [
        db.salesInvoices, 
        db.products, 
        db.stockLedgers,
        db.customers, 
        db.customerLedgers, 
        db.cashBook,
        db.auditLogs,
        db.dailyKPIs
      ], async () => {
        // 1. Add the invoice
        await db.salesInvoices.add(invoice);

        // 2. Adjust product stock using generic stock engine
        for (const item of invoice.items) {
          await recordStockLedger(
            item.productId, 
            'Sale', 
            invoice.id, 
            0, 
            item.qty || item.baseQty || item.quantity || 0, 
            invoice.date, 
            `Sales Invoice #${invoice.invoiceNo}`
          );
        }

        // 3. Process Customer Ledger Balance Updates
        if (invoice.customerDuesBreakdown && invoice.customerDuesBreakdown.length > 0) {
          // Master Load Invoice: Automatically update each specified customer's ledger balance with their due amount
          for (const dueEntry of invoice.customerDuesBreakdown) {
            if (!dueEntry.customerId || dueEntry.dueAmount <= 0) continue;

            const cust = await db.customers.get(dueEntry.customerId);
            if (cust) {
              const oldOutstanding = cust.outstandingBalance || 0;
              const newOutstanding = oldOutstanding + dueEntry.dueAmount;
              const ledgerId = `cl_due_master_${invoice.id}_${cust.id}_${Date.now()}`;

              await db.customerLedgers.add({
                id: ledgerId,
                customerId: cust.id,
                date: invoice.date,
                type: 'Invoice',
                refId: invoice.id,
                debit: dueEntry.dueAmount,
                credit: 0,
                balance: newOutstanding,
                remarks: `Master Load Invoice #${invoice.invoiceNo} Due Allocation (${invoice.customerName || 'Route Bulk Delivery'})`
              });

              await db.customers.update(cust.id, {
                outstandingBalance: newOutstanding
              });

              await AuditRepository.log(
                'UPDATE',
                'customers',
                cust.id,
                { outstandingBalance: oldOutstanding },
                { outstandingBalance: newOutstanding }
              );
            }
          }
        } else if (invoice.customerId && invoice.customerId !== 'cash_customer') {
          // Standard Single Customer Invoice
          const customer = await db.customers.get(invoice.customerId);
          if (customer) {
            const oldOutstanding = customer.outstandingBalance || 0;
            let runningOutstanding = oldOutstanding;

            // Debit full invoice
            runningOutstanding += invoice.netTotal;
            const invoiceLedgerId = `cl_inv_${invoice.id}`;
            await db.customerLedgers.add({
              id: invoiceLedgerId,
              customerId: invoice.customerId,
              date: invoice.date,
              type: 'Invoice',
              refId: invoice.id,
              debit: invoice.netTotal,
              credit: 0,
              balance: runningOutstanding,
              remarks: `Sales Invoice #${invoice.invoiceNo}`
            });

            // Credit cash payment if any
            if (invoice.cashPaid > 0) {
              runningOutstanding -= invoice.cashPaid;
              const paymentLedgerId = `cl_pay_${invoice.id}`;
              await db.customerLedgers.add({
                id: paymentLedgerId,
                customerId: invoice.customerId,
                date: invoice.date,
                type: 'Payment',
                refId: invoice.id,
                debit: 0,
                credit: invoice.cashPaid,
                balance: runningOutstanding,
                remarks: `Cash collection against Invoice #${invoice.invoiceNo}`
              });
            }

            await db.customers.update(invoice.customerId, {
              outstandingBalance: runningOutstanding
            });

            await AuditRepository.log(
              'UPDATE',
              'customers',
              invoice.customerId,
              { outstandingBalance: oldOutstanding },
              { outstandingBalance: runningOutstanding }
            );
          }
        }

        // 4. Record Cash Collection in Cash Book if cash paid
        if (invoice.cashPaid > 0) {
          await recordCashTransaction(
            invoice.date,
            'Sales_Collection',
            invoice.id,
            invoice.cashPaid,
            0,
            `Collection for Invoice #${invoice.invoiceNo} (${invoice.customerName || 'Sales Collection'})`
          );
        }

        // 5. Update Daily KPI
        const totalDue = invoice.dueAmount ?? (invoice.netTotal - invoice.cashPaid);
        await KPIRepository.updateDailyKPI(invoice.date, {
          sales: invoice.netTotal,
          dues: Math.max(0, totalDue)
        });

        // 6. Audit Trail
        await AuditRepository.log(
          'CREATE',
          'salesInvoices',
          invoice.id,
          null,
          invoice
        );
      });
    } catch (error) {
      await FailedTransactionRepository.log('postSalesInvoice', error, payload);
      throw error;
    }
  },

  /**
   * Atomic transaction helper for Purchase Invoice
   */
  async postPurchaseInvoice(invoice: PurchaseInvoice): Promise<void> {
    const payload = { invoice };
    try {
      await db.transaction('rw', [
        db.purchaseInvoices, 
        db.products, 
        db.stockLedgers,
        db.companies, 
        db.companyLedgers, 
        db.cashBook,
        db.auditLogs,
        db.dailyKPIs
      ], async () => {
        // 1. Add purchase invoice
        await db.purchaseInvoices.add(invoice);

        // 2. Adjust product stock using generic stock engine
        for (const item of invoice.items) {
          await recordStockLedger(
            item.productId, 
            'Purchase', 
            invoice.id, 
            item.qty, 
            0, 
            invoice.date, 
            `Purchase Bill #${invoice.purchaseNo}`
          );
        }

        // 3. Get Company
        const company = await db.companies.get(invoice.companyId);
        if (!company) throw new Error(`Company ${invoice.companyId} not found`);

        const oldOwed = company.outstandingBalance;
        let runningOwed = oldOwed;

        // 4. Create Company Ledger Entry (Credit)
        runningOwed += invoice.totalAmount;
        const purchaseLedgerId = `com_l_pur_${invoice.id}`;
        await db.companyLedgers.add({
          id: purchaseLedgerId,
          companyId: invoice.companyId,
          date: invoice.date,
          type: 'Purchase',
          refId: invoice.id,
          debit: 0,
          credit: invoice.totalAmount,
          balance: runningOwed,
          remarks: `Purchase Bill #${invoice.purchaseNo}`
        });

        // 5. If cash paid, record Payment Ledger Entry (Debit) and Cash Book transaction
        if (invoice.cashPaid > 0) {
          runningOwed -= invoice.cashPaid;
          const paymentLedgerId = `com_l_pay_${invoice.id}`;
          await db.companyLedgers.add({
            id: paymentLedgerId,
            companyId: invoice.companyId,
            date: invoice.date,
            type: 'Payment',
            refId: invoice.id,
            debit: invoice.cashPaid,
            credit: 0,
            balance: runningOwed,
            remarks: `Payment against Purchase Bill #${invoice.purchaseNo}`
          });

          // Update cash book using generic cash engine
          await recordCashTransaction(
            invoice.date,
            'Purchase_Payment',
            invoice.id,
            0,
            invoice.cashPaid,
            `Payment to company: ${company.name} for Purchase #${invoice.purchaseNo}`
          );
        }

        // 6. Update Company outstanding
        await db.companies.update(invoice.companyId, {
          outstandingBalance: runningOwed
        });

        // Audit Trail
        await AuditRepository.log(
          'CREATE',
          'purchaseInvoices',
          invoice.id,
          null,
          invoice
        );

        await AuditRepository.log(
          'UPDATE',
          'companies',
          invoice.companyId,
          { outstandingBalance: oldOwed },
          { outstandingBalance: runningOwed }
        );
      });
    } catch (error) {
      await FailedTransactionRepository.log('postPurchaseInvoice', error, payload);
      throw error;
    }
  },

  /**
   * Atomic transaction for manual customer payments/collection
   */
  async postCustomerPayment(customerId: string, amount: number, date: string, remarks: string): Promise<void> {
    const payload = { customerId, amount, date, remarks };
    try {
      await db.transaction('rw', [db.customers, db.customerLedgers, db.cashBook, db.auditLogs, db.dailyKPIs], async () => {
        const customer = await db.customers.get(customerId);
        if (!customer) throw new Error('Customer not found');

        const oldOutstanding = customer.outstandingBalance;
        const newOutstanding = oldOutstanding - amount;
        const refId = `pay_manual_${Date.now()}`;

        await db.customerLedgers.add({
          id: `cl_pay_man_${refId}`,
          customerId,
          date,
          type: 'Payment',
          refId,
          debit: 0,
          credit: amount,
          balance: newOutstanding,
          remarks: remarks || 'Direct Cash Receipt'
        });

        await recordCashTransaction(
          date,
          'Sales_Collection',
          refId,
          amount,
          0,
          `Direct Cash collection from ${customer.name}: ${remarks}`
        );

        await db.customers.update(customerId, {
          outstandingBalance: newOutstanding
        });

        // Audit Trail
        await AuditRepository.log(
          'CREATE',
          'customerLedgers',
          `cl_pay_man_${refId}`,
          null,
          { customerId, amount, date, remarks }
        );

        await AuditRepository.log(
          'UPDATE',
          'customers',
          customerId,
          { outstandingBalance: oldOutstanding },
          { outstandingBalance: newOutstanding }
        );
      });
    } catch (error) {
      await FailedTransactionRepository.log('postCustomerPayment', error, payload);
      throw error;
    }
  },

  /**
   * Atomic transaction for manual company payments
   */
  async postCompanyPayment(companyId: string, amount: number, date: string, remarks: string): Promise<void> {
    const payload = { companyId, amount, date, remarks };
    try {
      await db.transaction('rw', [db.companies, db.companyLedgers, db.cashBook, db.auditLogs, db.dailyKPIs], async () => {
        const company = await db.companies.get(companyId);
        if (!company) throw new Error('Company not found');

        const oldOutstanding = company.outstandingBalance;
        const newOutstanding = oldOutstanding - amount;
        const refId = `pay_com_manual_${Date.now()}`;

        await db.companyLedgers.add({
          id: `com_pay_man_${refId}`,
          companyId,
          date,
          type: 'Payment',
          refId,
          debit: amount,
          credit: 0,
          balance: newOutstanding,
          remarks: remarks || 'Direct Cash Payment'
        });

        await recordCashTransaction(
          date,
          'Purchase_Payment',
          refId,
          0,
          amount,
          `Direct Cash payment to ${company.name}: ${remarks}`
        );

        await db.companies.update(companyId, {
          outstandingBalance: newOutstanding
        });

        // Audit Trail
        await AuditRepository.log(
          'CREATE',
          'companyLedgers',
          `com_pay_man_${refId}`,
          null,
          { companyId, amount, date, remarks }
        );

        await AuditRepository.log(
          'UPDATE',
          'companies',
          companyId,
          { outstandingBalance: oldOutstanding },
          { outstandingBalance: newOutstanding }
        );
      });
    } catch (error) {
      await FailedTransactionRepository.log('postCompanyPayment', error, payload);
      throw error;
    }
  },

  /**
   * Atomic transaction for Company Damage approval
   */
  async approveDamageReturn(damageId: string): Promise<void> {
    const payload = { damageId };
    try {
      await db.transaction('rw', [db.companyDamages, db.companies, db.companyLedgers, db.auditLogs], async () => {
        const damage = await db.companyDamages.get(damageId);
        if (!damage) throw new Error('Damage record not found');
        if (damage.status !== 'Pending') return; // Already processed

        // Update status to Approved
        await db.companyDamages.update(damageId, { status: 'Approved' });

        // Deduct from company ledger (decreases outstanding we owe them)
        const company = await db.companies.get(damage.companyId);
        if (company) {
          const oldOutstanding = company.outstandingBalance;
          const newOutstanding = oldOutstanding - damage.damageValue;
          await db.companyLedgers.add({
            id: `com_damage_app_${damageId}`,
            companyId: damage.companyId,
            date: damage.date,
            type: 'Damage Credit',
            refId: damageId,
            debit: damage.damageValue,
            credit: 0,
            balance: newOutstanding,
            remarks: `Damage Return Approved - Ref: ${damage.productName}`
          });

          await db.companies.update(damage.companyId, {
            outstandingBalance: newOutstanding
          });

          // Audit Trail
          await AuditRepository.log(
            'UPDATE',
            'companyDamages',
            damageId,
            { status: 'Pending' },
            { status: 'Approved' }
          );

          await AuditRepository.log(
            'UPDATE',
            'companies',
            damage.companyId,
            { outstandingBalance: oldOutstanding },
            { outstandingBalance: newOutstanding }
          );
        }
      });
    } catch (error) {
      await FailedTransactionRepository.log('approveDamageReturn', error, payload);
      throw error;
    }
  },

  /**
   * Atomic transaction for Company Damage physical payment/refund
   */
  async settleDamagePayment(damageId: string): Promise<void> {
    const payload = { damageId };
    try {
      await db.transaction('rw', [db.companyDamages, db.cashBook, db.auditLogs, db.dailyKPIs], async () => {
        const damage = await db.companyDamages.get(damageId);
        if (!damage) throw new Error('Damage record not found');
        if (damage.status !== 'Approved') throw new Error('Damage must be Approved first before marking as Paid');

        await db.companyDamages.update(damageId, { status: 'Paid' });

        await recordCashTransaction(
          new Date().toISOString().split('T')[0],
          'Other',
          damageId,
          damage.damageValue,
          0,
          `Cash refund received from ${damage.companyName} for Damage: ${damage.productName}`
        );

        // Audit Trail
        await AuditRepository.log(
          'UPDATE',
          'companyDamages',
          damageId,
          { status: 'Approved' },
          { status: 'Paid' }
        );
      });
    } catch (error) {
      await FailedTransactionRepository.log('settleDamagePayment', error, payload);
      throw error;
    }
  },

  /**
   * Atomic transaction for adding incentive (updates Company Ledger directly)
   */
  async postCompanyIncentive(incentive: CompanyIncentive): Promise<void> {
    const payload = { incentive };
    try {
      await db.transaction('rw', [db.companyIncentives, db.companies, db.companyLedgers, db.auditLogs], async () => {
        await db.companyIncentives.add(incentive);

        const company = await db.companies.get(incentive.companyId);
        if (company) {
          const oldOutstanding = company.outstandingBalance;
          const newOutstanding = oldOutstanding - incentive.amount;
          await db.companyLedgers.add({
            id: `com_inc_${incentive.id}`,
            companyId: incentive.companyId,
            date: incentive.date,
            type: 'Incentive',
            refId: incentive.id,
            debit: incentive.amount,
            credit: 0,
            balance: newOutstanding,
            remarks: `Incentive Recieved: ${incentive.type} - ${incentive.remarks}`
          });

          await db.companies.update(incentive.companyId, {
            outstandingBalance: newOutstanding
          });

          // Audit Trail
          await AuditRepository.log(
            'CREATE',
            'companyIncentives',
            incentive.id,
            null,
            incentive
          );

          await AuditRepository.log(
            'UPDATE',
            'companies',
            incentive.companyId,
            { outstandingBalance: oldOutstanding },
            { outstandingBalance: newOutstanding }
          );
        }
      });
    } catch (error) {
      await FailedTransactionRepository.log('postCompanyIncentive', error, payload);
      throw error;
    }
  },

  /**
   * Atomic transaction for claims settlement
   */
  async settleCompanyClaim(claimId: string): Promise<void> {
    const payload = { claimId };
    try {
      await db.transaction('rw', [db.companyClaims, db.companies, db.companyLedgers, db.auditLogs], async () => {
        const claim = await db.companyClaims.get(claimId);
        if (!claim) throw new Error('Claim not found');
        if (claim.status === 'Settled') return;

        await db.companyClaims.update(claimId, { status: 'Settled' });

        const company = await db.companies.get(claim.companyId);
        if (company) {
          const oldOutstanding = company.outstandingBalance;
          const newOutstanding = oldOutstanding - claim.amount;
          await db.companyLedgers.add({
            id: `com_claim_settle_${claimId}`,
            companyId: claim.companyId,
            date: new Date().toISOString().split('T')[0],
            type: 'Claim Settlement',
            refId: claimId,
            debit: claim.amount,
            credit: 0,
            balance: newOutstanding,
            remarks: `Claim Settled: ${claim.type} - ${claim.remarks}`
          });

          await db.companies.update(claim.companyId, {
            outstandingBalance: newOutstanding
          });

          // Audit Trail
          await AuditRepository.log(
            'UPDATE',
            'companyClaims',
            claimId,
            { status: 'Pending' },
            { status: 'Settled' }
          );

          await AuditRepository.log(
            'UPDATE',
            'companies',
            claim.companyId,
            { outstandingBalance: oldOutstanding },
            { outstandingBalance: newOutstanding }
          );
        }
      });
    } catch (error) {
      await FailedTransactionRepository.log('settleCompanyClaim', error, payload);
      throw error;
    }
  },

  /**
   * Hawlat Transactions Helper
   */
  async postHawlatTransaction(
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
    const payload = { hawlatId, type, cashAmount, productId, productQty, remarks, date, extraDetails };
    try {
      await db.transaction('rw', [
        db.hawlats, 
        db.hawlatLedgers, 
        db.products, 
        db.cashBook,
        db.auditLogs,
        db.dailyKPIs
      ], async () => {
        const hawlat = await db.hawlats.get(hawlatId);
        if (!hawlat) throw new Error('Hawlat entity not found');

        const txId = `hawlat_tx_${Date.now()}`;
        const productBalances = { ...hawlat.productBalances };

        const oldCashBalance = hawlat.cashBalance || 0;
        const oldCustodyBalance = hawlat.custodyBalance || 0;
        let newCashBalance = oldCashBalance;
        let newCustodyBalance = oldCustodyBalance;

        // Handle Custody Deposit
        if (type === 'Cash_Custody_Deposit') {
          if (cashAmount > 0) {
            newCustodyBalance = oldCustodyBalance + cashAmount;
            await recordCashTransaction(
              date,
              'Hawlat_Custody_Out',
              txId,
              0,
              cashAmount,
              `দোকানে টাকা গচ্ছিত রাখা (${hawlat.name}): ${remarks || 'নিরাপদ আমানত'}`
            );
          }
        } 
        // Handle Bank Deposit & Settle
        else if (type === 'Bank_Deposit_Settle') {
          if (cashAmount > 0) {
            newCustodyBalance = Math.max(0, oldCustodyBalance - cashAmount);
            const bankInfoStr = `${extraDetails?.bankName || 'ব্যাংক'} - স্লিপ: ${extraDetails?.bankSlipNo || 'N/A'}`;
            await recordCashTransaction(
              date,
              'Bank_Deposit_In',
              txId,
              cashAmount,
              0,
              `গচ্ছিত টাকা ব্যাংকে জমা (${bankInfoStr}) - হাওলাদার: ${hawlat.name} (${remarks})`
            );
          }
        } 
        // Regular Cash Lending / Borrowing
        else if (type === 'Cash_Lend') {
          newCashBalance = oldCashBalance - Math.abs(cashAmount);
          await recordCashTransaction(
            date,
            'Hawlat_Cash',
            txId,
            0,
            Math.abs(cashAmount),
            `হাওলাত প্রদান (${hawlat.name}): ${remarks}`
          );
        } else if (type === 'Cash_Receive') {
          newCashBalance = oldCashBalance + Math.abs(cashAmount);
          await recordCashTransaction(
            date,
            'Hawlat_Cash',
            txId,
            Math.abs(cashAmount),
            0,
            `হাওলাত গ্রহণ (${hawlat.name}): ${remarks}`
          );
        } else if (type === 'Cash_Settle' || type === 'Mixed_Settle') {
          newCashBalance += cashAmount;
          if (cashAmount !== 0) {
            const inAmt = cashAmount > 0 ? cashAmount : 0;
            const outAmt = cashAmount < 0 ? Math.abs(cashAmount) : 0;
            await recordCashTransaction(
              date,
              'Hawlat_Cash',
              txId,
              inAmt,
              outAmt,
              `হাওলাত ক্যাশ সমন্বয় (${hawlat.name}): ${remarks}`
            );
          }
        }

        let pBalAfter = 0;
        let prodName = '';
        if (productId) {
          const currentPBal = productBalances[productId] || 0;
          let deltaBal = 0;

          if (type === 'Product_Receive') { // We borrowed products (Stock IN to ERP)
            deltaBal = productQty; // We owe them products (+)
          } else if (type === 'Product_Lend') { // We lent products (Stock OUT from ERP)
            deltaBal = -productQty; // They owe us products (-)
          } else if (type === 'Product_Settle' || type === 'Mixed_Settle') {
            deltaBal = productQty;
          }

          productBalances[productId] = currentPBal + deltaBal;
          pBalAfter = productBalances[productId];

          const prod = await db.products.get(productId);
          if (prod) {
            prodName = prod.name;
            const pcsPerCtn = prod.pcsPerCarton || extraDetails?.pcsPerCarton || 1;
            const oldStockInPcs = prod.stockInPcs !== undefined ? prod.stockInPcs : ((prod.stock || 0) * pcsPerCtn);
            
            let stockDeltaPcs = 0;
            if (type === 'Product_Receive') { // Stock IN
              stockDeltaPcs = productQty;
            } else if (type === 'Product_Lend') { // Stock OUT
              stockDeltaPcs = -productQty;
            } else if (type === 'Product_Settle') {
              stockDeltaPcs = productQty;
            }

            if (stockDeltaPcs !== 0) {
              const newStockInPcs = Math.max(0, oldStockInPcs + stockDeltaPcs);
              const newStockCartons = Math.floor(newStockInPcs / pcsPerCtn);

              await db.products.update(productId, {
                stock: newStockCartons,
                stockInPcs: newStockInPcs
              });

              await AuditRepository.log(
                'ADJUST',
                'products',
                productId,
                { stockInPcs: oldStockInPcs },
                { stockInPcs: newStockInPcs }
              );
            }
          }
        }

        // 3. Save Ledger Entry
        await db.hawlatLedgers.add({
          id: `hl_ent_${txId}`,
          hawlatId,
          hawlatName: hawlat.name,
          date,
          type,
          refId: txId,
          cashAmount,
          productId,
          productName: prodName || undefined,
          productQty,
          cartons: extraDetails?.cartons,
          loosePcs: extraDetails?.loosePcs,
          pcsPerCarton: extraDetails?.pcsPerCarton,
          ratePerCarton: extraDetails?.ratePerCarton,
          ratePerPcs: extraDetails?.ratePerPcs,
          totalValue: extraDetails?.totalValue,
          bankName: extraDetails?.bankName,
          bankSlipNo: extraDetails?.bankSlipNo,
          remarks,
          cashBalanceAfter: newCashBalance,
          custodyBalanceAfter: newCustodyBalance,
          productBalanceAfter: pBalAfter
        });

        // 4. Update Hawlat master record
        await db.hawlats.update(hawlatId, {
          cashBalance: newCashBalance,
          custodyBalance: newCustodyBalance,
          productBalances
        });

        // Audit Trail
        await AuditRepository.log(
          'CREATE',
          'hawlatLedgers',
          `hl_ent_${txId}`,
          null,
          payload
        );

        await AuditRepository.log(
          'UPDATE',
          'hawlats',
          hawlatId,
          { cashBalance: oldCashBalance, custodyBalance: oldCustodyBalance },
          { cashBalance: newCashBalance, custodyBalance: newCustodyBalance }
        );
      });
    } catch (error) {
      await FailedTransactionRepository.log('postHawlatTransaction', error, payload);
      throw error;
    }
  },

  /**
   * Settle Hawlat Debt Entirely
   */
  async settleHawlatDebt(
    hawlatId: string,
    settleCash: boolean,
    settleProducts: boolean,
    date: string
  ): Promise<void> {
    const hawlat = await db.hawlats.get(hawlatId);
    if (!hawlat) return;

    if (settleCash && hawlat.cashBalance !== 0) {
      const payAmt = -hawlat.cashBalance; 
      await this.postHawlatTransaction(
        hawlatId,
        'Cash_Settle',
        payAmt,
        undefined,
        0,
        `Full Settlement of Cash Hawlat (${payAmt > 0 ? 'Received Cash' : 'Paid Cash'})`,
        date
      );
    }

    if (settleProducts) {
      const activeProducts = Object.entries(hawlat.productBalances).filter(([_, qty]) => qty !== 0);
      for (const [pId, qty] of activeProducts) {
        const payQty = -qty; 
        await this.postHawlatTransaction(
          hawlatId,
          'Product_Settle',
          0,
          pId,
          payQty,
          `Full Settlement of Product Hawlat (${payQty > 0 ? 'Received Products' : 'Returned Products'})`,
          date
        );
      }
    }
  },

  /**
   * Reusable Centralized Expense Entry Helper
   */
  async postExpense(
    date: string,
    category: string,
    amount: number,
    remarks: string,
    paidBy?: string
  ): Promise<void> {
    const payload = { date, category, amount, remarks, paidBy };
    try {
      await db.transaction('rw', [db.expenses, db.cashBook, db.auditLogs, db.dailyKPIs], async () => {
        const expenseId = crypto.randomUUID();
        await db.expenses.add({
          id: expenseId,
          date,
          category,
          amount,
          remarks,
          paidBy
        });

        await recordCashTransaction(
          date,
          'Expense',
          expenseId,
          0,
          amount,
          `[Expense: ${category}] ${remarks}`
        );

        // Audit Trail
        await AuditRepository.log(
          'CREATE',
          'expenses',
          expenseId,
          null,
          payload
        );
      });
    } catch (error) {
      await FailedTransactionRepository.log('postExpense', error, payload);
      throw error;
    }
  },

  /**
   * Multi-shop due system collection helper
   */
  async postShopCollection(
    shopId: string, 
    amount: number, 
    date: string, 
    remarks: string
  ): Promise<void> {
    const payload = { shopId, amount, date, remarks };
    try {
      await db.transaction('rw', [db.shops, db.shopLedgers, db.cashBook, db.auditLogs, db.dailyKPIs], async () => {
        const shop = await db.shops.get(shopId);
        if (!shop) throw new Error('Shop not found');

        const oldDue = shop.totalDue;
        const newDue = oldDue - amount;
        const refId = `shop_coll_${Date.now()}`;

        await db.shopLedgers.add({
          id: `sl_coll_${refId}`,
          shopId,
          date,
          type: 'Collection',
          refId,
          debit: 0,
          credit: amount,
          balance: newDue,
          remarks: remarks || 'Direct Shop Due Collection'
        });

        await recordCashTransaction(
          date,
          'Sales_Collection',
          refId,
          amount,
          0,
          `Collection from Shop: ${shop.shopName} - ${remarks}`
        );

        await db.shops.update(shopId, {
          totalDue: newDue
        });

        // Audit Trail
        await AuditRepository.log(
          'CREATE',
          'shopLedgers',
          `sl_coll_${refId}`,
          null,
          payload
        );

        await AuditRepository.log(
          'UPDATE',
          'shops',
          shopId,
          { totalDue: oldDue },
          { totalDue: newDue }
        );
      });
    } catch (error) {
      await FailedTransactionRepository.log('postShopCollection', error, payload);
      throw error;
    }
  },

  /**
   * Atomic sales trip post
   */
  async postSalesTrip(trip: SalesTrip): Promise<void> {
    const payload = { trip };
    try {
      await db.transaction('rw', [
        db.salesTrips, 
        db.shops, 
        db.shopLedgers, 
        db.cashBook,
        db.auditLogs,
        db.dailyKPIs
      ], async () => {
        // 1. Save Sales Trip record
        await db.salesTrips.add(trip);

        // 2. Loop through shop due entries and post to each independent shop ledger
        for (const entry of trip.dueEntries) {
          const shop = await db.shops.get(entry.shopId);
          if (!shop) continue;

          const oldDue = shop.totalDue;
          let currentShopDue = oldDue;

          // If new due is added from sales in this trip
          if (entry.newDue > 0) {
            currentShopDue += entry.newDue;
            await db.shopLedgers.add({
              id: `sl_trip_sale_${trip.id}_${entry.shopId}`,
              shopId: entry.shopId,
              date: trip.date,
              type: 'Sale',
              refId: trip.id,
              debit: entry.newDue,
              credit: 0,
              balance: currentShopDue,
              remarks: `Invoice/Sale on Route Trip #${trip.tripNo}`
            });
          }

          // If cash was collected from this shop in this trip
          if (entry.cashCollected > 0) {
            currentShopDue -= entry.cashCollected;
            await db.shopLedgers.add({
              id: `sl_trip_coll_${trip.id}_${entry.shopId}`,
              shopId: entry.shopId,
              date: trip.date,
              type: 'Collection',
              refId: trip.id,
              debit: 0,
              credit: entry.cashCollected,
              balance: currentShopDue,
              remarks: `Collection on Route Trip #${trip.tripNo}`
            });
          }

          // Update shop balances
          await db.shops.update(entry.shopId, {
            previousDue: oldDue,
            newDue: entry.newDue,
            totalDue: currentShopDue
          });

          await AuditRepository.log(
            'UPDATE',
            'shops',
            entry.shopId,
            { totalDue: oldDue },
            { totalDue: currentShopDue }
          );
        }

        // 3. Post cash collection to the Cash Ledger if total cash collected > 0
        if (trip.totalCashCollected > 0) {
          await recordCashTransaction(
            trip.date,
            'Sales_Collection',
            trip.id,
            trip.totalCashCollected,
            0,
            `Route Trip #${trip.tripNo} Total Cash Collection (${trip.salesperson})`
          );
        }

        // Audit Trail
        await AuditRepository.log(
          'CREATE',
          'salesTrips',
          trip.id,
          null,
          trip
        );
      });
    } catch (error) {
      await FailedTransactionRepository.log('postSalesTrip', error, payload);
      throw error;
    }
  }
};
